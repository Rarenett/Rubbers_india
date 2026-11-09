import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Form, Modal, Card } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { ThemeContext } from '../../../context/ThemeContext';
import { getTrialBalance } from '../../../services/FinanceService';

const TrialBalance = () => {
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
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState('grouped'); // 'grouped' | 'detailed' | 'ledgers'
    const [showColumnType, setShowColumnType] = useState('closing'); // 'closing' | 'all'

    // F12 Configuration
    const [config, setConfig] = useState({
        showZeroBalances: false,
        showOpeningBalance: true,
        showTransactions: true,
    });
    const [showConfigModal, setShowConfigModal] = useState(false);

    // Selection & Navigation & Zoom
    const [selectedRowKey, setSelectedRowKey] = useState(null);
    const [expandedGroups, setExpandedGroups] = useState({});
    const [zoomGroupIds, setZoomGroupIds] = useState([]); // Stack of zoomed group IDs


    const [showPeriodModal, setShowPeriodModal] = useState(false);
    const [showFilterModal, setShowFilterModal] = useState(false);

    // ── Helper: Find group by ID in tree ──────────────────────────────────────
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

    const zoomPath = zoomGroupIds
        .map(id => findGroupById(data?.groups, id))
        .filter(Boolean);

    const currentActiveGroup = zoomPath.length > 0 ? zoomPath[zoomPath.length - 1] : null;

    const zoomIntoGroup = (groupId) => {
        setZoomGroupIds(prev => [...prev, groupId]);
        const targetGroup = findGroupById(data?.groups, groupId);
        if (targetGroup) {
            if (targetGroup.subgroups?.length > 0) {
                setSelectedRowKey(`group-${targetGroup.subgroups[0].id}`);
            } else if (targetGroup.ledgers?.length > 0) {
                setSelectedRowKey(`ledger-${targetGroup.ledgers[0].id}`);
            }
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
    const fetchReport = async (overrideFrom = fromDate, overrideTo = toDate) => {
        try {
            setLoading(true);
            const params = {};
            if (overrideFrom) params.from_date = overrideFrom;
            if (overrideTo)   params.to_date   = overrideTo;

            const res = await getTrialBalance(params);
            setData(res);

            setExpandedGroups({});
            setZoomGroupIds([]); // Reset zoom level on refetch
            if (res && res.groups && res.groups.length > 0) {
                setSelectedRowKey(`group-${res.groups[0].id}`);
            }
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'Failed to fetch Trial Balance data', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Helpers ───────────────────────────────────────────────────────────────
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

    // ── Build Row Key Navigation List ─────────────────────────────────────────
    const buildVisibleRowKeys = () => {
        if (!data) return [];
        const keys = [];

        if (viewMode === 'ledgers') {
            const ledgersList = currentActiveGroup 
                ? data.flat_ledgers?.filter(l => l.group_name === currentActiveGroup.name)
                : data.flat_ledgers;

            ledgersList
                ?.filter(l => !searchTerm || l.name.toLowerCase().includes(searchTerm.toLowerCase()))
                ?.forEach(l => keys.push(`ledger-${l.id}`));
            return keys;
        }

        const groupsToTraverse = currentActiveGroup 
            ? currentActiveGroup.subgroups || []
            : data.groups || [];

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

        groupsToTraverse.forEach(g => traverseGroup(g));

        if (currentActiveGroup && currentActiveGroup.ledgers) {
            currentActiveGroup.ledgers.forEach(l => {
                if (!searchTerm || l.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                    keys.push(`ledger-${l.id}`);
                }
            });
        }

        return keys;
    };

    // ── Listen to Keyboard Shortcuts ─────────────────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e) => {
            const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName);

            if (showPeriodModal || showFilterModal || showConfigModal) {
                if (e.key === 'Escape') {
                    setShowPeriodModal(false);
                    setShowFilterModal(false);
                    setShowConfigModal(false);
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
                setShowPeriodModal(true);
            } else if (e.key === 'F7') {
                e.preventDefault();
                setViewMode(prev => prev === 'ledgers' ? 'grouped' : 'ledgers');
            } else if (e.key === 'F8') {
                e.preventDefault();
                setShowColumnType(prev => prev === 'all' ? 'closing' : 'all');
            } else if (e.key === 'F4') {
                e.preventDefault();
                setViewMode(prev => prev === 'detailed' ? 'grouped' : 'detailed');
            } else if ((e.key === 's' || e.key === 'S') && e.altKey) {
                e.preventDefault();
                handleExport();
            } else if ((e.key === 'r' || e.key === 'R') && e.altKey) {
                e.preventDefault();
                handlePrint();
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
                if (selectedRowKey && selectedRowKey.startsWith('group-')) {
                    const groupId = parseInt(selectedRowKey.replace('group-', ''), 10);
                    zoomIntoGroup(groupId);
                } else if (selectedRowKey && selectedRowKey.startsWith('ledger-')) {
                    const ledgerId = parseInt(selectedRowKey.replace('ledger-', ''), 10);
                    const l = data?.flat_ledgers?.find(item => item.id === ledgerId);
                    if (l) navigate(`/finance/ledger-details/${l.id}`);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedRowKey, viewMode, expandedGroups, zoomGroupIds, data, searchTerm, showPeriodModal, showFilterModal, showConfigModal]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Export & Print ────────────────────────────────────────────────────────
    const handleExport = () => {
        if (!data || !data.flat_ledgers) return;

        let csv = 'data:text/csv;charset=utf-8,';
        csv += `"${fyInfo.companyHeader}","${fyInfo.companyAddress}","${fyInfo.periodHeader}"\n\n`;
        csv += 'Particulars,Group,Opening Dr (Rs),Opening Cr (Rs),Period Dr (Rs),Period Cr (Rs),Closing Dr (Rs),Closing Cr (Rs)\n';

        const exportList = currentActiveGroup 
            ? data.flat_ledgers.filter(l => l.group_name === currentActiveGroup.name)
            : data.flat_ledgers;

        exportList.forEach(l => {
            csv += `"${l.name}","${l.group_name}",${l.opening_dr},${l.opening_cr},${l.period_dr},${l.period_cr},${l.closing_dr},${l.closing_cr}\n`;
        });

        const totals = data.totals || {};
        csv += `\n"GRAND TOTAL","",${totals.opening_dr},${totals.opening_cr},${totals.period_dr},${totals.period_cr},${totals.closing_dr},${totals.closing_cr}\n`;

        const link = document.createElement('a');
        link.setAttribute('href', encodeURI(csv));
        link.setAttribute('download', `Trial_Balance_${currentActiveGroup ? currentActiveGroup.name : 'Full'}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => window.print();

    // ── Ledger Row Renderer ──────────────────────────────────────────────────
    const renderLedgerRow = (ledger, level = 0) => {
        if (searchTerm && !ledger.name.toLowerCase().includes(searchTerm.toLowerCase())) return null;

        const ledgerKey = `ledger-${ledger.id}`;
        const isLedgerSelected = selectedRowKey === ledgerKey;
        const indentPadding = level * 18;

        return (
            <tr
                key={ledgerKey}
                className="tally-row"
                onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRowKey(ledgerKey);
                    navigate(`/finance/ledger-details/${ledger.id}`);
                }}
                style={{
                    backgroundColor: isLedgerSelected ? (isDark ? '#1e293b' : '#f8fafc') : 'transparent',
                    color: isDark ? '#cbd5e1' : '#1e293b',
                    fontWeight: '400',
                    fontSize: '11px',
                    cursor: 'pointer',
                    height: '22px',
                }}
            >
                <td className="py-1" style={{ paddingLeft: `${24 + indentPadding}px`, borderRight: '1px solid #d4d4d4', fontStyle: 'italic' }}>
                    <i className="fa fa-book me-2 text-muted small" style={{ fontSize: '9px' }}></i>
                    {ledger.name}
                </td>

                {showColumnType === 'all' && (
                    <>
                        <td className="text-end font-monospace pe-2 py-1" style={{ borderRight: '1px solid #d4d4d4' }}>{fmt(ledger.opening_dr)}</td>
                        <td className="text-end font-monospace pe-2 py-1" style={{ borderRight: '1px solid #d4d4d4' }}>{fmt(ledger.opening_cr)}</td>
                        <td className="text-end font-monospace pe-2 py-1" style={{ borderRight: '1px solid #d4d4d4' }}>{fmt(ledger.period_dr)}</td>
                        <td className="text-end font-monospace pe-2 py-1" style={{ borderRight: '1px solid #d4d4d4' }}>{fmt(ledger.period_cr)}</td>
                    </>
                )}

                <td className="text-end font-monospace pe-2 py-1" style={{ borderRight: '1px solid #d4d4d4' }}>{fmt(ledger.closing_dr)}</td>
                <td className="text-end font-monospace pe-2 py-1">{fmt(ledger.closing_cr)}</td>
            </tr>
        );
    };

    // ── Recursive Group Row Renderer ──────────────────────────────────────────
    const renderGroupRow = (group, level = 0) => {
        const isExpanded = viewMode === 'detailed' || !!expandedGroups[group.id];
        const indentPadding = level * 18;

        const hasSubgroups = group.subgroups && group.subgroups.length > 0;
        const hasLedgers = group.ledgers && group.ledgers.length > 0;

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const matchesGroup = group.name.toLowerCase().includes(term);
            const matchesLedger = group.ledgers?.some(l => l.name.toLowerCase().includes(term));
            const matchesSub = group.subgroups?.some(s => s.name.toLowerCase().includes(term));
            if (!matchesGroup && !matchesLedger && !matchesSub) return null;
        }

        const rowKey = `group-${group.id}`;
        const isSelected = selectedRowKey === rowKey;

        return (
            <React.Fragment key={rowKey}>
                <tr
                    className="tally-row"
                    onClick={() => {
                        setSelectedRowKey(rowKey);
                        zoomIntoGroup(group.id);
                    }}
                    onDoubleClick={() => {
                        zoomIntoGroup(group.id);
                    }}
                    style={{
                        backgroundColor: isSelected ? (isDark ? '#1e293b' : '#f8fafc') : 'transparent',
                        color: isDark ? '#e0e0e0' : '#000000',
                        fontWeight: '700',
                        fontSize: '12px',
                        cursor: 'pointer',
                        height: '24px',
                        userSelect: 'none',
                    }}
                    title="Click to open group details"
                >
                    <td className="py-1 ps-2 d-flex align-items-center justify-content-between" style={{ borderRight: '1px solid #d4d4d4', paddingLeft: `${8 + indentPadding}px` }}>
                        <span>
                            <i className="fa fa-folder-open me-2 text-warning small" style={{ fontSize: '11px' }}></i>
                            {group.name}
                        </span>
                        <i className="fa fa-chevron-right text-muted small me-2" style={{ fontSize: '10px' }}></i>
                    </td>

                    {showColumnType === 'all' && (
                        <>
                            <td className="text-end font-monospace pe-2 py-1" style={{ borderRight: '1px solid #d4d4d4' }}>{fmt(group.opening_dr)}</td>
                            <td className="text-end font-monospace pe-2 py-1" style={{ borderRight: '1px solid #d4d4d4' }}>{fmt(group.opening_cr)}</td>
                            <td className="text-end font-monospace pe-2 py-1" style={{ borderRight: '1px solid #d4d4d4' }}>{fmt(group.period_dr)}</td>
                            <td className="text-end font-monospace pe-2 py-1" style={{ borderRight: '1px solid #d4d4d4' }}>{fmt(group.period_cr)}</td>
                        </>
                    )}

                    <td className="text-end font-monospace pe-2 py-1" style={{ borderRight: '1px solid #d4d4d4', width: '160px' }}>
                        {fmt(group.closing_dr)}
                    </td>
                    <td className="text-end font-monospace pe-2 py-1" style={{ width: '160px' }}>
                        {fmt(group.closing_cr)}
                    </td>
                </tr>

                {/* Subgroups */}
                {isExpanded && hasSubgroups && group.subgroups.map(sub => renderGroupRow(sub, level + 1))}

                {/* Ledgers */}
                {isExpanded && hasLedgers && group.ledgers.map(ledger => renderLedgerRow(ledger, level + 1))}
            </React.Fragment>
        );
    };

    const totals = data?.totals || {};

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
                        <Card.Title className="mb-0">Trial Balance</Card.Title>
                        {/* Breadcrumb Trail */}
                        <div className="d-flex align-items-center flex-wrap gap-1 small" style={{ fontSize: '12px' }}>
                            <span className="text-muted">›</span>
                            <span
                                className={zoomGroupIds.length === 0 ? 'text-secondary' : 'text-primary text-decoration-underline'}
                                onClick={() => zoomToPathIndex(-1)}
                                style={{ cursor: zoomGroupIds.length === 0 ? 'default' : 'pointer' }}
                            >
                                Trial Balance
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
                            onClick={() => setShowPeriodModal(true)}
                            style={{ height: '32px', fontSize: '12px' }} title="F3 – Change Period">
                            <span className="badge bg-light text-dark me-1 border" style={{ fontSize: '10px' }}>F3</span> Period
                        </Button>
                        <Button size="sm" className="tally-action-btn"
                            onClick={() => setViewMode(prev => prev === 'ledgers' ? 'grouped' : 'ledgers')}
                            style={{ height: '32px', fontSize: '12px' }} title="F7 – Toggle Group-wise / Ledger-wise">
                            <span className="badge bg-light text-dark me-1 border" style={{ fontSize: '10px' }}>F7</span> {viewMode === 'ledgers' ? 'Group-wise' : 'Ledger-wise'}
                        </Button>
                        <Button size="sm" className="tally-action-btn"
                            onClick={() => setShowColumnType(prev => prev === 'all' ? 'closing' : 'all')}
                            style={{ height: '32px', fontSize: '12px' }} title="F8 – Toggle Columns">
                            <span className="badge bg-light text-dark me-1 border" style={{ fontSize: '10px' }}>F8</span> {showColumnType === 'all' ? 'Closing Only' : 'All Columns'}
                        </Button>
                        <Button size="sm" className="tally-action-btn"
                            onClick={() => setViewMode(prev => prev === 'detailed' ? 'grouped' : 'detailed')}
                            style={{ height: '32px', fontSize: '12px' }} title="F4 – Toggle Detailed / Condensed">
                            <span className="badge bg-light text-dark me-1 border" style={{ fontSize: '10px' }}>F4</span> {viewMode === 'detailed' ? 'Condensed' : 'Detailed'}
                        </Button>
                        <Button size="sm" className="tally-action-btn"
                            onClick={handleExport}
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
                        Trial Balance ({fyInfo.periodHeader})
                    </div>
                </div>

                {/* ════════════ MAIN CONTENT LAYOUT ════════════ */}
                <div className="d-flex">

                    {/* ════════════ TABLE AREA ════════════ */}
                    <div className="flex-grow-1 p-0 d-flex flex-column justify-content-between">

                        {loading ? (
                            <div className="text-center py-5 bg-white rounded my-3">
                                <i className="fa fa-spinner fa-spin me-2 text-primary fs-3"></i>
                                <p className="mt-2 text-muted fw-semibold" style={{ fontSize: 13 }}>Loading Trial Balance...</p>
                            </div>
                        ) : (
                            <div className="tally-grid-box bg-white border-0">
                                <div className="table-responsive">
                                    <table className="w-100 border-0" style={{ fontSize: '13px', borderCollapse: 'collapse' }}>
                                        <thead>
                                            {/* Particulars & Header Block matching screenshot */}
                                            <tr style={{ borderBottom: '1px solid #d4d4d4' }}>
                                                <th className="ps-2 py-3" style={{ borderRight: '1px solid #d4d4d4', verticalAlign: 'bottom', width: '55%' }}>
                                                    <span style={{ fontSize: 14, fontWeight: 'bold', color: '#000' }}>
                                                        {currentActiveGroup ? `Particulars (Under ${currentActiveGroup.name})` : 'P a r t i c u l a r s'}
                                                    </span>
                                                </th>
                                                <th colSpan={showColumnType === 'all' ? 6 : 2} className="text-end pe-2 py-1" style={{ fontSize: 11, fontWeight: 'bold', backgroundColor: '#fcfcfc' }}>
                                                    <div className="fw-bold text-center mt-1" style={{ color: '#000' }}>Closing Balance</div>
                                                    <div className="d-flex justify-content-end gap-5 mt-1 border-top pt-1">
                                                        <span style={{ width: 150, textAlign: 'right' }}>Debit</span>
                                                        <span style={{ width: 150, textAlign: 'right' }}>Credit</span>
                                                    </div>
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {viewMode === 'ledgers' ? (
                                                (currentActiveGroup 
                                                    ? data?.flat_ledgers?.filter(l => l.group_name === currentActiveGroup.name)
                                                    : data?.flat_ledgers)
                                                    ?.filter(l => !searchTerm || l.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                                    ?.map((l) => renderLedgerRow(l, 0))
                                            ) : currentActiveGroup ? (
                                                <>
                                                    {currentActiveGroup.subgroups?.map(sub => renderGroupRow(sub, 0))}
                                                    {currentActiveGroup.ledgers?.map(ledger => renderLedgerRow(ledger, 0))}
                                                    {(!currentActiveGroup.subgroups?.length && !currentActiveGroup.ledgers?.length) && (
                                                        <tr>
                                                            <td colSpan={showColumnType === 'all' ? 7 : 3} className="text-center py-4 text-muted">
                                                                No subgroups or ledgers in this group.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </>
                                            ) : (
                                                data?.groups?.map(group => renderGroupRow(group, 0))
                                            )}
                                        </tbody>

                                        {/* Tally Grand Total / Group Total Footer */}
                                        <tfoot>
                                            <tr style={{
                                                borderTop: '1px solid #000',
                                                borderBottom: '4px double #000',
                                                fontWeight: 'bold',
                                                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                                height: '28px'
                                            }}>
                                                <td className="ps-2 py-1" style={{ borderRight: '1px solid #d4d4d4' }}>
                                                    {currentActiveGroup ? `Total - ${currentActiveGroup.name}` : 'Grand Total'}
                                                </td>
                                                {showColumnType === 'all' && (
                                                    <>
                                                        <td className="text-end font-monospace pe-2 py-1" style={{ borderRight: '1px solid #d4d4d4' }}>
                                                            {fmt(currentActiveGroup ? currentActiveGroup.opening_dr : totals.opening_dr)}
                                                        </td>
                                                        <td className="text-end font-monospace pe-2 py-1" style={{ borderRight: '1px solid #d4d4d4' }}>
                                                            {fmt(currentActiveGroup ? currentActiveGroup.opening_cr : totals.opening_cr)}
                                                        </td>
                                                        <td className="text-end font-monospace pe-2 py-1" style={{ borderRight: '1px solid #d4d4d4' }}>
                                                            {fmt(currentActiveGroup ? currentActiveGroup.period_dr : totals.period_dr)}
                                                        </td>
                                                        <td className="text-end font-monospace pe-2 py-1" style={{ borderRight: '1px solid #d4d4d4' }}>
                                                            {fmt(currentActiveGroup ? currentActiveGroup.period_cr : totals.period_cr)}
                                                        </td>
                                                    </>
                                                )}
                                                <td className="text-end font-monospace pe-2 py-1" style={{ borderRight: '1px solid #d4d4d4' }}>
                                                    {fmt(currentActiveGroup ? currentActiveGroup.closing_dr : totals.closing_dr)}
                                                </td>
                                                <td className="text-end font-monospace pe-2 py-1">
                                                    {fmt(currentActiveGroup ? currentActiveGroup.closing_cr : totals.closing_cr)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Bottom Status Message Strip */}
                        {totals && (
                            <div className="d-flex justify-content-between align-items-center px-3 py-2 border-top small bg-white no-print" style={{
                                backgroundColor: isDark ? '#24303f' : '#ffffff',
                                borderColor: isDark ? '#374557' : '#cbd5e1',
                                borderRadius: '2px'
                            }}>
                                <span className="fw-bold fs-6" style={{ color: totals.is_balanced ? '#16a34a' : '#dc2626' }}>
                                    {currentActiveGroup ? (
                                        `● Group: ${currentActiveGroup.name} (${currentActiveGroup.subgroups?.length || 0} Subgroups, ${currentActiveGroup.ledgers?.length || 0} Ledgers)`
                                    ) : totals.is_balanced
                                        ? '● Trial Balance Matched'
                                        : `● Difference in Opening / Closing: ${fmt(totals.difference)}`}
                                </span>
                            </div>
                        )}

                    </div>

                </div>
                </Card.Body>
                </Card>



                {/* ════════════ F2 CHANGE PERIOD MODAL ════════════ */}
                <Modal show={showPeriodModal} onHide={() => setShowPeriodModal(false)} centered size="sm">
                    <Modal.Header closeButton style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                        <Modal.Title className="fs-6 fw-bold text-dark">Change Period</Modal.Title>
                    </Modal.Header>
                    <Modal.Body className="p-3" style={{ backgroundColor: isDark ? '#0f172a' : '#fff' }}>
                        <Form id="tbPeriodForm" onSubmit={(e) => {
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
                        <Button variant="primary" size="sm" type="submit" form="tbPeriodForm" className="fw-bold px-3" style={{ backgroundColor: '#002b49', borderColor: '#002b49' }}>
                            Apply
                        </Button>
                    </Modal.Footer>
                </Modal>

                {/* ════════════ FILTER MODAL ════════════ */}
                <Modal show={showFilterModal} onHide={() => setShowFilterModal(false)} centered size="sm">
                    <Modal.Header closeButton style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                        <Modal.Title className="fs-6 fw-bold text-dark">Filter Particulars</Modal.Title>
                    </Modal.Header>
                    <Modal.Body className="p-3" style={{ backgroundColor: isDark ? '#0f172a' : '#fff' }}>
                        <Form.Group className="mb-2">
                            <Form.Label className="small fw-bold text-secondary mb-1">Search Group / Ledger Name:</Form.Label>
                            <Form.Control
                                type="text"
                                size="sm"
                                placeholder="Type group or ledger..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                autoFocus
                                style={{ borderRadius: '6px' }}
                            />
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                        <Button variant="light" size="sm" onClick={() => { setSearchTerm(''); setShowFilterModal(false); }}>
                            Clear
                        </Button>
                        <Button variant="primary" size="sm" onClick={() => setShowFilterModal(false)} className="fw-bold px-3" style={{ backgroundColor: '#002b49', borderColor: '#002b49' }}>
                            Apply
                        </Button>
                    </Modal.Footer>
                </Modal>

                {/* ════════════ F12 CONFIGURATION MODAL ════════════ */}
                <Modal show={showConfigModal} onHide={() => setShowConfigModal(false)} centered size="md">
                    <Modal.Header closeButton style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                        <Modal.Title className="fs-6 fw-bold text-dark">Trial Balance Configuration (F12)</Modal.Title>
                    </Modal.Header>
                    <Modal.Body className="p-3" style={{ backgroundColor: isDark ? '#0f172a' : '#fff' }}>
                        <Form>
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
                                id="showOpeningBalance"
                                label="Show Opening Balance Columns"
                                checked={config.showOpeningBalance}
                                onChange={e => setConfig(c => ({ ...c, showOpeningBalance: e.target.checked }))}
                                className="mb-3 fw-semibold"
                            />
                            <Form.Check
                                type="switch"
                                id="showTransactions"
                                label="Show Period Debit / Credit Transactions"
                                checked={config.showTransactions}
                                onChange={e => setConfig(c => ({ ...c, showTransactions: e.target.checked }))}
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

export default TrialBalance;
