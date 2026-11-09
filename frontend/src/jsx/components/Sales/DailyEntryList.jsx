import React, { useState } from 'react';
import { Card, Button, Form, Modal, Badge, Row, Col } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import CreateButton from '../../../components/permissions/CreateButton';
import DailyEntryCharts from './DailyEntryCharts';

import { formatDate } from '../../../utils/dateUtils';

// ── Helper: format currency ───────────────────────────────────────────────────
const formatCurrency = (val) =>
    parseFloat(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

// ── Summary Stat Card ─────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon, color, bg }) => (
    <div
        className="d-flex align-items-center gap-3 p-3 rounded-3"
        style={{ background: bg, border: `1.5px solid ${color}22`, flex: '1 1 180px', minWidth: '160px' }}
    >
        <div
            className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
            style={{ width: 48, height: 48, background: `${color}18`, fontSize: 22 }}
        >
            {icon}
        </div>
        <div>
            <div className="small text-muted mb-1" style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {label}
            </div>
            <div className="fw-bold" style={{ fontSize: '0.95rem', color }}>
                {value}
            </div>
        </div>
    </div>
);

// ── Day Card ─────────────────────────────────────────────────────────────────
const DayCard = ({ entry, idx, onEdit, onDelete, onClick }) => {
    const totalProdQty = (entry.production_items || []).reduce(
        (sum, p) => sum + parseFloat(p.quantity || 0), 0
    );

    return (
        <div
            onClick={onClick}
            style={{
                background: '#fff',
                border: '1.5px solid #e9ecef',
                borderRadius: 14,
                padding: '16px 20px',
                cursor: 'pointer',
                transition: 'box-shadow 0.18s, border-color 0.18s, transform 0.15s',
                position: 'relative',
                overflow: 'hidden'
            }}
            onMouseEnter={e => {
                e.currentTarget.style.boxShadow = '0 6px 24px rgba(99,102,241,0.13)';
                e.currentTarget.style.borderColor = '#6366f1';
                e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = '#e9ecef';
                e.currentTarget.style.transform = 'translateY(0)';
            }}
        >
            {/* Left accent bar */}
            <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: 4, borderRadius: '14px 0 0 14px',
                background: 'linear-gradient(180deg,#6366f1,#8b5cf6)'
            }} />

            <div className="d-flex flex-wrap align-items-start justify-content-between gap-2">
                {/* Date + badge */}
                <div>
                    <div className="fw-bold text-dark" style={{ fontSize: '1rem' }}>
                        {formatDate(entry.entry_date)}
                    </div>
                    <div className="mt-1">
                        {entry.production_items?.length > 0 ? (
                            <Badge bg="primary" style={{ fontSize: '0.7rem', borderRadius: 6 }}>
                                {entry.production_items.length} Product{entry.production_items.length > 1 ? 's' : ''}
                            </Badge>
                        ) : (
                            <Badge bg="secondary" style={{ fontSize: '0.7rem', borderRadius: 6 }}>No Production</Badge>
                        )}
                    </div>
                </div>

                {/* Three metrics */}
                <div className="d-flex flex-wrap gap-3 align-items-center">
                    <div className="text-center">
                        <div className="small text-muted" style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 600 }}>Produced Qty</div>
                        <div className="fw-bold" style={{ fontSize: '1rem', color: '#6366f1' }}>
                            {totalProdQty.toLocaleString('en-IN')}
                        </div>
                    </div>
                    <div style={{ width: 1, height: 36, background: '#e9ecef' }} />
                    <div className="text-center">
                        <div className="small text-muted" style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 600 }}>Sales</div>
                        <div className="fw-bold" style={{ fontSize: '1rem', color: '#16a34a' }}>
                            {formatCurrency(entry.total_sales)}
                        </div>
                    </div>
                    <div style={{ width: 1, height: 36, background: '#e9ecef' }} />
                    <div className="text-center">
                        <div className="small text-muted" style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 600 }}>Outstanding</div>
                        <div className="fw-bold" style={{ fontSize: '1rem', color: '#dc2626' }}>
                            {formatCurrency(entry.total_outstanding)}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                {(onEdit || onDelete) && (
                    <div
                        className="d-flex gap-1 align-items-center"
                        onClick={e => e.stopPropagation()}   // don't open modal when clicking Edit/Delete
                    >
                        {onEdit && <EditButton module="sales" onClick={() => onEdit(entry)} title="Edit" />}
                        {onDelete && <DeleteButton module="sales" onClick={() => onDelete(entry.id)} title="Delete" />}
                    </div>
                )}
            </div>

            {/* Hint text */}
            <div className="mt-2" style={{ fontSize: '0.72rem', color: '#a0a0b0' }}>
                Click to view production breakdown →
            </div>
        </div>
    );
};

