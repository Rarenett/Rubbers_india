import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Form, Modal, Card } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { ThemeContext } from '../../../context/ThemeContext';
import { getBalanceSheet } from '../../../services/FinanceService';

const BalanceSheet = () => {
    const { background } = useContext(ThemeContext);
    const isDark = background?.value === 'dark';
    const navigate = useNavigate();

    const todayStr = new Date().toISOString().split('T')[0];

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
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState('grouped'); // 'grouped' | 'detailed'

    // F12 Configuration
    const [config, setConfig] = useState({
        showZeroBalances: false,
    });
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [showPeriodModal, setShowPeriodModal] = useState(false);
    const [showFilterModal, setShowFilterModal] = useState(false);

    // Selection & Navigation & Zoom Stack (Exact Trial Balance style)
    const [selectedRowKey, setSelectedRowKey] = useState(null);
    const [expandedGroups, setExpandedGroups] = useState({});
    const [zoomGroupIds, setZoomGroupIds] = useState([]); // Stack of zoomed group IDs
    const [selectedLedgerModal, setSelectedLedgerModal] = useState(null);

    const [pendingFromDate, setPendingFromDate] = useState(defaultFY.fromDate);
    const [pendingToDate, setPendingToDate] = useState(defaultFY.toDate);

    // ── Helper: Find group by ID in tree at any depth ─────────────────────────
    const findGroupById = (groupsList, id) => {
        if (!groupsList) return null;
        for (const g of groupsList) {
            if (g.id === id) return g;
            if (g.subgroups && g.subgroups.length > 0) {
                const found = findGroupById(g.subgroups, id);
                if (found) return found;
            }
        }
        return null;
    };

    const allRootGroups = data ? [...(data.liabilities || []), ...(data.assets || [])] : [];

    const zoomPath = zoomGroupIds
        .map(id => findGroupById(allRootGroups, id))
        .filter(Boolean);

    const currentActiveGroup = zoomPath.length > 0 ? zoomPath[zoomPath.length - 1] : null;

    const zoomIntoGroup = (groupId) => {
        const targetGroup = findGroupById(allRootGroups, groupId);
        if (!targetGroup) return;
        setZoomGroupIds(prev => [...prev, groupId]);
        if (targetGroup.subgroups?.length > 0) {
            setSelectedRowKey(`group-${targetGroup.subgroups[0].id}`);
        } else if (targetGroup.ledgers?.length > 0) {
            setSelectedRowKey(`ledger-${targetGroup.ledgers[0].id}`);
        }
    };

    const zoomOut = () => {
        setZoomGroupIds(prev => prev.slice(0, -1));
    };

    const zoomToPathIndex = (index) => {
        if (index === -1) {
            setZoomGroupIds([]);
        } else {
            setZoomGroupIds(prev => prev.slice(0, index + 1));
        }
    };

    // ── Fetch Data ────────────────────────────────────────────────────────────
    const fetchReport = async (overrideFrom = fromDate, overrideTo = toDate, overrideShowZero = config.showZeroBalances) => {
        try {
            setLoading(true);
            const params = { from_date: overrideFrom, to_date: overrideTo, as_on_date: overrideTo };
            if (overrideShowZero) params.show_zero = 'true';

            const res = await getBalanceSheet(params);
            setData(res);

            setExpandedGroups({});
            setZoomGroupIds([]); // Reset zoom stack on refetch
            if (res && res.liabilities && res.liabilities.length > 0) {
                setSelectedRowKey(`group-${res.liabilities[0].id}`);
            }
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'Failed to fetch Balance Sheet data', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Helpers ───────────────────────────────────────────────────────────────
    const getFinancialYearInfo = () => {
        const today   = new Date();
        const m       = today.getMonth();
        const y       = today.getFullYear();
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
        return Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const toggleGroupExpand = (groupId) => {
        setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
    };

    // ── Build Row Navigation List for Keyboard Arrow Up/Down ──────────────────
    const buildVisibleRowKeys = () => {
        if (!data) return [];
        const keys = [];

        const traverseGroup = (g) => {
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const matchesGroup = g.name.toLowerCase().includes(term);
                const matchesLedger = g.ledgers?.some(l => l.name.toLowerCase().includes(term));
                const matchesSub = g.subgroups?.some(s => s.name.toLowerCase().includes(term));
                if (!matchesGroup && !matchesLedger && !matchesSub) return;
            }

            keys.push(`group-${g.id}`);

            const isExpanded = viewMode === 'detailed' || !!expandedGroups[g.id];
            if (isExpanded) {
                g.subgroups?.forEach(sub => traverseGroup(sub));
                g.ledgers?.forEach(l => {
                    if (!searchTerm || l.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                        keys.push(`ledger-${l.id}`);
                    }
                });
            }
        };

        if (currentActiveGroup) {
            currentActiveGroup.subgroups?.forEach(g => traverseGroup(g));
            currentActiveGroup.ledgers?.forEach(l => {
                if (!searchTerm || l.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                    keys.push(`ledger-${l.id}`);
                }
            });
        } else {
            data.liabilities?.forEach(g => traverseGroup(g));
            data.assets?.forEach(g => traverseGroup(g));
        }

        return keys;
    };

    // ── Keyboard Shortcuts (Esc to zoom out, Enter to zoom in, ArrowUp/Down) ──
    useEffect(() => {
        const handleKeyDown = (e) => {
            const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName);

            if (showPeriodModal || showFilterModal || showConfigModal || selectedLedgerModal) {
                if (e.key === 'Escape') {
                    setShowPeriodModal(false);
                    setShowFilterModal(false);
                    setShowConfigModal(false);
                    setSelectedLedgerModal(null);
                }
                return;
            }

            if (e.key === 'Escape' || (!isInput && e.key === 'Backspace')) {
                e.preventDefault();
                if (zoomGroupIds.length > 0) {
                    zoomOut();
                } else {
                    window.history.back();
                }
            } else if (e.key === 'F3') {
                e.preventDefault();
                setPendingFromDate(fromDate);
                setPendingToDate(toDate);
                setShowPeriodModal(true);
            } else if (e.key === 'F4') {
                e.preventDefault();
                setViewMode(prev => prev === 'detailed' ? 'grouped' : 'detailed');
            } else if ((e.key === 's' || e.key === 'S') && e.altKey) {
                e.preventDefault();
                exportCSV();
            } else if ((e.key === 'r' || e.key === 'R') && e.altKey) {
                e.preventDefault();
                window.print();
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                if (isInput) return;
                const keys = buildVisibleRowKeys();
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
                    if (selectedRowKey.startsWith('group-')) {
                        const gid = parseInt(selectedRowKey.replace('group-', ''), 10);
                        zoomIntoGroup(gid);
                    } else if (selectedRowKey.startsWith('ledger-')) {
                        const lid = parseInt(selectedRowKey.replace('ledger-', ''), 10);
                        const findLedger = (list) => {
                            if (!list) return null;
                            for (const g of list) {
                                const foundInGroup = g.ledgers?.find(l => l.id === lid);
                                if (foundInGroup) return foundInGroup;
                                const foundInSub = findLedger(g.subgroups);
                                if (foundInSub) return foundInSub;
                            }
                            return null;
                        };
                        const targetLedger = findLedger(allRootGroups);
                        if (targetLedger) navigate(`/finance/ledger-details/${targetLedger.id}`);
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedRowKey, zoomGroupIds, showPeriodModal, showFilterModal, showConfigModal, selectedLedgerModal, viewMode, data, fromDate, toDate]);

    // ── CSV Export ────────────────────────────────────────────────────────────
    const exportCSV = () => {
        if (!data) return;
        const rows = [
            [fyInfo.companyHeader],
            [fyInfo.companyAddress],
            ['Balance Sheet', fyInfo.periodHeader],
            [],
            ['Side', 'Group / Ledger', 'Amount (INR)']
        ];
        const addGroup = (side, grp, indent = 0) => {
            rows.push([side, ' '.repeat(indent * 2) + grp.name, fmt(grp.amount)]);
            grp.subgroups?.forEach(sg => addGroup(side, sg, indent + 1));
            grp.ledgers?.forEach(l => rows.push([side, ' '.repeat((indent + 1) * 2) + l.name, fmt(l.amount)]));
        };
        data.liabilities?.forEach(g => addGroup('Liabilities', g));
        if (data.net_profit > 0) rows.push(['Liabilities', 'Nett Profit', fmt(data.net_profit)]);
        rows.push(['Liabilities', 'TOTAL', fmt(data.total_liabilities)]);
        data.assets?.forEach(g => addGroup('Assets', g));
        if (data.net_loss > 0) rows.push(['Assets', 'Nett Loss', fmt(data.net_loss)]);
        rows.push(['Assets', 'TOTAL', fmt(data.total_assets)]);

        const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `BalanceSheet_${asOnDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ── Root View Tree Flattening for Dual Column Alignment ───────────────────
    const flattenTree = (groupList) => {
        const items = [];
        if (!groupList) return items;

        const traverse = (g, level = 0) => {
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const matchesGroup = g.name.toLowerCase().includes(term);
                const matchesLedger = g.ledgers?.some(l => l.name.toLowerCase().includes(term));
                const matchesSub = g.subgroups?.some(s => s.name.toLowerCase().includes(term));
                if (!matchesGroup && !matchesLedger && !matchesSub) return;
            }

            const isExpanded = viewMode === 'detailed' || !!expandedGroups[g.id];
            const hasChildren = (g.subgroups?.length > 0) || (g.ledgers?.length > 0);

            items.push({
                type: 'group',
                id: g.id,
                name: g.name,
                amount: g.amount,
                level,
                hasChildren,
                isExpanded,
            });

            if (isExpanded) {
                g.subgroups?.forEach(sub => traverse(sub, level + 1));
                g.ledgers?.forEach(l => {
                    if (!searchTerm || l.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                        items.push({
                            type: 'ledger',
                            id: l.id,
                            name: l.name,
                            amount: l.amount,
                            level: level + 1,
                            closing_dr: l.closing_dr,
                            closing_cr: l.closing_cr,
                        });
                    }
                });
            }
        };

        groupList.forEach(g => traverse(g, 0));
        return items;
    };

    // Prepare root lists
    const liabilityItems = flattenTree(data?.liabilities || []);
    const assetItems = flattenTree(data?.assets || []);

    if (data) {
        if (data.net_profit > 0) {
            liabilityItems.push({
                type: 'special',
                id: 'net-profit',
                name: 'Nett Profit',
                amount: data.net_profit,
                level: 0,
                isProfit: true,
            });
        }
        if (data.net_loss > 0) {
            assetItems.push({
                type: 'special',
                id: 'net-loss',
                name: 'Nett Loss',
                amount: data.net_loss,
                level: 0,
                isLoss: true,
            });
        }
    }

    const maxRows = Math.max(liabilityItems.length, assetItems.length);

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

                .tally-row:hover {
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
                        <Card.Title className="mb-0">Balance Sheet</Card.Title>
                        {/* Breadcrumb Trail */}
                        <div className="d-flex align-items-center flex-wrap gap-1 small" style={{ fontSize: '12px' }}>
                            <span className="text-muted">›</span>
                            <span
                                className={zoomGroupIds.length === 0 ? 'text-secondary' : 'text-primary text-decoration-underline'}
                                onClick={() => zoomToPathIndex(-1)}
                                style={{ cursor: zoomGroupIds.length === 0 ? 'default' : 'pointer' }}
                            >
                                Balance Sheet
                            </span>
                            {zoomPath.map((g, idx) => (
                                <React.Fragment key={g.id}>
                                    <span className="text-muted">›</span>
                                    <span
                                        className={idx === zoomPath.length - 1 ? 'text-secondary fw-bold' : 'text-primary text-decoration-underline'}
                                        onClick={() => zoomToPathIndex(idx)}
                                        style={{ cursor: idx === zoomPath.length - 1 ? 'default' : 'pointer' }}
                                    >
                                        {g.name}
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
                            onClick={() => { setPendingFromDate(fromDate); setPendingToDate(toDate); setShowPeriodModal(true); }}
                            style={{ height: '32px', fontSize: '12px' }} title="F3 – Change Period">
                            <span className="badge bg-light text-dark me-1 border" style={{ fontSize: '10px' }}>F3</span> Period
                        </Button>
                        <Button size="sm" className="tally-action-btn"
                            onClick={() => setViewMode(prev => prev === 'detailed' ? 'grouped' : 'detailed')}
                            style={{ height: '32px', fontSize: '12px' }} title="F4 – Toggle Detailed / Condensed">
                            <span className="badge bg-light text-dark me-1 border" style={{ fontSize: '10px' }}>F4</span> {viewMode === 'detailed' ? 'Condensed' : 'Detailed'}
                        </Button>
                        <Button size="sm" className="tally-action-btn"
                            onClick={exportCSV}
                            style={{ height: '32px', fontSize: '12px' }} title="Alt+S – Export CSV">
                            <span className="badge bg-light text-dark me-1 border" style={{ fontSize: '10px' }}>Alt+S</span> CSV
                        </Button>
                        <Button size="sm" className="tally-action-btn"
                            onClick={() => window.print()}
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
                        Balance Sheet ({fyInfo.periodHeader})
                    </div>
                </div>

                {/* ════════════ MAIN CONTENT LAYOUT ════════════ */}
                <div className="d-flex">

                    {/* ════════════ TABLE AREA ════════════ */}
                    <div className="flex-grow-1 p-0 d-flex flex-column justify-content-between">

                        {loading ? (
                            <div className="text-center py-5 bg-white rounded my-3">
                                <i className="fa fa-spinner fa-spin me-2 text-primary fs-3"></i>
                                <p className="mt-2 text-muted fw-semibold" style={{ fontSize: 13 }}>Loading Balance Sheet...</p>
                            </div>
                        ) : currentActiveGroup ? (
                            /* ════════════ 🔍 ZOOMED IN GROUP SUMMARY VIEW (MATCHING TALLY SCREENSHOT 2) ════════════ */
                            <div className="tally-grid-box bg-white border-0">
                                <div className="table-responsive">
                                    <table className="w-100 border-0" style={{ fontSize: '13px', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid #d4d4d4' }}>
                                                <th className="ps-2 py-2" style={{ borderRight: '1px solid #d4d4d4', verticalAlign: 'bottom', width: '55%' }}>
                                                    <span style={{ fontSize: 14, fontWeight: 'bold', color: '#000' }}>
                                                        Particulars (Under {currentActiveGroup.name})
                                                    </span>
                                                </th>
                                                <th colSpan={2} className="text-end pe-2 py-1" style={{ fontSize: 11, fontWeight: 'bold', backgroundColor: '#fcfcfc', width: '45%' }}>
                                                    <div className="fw-bold text-center mt-1" style={{ color: '#000' }}>Closing Balance</div>
                                                    <div className="d-flex justify-content-end gap-5 mt-1 border-top pt-1">
                                                        <span style={{ width: 140, textAlign: 'right' }}>Debit</span>
                                                        <span style={{ width: 140, textAlign: 'right' }}>Credit</span>
                                                    </div>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {/* Subgroups under zoomed group */}
                                            {currentActiveGroup.subgroups?.map((sub) => {
                                                const subKey = `group-${sub.id}`;
                                                const isSelected = selectedRowKey === subKey;
                                                const drVal = sub.closing_dr || (sub.net_balance > 0 ? sub.net_balance : 0);
                                                const crVal = sub.closing_cr || (sub.net_balance < 0 ? Math.abs(sub.net_balance) : 0);

                                                return (
                                                    <tr
                                                        key={subKey}
                                                        className="tally-row"
                                                        onClick={() => {
                                                            setSelectedRowKey(subKey);
                                                            zoomIntoGroup(sub.id);
                                                        }}
                                                        onDoubleClick={() => zoomIntoGroup(sub.id)}
                                                        style={{
                                                            backgroundColor: isSelected ? '#b0b0b0' : 'transparent',
                                                            color: isSelected ? '#000000' : (isDark ? '#e0e0e0' : '#000000'),
                                                            fontWeight: '700',
                                                            fontSize: '12px',
                                                            cursor: 'pointer',
                                                            height: '26px',
                                                            userSelect: 'none',
                                                        }}
                                                        title="Click or press Enter to zoom in"
                                                    >
                                                        <td className="py-1 ps-3 d-flex align-items-center justify-content-between" style={{ borderRight: '1px solid #d4d4d4' }}>
                                                            <span>
                                                                <i className="fa fa-folder-open me-2 text-warning small" style={{ fontSize: '11px' }}></i>
                                                                {sub.name}
                                                            </span>
                                                            <i className="fa fa-chevron-right text-muted small me-2" style={{ fontSize: '10px' }}></i>
                                                        </td>
                                                        <td className="text-end font-monospace pe-2 py-1" style={{ borderRight: '1px solid #d4d4d4', width: '150px' }}>
                                                            {fmt(drVal)}
                                                        </td>
                                                        <td className="text-end font-monospace pe-2 py-1" style={{ width: '150px' }}>
                                                            {fmt(crVal)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}

                                            {/* Ledgers directly under zoomed group */}
                                            {currentActiveGroup.ledgers?.map((ledger) => {
                                                const ledgerKey = `ledger-${ledger.id}`;
                                                const isSelected = selectedRowKey === ledgerKey;
                                                return (
                                                    <tr
                                                        key={ledgerKey}
                                                        className="tally-row"
                                                        onClick={() => { setSelectedRowKey(ledgerKey); navigate(`/finance/ledger-details/${ledger.id}`); }}
                                                        style={{
                                                            backgroundColor: isSelected ? '#b0b0b0' : 'transparent',
                                                            color: isSelected ? '#000000' : (isDark ? '#e0e0e0' : '#000000'),
                                                            fontWeight: '400',
                                                            fontSize: '12px',
                                                            cursor: 'pointer',
                                                            height: '24px',
                                                            userSelect: 'none',
                                                        }}
                                                        title="Double click to view ledger details"
                                                    >
                                                        <td className="py-1 ps-4" style={{ borderRight: '1px solid #d4d4d4' }}>
                                                            <i className="fa fa-book me-2 text-muted small" style={{ fontSize: '10px' }}></i>
                                                            {ledger.name}
                                                        </td>
                                                        <td className="text-end font-monospace pe-2 py-1" style={{ borderRight: '1px solid #d4d4d4', width: '150px' }}>
                                                            {fmt(ledger.closing_dr)}
                                                        </td>
                                                        <td className="text-end font-monospace pe-2 py-1" style={{ width: '150px' }}>
                                                            {fmt(ledger.closing_cr)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}

                                            {(!currentActiveGroup.subgroups?.length && !currentActiveGroup.ledgers?.length) && (
                                                <tr>
                                                    <td colSpan={3} className="text-center py-4 text-muted">
                                                        No subgroups or ledgers found under {currentActiveGroup.name}.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>

                                        <tfoot>
                                            <tr style={{
                                                borderTop: '1px solid #000',
                                                borderBottom: '4px double #000',
                                                fontWeight: 'bold',
                                                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                                height: '28px'
                                            }}>
                                                <td className="ps-3 py-1" style={{ borderRight: '1px solid #d4d4d4' }}>
                                                    Total - {currentActiveGroup.name}
                                                </td>
                                                <td className="text-end font-monospace pe-2 py-1" style={{ borderRight: '1px solid #d4d4d4', width: '150px' }}>
                                                    {fmt(currentActiveGroup.closing_dr || (currentActiveGroup.net_balance > 0 ? currentActiveGroup.net_balance : 0))}
                                                </td>
                                                <td className="text-end font-monospace pe-2 py-1" style={{ width: '150px' }}>
                                                    {fmt(currentActiveGroup.closing_cr || (currentActiveGroup.net_balance < 0 ? Math.abs(currentActiveGroup.net_balance) : 0))}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                        ) : (
                            /* ════════════ ⚖️ ROOT DUAL-COLUMN BALANCE SHEET VIEW ════════════ */
                            <div className="tally-grid-box bg-white border-0">
                                <div className="table-responsive">
                                    <table className="w-100 border-0" style={{ fontSize: '12px', borderCollapse: 'collapse' }}>
                                        <thead>
                                            {/* Particulars & Header Block matching Tally Dual Column */}
                                            <tr style={{ borderBottom: '1px solid #d4d4d4' }}>
                                                <th className="ps-2 py-2" style={{ borderRight: '1px solid #d4d4d4', width: '35%' }}>
                                                    <span style={{ fontSize: 13, fontWeight: 'bold', color: '#000' }}>
                                                        L i a b i l i t i e s
                                                    </span>
                                                </th>
                                                <th className="text-end pe-2 py-2" style={{ borderRight: '1px solid #000', width: '15%' }}>
                                                    <div style={{ fontSize: 12, fontWeight: 'bold', color: '#000' }}>Amount (₹)</div>
                                                </th>

                                                <th className="ps-2 py-2" style={{ borderRight: '1px solid #d4d4d4', width: '35%' }}>
                                                    <span style={{ fontSize: 13, fontWeight: 'bold', color: '#000' }}>
                                                        A s s e t s
                                                    </span>
                                                </th>
                                                <th className="text-end pe-2 py-2" style={{ width: '15%' }}>
                                                    <div style={{ fontSize: 12, fontWeight: 'bold', color: '#000' }}>Amount (₹)</div>
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {Array.from({ length: maxRows }).map((_, idx) => {
                                                const lib = liabilityItems[idx];
                                                const ass = assetItems[idx];

                                                const libKey = lib ? `${lib.type}-${lib.id}` : `empty-lib-${idx}`;
                                                const assKey = ass ? `${ass.type}-${ass.id}` : `empty-ass-${idx}`;

                                                const isLibSelected = selectedRowKey === libKey;
                                                const isAssSelected = selectedRowKey === assKey;

                                                return (
                                                    <tr key={idx} style={{ height: '24px', userSelect: 'none' }}>
                                                        {/* ── LEFT HALF: LIABILITIES ── */}
                                                        {lib ? (
                                                            <>
                                                                <td
                                                                    className="py-1 ps-2 tally-row"
                                                                    onClick={() => {
                                                                        setSelectedRowKey(libKey);
                                                                        if (lib.type === 'group') zoomIntoGroup(lib.id);
                                                                        else if (lib.type === 'ledger') setSelectedLedgerModal(lib);
                                                                    }}
                                                                    onDoubleClick={() => {
                                                                        if (lib.type === 'group') zoomIntoGroup(lib.id);
                                                                        else if (lib.type === 'ledger') setSelectedLedgerModal(lib);
                                                                    }}
                                                                    style={{
                                                                        backgroundColor: isLibSelected ? (isDark ? '#1e293b' : '#f8fafc') : 'transparent',
                                                                        color: isDark ? '#e0e0e0' : '#000000',
                                                                        fontWeight: lib.type === 'group' || lib.type === 'special' ? '700' : '400',
                                                                        fontSize: '12px',
                                                                        cursor: 'pointer',
                                                                        borderRight: '1px solid #d4d4d4',
                                                                        paddingLeft: `${8 + lib.level * 16}px`
                                                                    }}
                                                                    title="Click or press Enter to zoom into group"
                                                                >
                                                                    <div className="d-flex align-items-center justify-content-between">
                                                                        <span>
                                                                            {lib.type === 'group' && (
                                                                                <i className="fa fa-folder-open me-2 text-warning small" style={{ fontSize: '11px' }}></i>
                                                                            )}
                                                                            {lib.type === 'ledger' && (
                                                                                <i className="fa fa-book me-2 text-muted small" style={{ fontSize: '10px' }}></i>
                                                                            )}
                                                                            {lib.type === 'special' && (
                                                                                <i className="fa fa-chart-line me-2 text-success small" style={{ fontSize: '11px' }}></i>
                                                                            )}
                                                                            {lib.name}
                                                                        </span>
                                                                        {lib.hasChildren && (
                                                                            <i className="fa fa-chevron-right text-muted small me-2" style={{ fontSize: '10px' }}></i>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td
                                                                    className="text-end font-monospace pe-2 py-1 tally-row"
                                                                    onClick={() => setSelectedRowKey(libKey)}
                                                                    style={{
                                                                        backgroundColor: isLibSelected ? (isDark ? '#1e293b' : '#f8fafc') : 'transparent',
                                                                        color: isDark ? '#e0e0e0' : '#000000',
                                                                        fontWeight: lib.type === 'group' || lib.type === 'special' ? '700' : '400',
                                                                        fontSize: '12px',
                                                                        borderRight: '1px solid #000'
                                                                    }}
                                                                >
                                                                    {fmt(lib.amount)}
                                                                </td>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <td style={{ borderRight: '1px solid #d4d4d4' }}></td>
                                                                <td style={{ borderRight: '1px solid #000' }}></td>
                                                            </>
                                                        )}

                                                        {/* ── RIGHT HALF: ASSETS ── */}
                                                        {ass ? (
                                                            <>
                                                                <td
                                                                    className="py-1 ps-2 tally-row"
                                                                    onClick={() => {
                                                                        setSelectedRowKey(assKey);
                                                                        if (ass.type === 'group') zoomIntoGroup(ass.id);
                                                                        else if (ass.type === 'ledger') setSelectedLedgerModal(ass);
                                                                    }}
                                                                    onDoubleClick={() => {
                                                                        if (ass.type === 'group') zoomIntoGroup(ass.id);
                                                                        else if (ass.type === 'ledger') setSelectedLedgerModal(ass);
                                                                    }}
                                                                    style={{
                                                                        backgroundColor: isAssSelected ? (isDark ? '#1e293b' : '#f8fafc') : 'transparent',
                                                                        color: isDark ? '#e0e0e0' : '#000000',
                                                                        fontWeight: ass.type === 'group' || ass.type === 'special' ? '700' : '400',
                                                                        fontSize: '12px',
                                                                        cursor: 'pointer',
                                                                        borderRight: '1px solid #d4d4d4',
                                                                        paddingLeft: `${8 + ass.level * 16}px`
                                                                    }}
                                                                    title="Click or press Enter to zoom into group"
                                                                >
                                                                    <div className="d-flex align-items-center justify-content-between">
                                                                        <span>
                                                                            {ass.type === 'group' && (
                                                                                <i className="fa fa-folder-open me-2 text-warning small" style={{ fontSize: '11px' }}></i>
                                                                            )}
                                                                            {ass.type === 'ledger' && (
                                                                                <i className="fa fa-book me-2 text-muted small" style={{ fontSize: '10px' }}></i>
                                                                            )}
                                                                            {ass.type === 'special' && (
                                                                                <i className="fa fa-chart-line me-2 text-danger small" style={{ fontSize: '11px' }}></i>
                                                                            )}
                                                                            {ass.name}
                                                                        </span>
                                                                        {ass.hasChildren && (
                                                                            <i className="fa fa-chevron-right text-muted small me-2" style={{ fontSize: '10px' }}></i>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td
                                                                    className="text-end font-monospace pe-2 py-1 tally-row"
                                                                    onClick={() => setSelectedRowKey(assKey)}
                                                                    style={{
                                                                        backgroundColor: isAssSelected ? (isDark ? '#1e293b' : '#f8fafc') : 'transparent',
                                                                        color: isDark ? '#e0e0e0' : '#000000',
                                                                        fontWeight: ass.type === 'group' || ass.type === 'special' ? '700' : '400',
                                                                        fontSize: '12px'
                                                                    }}
                                                                >
                                                                    {fmt(ass.amount)}
                                                                </td>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <td style={{ borderRight: '1px solid #d4d4d4' }}></td>
                                                                <td></td>
                                                            </>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>

                                        {/* Tally Grand Total Footer */}
                                        <tfoot>
                                            <tr style={{
                                                borderTop: '1px solid #000',
                                                borderBottom: '4px double #000',
                                                fontWeight: 'bold',
                                                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                                height: '28px'
                                            }}>
                                                <td className="ps-2 py-1" style={{ borderRight: '1px solid #d4d4d4' }}>
                                                    Total
                                                </td>
                                                <td className="text-end font-monospace pe-2 py-1" style={{ borderRight: '1px solid #000' }}>
                                                    {fmt(data?.total_liabilities)}
                                                </td>

                                                <td className="ps-2 py-1" style={{ borderRight: '1px solid #d4d4d4' }}>
                                                    Total
                                                </td>
                                                <td className="text-end font-monospace pe-2 py-1">
                                                    {fmt(data?.total_assets)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Bottom Status Message Strip */}
                        {data && (
                            <div className="d-flex justify-content-between align-items-center px-3 py-2 border-top small bg-white no-print" style={{
                                backgroundColor: isDark ? '#24303f' : '#ffffff',
                                borderColor: isDark ? '#374557' : '#cbd5e1',
                                borderRadius: '2px'
                            }}>
                                <span className="fw-bold fs-6" style={{ color: data.is_balanced ? '#16a34a' : '#dc2626' }}>
                                    {currentActiveGroup ? (
                                        `● Group: ${currentActiveGroup.name} (${currentActiveGroup.subgroups?.length || 0} Subgroups, ${currentActiveGroup.ledgers?.length || 0} Ledgers)`
                                    ) : data.is_balanced
                                        ? '● Balance Sheet Tallied'
                                        : `● Difference in Balance Sheet: ${fmt(data.difference)}`}
                                </span>
                            </div>
                        )}

                    </div>

                </div>
                </Card.Body>
                </Card>
            </div>

            {/* ════════════ MODALS ════════════ */}

            {/* F2: Period Modal */}
            {/* ════════════ CHANGE PERIOD MODAL ════════════ */}
            <Modal show={showPeriodModal} onHide={() => setShowPeriodModal(false)} centered size="sm">
                <Modal.Header closeButton style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                    <Modal.Title className="fs-6 fw-bold text-dark">Change Period</Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-3" style={{ backgroundColor: isDark ? '#0f172a' : '#fff' }}>
                    <Form id="bsPeriodForm" onSubmit={(e) => {
                        e.preventDefault();
                        setFromDate(pendingFromDate);
                        setToDate(pendingToDate);
                        setShowPeriodModal(false);
                        fetchReport(pendingFromDate, pendingToDate);
                    }}>
                        <Form.Group className="mb-3">
                            <Form.Label className="small fw-bold text-secondary mb-1">From Date:</Form.Label>
                            <Form.Control
                                type="date"
                                size="sm"
                                value={pendingFromDate}
                                onChange={(e) => setPendingFromDate(e.target.value)}
                                style={{ borderRadius: '6px' }}
                            />
                        </Form.Group>
                        <Form.Group className="mb-2">
                            <Form.Label className="small fw-bold text-secondary mb-1">To Date:</Form.Label>
                            <Form.Control
                                type="date"
                                size="sm"
                                value={pendingToDate}
                                onChange={(e) => setPendingToDate(e.target.value)}
                                style={{ borderRadius: '6px' }}
                            />
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                    <Button variant="secondary" size="sm" onClick={() => setShowPeriodModal(false)}>
                        Cancel
                    </Button>
                    <Button variant="primary" size="sm" type="submit" form="bsPeriodForm" className="fw-bold px-3" style={{ backgroundColor: '#002b49', borderColor: '#002b49' }}>
                        Apply
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Filter Modal */}
            <Modal show={showFilterModal} onHide={() => setShowFilterModal(false)} centered size="sm">
                <Modal.Header closeButton style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                    <Modal.Title className="fs-6 fw-bold">Filter Balance Sheet</Modal.Title>
                </Modal.Header>
                <Modal.Body style={{ backgroundColor: isDark ? '#0f172a' : '#fff' }}>
                    <Form.Group className="mb-3">
                        <Form.Label className="small fw-semibold">Search Group / Ledger</Form.Label>
                        <Form.Control
                            type="text"
                            size="sm"
                            placeholder="Type to search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                    <Button variant="secondary" size="sm" onClick={() => setSearchTerm('')}>Clear</Button>
                    <Button variant="primary" size="sm" onClick={() => setShowFilterModal(false)}>Done</Button>
                </Modal.Footer>
            </Modal>

            {/* F12: Configuration Modal */}
            <Modal show={showConfigModal} onHide={() => setShowConfigModal(false)} centered size="sm">
                <Modal.Header closeButton style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                    <Modal.Title className="fs-6 fw-bold">Configuration (F12)</Modal.Title>
                </Modal.Header>
                <Modal.Body style={{ backgroundColor: isDark ? '#0f172a' : '#fff' }}>
                    <Form.Check
                        type="switch"
                        id="show-zero-bs"
                        label="Show Zero Balance Ledgers / Groups"
                        checked={config.showZeroBalances}
                        onChange={(e) => {
                            const newVal = e.target.checked;
                            setConfig(prev => ({ ...prev, showZeroBalances: newVal }));
                            fetchReport(asOnDate, newVal);
                        }}
                        className="mb-2 small fw-semibold"
                    />
                </Modal.Body>
                <Modal.Footer style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                    <Button variant="primary" size="sm" onClick={() => setShowConfigModal(false)}>Close</Button>
                </Modal.Footer>
            </Modal>

            {/* Ledger Details Modal */}
            {selectedLedgerModal && (
                <Modal show={!!selectedLedgerModal} onHide={() => setSelectedLedgerModal(null)} centered>
                    <Modal.Header closeButton style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                        <Modal.Title className="fs-6 fw-bold">
                            <i className="fa fa-book me-2 text-primary"></i>
                            Ledger: {selectedLedgerModal.name}
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body style={{ backgroundColor: isDark ? '#0f172a' : '#fff' }}>
                        <div className="table-responsive">
                            <table className="table table-sm table-bordered mb-0" style={{ fontSize: '13px' }}>
                                <tbody>
                                    {selectedLedgerModal.closing_dr !== undefined && (
                                        <tr>
                                            <td className="text-muted">Closing Debit</td>
                                            <td className="text-end font-monospace fw-bold">{fmt(selectedLedgerModal.closing_dr)}</td>
                                        </tr>
                                    )}
                                    {selectedLedgerModal.closing_cr !== undefined && (
                                        <tr>
                                            <td className="text-muted">Closing Credit</td>
                                            <td className="text-end font-monospace fw-bold">{fmt(selectedLedgerModal.closing_cr)}</td>
                                        </tr>
                                    )}
                                    <tr>
                                        <td className="fw-bold">Net Balance</td>
                                        <td className="text-end font-monospace fw-bold text-primary">
                                            {fmt(selectedLedgerModal.amount)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </Modal.Body>
                    <Modal.Footer style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                        <Button variant="secondary" size="sm" onClick={() => setSelectedLedgerModal(null)}>Close</Button>
                    </Modal.Footer>
                </Modal>
            )}

        </>
    );
};

export default BalanceSheet;
