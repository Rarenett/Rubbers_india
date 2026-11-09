import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import SalesService from '../../../services/SalesService';
import { exportIndividualOrderPDF, exportIndividualOrderExcel, printIndividualOrder } from '../Assets/exportUtils';

import { usePageTitle } from '../../../context/TitleContext';

/* ─── Premium Design Tokens ────────────────────────────────────────────────── */
const T = {
    ink: '#0f172a',
    inkMuted: '#334155',
    slate: '#64748b',
    steel: '#94a3b8',
    cloud: '#f1f5f9',
    cloudLight: '#f8fafc',
    white: '#ffffff',
    surface: '#f4f7fc',
    accent: '#3b5bdb',
    accentHover: '#2f4ac7',
    accentSoft: '#edf2ff',
    accentGlow: 'rgba(59, 91, 219, 0.22)',
    gold: '#d97706',
    goldSoft: '#fef3c7',
    emerald: '#059669',
    emeraldSoft: '#d1fae5',
    rose: '#e11d48',
    roseSoft: '#ffe4e6',
    rSm: '8px',
    rMd: '12px',
    rLg: '18px',
    rXl: '24px',
    shSm: '0 1px 3px rgba(15, 23, 42, 0.05), 0 1px 2px rgba(15, 23, 42, 0.03)',
    shMd: '0 4px 16px -2px rgba(15, 23, 42, 0.07), 0 2px 6px -1px rgba(15, 23, 42, 0.04)',
    shLg: '0 12px 32px -4px rgba(15, 23, 42, 0.10), 0 4px 12px -2px rgba(15, 23, 42, 0.05)',
    shAccent: '0 8px 24px -4px rgba(59, 91, 219, 0.35)',
};