// ── Production Detail Modal ────────────────────────────────────────────────────
const DetailModal = ({ entry, show, onHide }) => {
    if (!entry) return null;

    const totalProdQty = (entry.production_items || []).reduce(
        (sum, p) => sum + parseFloat(p.quantity || 0), 0
    );

    const totalSalesQty = (entry.production_items || []).reduce(
        (sum, p) => sum + parseFloat(p.sales_quantity || 0), 0
    );

    return (
        <Modal show={show} onHide={onHide} centered size="md">
            <Modal.Header closeButton style={{ borderBottom: '1px solid #e9ecef', background: '#f8f9fa' }}>
                <Modal.Title style={{ fontSize: '1rem', fontWeight: 700 }}>
                    📋 Daily Summary — {formatDate(entry.entry_date)}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body className="p-4">
                {/* Top totals row */}
                <div className="d-flex gap-3 flex-wrap mb-4">
                    <div className="flex-fill p-3 rounded-3 text-center" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                        <div className="small text-muted mb-1" style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Total Sales</div>
                        <div className="fw-bold" style={{ fontSize: '1.2rem', color: '#16a34a' }}>{formatCurrency(entry.total_sales)}</div>
                    </div>
                    <div className="flex-fill p-3 rounded-3 text-center" style={{ background: '#ecfeff', border: '1px solid #a5f3fc' }}>
                        <div className="small text-muted mb-1" style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Total Sales Qty</div>
                        <div className="fw-bold" style={{ fontSize: '1.2rem', color: '#0891b2' }}>{totalSalesQty.toLocaleString('en-IN')}</div>
                    </div>
                    <div className="flex-fill p-3 rounded-3 text-center" style={{ background: '#fff1f2', border: '1px solid #fecdd3' }}>
                        <div className="small text-muted mb-1" style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Outstanding</div>
                        <div className="fw-bold" style={{ fontSize: '1.2rem', color: '#dc2626' }}>{formatCurrency(entry.total_outstanding)}</div>
                    </div>
                    <div className="flex-fill p-3 rounded-3 text-center" style={{ background: '#eef2ff', border: '1px solid #c7d2fe' }}>
                        <div className="small text-muted mb-1" style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Total Produced</div>
                        <div className="fw-bold" style={{ fontSize: '1.2rem', color: '#6366f1' }}>{totalProdQty.toLocaleString('en-IN')}</div>
                    </div>
                </div>

                {/* Production & Sales 2-Column Table */}
                <div style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.04em', marginBottom: 10 }}>
                    🏭 MIS Breakdown
                </div>
                {entry.production_items && entry.production_items.length > 0 ? (
                    <div className="table-responsive rounded-3 border">
                        <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.88rem' }}>
                            <thead style={{ background: '#f8fafc' }}>
                                <tr className="text-uppercase text-muted" style={{ fontSize: '0.75rem', letterSpacing: '0.04em' }}>
                                    <th className="ps-3" style={{ width: '40px' }}>#</th>
                                    <th>Product Name</th>
                                    <th className="text-end" style={{ width: '180px', color: '#4f46e5', background: '#eef2ff' }}>
                                        1. Production
                                    </th>
                                    <th className="text-end pe-3" style={{ width: '180px', color: '#16a34a', background: '#f0fdf4' }}>
                                        2. Sales
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {entry.production_items.map((prod, i) => (
                                    <tr key={i}>
                                        <td className="ps-3 text-muted" style={{ fontSize: '0.8rem' }}>{i + 1}</td>
                                        <td className="fw-semibold text-dark">
                                            {prod.product_name || `Product #${prod.product}`}
                                        </td>
                                        <td className="text-end fw-bold" style={{ color: '#4f46e5' }}>
                                            {parseFloat(prod.quantity || 0).toLocaleString('en-IN')}{' '}
                                            <small className="text-muted fw-normal">{prod.unit_name || 'units'}</small>
                                        </td>
                                        <td className="text-end pe-3 fw-bold" style={{ color: '#16a34a' }}>
                                            {parseFloat(prod.sales_quantity || 0).toLocaleString('en-IN')}{' '}
                                            <small className="text-muted fw-normal">{prod.unit_name || 'units'}</small>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot style={{ background: '#f1f5f9', borderTop: '2px solid #cbd5e1' }}>
                                <tr className="fw-bold">
                                    <td colSpan="2" className="ps-3 text-dark">TOTAL</td>
                                    <td className="text-end fw-bold" style={{ color: '#4f46e5', fontSize: '0.95rem' }}>
                                        {totalProdQty.toLocaleString('en-IN')}
                                    </td>
                                    <td className="text-end pe-3 fw-bold" style={{ color: '#16a34a', fontSize: '0.95rem' }}>
                                        {totalSalesQty.toLocaleString('en-IN')}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-3 text-muted">
                        <div style={{ fontSize: '2rem' }}>📦</div>
                        <div className="small">No production details recorded.</div>
                    </div>
                )}
            </Modal.Body>
            <Modal.Footer style={{ borderTop: '1px solid #e9ecef', background: '#f8f9fa' }}>
                <Button variant="secondary" size="sm" onClick={onHide} style={{ borderRadius: 8 }}>
                    Close
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const DailyEntryList = ({
    data = [],
    loading = false,
    fromDate = '',
    toDate = '',
    onFromDateChange,
    onToDateChange,
    onEdit,
    onDelete,
    onAdd,
    can,
    defaultViewMode = 'list',
    isReport = false
}) => {
    const [selectedEntry, setSelectedEntry] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [viewMode, setViewMode] = useState(defaultViewMode); // 'list' or 'chart'

    const handleCardClick = (entry) => {
        setSelectedEntry(entry);
        setShowModal(true);
    };

    // Aggregated totals across filtered data
    const totalSales = data.reduce((s, e) => s + parseFloat(e.total_sales || 0), 0);
    const totalOutstanding = data.reduce((s, e) => s + parseFloat(e.total_outstanding || 0), 0);
    const totalProductionQty = data.reduce((s, e) =>
        s + (e.production_items || []).reduce((ps, p) => ps + parseFloat(p.quantity || 0), 0), 0
    );
    const totalSalesQty = data.reduce((s, e) =>
        s + (e.production_items || []).reduce((ps, p) => ps + parseFloat(p.sales_quantity || 0), 0), 0
    );

    const dateRangeLabel = fromDate || toDate
        ? `${fromDate || '...'} → ${toDate || '...'}`
        : 'All Time';

    return (
        <>
            {/* ── Page Header Bar ─────────────────────────────────────── */}
            <div
                className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 p-3 rounded-3"
                style={{ background: '#fff', border: '1px solid #e9ecef' }}
            >
                <div className="d-flex align-items-center gap-3 flex-wrap">
                    <div className="fw-bold text-dark" style={{ fontSize: '1rem' }}>
                        Daily Summaries
                        {data.length > 0 && (
                            <span className="ms-2 badge bg-primary rounded-pill" style={{ fontSize: '0.75rem' }}>
                                {data.length}
                            </span>
                        )}
                    </div>

                    {/* View Switcher */}
                    {isReport && (
                        <div className="d-flex align-items-center gap-1 bg-light p-1 rounded-3 d-print-none" style={{ border: '1px solid #e9ecef' }}>
                            <Button
                                variant={viewMode === 'list' ? 'primary' : 'light'}
                                size="sm"
                                onClick={() => setViewMode('list')}
                                style={{ borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, padding: '4px 12px' }}
                            >
                                📋 List
                            </Button>
                            <Button
                                variant={viewMode === 'chart' ? 'primary' : 'light'}
                                size="sm"
                                onClick={() => setViewMode('chart')}
                                style={{ borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, padding: '4px 12px' }}
                            >
                                📊 Graphs
                            </Button>
                        </div>
                    )}
                </div>

                {/* Date Filter */}
                <div className="d-flex align-items-center gap-2 flex-wrap">
                    <span className="small text-muted" style={{ whiteSpace: 'nowrap' }}>From:</span>
                    <Form.Control
                        type="date"
                        value={fromDate}
                        onChange={(e) => onFromDateChange(e.target.value)}
                        style={{ height: '36px', borderRadius: '8px', width: '150px', fontSize: '0.85rem' }}
                    />
                    <span className="small text-muted" style={{ whiteSpace: 'nowrap' }}>To:</span>
                    <Form.Control
                        type="date"
                        value={toDate}
                        onChange={(e) => onToDateChange(e.target.value)}
                        style={{ height: '36px', borderRadius: '8px', width: '150px', fontSize: '0.85rem' }}
                    />
                </div>


                {/* Navigation and Add Button */}
                {!isReport && onAdd && (
                    <div className="d-flex align-items-center gap-2">
                        <CreateButton module="sales" onClick={onAdd}>
                            Daily Summary
                        </CreateButton>
                    </div>
                )}
            </div>

            {/* ── Summary Stat Cards ───────────────────────────────────── */}
            {isReport && data.length > 0 && (
                <div className="mb-4">
                    <div className="small text-muted mb-2 fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        📊 Totals for: {dateRangeLabel}
                    </div>
                    <div className="d-flex flex-wrap gap-3">
                        <StatCard
                            label="Total Production Qty"
                            value={totalProductionQty.toLocaleString('en-IN')}
                            icon="🏭"
                            color="#6366f1"
                            bg="#f5f3ff"
                        />
                        <StatCard
                            label="Total Sales Qty"
                            value={totalSalesQty.toLocaleString('en-IN')}
                            icon="📦"
                            color="#06b6d4"
                            bg="#ecfeff"
                        />
                        <StatCard
                            label="Total Sales"
                            value={formatCurrency(totalSales)}
                            icon="💰"
                            color="#16a34a"
                            bg="#f0fdf4"
                        />
                        <StatCard
                            label="Total Outstanding"
                            value={formatCurrency(totalOutstanding)}
                            icon="⚠️"
                            color="#dc2626"
                            bg="#fff1f2"
                        />
                    </div>
                </div>
            )}

            {/* ── Day Cards / Charts ────────────────────────────────────── */}
            {viewMode === 'chart' ? (
                <DailyEntryCharts data={data} />
            ) : loading ? (
                <div className="text-center py-5 text-muted">
                    <div className="spinner-border spinner-border-sm me-2" role="status" />
                    Loading entries...
                </div>
            ) : data.length === 0 ? (
                <div className="text-center py-5" style={{ color: '#adb5bd' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 12 }}>📋</div>
                    <div className="fw-semibold" style={{ fontSize: '1rem' }}>No daily entries found</div>
                    <div className="small mt-1">Use the date filter or add a new daily summary.</div>
                </div>
            ) : (
                <div className="d-flex flex-column gap-3">
                    {data.map((entry, idx) => (
                        <DayCard
                            key={entry.id || idx}
                            entry={entry}
                            idx={idx}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onClick={() => handleCardClick(entry)}
                        />
                    ))}
                </div>
            )}

            {/* ── Detail Modal ─────────────────────────────────────────── */}
            <DetailModal
                entry={selectedEntry}
                show={showModal}
                onHide={() => setShowModal(false)}
            />
        </>
    );
};

export default DailyEntryList;
