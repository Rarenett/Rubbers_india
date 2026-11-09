import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Form, Modal, Badge, Card } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { ThemeContext } from '../../../context/ThemeContext';
import { getProfitAndLoss } from '../../../services/FinanceService';

const ProfitAndLoss = () => {
    const { background } = useContext(ThemeContext);
    const isDark = background?.value === 'dark';
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    const getCurrentFYDates = () => {
        const today = new Date();
        const m = today.getMonth();
        const y = today.getFullYear();
        const fyStartYear = m >= 3 ? y : y - 1;
        const fyEndYear = fyStartYear + 1;
        return {
            fromDate: `${fyStartYear}-04-01`,
            toDate: `${fyEndYear}-03-31`,
        };
    };
    const defaultFY = getCurrentFYDates();

    // Filters & Modes
    const [fromDate, setFromDate] = useState(defaultFY.fromDate);
    const [toDate, setToDate] = useState(defaultFY.toDate);
    const [viewMode, setViewMode] = useState('grouped'); // 'grouped' | 'detailed'

    // Drill-Down Stack State
    const [pnlNavStack, setPnlNavStack] = useState([]); // Array of navigation items e.g. [{ key: 'sales', label: 'Sales Accounts', amount, items }]
    const [selectedLedgerModal, setSelectedLedgerModal] = useState(null);

    // Stock Detail Breakdown Modal State
    const [showStockModal, setShowStockModal] = useState(false);
    const [stockModalType, setStockModalType] = useState('opening'); // 'opening' | 'closing'
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [stockSearchTerm, setStockSearchTerm] = useState('');

    // F12 Configuration
    const [config, setConfig] = useState({
        showPercentages: false,
        showZeroBalances: false,
        showClosingStockDetails: true,
        horizontalView: true,
    });
    const [showConfigModal, setShowConfigModal] = useState(false);

    // Selection & Modals
    const [selectedRowKey, setSelectedRowKey] = useState('op-stock');
    const [expandedSections, setExpandedSections] = useState({
        'op-stock': true,
        'cl-stock': true,
        purchases: true,
        direct_exp: true,
        sales: true,
        direct_inc: true,
        indirect_exp: true,
        indirect_inc: true,
    });
    const [showPeriodModal, setShowPeriodModal] = useState(false);

    const currentNavSection = pnlNavStack.length > 0 ? pnlNavStack[pnlNavStack.length - 1] : null;

    const drillIntoSection = (key, label, amount, items, stockType = null) => {
        if (stockType) {
            openStockDetail(stockType);
            return;
        }
        setPnlNavStack(prev => [...prev, { key, label, amount, items }]);
    };

    const stepBack = () => {
        setPnlNavStack(prev => prev.slice(0, -1));
    };

    const jumpToNavIndex = (idx) => {
        if (idx === -1) setPnlNavStack([]);
        else setPnlNavStack(prev => prev.slice(0, idx + 1));
    };

    // ── Fetch Report Data ──────────────────────────────────────────────────────
    const fetchReport = async (overrideFrom = fromDate, overrideTo = toDate, overrideConfig = config, overrideViewMode = viewMode) => {
        try {
            setLoading(true);
            const params = {};
            if (overrideFrom) params.from_date = overrideFrom;
            if (overrideTo)   params.to_date   = overrideTo;
            if (overrideConfig.showZeroBalances || overrideViewMode === 'detailed') params.show_zero = 'true';
            const res = await getProfitAndLoss(params);
            setData(res);
            setPnlNavStack([]); // Reset navigation stack on fresh fetch
        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'Failed to fetch Profit & Loss data', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport(fromDate, toDate, config, viewMode);
    }, [config.showZeroBalances, viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Helpers ───────────────────────────────────────────────────────────────
    const toggleSection = (key) => setExpandedSections(p => ({ ...p, [key]: !p[key] }));
    const isExpanded    = (key) => viewMode === 'detailed' || !!expandedSections[key];

    const openStockDetail = (type) => {
        setStockModalType(type);
        setShowStockModal(true);
    };

    const getFinancialYearInfo = () => {
        const today  = new Date();
        const m      = today.getMonth();
        const y      = today.getFullYear();
        const fyStart = m >= 3 ? y : y - 1;
        const fyEnd   = fyStart + 1;
        const fyCode  = `${String(fyStart).slice(-2)}-${String(fyEnd).slice(-2)}`;

        const fmtDate = (d) => {
            if (!d) return null;
            const [yr, mo, dy] = d.split('-');
            const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            return `${parseInt(dy)}-${MONTHS[parseInt(mo) - 1]}-${yr}`;
        };

        const fromDisp = fromDate ? fmtDate(fromDate) : `1-Apr-${fyStart}`;
        const toDisp   = toDate   ? fmtDate(toDate)   : `31-Mar-${fyEnd}`;

        return {
            fyCode,
            companyHeader: data?.company_name || 'Glenda Aqua',
            companyAddress: data?.company_address || 'Plot No. 45, Industrial Area, Kattedan, Hyderabad, Telangana - 500077',
            periodHeader:  `For ${fromDisp} to ${toDisp}`,
        };
    };

    const fyInfo = getFinancialYearInfo();

    const fmt = (val) => {
        if (val === null || val === undefined) return '';
        const num = parseFloat(val) || 0;
        if (num === 0) return config.showZeroBalances ? '0.00' : '';
        return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Calculate Turnover (% of Sales)
    const salesTotal = data?.trading?.sales?.total || 0;
    const getPct = (val) => {
        if (!config.showPercentages || !salesTotal || salesTotal === 0) return null;
        const num = parseFloat(val) || 0;
        const pct = (num / salesTotal) * 100;
        return `${pct.toFixed(1)}%`;
    };

    // ── Derived Values ────────────────────────────────────────────────────────
    const trading = data?.trading || {};
    const pnl     = data?.pnl     || {};

    const tradingDrTotal = trading.dr_total ?? trading.grand_total ?? 0;
    const tradingCrTotal = trading.cr_total ?? trading.grand_total ?? 0;
    const pnlDrTotal     = pnl.dr_total     ?? pnl.grand_total     ?? 0;
    const pnlCrTotal     = pnl.cr_total     ?? pnl.grand_total     ?? 0;

    // ── Key Navigation List ───────────────────────────────────────────────────
    const buildRowKeys = () => {
        const keys = [];
        // Trading Dr
        keys.push('op-stock');
        if (isExpanded('op-stock')) trading.opening_stock_items?.forEach((_, i) => keys.push(`op-stock-${i}`));
        keys.push('purchases');
        if (isExpanded('purchases')) trading.purchases?.items?.forEach((_, i) => keys.push(`purchases-${i}`));
        keys.push('direct_exp');
        if (isExpanded('direct_exp')) trading.direct_expenses?.items?.forEach((_, i) => keys.push(`direct_exp-${i}`));
        if ((trading.gross_profit || 0) > 0) keys.push('gross-profit-co');

        // P&L Dr
        if ((pnl.gross_loss_bf || 0) > 0) keys.push('gross-loss-bf');
        keys.push('indirect_exp');
        if (isExpanded('indirect_exp')) pnl.indirect_expenses?.items?.forEach((_, i) => keys.push(`indirect_exp-${i}`));
        if ((pnl.net_profit || 0) > 0) keys.push('net-profit');

        // Trading Cr
        keys.push('sales');
        if (isExpanded('sales')) trading.sales?.items?.forEach((_, i) => keys.push(`sales-${i}`));
        keys.push('direct_inc');
        if (isExpanded('direct_inc')) trading.direct_incomes?.items?.forEach((_, i) => keys.push(`direct_inc-${i}`));
        keys.push('cl-stock');
        if (isExpanded('cl-stock')) trading.closing_stock_items?.forEach((_, i) => keys.push(`cl-stock-${i}`));
        if ((trading.gross_loss || 0) > 0) keys.push('gross-loss-co');

        // P&L Cr
        if ((pnl.gross_profit_bf || 0) > 0) keys.push('gross-profit-bf');
        keys.push('indirect_inc');
        if (isExpanded('indirect_inc')) pnl.indirect_incomes?.items?.forEach((_, i) => keys.push(`indirect_inc-${i}`));
        if ((pnl.net_loss || 0) > 0) keys.push('net-loss');

        return keys;
    };

    // ── Keyboard Listeners ───────────────────────────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e) => {
            const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName);

            if (showPeriodModal || showConfigModal || showStockModal || selectedLedgerModal) {
                if (e.key === 'Escape') {
                    setShowPeriodModal(false);
                    setShowConfigModal(false);
                    setShowStockModal(false);
                    setSelectedLedgerModal(null);
                }
                return;
            }

            if (e.key === 'Escape' || (!isInput && e.key === 'Backspace')) {
                e.preventDefault();
                if (pnlNavStack.length > 0) {
                    stepBack();
                } else {
                    window.history.back();
                }
            } else if (e.key === 'F3') {
                e.preventDefault();
                setShowPeriodModal(true);
            } else if (e.key === 'F4') {
                e.preventDefault();
                setViewMode(p => p === 'detailed' ? 'grouped' : 'detailed');
            } else if ((e.key === 's' || e.key === 'S') && e.altKey) {
                e.preventDefault();
                handleExportCSV();
            } else if ((e.key === 'r' || e.key === 'R') && e.altKey) {
                e.preventDefault();
                handlePrint();
            } else if (e.key === 'F12') {
                e.preventDefault();
                setShowConfigModal(true);
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                if (isInput) return;
                const keys = buildRowKeys();
                if (!keys.length) return;
                const idx = keys.indexOf(selectedRowKey);
                if (e.key === 'ArrowDown') {
                    const next = idx < keys.length - 1 ? keys[idx + 1] : keys[0];
                    setSelectedRowKey(next);
                } else {
                    const prev = idx > 0 ? keys[idx - 1] : keys[keys.length - 1];
                    setSelectedRowKey(prev);
                }
            } else if (e.key === 'Enter') {
                if (isInput) return;
                if (selectedRowKey) {
                    const baseKey = selectedRowKey.split('-')[0];
                    if (baseKey === 'op-stock') {
                        drillIntoSection('op-stock', 'Opening Stock', trading.opening_stock, trading.opening_stock_items);
                    } else if (baseKey === 'cl-stock') {
                        drillIntoSection('cl-stock', 'Closing Stock', trading.closing_stock, trading.closing_stock_items);
                    } else if (baseKey === 'purchases') {
                        drillIntoSection('purchases', 'Purchase Accounts', trading.purchases?.total, trading.purchases?.items);
                    } else if (baseKey === 'direct_exp') {
                        drillIntoSection('direct_exp', 'Direct Expenses', trading.direct_expenses?.total, trading.direct_expenses?.items);
                    } else if (baseKey === 'sales') {
                        drillIntoSection('sales', 'Sales Accounts', trading.sales?.total, trading.sales?.items);
                    } else if (baseKey === 'direct_inc') {
                        drillIntoSection('direct_inc', 'Direct Incomes', trading.direct_incomes?.total, trading.direct_incomes?.items);
                    } else if (baseKey === 'indirect_exp') {
                        drillIntoSection('indirect_exp', 'Indirect Expenses', pnl.indirect_expenses?.total, pnl.indirect_expenses?.items);
                    } else if (baseKey === 'indirect_inc') {
                        drillIntoSection('indirect_inc', 'Indirect Incomes', pnl.indirect_incomes?.total, pnl.indirect_incomes?.items);
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedRowKey, viewMode, expandedSections, pnlNavStack, data, showPeriodModal, showConfigModal, showStockModal, selectedLedgerModal]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── CSV Export ────────────────────────────────────────────────────────────
    const handleExportCSV = () => {
        if (!data) return;
        const t = data.trading || {};
        const p = data.pnl     || {};

        const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
        const row = (a, b, c, d) => `${esc(a)},${esc(b)},${esc(c)},${esc(d)}\n`;

        let csv = 'data:text/csv;charset=utf-8,';
        csv += row(fyInfo.companyHeader, '', '', '');
        csv += row(fyInfo.companyAddress, '', '', '');
        csv += row('Profit & Loss Account', fyInfo.periodHeader, '', '');
        csv += row('', '', '', '');
        csv += row('Particulars (Expenses)', 'Amount (Rs)', 'Particulars (Incomes)', 'Amount (Rs)');
        csv += row('--- TRADING ACCOUNT ---', '', '--- TRADING ACCOUNT ---', '');
        csv += row('Opening Stock',     fmt(t.opening_stock),           'Sales Accounts',  fmt(t.sales?.total || 0));
        csv += row('Purchase Accounts', fmt(t.purchases?.total || 0),   'Direct Incomes',  fmt(t.direct_incomes?.total || 0));
        csv += row('Direct Expenses',   fmt(t.direct_expenses?.total || 0), 'Closing Stock', fmt(t.closing_stock));

        if ((t.gross_profit || 0) > 0) csv += row('Gross Profit c/o', fmt(t.gross_profit), '', '');
        if ((t.gross_loss   || 0) > 0) csv += row('', '', 'Gross Loss c/o', fmt(t.gross_loss));

        csv += row('Total Trading (Dr)', fmt(t.dr_total || t.grand_total || 0), 'Total Trading (Cr)', fmt(t.cr_total || t.grand_total || 0));
        csv += row('', '', '', '');
        csv += row('--- P&L ACCOUNT ---', '', '--- P&L ACCOUNT ---', '');

        if ((p.gross_loss_bf   || 0) > 0) csv += row('Gross Loss b/f',   fmt(p.gross_loss_bf),   '', '');
        if ((p.gross_profit_bf || 0) > 0) csv += row('', '', 'Gross Profit b/f', fmt(p.gross_profit_bf));

        csv += row('Indirect Expenses', fmt(p.indirect_expenses?.total || 0), 'Indirect Incomes', fmt(p.indirect_incomes?.total || 0));

        if ((p.net_profit || 0) > 0) csv += row('Nett Profit', fmt(p.net_profit), '', '');
        if ((p.net_loss   || 0) > 0) csv += row('', '', 'Nett Loss', fmt(p.net_loss));

        csv += row('Grand Total (Dr)', fmt(p.dr_total || p.grand_total || 0), 'Grand Total (Cr)', fmt(p.cr_total || p.grand_total || 0));

        const link = document.createElement('a');
        link.setAttribute('href', encodeURI(csv));
        link.setAttribute('download', `Profit_And_Loss_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => window.print();

    // ── Row Renderers ─────────────────────────────────────────────────────────
    const isRowSelected = (key) => selectedRowKey === key;
    const rowBgStyle = (key) => isRowSelected(key) ? (isDark ? '#1e293b' : '#f8fafc') : 'transparent';
    const rowColorStyle = (key) => isDark ? '#e0e0e0' : '#000';

    // Section Parent Row
    const renderGroupRow = (key, label, amount, clickToggle, items, onOpenStock) => {
        const expanded = isExpanded(key);
        const hasChildren = items && items.length > 0;
        const sel = isRowSelected(key);
        const pct = getPct(amount);

        const handleRowClick = () => {
            setSelectedRowKey(key);
            if (onOpenStock) {
                onOpenStock();
            } else {
                drillIntoSection(key, label, amount, items);
            }
        };

        return (
            <tr
                key={key}
                className="tally-pnl-row"
                onClick={handleRowClick}
                onDoubleClick={() => {
                    if (onOpenStock) onOpenStock();
                    else drillIntoSection(key, label, amount, items);
                }}
                style={{
                    backgroundColor: rowBgStyle(key),
                    color: rowColorStyle(key),
                    fontWeight: '700',
                    height: '26px',
                    cursor: 'pointer',
                    outline: sel ? `1px solid ${isDark ? '#475569' : '#cbd5e1'}` : 'none',
                }}
                title="Click to view details"
            >
                <td className="ps-2 py-1 d-flex align-items-center justify-content-between">
                    <div>
                        {hasChildren && (
                            <span style={{ display: 'inline-block', width: 14, fontSize: 10, color: sel ? '#000' : '#555' }}>
                                {expanded ? '▼' : '▶'}
                            </span>
                        )}
                        {!hasChildren && <span style={{ display: 'inline-block', width: 14 }}></span>}
                        {label}
                    </div>
                    <i className="fa fa-chevron-right text-muted small me-2" style={{ fontSize: '10px' }}></i>
                </td>

                {/* Inner Sub-column */}
                <td className="text-end font-monospace pe-2 py-1" style={{ width: config.showPercentages ? '22%' : '28%', fontSize: 13 }}></td>

                {/* Main Outer Column */}
                <td className="text-end font-monospace pe-3 py-1 fw-bold" style={{ width: config.showPercentages ? '25%' : '32%', fontSize: 13 }}>
                    {fmt(amount)}
                </td>

                {config.showPercentages && (
                    <td className="text-end font-monospace pe-2 py-1 small text-muted" style={{ width: '15%' }}>
                        {pct}
                    </td>
                )}
            </tr>
        );
    };

    // Sub-item (Drill-down Ledger / Stock Category) Row
    const renderItemRows = (sectionKey, items, onOpenCategory) => {
        if (!isExpanded(sectionKey) || !items || items.length === 0) return null;

        return items.map((item, idx) => {
            const itemKey = `${sectionKey}-${idx}`;
            const sel = isRowSelected(itemKey);
            const amt = item.amount !== undefined ? item.amount : (item.opening_val !== undefined ? item.opening_val : (item.closing_val !== undefined ? item.closing_val : (item.closing_dr || item.closing_cr || 0)));
            const pct = getPct(amt);

            return (
                <tr
                    key={item.id || itemKey}
                    className="tally-pnl-row"
                    onClick={() => {
                        setSelectedRowKey(itemKey);
                        const catObj = (trading.stock_summary || []).find(c => c.category === item.name || c.name === item.name);
                        const subItems = (item.items && item.items.length > 0) ? item.items : (catObj ? catObj.items : null);
                        const isStockItem = item.is_stock_item || item.opening_qty !== undefined || item.closing_qty !== undefined || item.unit !== undefined;

                        if (subItems && subItems.length > 0) {
                            drillIntoSection(itemKey, item.name, amt, subItems);
                        } else if (sectionKey === 'op-stock' || sectionKey === 'cl-stock' || catObj) {
                            drillIntoSection(itemKey, item.name, amt, catObj?.items || []);
                        } else if (!isStockItem && item.id) {
                            navigate(`/finance/ledger-details/${item.id}`);
                        }
                    }}
                    onDoubleClick={() => {
                        const catObj = (trading.stock_summary || []).find(c => c.category === item.name || c.name === item.name);
                        const subItems = (item.items && item.items.length > 0) ? item.items : (catObj ? catObj.items : null);
                        const isStockItem = item.is_stock_item || item.opening_qty !== undefined || item.closing_qty !== undefined || item.unit !== undefined;

                        if (subItems && subItems.length > 0) {
                            drillIntoSection(itemKey, item.name, amt, subItems);
                        } else if (sectionKey === 'op-stock' || sectionKey === 'cl-stock' || catObj) {
                            drillIntoSection(itemKey, item.name, amt, catObj?.items || []);
                        } else if (!isStockItem && item.id) {
                            navigate(`/finance/ledger-details/${item.id}`);
                        }
                    }}
                    style={{
                        backgroundColor: rowBgStyle(itemKey),
                        color: rowColorStyle(itemKey),
                        height: '24px',
                        cursor: 'pointer',
                        outline: sel ? `1px solid ${isDark ? '#475569' : '#cbd5e1'}` : 'none',
                    }}
                    title="Click to view details"
                >
                    <td className="py-1" style={{ paddingLeft: '32px', fontSize: 12 }}>
                        <span style={{ color: sel ? '#000' : (isDark ? '#aaa' : '#444') }}>{item.name}</span>
                    </td>

                    {/* Inner Sub-column (Item / Category Amount) */}
                    <td className="text-end font-monospace pe-2 py-1" style={{ fontSize: 12 }}>
                        {fmt(amt)}
                    </td>

                    {/* Main Outer Column (Blank for inner ledgers) */}
                    <td className="text-end font-monospace pe-3 py-1"></td>

                    {config.showPercentages && (
                        <td className="text-end font-monospace pe-2 py-1 small text-muted">
                            {pct}
                        </td>
                    )}
                </tr>
            );
        });
    };

    // Balancing / Special Line (Gross Profit c/o, Nett Profit, etc.)
    const renderBalancingRow = (key, label, amount, color) => {
        const sel = isRowSelected(key);
        const pct = getPct(amount);

        return (
            <tr
                key={key}
                className="tally-pnl-row"
                onClick={() => setSelectedRowKey(key)}
                style={{
                    backgroundColor: rowBgStyle(key),
                    color: sel ? '#000' : color,
                    fontWeight: '700',
                    fontStyle: 'italic',
                    height: '26px',
                    cursor: 'pointer',
                    outline: sel ? `1px solid ${isDark ? '#475569' : '#cbd5e1'}` : 'none',
                }}
            >
                <td className="ps-2 py-1">
                    <span style={{ display: 'inline-block', width: 14 }}></span>
                    {label}
                </td>
                <td className="text-end font-monospace pe-2 py-1"></td>
                <td className="text-end font-monospace pe-3 py-1 fw-bold">{fmt(amount)}</td>
                {config.showPercentages && (
                    <td className="text-end font-monospace pe-2 py-1 small">{pct}</td>
                )}
            </tr>
        );
    };

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <>
            <style>{`
                @page {
                    size: landscape;
                    margin: 10mm;
                }
                @media print {
                    .no-print { display: none !important; }
                    body { font-size: 11px; color: #000 !important; }
                }
                .tally-pnl-row:hover {
                    background-color: ${isDark ? '#334155' : '#f1f5f9'} !important;
                }
                .tally-btn-shortcut {
                    font-weight: 700;
                    color: #002b49;
                    background-color: #dbeafe;
                    padding: 2px 4px;
                    border-radius: 3px;
                    font-size: 10px;
                }
            `}</style>

            <div className="container-fluid">

                {/* ════════════ CARD HEADER ════════════ */}
                <Card className="mb-0">
                <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2 no-print">
                    <div className="d-flex align-items-center gap-2">
                        <Card.Title className="mb-0">Profit &amp; Loss A/c</Card.Title>
                        {/* Breadcrumb Trail */}
                        <div className="d-flex align-items-center flex-wrap gap-1 small" style={{ fontSize: '12px' }}>
                            <span className="text-muted">›</span>
                            <span
                                className={pnlNavStack.length === 0 ? 'text-secondary' : 'text-primary text-decoration-underline'}
                                onClick={() => jumpToNavIndex(-1)}
                                style={{ cursor: pnlNavStack.length === 0 ? 'default' : 'pointer' }}
                            >
                                P&amp;L
                            </span>
                            {pnlNavStack.map((s, idx) => (
                                <React.Fragment key={idx}>
                                    <span className="text-muted">›</span>
                                    <span
                                        className={idx === pnlNavStack.length - 1 ? 'text-secondary fw-bold' : 'text-primary text-decoration-underline'}
                                        onClick={() => jumpToNavIndex(idx)}
                                        style={{ cursor: idx === pnlNavStack.length - 1 ? 'default' : 'pointer' }}
                                    >
                                        {s.label}
                                    </span>
                                </React.Fragment>
                            ))}
                        </div>
                    </div>

                    {/* Centered Company Name & Period Date */}
                    <div className="text-center px-2">
                        <div className="fw-bold text-dark" style={{ fontSize: '15px', lineHeight: '1.2' }}>
                            {fyInfo.companyHeader}
                        </div>
                        <div className="fw-semibold text-secondary small">
                            {fyInfo.periodHeader}
                        </div>
                    </div>

                    <div className="d-flex align-items-center gap-1 flex-wrap">
                        <Button size="sm" className="tally-action-btn"
                            onClick={() => setShowPeriodModal(true)}
                            style={{ height: '32px', fontSize: '12px' }} title="F3 – Change Period">
                            <span className="badge bg-light text-dark me-1 border" style={{ fontSize: '10px' }}>F3</span> Period
                        </Button>
                        <Button size="sm" className="tally-action-btn"
                            onClick={() => setViewMode(p => p === 'detailed' ? 'grouped' : 'detailed')}
                            style={{ height: '32px', fontSize: '12px' }} title="F4 – Toggle Detailed/Condensed">
                            <span className="badge bg-light text-dark me-1 border" style={{ fontSize: '10px' }}>F4</span> {viewMode === 'detailed' ? 'Condensed' : 'Detailed'}
                        </Button>
                        <Button size="sm" className="tally-action-btn"
                            onClick={handleExportCSV}
                            style={{ height: '32px', fontSize: '12px' }} title="Alt+S – Export CSV">
                            <span className="badge bg-light text-dark me-1 border" style={{ fontSize: '10px' }}>Alt+S</span> CSV
                        </Button>
                        <Button size="sm" className="tally-action-btn"
                            onClick={handlePrint}
                            style={{ height: '32px', fontSize: '12px' }} title="Alt+R – Print Report">
                            <span className="badge bg-light text-dark me-1 border" style={{ fontSize: '10px' }}>Alt+R</span> Print
                        </Button>
                    </div>
                </Card.Header>
                <Card.Body className="p-0">

                {/* Dedicated Print-Only Company Header */}
                <div className="d-none d-print-block text-center py-2 mb-2 border-bottom">
                    <h3 className="fw-bold mb-1" style={{ color: '#000', fontSize: '18px' }}>
                        {fyInfo.companyHeader}
                    </h3>
                    <div className="fw-bold text-dark fs-6">
                        Profit &amp; Loss Account ({fyInfo.periodHeader})
                    </div>
                </div>

                {/* ════════════ MAIN CONTENT LAYOUT ════════════ */}
                <div className="d-flex">
                    <div className="flex-grow-1 p-2 d-flex flex-column justify-content-between">

                        {loading ? (
                            <div className="text-center py-5 bg-white rounded shadow-sm my-3" style={{ backgroundColor: isDark ? '#24303f' : '#fff' }}>
                                <i className="fa fa-spinner fa-spin me-2 text-primary fs-3"></i>
                                <p className="mt-2 text-muted fw-semibold" style={{ fontSize: 13 }}>Loading Profit &amp; Loss Statement...</p>
                            </div>
                        ) : currentNavSection ? (
                            /* ════════════ FOCUSED SECTION DRILL-DOWN VIEW ════════════ */
                            <div className="tally-grid-box bg-white border" style={{
                                backgroundColor: isDark ? '#24303f' : '#ffffff',
                                borderColor: isDark ? '#374557' : '#abc9e6',
                                borderRadius: '2px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
                            }}>
                                <div className="px-3 py-2 text-start fw-bold border-bottom d-flex justify-content-between align-items-center" style={{
                                    backgroundColor: isDark ? '#1e293b' : '#eaf3fb',
                                    color: isDark ? '#93c5fd' : '#002060',
                                    fontSize: 13
                                }}>
                                    <span>Particulars (Under {currentNavSection.label})</span>
                                    <span className="font-monospace fw-bold fs-6">Total: {fmt(currentNavSection.amount)}</span>
                                </div>

                                <table className="w-100" style={{ fontSize: 12, borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr className="border-bottom" style={{ backgroundColor: isDark ? '#0f172a' : '#f4f8fc', fontSize: 11, fontWeight: 'bold' }}>
                                            <th className="ps-3 py-2">Particulars / Ledger Name</th>
                                            <th className="text-end pe-3 py-2" style={{ width: '30%' }}>Amount ()</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentNavSection.items && currentNavSection.items.length > 0 ? (
                                            currentNavSection.items.map((item, idx) => {
                                                const amt = item.amount ?? item.opening_val ?? item.closing_val ?? item.closing_dr ?? item.closing_cr ?? 0;
                                                const isStockItem = item.is_stock_item || item.opening_qty !== undefined || item.closing_qty !== undefined || item.unit !== undefined;

                                                const handleItemClick = () => {
                                                    if (isStockItem) {
                                                        Swal.fire({
                                                            title: item.name,
                                                            html: `
                                                                <div class="text-start fs-6 p-2">
                                                                    <p class="mb-2"><strong>Category:</strong> ${currentNavSection.label}</p>
                                                                    <p class="mb-2"><strong>Unit:</strong> ${item.unit || 'Nos'}</p>
                                                                    <p class="mb-2"><strong>Opening Stock:</strong> ${item.opening_qty ?? 0} ${item.unit || ''} (₹ ${fmt(item.opening_val || 0)})</p>
                                                                    <p class="mb-0"><strong>Closing Stock:</strong> ${item.closing_qty ?? 0} ${item.unit || ''} (₹ ${fmt(item.closing_val || 0)})</p>
                                                                </div>
                                                            `,
                                                            icon: 'info',
                                                            confirmButtonColor: '#002b49',
                                                            confirmButtonText: 'Close'
                                                        });
                                                    } else if (item.id) {
                                                        navigate(`/finance/ledger-details/${item.id}`);
                                                    }
                                                };

                                                return (
                                                    <tr
                                                        key={item.id || idx}
                                                        className="tally-pnl-row"
                                                        onClick={handleItemClick}
                                                        onDoubleClick={handleItemClick}
                                                        style={{ height: '28px', cursor: 'pointer' }}
                                                        title={isStockItem ? "Click to view stock item details" : "Click to view ledger details"}
                                                    >
                                                        <td className="ps-3 py-1 fw-semibold">
                                                            <i className={isStockItem ? "fa fa-cube me-2 text-primary small" : "fa fa-book me-2 text-muted small"} style={{ fontSize: '10px' }}></i>
                                                            {item.name}
                                                        </td>
                                                        <td className="text-end font-monospace pe-3 py-1 fw-bold">
                                                            {fmt(amt)}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={2} className="text-center py-4 text-muted">
                                                    No ledger entries found under {currentNavSection.label}.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{
                                            borderTop: '1px solid #000',
                                            borderBottom: '4px double #000',
                                            backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                                            fontWeight: 'bold',
                                            fontSize: 12
                                        }}>
                                            <td className="ps-3 py-2">Total - {currentNavSection.label}</td>
                                            <td className="text-end font-monospace pe-3 py-2">{fmt(currentNavSection.amount)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        ) : (
                            /* ════════════ MAIN STATEMENT VIEW (FULL P&L) ════════════ */
                            <div className="tally-grid-box bg-white border" style={{
                                backgroundColor: isDark ? '#24303f' : '#ffffff',
                                borderColor: isDark ? '#374557' : '#abc9e6',
                                borderRadius: '2px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
                            }}>

                                {/* Dual Side Container */}
                                <div className="d-flex" style={{ borderBottom: '1px solid #abc9e6' }}>

                                    {/* ════════════ LEFT SIDE — DEBIT / EXPENSES ════════════ */}
                                    <div className="w-50 border-end" style={{ borderColor: isDark ? '#374557' : '#abc9e6' }}>

                                        {/* Debit Header */}
                                        <div className="px-2 py-1 text-center fw-bold border-bottom" style={{
                                            backgroundColor: isDark ? '#1e293b' : '#eaf3fb',
                                            color: isDark ? '#93c5fd' : '#002060',
                                            fontSize: 13
                                        }}>
                                            P a r t i c u l a r s (Expenses / Debit)
                                        </div>

                                        <table className="w-100" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr className="border-bottom" style={{ backgroundColor: isDark ? '#0f172a' : '#f4f8fc', fontSize: 12, fontWeight: 'bold' }}>
                                                    <th className="ps-2 py-1">Particulars</th>
                                                    <th className="text-end pe-2 py-1" style={{ width: config.showPercentages ? '22%' : '28%' }}>Inner ()</th>
                                                    <th className="text-end pe-3 py-1" style={{ width: config.showPercentages ? '25%' : '32%' }}>Amount ()</th>
                                                    {config.showPercentages && <th className="text-end pe-2 py-1" style={{ width: '15%' }}>%</th>}
                                                </tr>
                                            </thead>
                                            <tbody>

                                                {/* ── TRADING ACCOUNT (DR) ── */}
                                                {/* Opening Stock */}
                                                {renderGroupRow('op-stock', 'Opening Stock', trading.opening_stock, () => toggleSection('op-stock'), trading.opening_stock_items)}
                                                {renderItemRows('op-stock', trading.opening_stock_items)}

                                                {/* Purchase Accounts */}
                                                {renderGroupRow('purchases', 'Purchase Accounts', trading.purchases?.total, () => toggleSection('purchases'), trading.purchases?.items)}
                                                {renderItemRows('purchases', trading.purchases?.items)}

                                                {/* Direct Expenses */}
                                                {renderGroupRow('direct_exp', 'Direct Expenses', trading.direct_expenses?.total, () => toggleSection('direct_exp'), trading.direct_expenses?.items)}
                                                {renderItemRows('direct_exp', trading.direct_expenses?.items)}

                                                {/* Gross Profit c/o (if Profit) */}
                                                {(trading.gross_profit || 0) > 0 &&
                                                    renderBalancingRow('gross-profit-co', 'Gross Profit c/o', trading.gross_profit, '#15803d')}

                                            </tbody>
                                        </table>
                                    </div>

                                    {/* ════════════ RIGHT SIDE — CREDIT / INCOMES ════════════ */}
                                    <div className="w-50">

                                        {/* Credit Header */}
                                        <div className="px-2 py-1 text-center fw-bold border-bottom" style={{
                                            backgroundColor: isDark ? '#1e293b' : '#eaf3fb',
                                            color: isDark ? '#93c5fd' : '#002060',
                                            fontSize: 13
                                        }}>
                                            P a r t i c u l a r s (Incomes / Credit)
                                        </div>

                                        <table className="w-100" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr className="border-bottom" style={{ backgroundColor: isDark ? '#0f172a' : '#f4f8fc', fontSize: 12, fontWeight: 'bold' }}>
                                                    <th className="ps-2 py-1">Particulars</th>
                                                    <th className="text-end pe-2 py-1" style={{ width: config.showPercentages ? '22%' : '28%' }}>Inner ()</th>
                                                    <th className="text-end pe-3 py-1" style={{ width: config.showPercentages ? '25%' : '32%' }}>Amount ()</th>
                                                    {config.showPercentages && <th className="text-end pe-2 py-1" style={{ width: '15%' }}>%</th>}
                                                </tr>
                                            </thead>
                                            <tbody>

                                                {/* ── TRADING ACCOUNT (CR) ── */}
                                                {/* Sales Accounts */}
                                                {renderGroupRow('sales', 'Sales Accounts', trading.sales?.total, () => toggleSection('sales'), trading.sales?.items)}
                                                {renderItemRows('sales', trading.sales?.items)}

                                                {/* Direct Incomes */}
                                                {renderGroupRow('direct_inc', 'Direct Incomes', trading.direct_incomes?.total, () => toggleSection('direct_inc'), trading.direct_incomes?.items)}
                                                {renderItemRows('direct_inc', trading.direct_incomes?.items)}

                                                {/* Closing Stock */}
                                                {renderGroupRow('cl-stock', 'Closing Stock', trading.closing_stock, () => toggleSection('cl-stock'), trading.closing_stock_items)}
                                                {renderItemRows('cl-stock', trading.closing_stock_items)}

                                                {/* Gross Loss c/o (if Loss) */}
                                                {(trading.gross_loss || 0) > 0 &&
                                                    renderBalancingRow('gross-loss-co', 'Gross Loss c/o', trading.gross_loss, '#b91c1c')}

                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* ════════════ TRADING TOTAL BAR ════════════ */}
                                <div className="d-flex" style={{
                                    borderTop: '1px solid #000',
                                    borderBottom: '1px solid #000',
                                    backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                                    fontWeight: 'bold',
                                    fontSize: 12
                                }}>
                                    <div className="w-50 border-end d-flex justify-content-between px-2 py-1" style={{ borderColor: isDark ? '#374557' : '#abc9e6' }}>
                                        <span>Total Trading (Dr)</span>
                                        <span className="font-monospace pe-2">{fmt(tradingDrTotal)}</span>
                                    </div>
                                    <div className="w-50 d-flex justify-content-between px-2 py-1">
                                        <span>Total Trading (Cr)</span>
                                        <span className="font-monospace pe-2">{fmt(tradingCrTotal)}</span>
                                    </div>
                                </div>

                                {/* ════════════ PROFIT & LOSS SECTION (BOTTOM HALF) ════════════ */}
                                <div className="d-flex">

                                    {/* ── P&L LEFT (DR) ── */}
                                    <div className="w-50 border-end" style={{ borderColor: isDark ? '#374557' : '#abc9e6' }}>
                                        <table className="w-100" style={{ fontSize: 12, borderCollapse: 'collapse' }}>
                                            <tbody>
                                                {/* Gross Loss b/f */}
                                                {(pnl.gross_loss_bf || 0) > 0 &&
                                                    renderBalancingRow('gross-loss-bf', 'Gross Loss b/f', pnl.gross_loss_bf, '#b91c1c')}

                                                {/* Indirect Expenses */}
                                                {renderGroupRow('indirect_exp', 'Indirect Expenses', pnl.indirect_expenses?.total, () => toggleSection('indirect_exp'), pnl.indirect_expenses?.items)}
                                                {renderItemRows('indirect_exp', pnl.indirect_expenses?.items)}

                                                {/* Nett Profit */}
                                                {(pnl.net_profit || 0) > 0 &&
                                                    renderBalancingRow('net-profit', 'Nett Profit', pnl.net_profit, '#15803d')}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* ── P&L RIGHT (CR) ── */}
                                    <div className="w-50">
                                        <table className="w-100" style={{ fontSize: 12, borderCollapse: 'collapse' }}>
                                            <tbody>
                                                {/* Gross Profit b/f */}
                                                {(pnl.gross_profit_bf || 0) > 0 &&
                                                    renderBalancingRow('gross-profit-bf', 'Gross Profit b/f', pnl.gross_profit_bf, '#15803d')}

                                                {/* Indirect Incomes */}
                                                {renderGroupRow('indirect_inc', 'Indirect Incomes', pnl.indirect_incomes?.total, () => toggleSection('indirect_inc'), pnl.indirect_incomes?.items)}
                                                {renderItemRows('indirect_inc', pnl.indirect_incomes?.items)}

                                                {/* Nett Loss */}
                                                {(pnl.net_loss || 0) > 0 &&
                                                    renderBalancingRow('net-loss', 'Nett Loss', pnl.net_loss, '#b91c1c')}
                                            </tbody>
                                        </table>
                                    </div>

                                </div>

                                {/* ════════════ GRAND TOTAL BAR (DOUBLE UNDERLINE) ════════════ */}
                                <div className="d-flex" style={{
                                    borderTop: '1px solid #000',
                                    borderBottom: '4px double #000',
                                    backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                                    fontWeight: 'bold',
                                    fontSize: 13
                                }}>
                                    <div className="w-50 border-end d-flex justify-content-between px-2 py-1" style={{ borderColor: isDark ? '#374557' : '#abc9e6' }}>
                                        <span>Total</span>
                                        <span className="font-monospace pe-2">{fmt(pnlDrTotal)}</span>
                                    </div>
                                    <div className="w-50 d-flex justify-content-between px-2 py-1">
                                        <span>Total</span>
                                        <span className="font-monospace pe-2">{fmt(pnlCrTotal)}</span>
                                    </div>
                                </div>

                            </div>
                        )}

                        {/* ── Bottom Status Strip ── */}
                        <div className="d-flex justify-content-between align-items-center px-3 py-2 mt-2 border-top small bg-white no-print" style={{
                            backgroundColor: isDark ? '#24303f' : '#ffffff',
                            borderColor: isDark ? '#374557' : '#cbd5e1',
                            borderRadius: '2px'
                        }}>
                            <span className="fw-bold fs-6" style={{ color: (pnl.net_profit || 0) > 0 ? '#16a34a' : '#dc2626' }}>
                                {currentNavSection ? (
                                    `● Section: ${currentNavSection.label} (${currentNavSection.items?.length || 0} Ledgers)`
                                ) : (pnl.net_profit || 0) > 0
                                    ? `● Nett Profit: ${fmt(pnl.net_profit)}`
                                    : `● Nett Loss: ${fmt(pnl.net_loss)}`}
                            </span>
                        </div>

                    </div>

                </div>
                </Card.Body>
                </Card>

                {/* ════════════ LEDGER DETAIL MODAL ════════════ */}
                {selectedLedgerModal && (
                    <Modal show={true} onHide={() => setSelectedLedgerModal(null)} centered size="md">
                        <Modal.Header closeButton style={{ backgroundColor: '#002b49', color: '#fff' }}>
                            <Modal.Title style={{ fontSize: 15, fontWeight: 'bold' }}>
                                <i className="fa fa-book me-2"></i>Ledger Details: {selectedLedgerModal.name}
                            </Modal.Title>
                        </Modal.Header>
                        <Modal.Body className="p-3">
                            <div className="mb-3 p-2 rounded bg-light border">
                                <div className="row g-2 text-dark">
                                    <div className="col-6">
                                        <small className="text-muted d-block fw-semibold">Head / Category</small>
                                        <span className="fw-bold">{currentNavSection ? currentNavSection.label : selectedLedgerModal.group_name || 'Profit & Loss'}</span>
                                    </div>
                                    <div className="col-6">
                                        <small className="text-muted d-block fw-semibold">Net Balance</small>
                                        <span className="fw-bold text-primary font-monospace">{fmt(selectedLedgerModal.amount || selectedLedgerModal.closing_dr || selectedLedgerModal.closing_cr)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="table-responsive border rounded mb-3">
                                <table className="table table-sm table-bordered m-0" style={{ fontSize: '12px' }}>
                                    <thead className="table-dark">
                                        <tr>
                                            <th>Particulars</th>
                                            <th className="text-end">Amount ()</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="fw-semibold">Total Debit / Period Expenses</td>
                                            <td className="text-end font-monospace">{fmt(selectedLedgerModal.closing_dr || selectedLedgerModal.amount)}</td>
                                        </tr>
                                        <tr>
                                            <td className="fw-semibold">Total Credit / Period Incomes</td>
                                            <td className="text-end font-monospace">{fmt(selectedLedgerModal.closing_cr || 0)}</td>
                                        </tr>
                                        <tr className="table-warning fw-bold">
                                            <td>Net Statement Value</td>
                                            <td className="text-end font-monospace">{fmt(selectedLedgerModal.amount || selectedLedgerModal.closing_dr || selectedLedgerModal.closing_cr)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="d-flex justify-content-between align-items-center">
                                <small className="text-muted">
                                    <i className="fa fa-info-circle me-1"></i>Press <kbd>Esc</kbd> or click Close to return
                                </small>
                                <Button variant="secondary" size="sm" onClick={() => setSelectedLedgerModal(null)}>
                                    Close
                                </Button>
                            </div>
                        </Modal.Body>
                    </Modal>
                )}



                {/* ════════════ F2 CHANGE PERIOD MODAL ════════════ */}
                <Modal show={showPeriodModal} onHide={() => setShowPeriodModal(false)} centered size="sm">
                    <Modal.Header closeButton style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                        <Modal.Title className="fs-6 fw-bold text-dark">Change Period</Modal.Title>
                    </Modal.Header>
                    <Modal.Body className="p-3" style={{ backgroundColor: isDark ? '#0f172a' : '#fff' }}>
                        <Form id="pnlPeriodForm" onSubmit={(e) => {
                            e.preventDefault();
                            fetchReport();
                            setShowPeriodModal(false);
                        }}>
                            <Form.Group className="mb-3">
                                <Form.Label className="small fw-bold text-secondary mb-1">From Date:</Form.Label>
                                <Form.Control 
                                    type="date" 
                                    size="sm" 
                                    value={fromDate} 
                                    onChange={e => setFromDate(e.target.value)} 
                                    style={{ borderRadius: '6px' }}
                                />
                            </Form.Group>
                            <Form.Group className="mb-2">
                                <Form.Label className="small fw-bold text-secondary mb-1">To Date:</Form.Label>
                                <Form.Control 
                                    type="date" 
                                    size="sm" 
                                    value={toDate} 
                                    onChange={e => setToDate(e.target.value)} 
                                    style={{ borderRadius: '6px' }}
                                />
                            </Form.Group>
                        </Form>
                    </Modal.Body>
                    <Modal.Footer style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                        <Button variant="secondary" size="sm" onClick={() => setShowPeriodModal(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary" size="sm" type="submit" form="pnlPeriodForm" className="fw-bold px-3" style={{ backgroundColor: '#002b49', borderColor: '#002b49' }}>
                            Apply
                        </Button>
                    </Modal.Footer>
                </Modal>

                {/* ════════════ F12 CONFIGURATION MODAL ════════════ */}
                <Modal show={showConfigModal} onHide={() => setShowConfigModal(false)} centered size="md">
                    <Modal.Header closeButton style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                        <Modal.Title className="fs-6 fw-bold text-dark">Profit &amp; Loss Configuration (F12)</Modal.Title>
                    </Modal.Header>
                    <Modal.Body className="p-3" style={{ backgroundColor: isDark ? '#0f172a' : '#fff' }}>
                        <Form>
                            <Form.Check
                                type="switch"
                                id="showPercentages"
                                label="Show Percentage (% of Sales turnover)"
                                checked={config.showPercentages}
                                onChange={e => setConfig(c => ({ ...c, showPercentages: e.target.checked }))}
                                className="mb-3 fw-semibold"
                            />
                            <Form.Check
                                type="switch"
                                id="showZeroBalances"
                                label="Show Ledgers with Zero Balance"
                                checked={config.showZeroBalances}
                                onChange={e => setConfig(c => ({ ...c, showZeroBalances: e.target.checked }))}
                                className="mb-3 fw-semibold"
                            />
                            <Form.Check
                                type="switch"
                                id="showClosingStockDetails"
                                label="Expand Stock-in-Hand details"
                                checked={config.showClosingStockDetails}
                                onChange={e => setConfig(c => ({ ...c, showClosingStockDetails: e.target.checked }))}
                                className="mb-1 fw-semibold"
                            />
                        </Form>
                    </Modal.Body>
                    <Modal.Footer style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                        <Button variant="secondary" size="sm" onClick={() => setShowConfigModal(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary" size="sm" onClick={() => setShowConfigModal(false)} className="fw-bold px-3" style={{ backgroundColor: '#002b49', borderColor: '#002b49' }}>
                            Save Configuration
                        </Button>
                    </Modal.Footer>
                </Modal>

            </div>
        </>
    );
};

export default ProfitAndLoss;