const DistributorOrdersList = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [sortBy, setSortBy] = useState('NEWEST');
    const [expandedOrderId, setExpandedOrderId] = useState(null);
    const [orderDetailsCache, setOrderDetailsCache] = useState({});
    const [loadingDetailsId, setLoadingDetailsId] = useState(null);
    const [copiedId, setCopiedId] = useState(null);

    // ── Set title ──────────────────────────────────────────────────────────
    usePageTitle("Distributor Orders List");

    const fetchOrders = useCallback(async (isRefresh = false) => {
        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        try {
            const [salesOrdersRes, ledgersRes] = await Promise.all([
                SalesService.getSalesOrders(),
                SalesService.getLedgers()
            ]);
            const loadedLedgers = Array.isArray(ledgersRes.data) ? ledgersRes.data : [];
            const userDetailsStr = localStorage.getItem('userDetails');
            const currentUser = userDetailsStr ? JSON.parse(userDetailsStr).user : null;

            if (currentUser) {
                const isDistributor = (
                    currentUser.customer_type ||
                    currentUser.customer_info?.customer_type ||
                    currentUser.role?.name ||
                    currentUser.role_name || ''
                ).toLowerCase() === 'distributor';

                if (isDistributor) {
                    let customerLedgerId = '';
                    if (currentUser.customer_info?.ledger_id) {
                        const found = loadedLedgers.find(l => String(l.id) === String(currentUser.customer_info.ledger_id));
                        if (found) customerLedgerId = String(found.id);
                    }
                    if (!customerLedgerId) {
                        const emails = [currentUser.email, currentUser.customer_info?.email].filter(Boolean).map(e => e.trim().toLowerCase());
                        for (const email of emails) {
                            const m = loadedLedgers.find(l => (l.email || '').trim().toLowerCase() === email);
                            if (m) { customerLedgerId = String(m.id); break; }
                        }
                    }
                    if (!customerLedgerId) {
                        const names = [currentUser.customer_info?.name, currentUser.customer_info?.ledger_name, currentUser.name, currentUser.first_name ? `${currentUser.first_name} ${currentUser.last_name || ''}`.trim() : null, currentUser.username].filter(Boolean).map(n => n.trim().toLowerCase());
                        for (const name of names) {
                            const m = loadedLedgers.find(l => (l.name || '').trim().toLowerCase() === name);
                            if (m) { customerLedgerId = String(m.id); break; }
                        }
                    }
                    const allOrders = Array.isArray(salesOrdersRes.data) ? salesOrdersRes.data : [];
                    const myOrders = allOrders.filter(o => String(o.customer_ledger) === customerLedgerId);
                    myOrders.sort((a, b) => new Date(b.created_at || b.entry_date) - new Date(a.created_at || a.entry_date));
                    setOrders(myOrders);
                }
            }
        } catch (err) {
            console.error('Error fetching distributor orders:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        try {
            return new Date(dateStr).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        } catch {
            return dateStr;
        }
    };

    const formatCurrency = (val) => {
        const num = parseFloat(val || 0);
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    };

    const getStatusStyle = (status = 'Pending') => {
        const s = status.toLowerCase();
        if (s.includes('deliver') || s.includes('complet')) {
            return {
                bg: '#ecfdf5',
                color: '#047857',
                border: '#a7f3d0',
                dot: '#10b981',
                label: status
            };
        }
        if (s.includes('cancel') || s.includes('reject') || s.includes('not approved')) {
            return {
                bg: '#fff1f2',
                color: '#be123c',
                border: '#fecdd3',
                dot: '#f43f5e',
                label: status
            };
        }
        if (s.includes('approv') || s.includes('ship')) {
            return {
                bg: '#eff6ff',
                color: '#1d4ed8',
                border: '#bfdbfe',
                dot: '#3b82f6',
                label: status
            };
        }
        return {
            bg: '#fffbeb',
            color: '#b45309',
            border: '#fde68a',
            dot: '#f59e0b',
            label: status || 'Pending'
        };
    };

    const handleExportIndividual = async (order, format) => {
        let fullOrder = orderDetailsCache[order.id] || order;
        try {
            if (!fullOrder.items || !Array.isArray(fullOrder.items) || fullOrder.items.length === 0) {
                const res = await SalesService.getSalesOrderById(order.id);
                if (res && res.data) {
                    fullOrder = res.data;
                    setOrderDetailsCache(prev => ({ ...prev, [order.id]: fullOrder }));
                }
            }
        } catch (err) {
            console.error('Error fetching order details for export:', err);
        }

        if (format === 'pdf') {
            exportIndividualOrderPDF(fullOrder);
        } else if (format === 'excel') {
            exportIndividualOrderExcel(fullOrder);
        } else if (format === 'print') {
            printIndividualOrder(fullOrder);
        }
    };

    const handleToggleExpand = async (orderId) => {
        if (expandedOrderId === orderId) {
            setExpandedOrderId(null);
            return;
        }
        setExpandedOrderId(orderId);

        if (!orderDetailsCache[orderId]) {
            setLoadingDetailsId(orderId);
            try {
                const res = await SalesService.getSalesOrderById(orderId);
                if (res && res.data) {
                    setOrderDetailsCache(prev => ({ ...prev, [orderId]: res.data }));
                }
            } catch (err) {
                console.error('Error loading full order details:', err);
            } finally {
                setLoadingDetailsId(null);
            }
        }
    };

    const handleCopyOrderNo = (orderNo, orderId) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(orderNo);
            setCopiedId(orderId);
            setTimeout(() => setCopiedId(null), 2000);
        }
    };

    /* ── Filtered & Sorted Orders ───────────────────────────────────────────── */
    const filteredOrders = useMemo(() => {
        let list = [...orders];

        // Search Filter
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            list = list.filter(o =>
                (o.so_no || '').toLowerCase().includes(term) ||
                (o.delivery_location || '').toLowerCase().includes(term) ||
                (o.narration || '').toLowerCase().includes(term) ||
                (o.status || '').toLowerCase().includes(term)
            );
        }

        // Status Filter
        if (statusFilter !== 'ALL') {
            list = list.filter(o => {
                const st = (o.status || 'Pending').toLowerCase();
                if (statusFilter === 'Pending') return st.includes('pending') || st.includes('draft');
                if (statusFilter === 'Approved') return st.includes('approv') || st.includes('ship');
                if (statusFilter === 'Delivered') return st.includes('deliver') || st.includes('complet');
                if (statusFilter === 'Cancelled') return st.includes('cancel') || st.includes('reject');
                return true;
            });
        }

        // Sort
        list.sort((a, b) => {
            const dateA = new Date(a.entry_date || a.created_at || 0);
            const dateB = new Date(b.entry_date || b.created_at || 0);
            const amtA = parseFloat(a.total_amount || 0);
            const amtB = parseFloat(b.total_amount || 0);

            if (sortBy === 'NEWEST') return dateB - dateA;
            if (sortBy === 'OLDEST') return dateA - dateB;
            if (sortBy === 'AMOUNT_HIGH') return amtB - amtA;
            if (sortBy === 'AMOUNT_LOW') return amtA - amtB;
            return 0;
        });

        return list;
    }, [orders, searchTerm, statusFilter, sortBy]);

    /* ── KPI Summary Calculations ───────────────────────────────────────────── */
    const stats = useMemo(() => {
        let pending = 0;
        let delivered = 0;
        let totalAmount = 0;
        orders.forEach(o => {
            const st = (o.status || '').toLowerCase();
            if (st.includes('deliver')) delivered++;
            else if (st.includes('cancel')) {} // ignore cancelled in pending
            else pending++;

            totalAmount += parseFloat(o.total_amount || 0);
        });
        return {
            totalCount: orders.length,
            pendingCount: pending,
            deliveredCount: delivered,
            totalValue: totalAmount
        };
    }, [orders]);

    /* ── Status Tab Counters ────────────────────────────────────────────────── */
    const tabCounts = useMemo(() => {
        const counts = { ALL: orders.length, Pending: 0, Approved: 0, Delivered: 0, Cancelled: 0 };
        orders.forEach(o => {
            const st = (o.status || 'Pending').toLowerCase();
            if (st.includes('deliver')) counts.Delivered++;
            else if (st.includes('approv') || st.includes('ship')) counts.Approved++;
            else if (st.includes('cancel')) counts.Cancelled++;
            else counts.Pending++;
        });
        return counts;
    }, [orders]);

    /* ── Loading Screen ─────────────────────────────────────────────────────── */
    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: T.surface, gap: '24px' }}>
                <style>{`
                    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap');
                    @keyframes spin  { to { transform:rotate(360deg) } }
                    @keyframes pulse { 0%,100%{ opacity:1 } 50%{ opacity:.45 } }
                `}</style>
                <div style={{
                    width: '56px', height: '56px',
                    border: `4px solid ${T.cloud}`, borderTopColor: T.accent,
                    borderRadius: '50%', animation: 'spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite',
                    boxShadow: '0 4px 16px rgba(59,91,219,0.18)'
                }} />
                <div style={{ textAlign: 'center' }}>
                    <p style={{ color: T.ink, fontWeight: '700', fontSize: '1.08rem', margin: '0 0 6px', fontFamily: "'DM Sans',sans-serif" }}>Loading Your Orders</p>
                    <p style={{ color: T.slate, fontSize: '0.85rem', margin: 0, fontFamily: "'DM Sans',sans-serif", animation: 'pulse 2s ease infinite' }}>Connecting to distributor ledger history…</p>
                </div>
            </div>
        );
    }

    /* ── Main Render ────────────────────────────────────────────────────────── */
    return (
        <div style={{
            background: T.surface,
            minHeight: '100vh',
            fontFamily: "'DM Sans', 'Inter', -apple-system, sans-serif",
            color: T.ink,
            paddingBottom: '48px',
        }}>
            {/* ── Global Styles ───────────────────────────────────────────── */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=DM+Serif+Display&display=swap');
                @keyframes spin      { to { transform:rotate(360deg) } }
                @keyframes slideUp   { from { transform:translateY(12px);opacity:0 } to { transform:translateY(0);opacity:1 } }
                @keyframes fadeIn    { from { opacity:0 } to { opacity:1 } }
                @keyframes pulseSlow { 0%,100% { opacity:0.6; transform:scale(1) } 50% { opacity:1; transform:scale(1.04) } }

                * { box-sizing: border-box; }
                .dol-card {
                    animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
                    background: ${T.white};
                    border-radius: ${T.rXl};
                    padding: 22px 24px;
                    box-shadow: ${T.shSm};
                    border: 1px solid rgba(15, 23, 42, 0.08);
                    margin-bottom: 16px;
                    transition: all 0.22s ease;
                }
                .dol-card:hover {
                    box-shadow: ${T.shLg};
                    transform: translateY(-2px);
                    border-color: rgba(59, 91, 219, 0.24);
                }
                .dol-new-btn {
                    background: linear-gradient(135deg, ${T.accent} 0%, #4d6fe8 100%);
                    border: none;
                    color: #fff;
                    padding: 10px 22px;
                    border-radius: 14px;
                    font-size: 0.88rem;
                    font-weight: 700;
                    cursor: pointer;
                    box-shadow: ${T.shAccent};
                    white-space: nowrap;
                    font-family: inherit;
                    letter-spacing: 0.01em;
                    transition: all 0.2s ease;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                }
                .dol-new-btn:hover {
                    opacity: 0.96;
                    transform: translateY(-2px);
                    box-shadow: 0 10px 28px rgba(59, 91, 219, 0.45) !important;
                }
                .dol-action-btn {
                    background: ${T.white};
                    border: 1px solid rgba(15, 23, 42, 0.12);
                    border-radius: 8px;
                    padding: 6px 12px;
                    font-size: 0.77rem;
                    font-weight: 600;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    transition: all 0.18s ease;
                    font-family: inherit;
                }
                .dol-action-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 3px 8px rgba(15, 23, 42, 0.08);
                }
                .dol-action-btn.pdf:hover   { border-color: #f43f5e; color: #e11d48; background: #fff1f2; }
                .dol-action-btn.excel:hover { border-color: #10b981; color: #059669; background: #ecfdf5; }
                .dol-action-btn.print:hover { border-color: #3b82f6; color: #2563eb; background: #eff6ff; }
                .dol-tab {
                    padding: 8px 16px;
                    border-radius: 99px;
                    font-size: 0.82rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.18s ease;
                    border: 1px solid transparent;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    white-space: nowrap;
                    background: transparent;
                    color: ${T.slate};
                }
                .dol-tab:hover {
                    color: ${T.ink};
                    background: rgba(15, 23, 42, 0.05);
                }
                .dol-tab.active {
                    background: ${T.ink};
                    color: ${T.white};
                    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
                }
                .dol-input {
                    width: 100%;
                    border: 1px solid rgba(15, 23, 42, 0.12);
                    border-radius: 12px;
                    padding: 10px 14px 10px 40px;
                    font-size: 0.88rem;
                    color: ${T.ink};
                    background: ${T.white};
                    outline: none;
                    transition: all 0.18s ease;
                    font-family: inherit;
                }
                .dol-input:focus {
                    border-color: ${T.accent};
                    box-shadow: 0 0 0 4px ${T.accentGlow};
                }
                .dol-select {
                    border: 1px solid rgba(15, 23, 42, 0.12);
                    border-radius: 10px;
                    padding: 8px 14px;
                    font-size: 0.82rem;
                    font-weight: 600;
                    color: ${T.ink};
                    background: ${T.white};
                    outline: none;
                    cursor: pointer;
                    font-family: inherit;
                    transition: all 0.18s ease;
                }
                .dol-select:focus {
                    border-color: ${T.accent};
                }
                .dol-details-table {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0;
                    margin-top: 10px;
                }
                .dol-details-table th {
                    background: ${T.cloudLight};
                    color: ${T.slate};
                    font-size: 0.74rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    padding: 10px 14px;
                    text-align: left;
                    border-bottom: 1px solid rgba(15, 23, 42, 0.08);
                }
                .dol-details-table td {
                    padding: 12px 14px;
                    font-size: 0.85rem;
                    color: ${T.ink};
                    border-bottom: 1px solid rgba(15, 23, 42, 0.05);
                }
                .dol-details-table tr:last-child td {
                    border-bottom: none;
                }

                .dol-container {
                    max-width: 1360px;
                    margin-left: auto;
                    margin-right: auto;
                    padding-left: 28px;
                    padding-right: 28px;
                }
                @media (max-width: 768px) {
                    .dol-container {
                        padding-left: 10px !important;
                        padding-right: 10px !important;
                    }
                    .dol-hero-banner {
                        padding: 16px 0 24px !important;
                    }
                    .dol-hero-title {
                        font-size: 1.4rem !important;
                    }
                    .dol-hero-sub {
                        font-size: 0.8rem !important;
                        margin-top: 4px !important;
                    }
                    .dol-header-row {
                        flex-direction: row !important;
                        align-items: center !important;
                        justify-content: space-between !important;
                        gap: 12px !important;
                        flex-wrap: nowrap !important;
                    }
                    .dol-new-btn {
                        padding: 8px 12px !important;
                        font-size: 0.8rem !important;
                        flex-shrink: 0 !important;
                    }
                    .dol-stats-strip {
                        margin: -16px auto 16px !important;
                        padding: 12px 14px !important;
                        border-radius: 14px !important;
                    }
                    .dol-stats-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                        gap: 12px 8px !important;
                    }
                    .dol-stat-item {
                        padding: 4px 6px !important;
                        border-right: none !important;
                    }
                    .dol-stat-label {
                        font-size: 0.72rem !important;
                    }
                    .dol-stat-value {
                        font-size: 1.15rem !important;
                    }
                    .dol-toolbar {
                        padding: 10px 12px !important;
                        gap: 10px !important;
                    }
                    .dol-toolbar-row1 {
                        display: flex !important;
                        width: 100% !important;
                        gap: 8px !important;
                        align-items: center !important;
                    }
                    .dol-search-wrapper {
                        flex: 1 1 auto !important;
                        max-width: 100% !important;
                    }
                    .dol-select {
                        width: 130px !important;
                        flex-shrink: 0 !important;
                        font-size: 0.8rem !important;
                        padding: 7px 10px !important;
                    }
                    .dol-tabs-container {
                        width: 100% !important;
                        overflow-x: auto !important;
                        -webkit-overflow-scrolling: touch !important;
                        padding: 3px !important;
                        gap: 4px !important;
                        scrollbar-width: none;
                    }
                    .dol-tabs-container::-webkit-scrollbar {
                        display: none;
                    }
                    .dol-tab {
                        white-space: nowrap !important;
                        flex-shrink: 0 !important;
                        padding: 6px 12px !important;
                        font-size: 0.78rem !important;
                    }
                    .dol-card-left {
                        flex: 1 1 100% !important;
                        min-width: 0 !important;
                    }
                    .dol-card-right {
                        width: 100% !important;
                        flex-direction: row !important;
                        align-items: center !important;
                        justify-content: space-between !important;
                        border-top: 1px dashed rgba(15, 23, 42, 0.08);
                        padding-top: 10px !important;
                        margin-top: 4px !important;
                    }
                }
                @media (max-width: 480px) {
                    .dol-container {
                        padding-left: 6px !important;
                        padding-right: 6px !important;
                    }
                    .dol-hero-title {
                        font-size: 1.25rem !important;
                    }
                    .dol-stat-value {
                        font-size: 1.05rem !important;
                    }
                    .dol-card {
                        padding: 14px 12px !important;
                    }
                }
                .dol-hdr-btn-primary:hover,
                .dol-hdr-btn-secondary:hover {
                    background: rgba(255, 255, 255, 0.2) !important;
                }
            `}</style>

            {/* ── Form-Style Header Banner ─────────────────────────────────── */}
            <div
                className="dol-hero-banner"
                style={{
                    background: 'linear-gradient(160deg, #0f1e45 0%, #1a2f6b 55%, #243580 100%)',
                    padding: '24px 0 24px',
                    borderBottomLeftRadius: '32px',
                    borderBottomRightRadius: '32px',
                    color: T.white,
                    boxShadow: '0 12px 36px rgba(15,30,69,0.22)',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Decorative concentric arcs */}
                <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '280px', height: '280px', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '180px', height: '180px', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

                <div className="dol-container" style={{ position: 'relative', zIndex: 2 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap', gap: '12px' }}>
                        {/* Left: badge + title */}
                        <div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(201,168,76,0.14)', border: '1px solid rgba(201,168,76,0.28)', borderRadius: '20px', padding: '3px 10px', marginBottom: '10px' }}>
                                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: T.gold, display: 'inline-block' }} />
                                <span style={{ fontSize: '0.63rem', fontWeight: '700', letterSpacing: '0.09em', color: T.gold, textTransform: 'uppercase' }}>Distributor Connect</span>
                            </div>
                            <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: '1.7rem', fontWeight: '400', margin: '0', letterSpacing: '-0.01em', lineHeight: 1.15, color: T.white }}>
                                My Orders
                            </h1>
                        </div>

                        {/* Right: date on top, new order and back buttons below */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                            <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,255,255,0.48)', fontWeight: '400', whiteSpace: 'nowrap' }}>
                                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </p>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    className="dol-hdr-btn-primary"
                                    onClick={() => navigate('/sales-order-distributor')}
                                    style={{
                                        background: 'rgba(59,91,219,0.2)', border: '1px solid rgba(59,91,219,0.4)',
                                        color: '#fff', padding: '7px 14px', borderRadius: '12px',
                                        fontSize: '0.77rem', fontWeight: '600', cursor: 'pointer',
                                        backdropFilter: 'blur(6px)', whiteSpace: 'nowrap',
                                        fontFamily: 'inherit', letterSpacing: '0.01em', transition: 'background 0.18s',
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                    }}
                                >
                                    <span>+ New Order</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Unified Overview & Search Control Center ─────────────────── */}
            <div className="dol-container" style={{ margin: '18px auto 20px', position: 'relative', zIndex: 10 }}>
                <div
                    className="dol-stats-strip"
                    style={{
                        background: T.white,
                        borderRadius: T.rXl,
                        padding: '18px 22px',
                        boxShadow: T.shMd,
                        border: '1px solid rgba(15, 23, 42, 0.08)',
                    }}
                >
                    <div
                        className="dol-stats-grid"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: '16px',
                            alignItems: 'center',
                        }}
                    >
                        {/* Stat 1: Total */}
                        <div className="dol-stat-item" style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            borderRight: '1px solid rgba(15, 23, 42, 0.06)',
                            paddingRight: '12px',
                        }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '12px',
                                background: '#eff6ff', color: '#3b82f6',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.2rem', flexShrink: 0
                            }}>
                                📦
                            </div>
                            <div>
                                <p className="dol-stat-label" style={{ margin: 0, fontSize: '0.76rem', color: T.slate, fontWeight: '600' }}>
                                    Total
                                </p>
                                <h4 className="dol-stat-value" style={{ margin: '2px 0 0', fontSize: '1.35rem', fontWeight: '800', color: T.ink }}>
                                    {stats.totalCount}
                                </h4>
                            </div>
                        </div>

                        {/* Stat 2: Pending */}
                        <div className="dol-stat-item" style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            borderRight: '1px solid rgba(15, 23, 42, 0.06)',
                            paddingRight: '12px',
                        }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '12px',
                                background: '#fffbeb', color: '#d97706',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.2rem', flexShrink: 0
                            }}>
                                ⏳
                            </div>
                            <div>
                                <p className="dol-stat-label" style={{ margin: 0, fontSize: '0.76rem', color: T.slate, fontWeight: '600' }}>
                                    Pending
                                </p>
                                <h4 className="dol-stat-value" style={{ margin: '2px 0 0', fontSize: '1.35rem', fontWeight: '800', color: '#d97706' }}>
                                    {stats.pendingCount}
                                </h4>
                            </div>
                        </div>

                        {/* Stat 3: Delivered */}
                        <div className="dol-stat-item" style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            borderRight: '1px solid rgba(15, 23, 42, 0.06)',
                            paddingRight: '12px',
                        }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '12px',
                                background: '#ecfdf5', color: '#059669',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.2rem', flexShrink: 0
                            }}>
                                ✅
                            </div>
                            <div>
                                <p className="dol-stat-label" style={{ margin: 0, fontSize: '0.76rem', color: T.slate, fontWeight: '600' }}>
                                    Delivered
                                </p>
                                <h4 className="dol-stat-value" style={{ margin: '2px 0 0', fontSize: '1.35rem', fontWeight: '800', color: '#059669' }}>
                                    {stats.deliveredCount}
                                </h4>
                            </div>
                        </div>

                        {/* Stat 4: Value */}
                        <div className="dol-stat-item" style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                        }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '12px',
                                background: '#e0e7ff', color: '#4338ca',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.2rem', flexShrink: 0
                            }}>
                                💰
                            </div>
                            <div>
                                <p className="dol-stat-label" style={{ margin: 0, fontSize: '0.76rem', color: T.slate, fontWeight: '600' }}>
                                    Value
                                </p>
                                <h4 className="dol-stat-value" style={{ margin: '2px 0 0', fontSize: '1.35rem', fontWeight: '800', color: T.accent }}>
                                    {formatCurrency(stats.totalValue)}
                                </h4>
                            </div>
                        </div>
                    </div>

                    {/* Integrated Sleek Search Bar */}
                    <div style={{
                        borderTop: '1px dashed rgba(15, 23, 42, 0.08)',
                        paddingTop: '14px',
                        marginTop: '14px',
                    }}>
                        <div className="dol-search-wrapper" style={{ position: 'relative', width: '100%' }}>
                            <svg
                                style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: T.slate, pointerEvents: 'none' }}
                                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                            >
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                            <input
                                type="text"
                                className="dol-input"
                                style={{
                                    paddingLeft: '38px',
                                    width: '100%',
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '12px',
                                    paddingTop: '10px',
                                    paddingBottom: '10px',
                                    fontSize: '0.85rem',
                                    color: T.ink,
                                    outline: 'none',
                                }}
                                placeholder="Search orders by number, location, or status..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    style={{
                                        position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                                        background: T.cloud, border: 'none', borderRadius: '50%', width: '20px', height: '20px',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: T.slate, fontSize: '12px', fontWeight: 'bold'
                                    }}
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Orders List Section ─────────────────────────────────────── */}
            <div className="dol-container" style={{ margin: '0 auto' }}>
                {filteredOrders.length === 0 ? (
                    /* Empty State Card */
                    <div style={{
                        background: T.white,
                        borderRadius: T.rXl,
                        padding: '54px 28px',
                        boxShadow: T.shSm,
                        border: '1px solid rgba(15, 23, 42, 0.08)',
                        textAlign: 'center',
                        position: 'relative',
                        overflow: 'hidden',
                    }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, ${T.accent}, #7b93f5)`, borderRadius: '24px 24px 0 0' }} />
                        <div style={{
                            width: '76px', height: '76px', borderRadius: '50%',
                            background: T.accentSoft, color: T.accent,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '2rem', margin: '0 auto 16px',
                            boxShadow: '0 4px 16px rgba(59, 91, 219, 0.15)'
                        }}>
                            📦
                        </div>
                        <h3 style={{ margin: '0 0 8px', color: T.ink, fontFamily: "'DM Serif Display', serif", fontSize: '1.6rem', fontWeight: '400' }}>
                            {searchTerm || statusFilter !== 'ALL' ? 'No orders match your filter' : 'No Orders Placed Yet'}
                        </h3>
                        <p style={{ color: T.slate, margin: '0 auto 24px', fontSize: '0.92rem', maxWidth: '420px', lineHeight: 1.5 }}>
                            {searchTerm || statusFilter !== 'ALL'
                                ? "We couldn't find any orders matching your current search or status filter. Try clearing your filters."
                                : "You haven't placed any distributor sales orders yet. Click below to create your first order easily."}
                        </p>
                        {searchTerm || statusFilter !== 'ALL' ? (
                            <button
                                onClick={() => { setSearchTerm(''); setStatusFilter('ALL'); }}
                                className="dol-action-btn"
                                style={{ padding: '10px 24px', fontSize: '0.85rem' }}
                            >
                                Reset Filters
                            </button>
                        ) : (
                            <button
                                onClick={() => navigate('/sales-order-distributor')}
                                className="dol-new-btn"
                                style={{ padding: '12px 28px', fontSize: '0.92rem' }}
                            >
                                + Place Your First Order
                            </button>
                        )}
                    </div>
                ) : (
                    filteredOrders.map((order, idx) => {
                        const st = getStatusStyle(order.status || 'Pending');
                        const isExpanded = expandedOrderId === order.id;
                        const details = orderDetailsCache[order.id] || order;
                        const items = Array.isArray(details.items) ? details.items : [];

                        return (
                            <div
                                key={order.id}
                                className="dol-card"
                                style={{
                                    animationDelay: `${idx * 0.04}s`,
                                    borderLeft: `4px solid ${st.dot}`,
                                    position: 'relative',
                                }}
                            >
                                {/* Top Main Bar */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                                    {/* Left: Order Badge + Metadata */}
                                    <div className="dol-card-left" style={{ flex: '1 1 400px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                            <span
                                                onClick={() => handleCopyOrderNo(order.so_no || order.order_no, order.id)}
                                                title="Click to copy Order No"
                                                style={{
                                                    fontSize: '1.1rem',
                                                    fontWeight: '800',
                                                    color: T.ink,
                                                    fontFamily: "'DM Sans', sans-serif",
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                }}
                                            >
                                                {order.so_no || order.order_no || `SO-${order.id}`}
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.slate} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                                </svg>
                                            </span>

                                            {copiedId === order.id && (
                                                <span style={{ fontSize: '0.72rem', background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                                                    Copied!
                                                </span>
                                            )}

                                            {/* Status Pill */}
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                background: st.bg,
                                                border: `1px solid ${st.border}`,
                                                color: st.color,
                                                padding: '3px 10px',
                                                borderRadius: '20px',
                                                fontSize: '0.73rem',
                                                fontWeight: '700',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.06em',
                                            }}>
                                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: st.dot, display: 'inline-block' }} />
                                                {st.label}
                                            </span>

                                            {order.approval_status && order.approval_status !== 'Pending' && (
                                                <span style={{
                                                    fontSize: '0.72rem',
                                                    fontWeight: '600',
                                                    color: order.approval_status === 'Approved' ? '#059669' : '#e11d48',
                                                    background: order.approval_status === 'Approved' ? '#d1fae5' : '#ffe4e6',
                                                    padding: '2px 8px',
                                                    borderRadius: '6px',
                                                }}>
                                                    {order.approval_status}
                                                </span>
                                            )}
                                        </div>

                                        {/* Meta Icons Row */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.82rem', color: T.slate }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                                    <line x1="16" y1="2" x2="16" y2="6"></line>
                                                    <line x1="8" y1="2" x2="8" y2="6"></line>
                                                    <line x1="3" y1="10" x2="21" y2="10"></line>
                                                </svg>
                                                <span>Ordered: <strong>{formatDate(order.entry_date || order.created_at)}</strong></span>
                                            </span>

                                            {order.delivery_location && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                                        <circle cx="12" cy="10" r="3"></circle>
                                                    </svg>
                                                    <span>Delivery: <strong>{order.delivery_location}</strong></span>
                                                </span>
                                            )}

                                            {order.driver_name && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                                        <circle cx="12" cy="7" r="4"></circle>
                                                    </svg>
                                                    <span>Driver: <strong>{order.driver_name}</strong></span>
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right: Amount & Expand Button */}
                                    <div className="dol-card-right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                                        <div style={{ fontSize: '1.45rem', fontWeight: '800', color: T.accent, letterSpacing: '-0.01em' }}>
                                            {formatCurrency(order.total_amount || 0)}
                                        </div>
                                        <button
                                            onClick={() => handleToggleExpand(order.id)}
                                            style={{
                                                background: isExpanded ? T.accentSoft : 'transparent',
                                                color: isExpanded ? T.accent : T.slate,
                                                border: 'none',
                                                borderRadius: '8px',
                                                padding: '6px 12px',
                                                fontSize: '0.8rem',
                                                fontWeight: '700',
                                                cursor: 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                transition: 'all 0.18s ease',
                                                fontFamily: 'inherit',
                                            }}
                                        >
                                            <span>{isExpanded ? 'Hide Items' : 'View Ordered Items'}</span>
                                            <svg
                                                style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
                                                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                            >
                                                <polyline points="6 9 12 15 18 9"></polyline>
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Item Quick Preview Pill Row (When Not Expanded) */}
                                {!isExpanded && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.76rem', color: T.slate, fontWeight: '600' }}>
                                            Products:
                                        </span>
                                        {items.length > 0 ? (
                                            <>
                                                {items.slice(0, 3).map((it, i) => (
                                                    <span
                                                        key={i}
                                                        style={{
                                                            background: T.cloudLight,
                                                            border: '1px solid rgba(15, 23, 42, 0.08)',
                                                            borderRadius: '6px',
                                                            padding: '3px 10px',
                                                            fontSize: '0.78rem',
                                                            color: T.inkMuted,
                                                            fontWeight: '500',
                                                        }}
                                                    >
                                                        <strong>{it.quantity || it.qty || 1}x</strong> {it.product_name || it.item_name || it.product || 'Item'}
                                                    </span>
                                                ))}
                                                {items.length > 3 && (
                                                    <span style={{
                                                        background: T.accentSoft,
                                                        color: T.accent,
                                                        borderRadius: '6px',
                                                        padding: '3px 8px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: '700',
                                                    }}>
                                                        +{items.length - 3} more
                                                    </span>
                                                )}
                                            </>
                                        ) : (
                                            <span style={{ fontSize: '0.78rem', color: T.steel, fontStyle: 'italic' }}>
                                                Click "View Ordered Items" to load full order items
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* ── Expandable Order Items & Details Accordion ───────────────── */}
                                {isExpanded && (
                                    <div style={{
                                        marginTop: '16px',
                                        paddingTop: '16px',
                                        borderTop: `1px solid rgba(15, 23, 42, 0.08)`,
                                        animation: 'fadeIn 0.2s ease',
                                    }}>
                                        {loadingDetailsId === order.id ? (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0', gap: '10px' }}>
                                                <div style={{ width: '22px', height: '22px', border: `3px solid ${T.cloud}`, borderTopColor: T.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                                <span style={{ fontSize: '0.86rem', color: T.slate, fontWeight: '600' }}>Loading order line items...</span>
                                            </div>
                                        ) : items.length > 0 ? (
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                    <h5 style={{ margin: 0, fontSize: '0.88rem', fontWeight: '700', color: T.ink }}>
                                                        Ordered Products ({items.length})
                                                    </h5>
                                                    {details.preferred_delivery_date && (
                                                        <span style={{ fontSize: '0.78rem', color: T.slate }}>
                                                            Expected Delivery: <strong>{formatDate(details.preferred_delivery_date)}</strong>
                                                        </span>
                                                    )}
                                                </div>

                                                <div style={{ overflowX: 'auto', borderRadius: T.rSm, border: '1px solid rgba(15, 23, 42, 0.08)' }}>
                                                    <table className="dol-details-table">
                                                        <thead>
                                                            <tr>
                                                                <th style={{ width: '45px' }}>#</th>
                                                                <th>Product Description</th>
                                                                <th>HSN</th>
                                                                <th style={{ textAlign: 'right' }}>Qty</th>
                                                                <th style={{ textAlign: 'right' }}>Unit Rate</th>
                                                                <th style={{ textAlign: 'right' }}>GST %</th>
                                                                <th style={{ textAlign: 'right' }}>Total ()</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {items.map((item, i) => (
                                                                <tr key={i}>
                                                                    <td style={{ color: T.slate, fontWeight: '600' }}>{i + 1}</td>
                                                                    <td style={{ fontWeight: '600', color: T.ink }}>
                                                                        {item.product_name || item.item_name || item.product || 'Product'}
                                                                    </td>
                                                                    <td style={{ color: T.slate }}>{item.hsn || '—'}</td>
                                                                    <td style={{ textAlign: 'right', fontWeight: '700' }}>
                                                                        {item.quantity || item.qty || 0} {item.per_name || item.unit_name || item.unit || ''}
                                                                    </td>
                                                                    <td style={{ textAlign: 'right', color: T.slate }}>
                                                                        {parseFloat(item.rate || 0).toFixed(2)}
                                                                    </td>
                                                                    <td style={{ textAlign: 'right', color: T.slate }}>
                                                                        {item.gst_percent ? `${item.gst_percent}%` : '0%'}
                                                                    </td>
                                                                    <td style={{ textAlign: 'right', fontWeight: '700', color: T.ink }}>
                                                                        {parseFloat(item.amount || item.total_amount || 0).toFixed(2)}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {/* Narration / Notes */}
                                                {(details.narration || details.remarks) && (
                                                    <div style={{
                                                        marginTop: '12px',
                                                        background: '#fffbeb',
                                                        border: '1px solid #fef3c7',
                                                        borderRadius: '8px',
                                                        padding: '10px 14px',
                                                        fontSize: '0.82rem',
                                                        color: '#92400e',
                                                    }}>
                                                        <strong>Remarks / Notes: </strong>
                                                        {details.narration || details.remarks}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div style={{ textAlign: 'center', padding: '20px 0', color: T.slate, fontSize: '0.85rem' }}>
                                                No detailed item records found for this order.
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Bottom Action Footer (Exports & Controls) */}
                                <div style={{
                                    borderTop: `1px solid rgba(15, 23, 42, 0.08)`,
                                    marginTop: '16px',
                                    paddingTop: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: '10px',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: T.slate }}>
                                        <span style={{ fontSize: '0.9rem' }}>🛒</span>
                                        <span>
                                            {items.length > 0
                                                ? `${items.length} item${items.length > 1 ? 's' : ''} in order`
                                                : order.items && order.items.length > 0
                                                    ? `${order.items.length} item${order.items.length > 1 ? 's' : ''} in order`
                                                    : 'Order placed'}
                                        </span>
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <button
                                            type="button"
                                            className="dol-action-btn pdf"
                                            onClick={(e) => { e.stopPropagation(); handleExportIndividual(order, 'pdf'); }}
                                            title="Download PDF Copy"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                <polyline points="14 2 14 8 20 8"></polyline>
                                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                                <polyline points="10 9 9 9 8 9"></polyline>
                                            </svg>
                                            <span>PDF</span>
                                        </button>

                                        <button
                                            type="button"
                                            className="dol-action-btn excel"
                                            onClick={(e) => { e.stopPropagation(); handleExportIndividual(order, 'excel'); }}
                                            title="Download Excel Spreadsheet"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                <polyline points="14 2 14 8 20 8"></polyline>
                                                <line x1="8" y1="13" x2="16" y2="17"></line>
                                                <line x1="16" y1="13" x2="8" y2="17"></line>
                                            </svg>
                                            <span>Excel</span>
                                        </button>

                                        <button
                                            type="button"
                                            className="dol-action-btn print"
                                            onClick={(e) => { e.stopPropagation(); handleExportIndividual(order, 'print'); }}
                                            title="Print Order Sheet"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                                                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                                                <rect x="6" y="14" width="12" height="8"></rect>
                                            </svg>
                                            <span>Print</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default DistributorOrdersList;

