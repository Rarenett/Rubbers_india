import React, { useState, useEffect, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Card, Button, Modal, Form, Row, Col, Table } from 'react-bootstrap';
import Swal from 'sweetalert2';
import Select from 'react-select';
import { ThemeContext } from '../../../context/ThemeContext';
import { getLedgers, getJournals, createJournal, updateJournal, deleteJournal } from '../../../services/FinanceService';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import InventoryService from '../../../services/InventoryService';
import PurchaseService from '../../../services/PurchaseService';
import SalesService from '../../../services/SalesService';
import { fetchCompany, fetchCompanyAddresses, fetchCompanyContacts, fetchBranches } from '../../../services/CompanyService';
import { fetchPrefixConfigurations, generateNextVoucherNumber } from '../../../services/PrefixService';
import { printFriendlyVoucher } from '../../../services/VoucherPrintService';

// ─── Bill Settlement Popup Component ───────────────────────────────────────
const BillSettlementPopup = ({ show, onHide, invoices, ledgerName, totalAmount, existingAllocations, onApply, isDark, voucherType = 'Payment', isEditMode = false }) => {
    const [rows, setRows] = useState([]);

    const getRemainingAmount = (currentRows, excludeIdx) => {
        const allocated = currentRows.reduce((sum, r, idx) => {
            if (idx === excludeIdx) return sum;
            if (r.isInvoice && !r.selected) return sum;
            return sum + (parseFloat(r.settleAmount) || 0);
        }, 0);
        return parseFloat(totalAmount) - allocated;
    };

    useEffect(() => {
        if (!show) return;
        
        const activeAllocs = existingAllocations || [];
        
        // Filter out invoices that are already settled (excluding allocations in this payment)
        const visibleInvoices = invoices.filter(inv => {
            const ex = activeAllocs.find(a => String(a.invoiceId) === String(inv.id) && (a.refType === 'against_ref' || !a.refType));
            const exAmt = ex ? parseFloat(ex.settleAmount || 0) : 0;
            const dbOutstanding = inv.outstanding_amount !== undefined ? parseFloat(inv.outstanding_amount) : parseFloat(inv.total_amount || 0);
            const availableAmt = dbOutstanding + exAmt;
            return availableAmt > 0.01;
        });

        // 1. Map outstanding invoices to invoice rows
        const initialInvoiceRows = visibleInvoices.map(inv => {
            const ex = activeAllocs.find(a => String(a.invoiceId) === String(inv.id) && (a.refType === 'against_ref' || !a.refType));
            const exAmt = ex ? parseFloat(ex.settleAmount || 0) : 0;
            const dbOutstanding = inv.outstanding_amount !== undefined ? parseFloat(inv.outstanding_amount) : parseFloat(inv.total_amount || 0);
            const invoiceTotal = parseFloat(inv.total_amount || 0);
            
            return {
                isInvoice: true,
                invoiceId: inv.id,
                refType: 'against_ref',
                refName: inv.invoice_no,
                invoiceDate: inv.entry_date || '',
                invoiceTotal: invoiceTotal,
                // Only add exAmt back when editing a SAVED voucher (server already deducted this amount).
                // For new unsaved payments, server hasn't deducted anything, so outstanding is already correct.
                outstandingAmount: isEditMode ? (dbOutstanding + exAmt) : dbOutstanding,
                alreadyAllocated: Math.max(0, invoiceTotal - dbOutstanding),
                selected: !!ex,
                settleAmount: ex ? parseFloat(ex.settleAmount) : 0
            };
        });

        // 2. Map other custom references from activeAllocs
        const initialCustomRows = activeAllocs
            .filter(a => a.refType && a.refType !== 'against_ref')
            .map(a => ({
                isInvoice: false,
                refType: a.refType,
                refName: a.refName || '',
                settleAmount: parseFloat(a.settleAmount) || 0
            }));

        // If new allocation, auto FIFO allocate
        if (activeAllocs.length === 0) {
            let remainingVal = parseFloat(totalAmount) || 0;
            initialInvoiceRows.forEach(row => {
                if (remainingVal > 0) {
                    row.selected = true;
                    const settleAmt = Math.min(row.outstandingAmount, remainingVal);
                    row.settleAmount = parseFloat(settleAmt.toFixed(2));
                    remainingVal -= settleAmt;
                }
            });
            if (remainingVal > 0.01) {
                initialCustomRows.push({
                    isInvoice: false,
                    refType: 'on_account',
                    refName: 'On Account',
                    settleAmount: parseFloat(remainingVal.toFixed(2))
                });
            }
        }

        setRows([...initialInvoiceRows, ...initialCustomRows]);
    }, [show, invoices, totalAmount, existingAllocations]);

    useEffect(() => {
        if (show) {
            const timer = setTimeout(() => {
                const firstInput = document.getElementById('settle-amount-0');
                if (firstInput) {
                    firstInput.focus();
                    if (firstInput.select) firstInput.select();
                }
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [show]);

    const toggleInvoice = (idx) => {
        setRows(prev => prev.map((r, i) => {
            if (i === idx) {
                const nextSelected = !r.selected;
                const rem = getRemainingAmount(prev, idx);
                return {
                    ...r,
                    selected: nextSelected,
                    settleAmount: nextSelected ? parseFloat(Math.min(r.outstandingAmount, Math.max(0, rem)).toFixed(2)) : 0
                };
            }
            return r;
        }));
    };

    const updateAmount = (idx, val) => {
        setRows(prev => prev.map((r, i) => {
            if (i === idx) {
                const nextVal = parseFloat(val) || 0;
                return {
                    ...r,
                    selected: r.isInvoice ? nextVal > 0 : undefined,
                    settleAmount: nextVal
                };
            }
            return r;
        }));
    };

    const setFullAmount = (idx) => {
        setRows(prev => prev.map((r, i) => {
            if (i === idx) {
                return {
                    ...r,
                    selected: true,
                    settleAmount: r.outstandingAmount
                };
            }
            return r;
        }));
    };

    const addCustomRow = () => {
        const allocated = rows.reduce((sum, r) => {
            if (r.isInvoice && !r.selected) return sum;
            return sum + (parseFloat(r.settleAmount) || 0);
        }, 0);
        const remaining = Math.max(0, parseFloat(totalAmount) - allocated);
        
        setRows([...rows, {
            isInvoice: false,
            refType: 'new_ref',
            refName: '',
            settleAmount: parseFloat(remaining.toFixed(2))
        }]);
    };

    const removeCustomRow = (idx) => {
        setRows(rows.filter((_, i) => i !== idx));
    };

    const updateCustomRowField = (idx, field, value) => {
        setRows(prev => prev.map((r, i) => {
            if (i === idx) {
                const updated = { ...r, [field]: value };
                if (field === 'refType' && value === 'on_account') {
                    updated.refName = 'On Account';
                }
                return updated;
            }
            return r;
        }));
    };

    const totalAllocated = rows.reduce((s, r) => {
        if (r.isInvoice && !r.selected) return s;
        return s + (parseFloat(r.settleAmount) || 0);
    }, 0);
    const unallocated = parseFloat(totalAmount) - totalAllocated;
    const isSaveDisabled = Math.abs(unallocated) > 0.01;

    const handleSave = () => {
        const validAllocations = rows
            .filter(r => (!r.isInvoice || r.selected) && (parseFloat(r.settleAmount) || 0) > 0.01)
            .map(r => ({
                refType: r.refType,
                invoiceId: r.isInvoice ? r.invoiceId : null,
                refName: r.refName,
                invoiceNo: r.refName,
                settleAmount: parseFloat(r.settleAmount) || 0
            }));
        onApply(validAllocations);
    };

    const billCount = rows.filter(r => (r.isInvoice && r.selected) || (!r.isInvoice && r.settleAmount > 0)).length;

    return (
        <Modal show={show} onHide={onHide} size="lg" centered restoreFocus={false} enforceFocus={false}>
            <Modal.Header closeButton style={{ background: isDark ? '#1a1f26' : '#f0f4ff', borderBottom: '2px solid #3b6fd4' }}>
                <Modal.Title>
                    <div className="d-flex align-items-center gap-2">
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#3b6fd4,#6ea4ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <i className="fa fa-file-invoice-dollar text-white" style={{ fontSize: 16 }}></i>
                        </div>
                        <div>
                            <div className="fw-bold" style={{ fontSize: 15, color: isDark ? '#fff' : '#1a1f3c' }}>Bill-Wise Settlement</div>
                            <div style={{ fontSize: 12, color: '#6b7a99' }}>{ledgerName} — {voucherType} {parseFloat(totalAmount || 0).toFixed(2)}</div>
                        </div>
                    </div>
                </Modal.Title>
            </Modal.Header>

            {/* Summary bar */}
            <div style={{ display: 'flex', gap: 40, padding: '12px 24px', background: isDark ? '#232b36' : '#e8f0fe', borderBottom: '1px solid #c5d2f6', flexWrap: 'wrap' }}>
                {[
                    { label: `${voucherType.toUpperCase()} AMOUNT`, val: parseFloat(totalAmount || 0).toFixed(2), color: isDark ? '#fff' : '#1a1f3c' },
                    { label: 'ALLOCATED', val: totalAllocated.toFixed(2), color: '#27ae60' },
                    { label: 'UNALLOCATED / ON A/C', val: unallocated.toFixed(2), color: Math.abs(unallocated) > 0.01 ? '#dc3545' : '#27ae60' }
                ].map(item => (
                    <div key={item.label}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7a99', letterSpacing: 0.5, marginBottom: 2 }}>{item.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: item.color, fontFamily: 'monospace' }}>{item.val}</div>
                    </div>
                ))}
            </div>

            <Modal.Body className="p-0" style={{ backgroundColor: isDark ? '#1a222c' : '#fff' }}>
                <div className="table-responsive" style={{ maxHeight: '350px' }}>
                    <Table hover bordered className="align-middle mb-0 text-center custom-bill-table" style={{ fontSize: 13 }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: isDark ? '#2a3240' : '#f5f7ff' }}>
                            <tr>
                                <th style={{ width: '6%', padding: '10px 8px', borderBottom: '2px solid #c5d2f6', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#3b4a6b' }}>Select</th>
                                <th style={{ width: '16%', padding: '10px 8px', borderBottom: '2px solid #c5d2f6', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#3b4a6b' }}>Type of Ref</th>
                                <th style={{ width: '18%', padding: '10px 8px', borderBottom: '2px solid #c5d2f6', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#3b4a6b' }}>Invoice No / Name</th>
                                <th style={{ width: '10%', padding: '10px 8px', borderBottom: '2px solid #c5d2f6', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#3b4a6b' }}>Date</th>
                                <th style={{ width: '11%', padding: '10px 8px', borderBottom: '2px solid #c5d2f6', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#3b4a6b' }}>Invoice Total ()</th>
                                <th style={{ width: '11%', padding: '10px 8px', borderBottom: '2px solid #c5d2f6', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#dc3545' }}>Allocated ()</th>
                                <th style={{ width: '11%', padding: '10px 8px', borderBottom: '2px solid #c5d2f6', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#27ae60' }}>Balance ()</th>
                                <th style={{ width: '12%', padding: '10px 8px', borderBottom: '2px solid #c5d2f6', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#3b4a6b' }}>Settle Amount ()</th>
                                <th style={{ width: '5%', padding: '10px 8px', borderBottom: '2px solid #c5d2f6', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#3b4a6b' }}>Full</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, idx) => {
                                return (
                                    <tr key={idx} style={{ background: row.isInvoice && row.selected ? (isDark ? '#1e2d4a' : '#f0f4ff') : 'transparent' }}>
                                        {/* Select / Delete Checkbox */}
                                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #e5eaf5' }}>
                                            {row.isInvoice ? (
                                                <div 
                                                    onClick={() => toggleInvoice(idx)}
                                                    style={{
                                                        width: '20px',
                                                        height: '20px',
                                                        borderRadius: '4px',
                                                        border: '2px solid ' + (row.selected ? '#2ecc71' : '#ced4da'),
                                                        backgroundColor: row.selected ? '#2ecc71' : 'transparent',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: 'pointer',
                                                        margin: '0 auto'
                                                    }}
                                                >
                                                    {row.selected && <i className="fa fa-check text-white" style={{ fontSize: '11px' }}></i>}
                                                </div>
                                            ) : (
                                                <div 
                                                    onClick={() => removeCustomRow(idx)}
                                                    style={{
                                                        width: '20px',
                                                        height: '20px',
                                                        borderRadius: '4px',
                                                        border: '2px solid #dc3545',
                                                        backgroundColor: 'transparent',
                                                        color: '#dc3545',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: 'pointer',
                                                        margin: '0 auto'
                                                    }}
                                                    title="Remove Reference Row"
                                                >
                                                    <i className="fa fa-times" style={{ fontSize: '11px' }}></i>
                                                </div>
                                            )}
                                        </td>

                                        {/* Type of Ref */}
                                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #e5eaf5' }}>
                                            {row.isInvoice ? (
                                                <span className="badge bg-light text-secondary border px-2.5 py-1.5 fw-semibold" style={{ fontSize: 11 }}>
                                                    Against Ref
                                                </span>
                                            ) : (
                                                <Form.Select
                                                    size="sm"
                                                    id={`bill-reftype-${idx}`}
                                                    value={row.refType}
                                                    onChange={e => updateCustomRowField(idx, 'refType', e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            const targetId = row.refType === 'on_account' ? `settle-amount-${idx}` : `bill-refname-${idx}`;
                                                            const targetEl = document.getElementById(targetId);
                                                            if (targetEl) { targetEl.focus(); if (targetEl.select) targetEl.select(); }
                                                        }
                                                    }}
                                                    className="border-secondary border-opacity-25 py-0.5"
                                                    style={{ fontSize: 12 }}
                                                >
                                                    <option value="new_ref">New Reference</option>
                                                    <option value="advance">Advance</option>
                                                    <option value="on_account">On Account</option>
                                                </Form.Select>
                                            )}
                                        </td>

                                        {/* Name / Ref Identifier */}
                                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #e5eaf5' }}>
                                            {row.isInvoice ? (
                                                <span className="fw-semibold text-primary">{row.refName}</span>
                                            ) : row.refType === 'on_account' ? (
                                                <Form.Control
                                                    size="sm"
                                                    type="text"
                                                    value="On Account"
                                                    disabled
                                                    className="border-secondary border-opacity-25 bg-light text-muted fw-semibold py-0.5"
                                                    style={{ fontSize: 12 }}
                                                />
                                            ) : (
                                                <Form.Control
                                                    size="sm"
                                                    id={`bill-refname-${idx}`}
                                                    type="text"
                                                    placeholder="Reference Name"
                                                    value={row.refName}
                                                    onChange={e => updateCustomRowField(idx, 'refName', e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            const targetEl = document.getElementById(`settle-amount-${idx}`);
                                                            if (targetEl) { targetEl.focus(); if (targetEl.select) targetEl.select(); }
                                                        }
                                                    }}
                                                    className="border-secondary border-opacity-25 py-0.5"
                                                    style={{ fontSize: 12 }}
                                                />
                                            )}
                                        </td>

                                        {/* Date */}
                                        <td className="text-muted small" style={{ padding: '8px 8px', borderBottom: '1px solid #e5eaf5' }}>
                                            {row.isInvoice ? row.invoiceDate : '—'}
                                        </td>

                                        {/* Invoice Total */}
                                        <td className="font-monospace fw-semibold" style={{ padding: '8px 8px', borderBottom: '1px solid #e5eaf5', color: '#3b4a6b' }}>
                                            {row.isInvoice ? parseFloat(row.invoiceTotal || row.outstandingAmount).toFixed(2) : '—'}
                                        </td>

                                        {/* Already Allocated */}
                                        <td className="font-monospace fw-semibold" style={{ padding: '8px 8px', borderBottom: '1px solid #e5eaf5', color: row.isInvoice && row.alreadyAllocated > 0.01 ? '#dc3545' : '#aaa' }}>
                                            {row.isInvoice ? parseFloat(row.alreadyAllocated || 0).toFixed(2) : '—'}
                                        </td>

                                        {/* Balance (outstanding) */}
                                        <td className="font-monospace fw-semibold" style={{ padding: '8px 8px', borderBottom: '1px solid #e5eaf5', color: '#27ae60' }}>
                                            {row.isInvoice ? parseFloat(row.outstandingAmount).toFixed(2) : '—'}
                                        </td>

                                        {/* Settle Amount */}
                                        <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5eaf5' }}>
                                            <Form.Control
                                                size="sm"
                                                id={`settle-amount-${idx}`}
                                                type="number"
                                                step="0.01"
                                                placeholder="0.00"
                                                value={row.settleAmount || ''}
                                                onChange={e => updateAmount(idx, e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        if (idx < rows.length - 1) {
                                                            const nextEl = document.getElementById(`settle-amount-${idx + 1}`);
                                                            if (nextEl) { nextEl.focus(); if (nextEl.select) nextEl.select(); }
                                                        } else {
                                                            const applyBtn = document.getElementById('bill-apply-btn');
                                                            if (applyBtn) {
                                                                applyBtn.focus();
                                                            } else if (!isSaveDisabled) {
                                                                handleSave();
                                                            }
                                                        }
                                                    }
                                                }}
                                                className="text-end font-monospace border-secondary border-opacity-25 py-0.5"
                                                style={{ width: '110px', fontSize: 13, margin: '0 auto' }}
                                            />
                                        </td>

                                        {/* Full */}
                                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #e5eaf5' }}>
                                            {row.isInvoice ? (
                                                <button
                                                    type="button"
                                                    title="Settle Full"
                                                    onClick={() => setFullAmount(idx)}
                                                    className="btn btn-xs btn-link p-0 text-primary border-0"
                                                    style={{ fontSize: 14 }}
                                                >
                                                    <i className="fa fa-check-double" style={{ color: '#3b6fd4' }}></i>
                                                </button>
                                            ) : '—'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </Table>
                </div>

                <div className="d-flex justify-content-between align-items-center p-3">
                    <Button
                        variant="info"
                        size="sm"
                        onClick={addCustomRow}
                        className="text-white fw-semibold px-3 py-1.5 rounded-3 shadow-sm d-flex align-items-center gap-1"
                        style={{ backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' }}
                    >
                        <i className="fa fa-plus"></i> Add Row
                    </Button>
                </div>
            </Modal.Body>

            <Modal.Footer className="border-0 px-4 pb-4 bg-light rounded-bottom-4 d-flex justify-content-between align-items-center">
                <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => {
                        onApply([]);
                    }}
                    className="px-4 py-2 rounded-3 fw-bold"
                    style={{ borderColor: '#7030a0', color: '#7030a0', background: 'transparent' }}
                >
                    <i className="fa fa-times me-1"></i> Clear / On Account
                </Button>
                
                <div className="d-flex gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onHide}
                        className="px-4 py-2 border-0 rounded-3 text-dark fw-semibold"
                        style={{ backgroundColor: '#e2e8f0', color: '#1e293b' }}
                    >
                        Cancel
                    </Button>
                    
                    <Button
                        id="bill-apply-btn"
                        variant="primary"
                        size="sm"
                        onClick={handleSave}
                        disabled={isSaveDisabled}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !isSaveDisabled) {
                                e.preventDefault();
                                handleSave();
                            }
                        }}
                        className="px-4 py-2 border-0 rounded-3 fw-bold shadow-sm"
                        style={{ backgroundColor: '#3b6fd4', color: '#fff' }}
                    >
                        <i className="fa fa-check me-1"></i> Apply {billCount > 0 ? `(${billCount} Bill${billCount > 1 ? 's' : ''})` : ''}
                    </Button>
                </div>
            </Modal.Footer>
        </Modal>
    );
};

const JournalList = () => {
    const location = useLocation();
    const [journals, setJournals] = useState([]);
    const [ledgers, setLedgers] = useState([]);
    const [loading, setLoading] = useState(true);
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const firstDayOfMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    const lastDayObj = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const lastDayOfMonth = `${lastDayObj.getFullYear()}-${pad(lastDayObj.getMonth() + 1)}-${pad(lastDayObj.getDate())}`;

    const [searchTerm, setSearchTerm] = useState('');
    const [fromDate, setFromDate] = useState(firstDayOfMonth);
    const [toDate, setToDate] = useState(lastDayOfMonth);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [expandedNarrations, setExpandedNarrations] = useState({});
    const [maintainNarration, setMaintainNarration] = useState(false);

    // Bill-wise settlement states
    const [billAllocations, setBillAllocations] = useState({});
    const [billSettlementModal, setBillSettlementModal] = useState({ show: false, rowIdx: null });
    const [ledgerInvoices, setLedgerInvoices] = useState({});

    const fetchInvoicesForLedger = async (ledgerIdInput, forceRefresh = false) => {
        if (!ledgerIdInput) return;
        const ledgerId = String(ledgerIdInput?.id || ledgerIdInput);
        if (!forceRefresh && ledgerInvoices[ledgerId]) return;
        
        const ledger = ledgers.find(l => String(l.id) === ledgerId);
        const groupName = (ledger?.account_group_name || '').toLowerCase();
        const isSupplier = groupName.includes('creditor') || groupName.includes('supplier') || groupName.includes('purchase');
        
        try {
            let invoicesList = [];
            if (isSupplier) {
                const res = await PurchaseService.getPurchaseInvoicesBySupplier(ledgerId);
                invoicesList = Array.isArray(res.data) ? res.data : [];
            } else {
                const res = await SalesService.getSalesInvoices(ledgerId);
                invoicesList = Array.isArray(res.data) ? res.data : [];
            }
            setLedgerInvoices(prev => ({
                ...prev,
                [ledgerId]: invoicesList
            }));
        } catch (error) {
            console.error('Failed to fetch invoices for ledger:', error);
        }
    };

    const defaultDetail = {
        entry_type: 'Dr',
        ledger: '',
        debit_amount: 0.00,
        credit_amount: 0.00,
        narration: ''
    };

    const defaultJournal = {
        id: null,
        voucher_no: '',
        voucher_date: new Date().toISOString().split('T')[0],
        narration: '',
        details: [
            { ...defaultDetail, entry_type: 'Dr' },
            { ...defaultDetail, entry_type: 'Cr' }
        ]
    };

    const [currentJournal, setCurrentJournal] = useState(defaultJournal);

    const [companyInfo, setCompanyInfo] = useState(null);
    const [companyAddress, setCompanyAddress] = useState(null);
    const [companyContact, setCompanyContact] = useState(null);
    const [prefixConfigs, setPrefixConfigs] = useState([]);
    const [branches, setBranches] = useState([]);

    const { background } = useContext(ThemeContext);
    const isDark = background?.value === 'dark';

    useEffect(() => {
        fetchData();
        fetchLedgers();
        fetchConfiguration();
        loadCompanyDetails();
        fetchPrefixConfigs();
    }, []);

    const fetchPrefixConfigs = async () => {
        try {
            const [pRes, bRes] = await Promise.all([
                fetchPrefixConfigurations(),
                fetchBranches()
            ]);
            const configs = Array.isArray(pRes.data) ? pRes.data : (pRes.data?.results || []);
            const bData = Array.isArray(bRes.data) ? bRes.data : (bRes.data?.results || []);
            setPrefixConfigs(configs);
            setBranches(bData);
            return { configs, branches: bData };
        } catch (err) {
            console.error('Failed to fetch prefix configurations:', err);
            return { configs: [], branches: [] };
        }
    };

    const loadCompanyDetails = async () => {
        try {
            const companyRes = await fetchCompany();
            if (companyRes.data && companyRes.data.length > 0) {
                const companyData = companyRes.data[0];
                setCompanyInfo(companyData);

                const [addrRes, contactRes] = await Promise.all([
                    fetchCompanyAddresses(companyData.id),
                    fetchCompanyContacts(companyData.id)
                ]);

                const addressesList = addrRes.data || [];
                const primaryAddr = addressesList.find(a => 
                    a.address_type === 'headquarters' || 
                    a.address_type === 'registered' || 
                    a.address_type === 'corporate'
                ) || addressesList[0];
                setCompanyAddress(primaryAddr);

                const contactsList = contactRes.data || [];
                const primaryContact = contactsList.find(c => c.is_primary) || contactsList[0];
                setCompanyContact(primaryContact);
            }
        } catch (err) {
            console.error("Failed to load company details for printing header:", err);
        }
    };



    const fetchConfiguration = async () => {
        try {
            const res = await InventoryService.getProductConfigurations();
            const configs = Array.isArray(res.data) ? res.data : [];
            const myConfig = configs.find(c => 
                (c.voucher_type_name && c.voucher_type_name.toLowerCase() === 'journal') ||
                (c.voucher_type_code && c.voucher_type_code.toLowerCase() === 'jv')
            );
            if (myConfig) {
                setMaintainNarration(!!myConfig.maintain_narration);
            } else {
                setMaintainNarration(false);
            }
        } catch (error) {
            console.error('Failed to fetch product configuration:', error);
        }
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getJournals();
            setJournals(data);
        } catch (error) {
            Swal.fire('Error', 'Failed to fetch journal vouchers', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchLedgers = async () => {
        try {
            const data = await getLedgers();
            setLedgers(data);
        } catch (error) {
            console.error('Failed to fetch ledgers', error);
        }
    };

    const generateVoucherNo = (customList = null, customConfigs = null, customBranches = null) => {
        const configs = customConfigs || prefixConfigs || [];
        const branchList = customBranches || branches || [];
        const journalConfig = configs.find(c => {
            const vName = (c.voucher_type_name || '').toLowerCase().trim();
            return vName === 'journal' || c.prefix === 'JV';
        });
        return generateNextVoucherNumber(journalConfig, customList || journals, 'JV', branchList);
    };

    const printVoucher = (voucher, type = 'Journal') => {
        printFriendlyVoucher({
            voucher,
            type,
            ledgers,
            companyInfo,
            companyAddress,
            companyContact
        });
    };

    const handleShowModal = (journal = null) => {
        if (journal) {
            const initialExpanded = {};
            const loadedAllocations = {};
            if (journal.details) {
                journal.details.forEach((d, idx) => {
                    if (d.narration) {
                        initialExpanded[idx] = true;
                    }
                    const allocations = d.bill_allocations || [];
                    const mappedAllocs = allocations.map(a => ({
                        refType: a.allocation_type === 'Agst Ref' ? 'against_ref' : a.allocation_type === 'New Ref' ? 'new_ref' : a.allocation_type === 'Advance' ? 'advance' : 'on_account',
                        invoiceId: a.against_purchase_invoice || a.against_sales_invoice || '',
                        refName: a.name || '',
                        settleAmount: parseFloat(a.amount) || 0
                    }));
                    if (mappedAllocs.length > 0) {
                        loadedAllocations[idx] = mappedAllocs;
                        fetchInvoicesForLedger(d.ledger?.id || d.ledger);
                    }
                });
            }
            setBillAllocations(loadedAllocations);
            setExpandedNarrations(initialExpanded);
            setCurrentJournal({
                ...journal,
                narration: journal.narration || '',
                details: journal.details?.length ? journal.details.map(d => ({
                    ...d,
                    ledger: d.ledger?.id || d.ledger,
                    debit_amount: parseFloat(d.debit_amount) || 0,
                    credit_amount: parseFloat(d.credit_amount) || 0
                })) : [
                    { ...defaultDetail, entry_type: 'Dr' },
                    { ...defaultDetail, entry_type: 'Cr' }
                ]
            });
            setEditMode(true);
        } else {
            setBillAllocations({});
            setExpandedNarrations({});
            const initialNo = generateVoucherNo();
            setCurrentJournal({
                ...defaultJournal,
                voucher_no: initialNo
            });
            setEditMode(false);
            fetchPrefixConfigs().then(({ configs, branches: bData }) => {
                const latestNo = generateVoucherNo(null, configs, bData);
                setCurrentJournal(prev => ({
                    ...prev,
                    voucher_no: latestNo
                }));
            });
        }
        setShowModal(true);
    };

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const editId = searchParams.get('edit');
        if (!editId) return;

        const openTarget = async () => {
            let list = journals;
            if (!list || list.length === 0) {
                try {
                    list = await getJournals();
                    setJournals(list);
                } catch (e) {
                    console.error('Error fetching journals for edit modal:', e);
                }
            }
            if (list && list.length > 0) {
                const cleanTarget = String(editId).toLowerCase().replace(/[^a-z0-9]/g, '');
                const itemToEdit = list.find(j => {
                    const jId = String(j.id);
                    const jVNo = String(j.voucher_no || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    return jId === String(editId) || jVNo === cleanTarget || (cleanTarget && jVNo.endsWith(cleanTarget));
                });
                if (itemToEdit) {
                    handleShowModal(itemToEdit);
                }
            }
        };
        openTarget();
    }, [location.search]);

    const handleDelete = async (id, no) => {
        const result = await Swal.fire({
            title: 'Delete Journal Voucher?',
            text: `Are you sure you want to delete journal voucher "${no}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deleteJournal(id);
                Swal.fire('Deleted', 'Voucher deleted successfully', 'success');
                fetchData();
            } catch (error) {
                Swal.fire('Error', 'Failed to delete journal voucher', 'error');
            }
        }
    };

    const handleInputChange = (field, value) => {
        setCurrentJournal({ ...currentJournal, [field]: value });
    };

    const handleDetailChange = (index, field, value) => {
        const details = [...currentJournal.details];
        let updatedRow = { ...details[index], [field]: value };

        // Auto validation details
        if (field === 'entry_type') {
            if (value === 'Dr') {
                updatedRow.credit_amount = 0;
            } else {
                updatedRow.debit_amount = 0;
            }
            setBillAllocations(prev => {
                const next = { ...prev };
                delete next[index];
                return next;
            });
        } else if (field === 'ledger') {
            setBillAllocations(prev => {
                const next = { ...prev };
                delete next[index];
                return next;
            });
            if (value) {
                fetchInvoicesForLedger(value);
            }
        } else if (field === 'debit_amount') {
            updatedRow.credit_amount = 0;
        } else if (field === 'credit_amount') {
            updatedRow.debit_amount = 0;
        }

        details[index] = updatedRow;
        setCurrentJournal({ ...currentJournal, details });
    };

    const handleFocusAmount = (index, field) => {
        const details = [...currentJournal.details];
        const row = details[index];
        
        // Only autofill if the current field value is 0 or empty/falsy
        const currentVal = parseFloat(row[field]) || 0;
        if (currentVal === 0) {
            const otherDebits = details.reduce((sum, d, idx) => sum + (idx !== index ? (parseFloat(d.debit_amount) || 0) : 0), 0);
            const otherCredits = details.reduce((sum, d, idx) => sum + (idx !== index ? (parseFloat(d.credit_amount) || 0) : 0), 0);
            
            if (field === 'debit_amount' && row.entry_type === 'Dr') {
                if (otherCredits > otherDebits) {
                    row.debit_amount = otherCredits - otherDebits;
                    setCurrentJournal({ ...currentJournal, details });
                }
            } else if (field === 'credit_amount' && row.entry_type === 'Cr') {
                if (otherDebits > otherCredits) {
                    row.credit_amount = otherDebits - otherCredits;
                    setCurrentJournal({ ...currentJournal, details });
                }
            }
        }
    };

    const addDetailRow = () => {
        const details = currentJournal.details;
        const totalDebit = details.reduce((sum, d) => sum + (parseFloat(d.debit_amount) || 0), 0);
        const totalCredit = details.reduce((sum, d) => sum + (parseFloat(d.credit_amount) || 0), 0);
        
        let newEntryType = 'Dr';
        let newDebit = 0;
        let newCredit = 0;
        
        if (totalDebit > totalCredit) {
            newEntryType = 'Cr';
            newCredit = totalDebit - totalCredit;
        } else if (totalCredit > totalDebit) {
            newEntryType = 'Dr';
            newDebit = totalCredit - totalDebit;
        }
        
        const newRow = {
            ...defaultDetail,
            entry_type: newEntryType,
            debit_amount: newDebit,
            credit_amount: newCredit
        };

        setCurrentJournal({
            ...currentJournal,
            details: [...currentJournal.details, newRow]
        });
    };

    const removeDetailRow = (index) => {
        if (currentJournal.details.length <= 2) {
            Swal.fire('Validation Warning', 'A journal voucher must have at least 2 entries.', 'warning');
            return;
        }
        const details = [...currentJournal.details];
        details.splice(index, 1);
        setCurrentJournal({ ...currentJournal, details });
        
        setBillAllocations(prev => {
            const next = {};
            Object.keys(prev).forEach(k => {
                const kidx = parseInt(k, 10);
                if (kidx < index) {
                    next[kidx] = prev[k];
                } else if (kidx > index) {
                    next[kidx - 1] = prev[k];
                }
            });
            return next;
        });
    };

    const openBillSettlement = (idx) => {
        const row = currentJournal.details[idx];
        if (!row || !row.ledger) return;
        const ledgerId = String(row.ledger?.id || row.ledger);
        
        fetchInvoicesForLedger(ledgerId, true);
        
        setBillSettlementModal({
            show: true,
            rowIdx: idx
        });
    };

    const handleBillSettlementApply = (allocs) => {
        const rowIdx = billSettlementModal.rowIdx;
        const nextAllocations = { ...billAllocations };
        if (allocs.length === 0) {
            delete nextAllocations[rowIdx];
        } else {
            nextAllocations[rowIdx] = allocs;
            const totalSettled = allocs.reduce((s, a) => s + (parseFloat(a.settleAmount) || 0), 0);
            const targetRow = currentJournal.details[rowIdx];
            if (targetRow) {
                const amtField = targetRow.entry_type === 'Dr' ? 'debit_amount' : 'credit_amount';
                handleDetailChange(rowIdx, amtField, totalSettled);
            }
        }
        setBillSettlementModal({ show: false, rowIdx: null });

        setTimeout(() => {
            const nextRowIdx = rowIdx + 1;
            if (nextRowIdx < currentJournal.details.length) {
                const nextRow = currentJournal.details[nextRowIdx];
                const targetCol = (nextRow && nextRow.ledger) 
                    ? (nextRow.entry_type === 'Dr' ? 'debit_amount' : 'credit_amount') 
                    : 'ledger';
                focusCell(nextRowIdx, targetCol);
            } else {
                addDetailRow();
                setTimeout(() => {
                    focusCell(nextRowIdx, 'ledger');
                }, 100);
            }
        }, 150);
    };

    const handleBillSettlementClose = () => {
        const rowIdx = billSettlementModal.rowIdx;
        setBillSettlementModal({ show: false, rowIdx: null });
        if (rowIdx !== null && rowIdx !== undefined) {
            setTimeout(() => {
                const nextRowIdx = rowIdx + 1;
                if (nextRowIdx < currentJournal.details.length) {
                    const nextRow = currentJournal.details[nextRowIdx];
                    const targetCol = (nextRow && nextRow.ledger) 
                        ? (nextRow.entry_type === 'Dr' ? 'debit_amount' : 'credit_amount') 
                        : 'ledger';
                    focusCell(nextRowIdx, targetCol);
                } else {
                    addDetailRow();
                    setTimeout(() => {
                        focusCell(nextRowIdx, 'ledger');
                    }, 100);
                }
            }, 150);
        }
    };

    const toggleNarration = (idx) => {
        setExpandedNarrations(prev => ({
            ...prev,
            [idx]: !prev[idx]
        }));
    };

    // Live calculations
    const totalDebit = currentJournal.details.reduce((sum, d) => sum + (parseFloat(d.debit_amount) || 0), 0);
    const totalCredit = currentJournal.details.reduce((sum, d) => sum + (parseFloat(d.credit_amount) || 0), 0);
    const isBalanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.01;

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!currentJournal.voucher_no) {
            Swal.fire('Validation Error', 'Voucher Number is required', 'warning');
            return;
        }

        if (!isBalanced) {
            Swal.fire('Validation Error', 'Total Debit must equal Total Credit and be greater than zero.', 'warning');
            return;
        }

        for (let i = 0; i < currentJournal.details.length; i++) {
            const row = currentJournal.details[i];
            if (!row.ledger) {
                Swal.fire('Validation Error', `Please select a Ledger Account for entry row #${i + 1}`, 'warning');
                return;
            }
            const dr = parseFloat(row.debit_amount) || 0;
            const cr = parseFloat(row.credit_amount) || 0;
            if (row.entry_type === 'Dr' && dr <= 0) {
                Swal.fire('Validation Error', `Debit amount must be greater than zero for row #${i + 1}`, 'warning');
                return;
            }
            if (row.entry_type === 'Cr' && cr <= 0) {
                Swal.fire('Validation Error', `Credit amount must be greater than zero for row #${i + 1}`, 'warning');
                return;
            }
        }

        try {
            const cleanedDetails = currentJournal.details.map((detail, idx) => {
                const allocs = billAllocations[idx] || [];
                const serializedAllocs = allocs.map(alloc => {
                    const ledger = ledgers.find(l => String(l.id) === String(detail.ledger));
                    const groupName = (ledger?.account_group_name || '').toLowerCase();
                    const isSupplier = groupName.includes('creditor') || groupName.includes('supplier') || groupName.includes('purchase');
                    return {
                        allocation_type: alloc.refType === 'against_ref' ? 'Agst Ref' : alloc.refType === 'new_ref' ? 'New Ref' : alloc.refType === 'advance' ? 'Advance' : 'On Account',
                        against_purchase_invoice: isSupplier ? (alloc.invoiceId || null) : null,
                        against_sales_invoice: !isSupplier ? (alloc.invoiceId || null) : null,
                        name: alloc.refName || (alloc.refType === 'on_account' ? 'On Account' : ''),
                        amount: parseFloat(alloc.settleAmount) || 0
                    };
                });
                
                return {
                    ledger: detail.ledger?.id || detail.ledger,
                    entry_type: detail.entry_type,
                    debit_amount: parseFloat(detail.debit_amount) || 0,
                    credit_amount: parseFloat(detail.credit_amount) || 0,
                    narration: detail.narration || '',
                    bill_allocations: serializedAllocs
                };
            });

            const payload = {
                ...currentJournal,
                details: cleanedDetails
            };

            const savedVoucher = { ...payload };
            if (editMode) {
                await updateJournal(currentJournal.id, payload);
            } else {
                await createJournal(payload);
            }
            setShowModal(false);
            fetchData();

            Swal.fire({
                title: editMode ? 'Voucher Updated' : 'Voucher Created',
                text: 'Voucher saved successfully. Do you want to print it?',
                icon: 'success',
                showCancelButton: true,
                confirmButtonText: 'Yes, Print',
                cancelButtonText: 'No, Thanks',
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33'
            }).then((result) => {
                if (result.isConfirmed) {
                    printVoucher(savedVoucher, 'Journal');
                }
            });
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'Failed to save voucher. Ensure Voucher Number is unique.', 'error');
        }
    };

    // Spreadsheet keyboard navigation
    const focusCell = (rowIndex, colName) => {
        const cols = ['entry_type', 'ledger', 'debit_amount', 'credit_amount', 'narration'];
        let curColIdx = cols.indexOf(colName);
        let curRowIdx = rowIndex;

        while (curRowIdx < 100) {
            const id = `cell-${curRowIdx}-${cols[curColIdx]}`;
            const element = document.getElementById(id);
            if (element) {
                if (!element.disabled) {
                    setTimeout(() => {
                        element.focus();
                        if (element.select && typeof element.select === 'function') {
                            element.select();
                        }
                    }, 50);
                    return;
                }
            } else {
                if (curRowIdx > rowIndex) {
                    break;
                }
            }
            curColIdx++;
            if (curColIdx >= cols.length) {
                curColIdx = 0;
                curRowIdx++;
            }
        }
    };

    const handleCellKeyDown = (e, rowIndex, colName) => {
        const target = e.target;
        const isReactSelectOpen = target.getAttribute('aria-expanded') === 'true';

        if (isReactSelectOpen && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter')) {
            return; // Let react-select handle dropdown navigation and selection
        }

        if (e.key === 'Enter') {
            const row = currentJournal.details[rowIndex];

            if (colName === 'ledger') {
                if (!row || !row.ledger) {
                    e.preventDefault();
                    if (currentJournal.details.length > 2) {
                        removeDetailRow(rowIndex);
                    }
                    setTimeout(() => {
                        const masterNarrationEl = document.getElementById('master-narration');
                        if (masterNarrationEl) {
                            masterNarrationEl.focus();
                        }
                    }, 50);
                    return;
                }
            }

            if (!row || !row.ledger) {
                e.preventDefault();
                if (currentJournal.details.length > 2) {
                    removeDetailRow(rowIndex);
                }
                setTimeout(() => {
                    const masterNarrationEl = document.getElementById('master-narration');
                    if (masterNarrationEl) {
                        masterNarrationEl.focus();
                    }
                }, 50);
                return;
            }

            e.preventDefault();
            const cols = ['entry_type', 'ledger', 'debit_amount', 'credit_amount', 'narration'];

            if (colName === 'debit_amount' || colName === 'credit_amount') {
                const isActiveField = (colName === 'debit_amount' && row.entry_type === 'Dr') || 
                                       (colName === 'credit_amount' && row.entry_type === 'Cr');
                if (isActiveField) {
                    e.preventDefault();
                    if (rowIndex < currentJournal.details.length - 1) {
                        focusCell(rowIndex + 1, 'ledger');
                    } else {
                        // Check if total debit equals total credit
                        const curDebit = currentJournal.details.reduce((s, d) => s + (parseFloat(d.debit_amount) || 0), 0);
                        const curCredit = currentJournal.details.reduce((s, d) => s + (parseFloat(d.credit_amount) || 0), 0);
                        const balanced = curDebit > 0 && Math.abs(curDebit - curCredit) < 0.01;

                        if (balanced) {
                            // Voucher is balanced. Move focus directly to Master Narration.
                            setTimeout(() => {
                                const masterNarrationEl = document.getElementById('master-narration');
                                if (masterNarrationEl) {
                                    masterNarrationEl.focus();
                                }
                            }, 50);
                        } else {
                            // Voucher is not balanced yet. Spawn the next row.
                            addDetailRow();
                            setTimeout(() => {
                                focusCell(rowIndex + 1, 'ledger');
                            }, 80);
                        }
                    }
                    return;
                }
            }

            if (colName === 'narration') {
                // Toggle narration and focus the text area
                setExpandedNarrations(prev => {
                    const next = { ...prev, [rowIndex]: true };
                    setTimeout(() => {
                        const txtEl = document.getElementById(`cell-${rowIndex}-narration-text`);
                        if (txtEl) {
                            txtEl.focus();
                            if (txtEl.select) txtEl.select();
                        }
                    }, 50);
                    return next;
                });
                return;
            }

            if (colName === 'narration-text') {
                if (rowIndex < currentJournal.details.length - 1) {
                    focusCell(rowIndex + 1, 'ledger');
                } else {
                    // We are on the last row. Always spawn the next row.
                    addDetailRow();
                    setTimeout(() => {
                        focusCell(rowIndex + 1, 'ledger');
                    }, 80);
                }
                return;
            }

            if (currentColIdx < cols.length - 1) {
                focusCell(rowIndex, cols[currentColIdx + 1]);
            }
        } else if (e.key === 'ArrowUp') {
            if (colName === 'narration-text') {
                e.preventDefault();
                focusCell(rowIndex, 'narration');
            } else if (rowIndex > 0) {
                e.preventDefault();
                focusCell(rowIndex - 1, colName);
            }
        } else if (e.key === 'ArrowDown') {
            if (colName === 'narration' && expandedNarrations[rowIndex]) {
                e.preventDefault();
                const txtEl = document.getElementById(`cell-${rowIndex}-narration-text`);
                if (txtEl) txtEl.focus();
            } else if (rowIndex < currentJournal.details.length - 1) {
                e.preventDefault();
                focusCell(rowIndex + 1, colName);
            }
        }
    };

    const customSelectStyles = {
        control: (provided, state) => ({
            ...provided,
            backgroundColor: isDark ? '#24292D' : '#ffffff',
            borderColor: state.isFocused ? '#2ece8a' : (isDark ? '#475569' : '#cbd5e1'),
            color: isDark ? '#ffffff' : '#2f3f50',
            minHeight: '36px',
            borderRadius: '8px',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(46,206,138,0.15)' : 'none',
            '&:hover': { borderColor: '#2ece8a' },
            fontSize: '13px',
        }),
        valueContainer: (provided) => ({
            ...provided,
            padding: '2px 10px',
            display: 'flex',
            alignItems: 'center',
        }),
        input: (provided) => ({
            ...provided,
            margin: '0px',
            padding: '0px',
            color: isDark ? '#ffffff' : '#2f3f50'
        }),
        indicatorsContainer: (provided) => ({
            ...provided,
        }),
        dropdownIndicator: (provided) => ({
            ...provided,
            padding: '4px 8px',
            color: isDark ? '#94a3b8' : '#64748b',
            '&:hover': { color: '#2ece8a' }
        }),
        clearIndicator: (provided) => ({
            ...provided,
            padding: '4px 8px',
            color: isDark ? '#94a3b8' : '#64748b',
            '&:hover': { color: '#ef4444' }
        }),
        menu: (provided) => ({
            ...provided,
            zIndex: 99999,
            backgroundColor: isDark ? '#2F363E' : '#ffffff',
            borderRadius: '10px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
            border: isDark ? '1px solid #475569' : '1px solid #e2e8f0',
            overflow: 'hidden',
            fontSize: '13px',
        }),
        menuPortal: base => ({ ...base, zIndex: 99999 }),
        singleValue: (provided) => ({ ...provided, color: isDark ? '#ffffff' : '#2f3f50' }),
        option: (provided, state) => ({
            ...provided,
            backgroundColor: state.isSelected ? (isDark ? '#334155' : '#f1f5f9') : state.isFocused ? (isDark ? '#383F47' : '#f8fafc') : 'transparent',
            color: state.isSelected ? '#2ece8a' : (isDark ? '#ffffff' : '#334155'),
            cursor: 'pointer',
            fontWeight: state.isSelected ? '600' : 'normal',
            padding: '8px 12px',
            ':active': {
                backgroundColor: isDark ? '#475569' : '#e2e8f0'
            }
        })
    };

    const filteredJournals = journals.filter(j => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = (
            (j.voucher_no || '').toLowerCase().includes(term) ||
            (j.narration || '').toLowerCase().includes(term) ||
            (j.voucher_date || '').toLowerCase().includes(term)
        );

        let matchesDate = true;
        if (fromDate) {
            const vDate = j.voucher_date ? j.voucher_date.split('T')[0] : '';
            if (!vDate || vDate < fromDate) matchesDate = false;
        }
        if (toDate) {
            const vDate = j.voucher_date ? j.voucher_date.split('T')[0] : '';
            if (!vDate || vDate > toDate) matchesDate = false;
        }

        return matchesSearch && matchesDate;
    });

    const totalPages = Math.ceil(filteredJournals.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentJournals = filteredJournals.slice(startIndex, startIndex + itemsPerPage);

    return (
        <div className="container-fluid">
            <div className="row">
            <div className="col-lg-12">
                <Card>
                    <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <Card.Title className="mb-0">Journal Vouchers</Card.Title>
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                            <div className="d-flex align-items-center gap-1">
                                <span className="text-muted" style={{ fontSize: '12px', fontWeight: '500' }}>From:</span>
                                <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    value={fromDate}
                                    onChange={(e) => {
                                        setFromDate(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    style={{ width: '135px', height: '34px', fontSize: '12px', borderRadius: '6px' }}
                                />
                            </div>
                            <div className="d-flex align-items-center gap-1">
                                <span className="text-muted" style={{ fontSize: '12px', fontWeight: '500' }}>To:</span>
                                <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    value={toDate}
                                    onChange={(e) => {
                                        setToDate(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    style={{ width: '135px', height: '34px', fontSize: '12px', borderRadius: '6px' }}
                                />
                            </div>
                            <div style={{ width: '250px', position: 'relative' }}>
                                <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                <Form.Control
                                    type="text"
                                    placeholder="Search Journal..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    style={{ height: '34px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                />
                            </div>
                            <div className="d-flex gap-2 ms-auto">
                                <CreateButton 
                                    module="journal" 
                                    onClick={() => handleShowModal()} 
                                    style={{ height: '34px', display: 'flex', alignItems: 'center', fontSize: '13px' }}
                                >
                                    Journal
                                </CreateButton>
                            </div>
                        </div>
                    </Card.Header>
                    <Card.Body>
                        {loading ? (
                            <div className="text-center py-5">
                                <div className="spinner-border text-primary" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-responsive-md">
                                    <thead>
                                        <tr>
                                            <th>SL NO</th>
                                            <th>VOUCHER NO</th>
                                            <th>DATE</th>
                                            <th>NARRATION</th>
                                            <th>TOTAL DEBIT (₹)</th>
                                            <th>TOTAL CREDIT (₹)</th>
                                            <th className="text-end">ACTIONS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentJournals.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="text-center py-4 text-muted">No vouchers found</td>
                                            </tr>
                                        ) : (
                                            currentJournals.map((j, idx) => {
                                                const dTotal = j.details?.reduce((s, row) => s + (parseFloat(row.debit_amount) || 0), 0) || 0;
                                                const cTotal = j.details?.reduce((s, row) => s + (parseFloat(row.credit_amount) || 0), 0) || 0;
                                                return (
                                                    <tr key={j.id}>
                                                        <td>{startIndex + idx + 1}</td>
                                                        <td>{j.voucher_no}</td>
                                                        <td>{j.voucher_date}</td>
                                                        <td className="text-truncate" style={{ maxWidth: '300px' }}>{j.narration || '-'}</td>
                                                        <td>
                                                            {dTotal.toFixed(2)}{' '}
                                                            <span className="fw-semibold text-success" style={{ fontSize: '11px' }}>Dr</span>
                                                        </td>
                                                        <td>
                                                            {cTotal.toFixed(2)}{' '}
                                                            <span className="fw-semibold text-danger" style={{ fontSize: '11px' }}>Cr</span>
                                                        </td>
                                                        <td className="text-end">
                                                            <div className="d-flex justify-content-end align-items-center">
                                                                <Button 
                                                                    variant="outline-info" 
                                                                    size="sm" 
                                                                    className="me-1 py-1 px-2" 
                                                                    onClick={() => printVoucher(j, 'Journal')} 
                                                                    title="Print Voucher"
                                                                >
                                                                    <i className="fa fa-print"></i>
                                                                </Button>
                                                                <EditButton module="journal" onClick={() => handleShowModal(j)} className="me-1" />
                                                                <DeleteButton module="journal" onClick={() => handleDelete(j.id, j.voucher_no)} />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>

                                {totalPages > 1 && (
                                    <div className="d-flex justify-content-between align-items-center mt-3">
                                        <div className="text-muted" style={{ fontSize: '13px' }}>
                                            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredJournals.length)} of {filteredJournals.length} entries
                                        </div>
                                        <nav>
                                            <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                    <button 
                                                        type="button" 
                                                        className="page-link" 
                                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                                                        disabled={currentPage === 1}
                                                        style={{ border: 'none', background: 'none' }}
                                                    >
                                                        <i className="la la-angle-left" />
                                                    </button>
                                                </li>
                                                {Array.from({ length: totalPages }, (_, index) => {
                                                    const pageNumber = index + 1;
                                                    if (
                                                        pageNumber === 1 ||
                                                        pageNumber === totalPages ||
                                                        (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                                                    ) {
                                                        return (
                                                            <li key={pageNumber} className={`page-item ${currentPage === pageNumber ? 'active' : ''}`}>
                                                                <button 
                                                                    type="button" 
                                                                    className="page-link" 
                                                                    onClick={() => setCurrentPage(pageNumber)}
                                                                    style={{ border: 'none' }}
                                                                >
                                                                    {pageNumber}
                                                                </button>
                                                            </li>
                                                        );
                                                    } else if (
                                                        pageNumber === currentPage - 2 ||
                                                        pageNumber === currentPage + 2
                                                    ) {
                                                        return (
                                                            <li key={pageNumber} className="page-item disabled">
                                                                <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                                            </li>
                                                        );
                                                    }
                                                    return null;
                                                })}
                                                <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                                    <button 
                                                        type="button" 
                                                        className="page-link" 
                                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                                                        disabled={currentPage === totalPages}
                                                        style={{ border: 'none', background: 'none' }}
                                                    >
                                                        <i className="la la-angle-right" />
                                                    </button>
                                                </li>
                                            </ul>
                                        </nav>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card.Body>
                </Card>
            </div>
        </div>

            <Modal
                show={showModal}
                onHide={() => setShowModal(false)}
                size="xl"
                centered
                className="journal-voucher-modal"
                onEntered={() => {
                    document.getElementById('voucher-no-input')?.focus();
                }}
            >
                <Modal.Header closeButton>
                    <Modal.Title className="w-100">
                        <div className="d-flex align-items-center">
                            <div
                                className="d-flex align-items-center justify-content-center rounded-circle me-3 form-icon-circle"
                                style={{ width: '48px', height: '48px' }}
                            >
                                <i className="fa fa-book text-white fs-4"></i>
                            </div>
                            <div>
                                <h4 className="mb-1">{editMode ? 'Edit Journal Voucher' : 'New Journal Voucher'}</h4>
                                <p className="mb-0 text-muted" style={{ fontSize: '13px', fontWeight: 'normal' }}>
                                    {editMode
                                        ? 'Modify entries and narration for this journal voucher'
                                        : 'Double-entry book keeping record. Debit and Credit totals must balance.'}
                                </p>
                            </div>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleSubmit}>
                    <Modal.Body className="py-2">
                        <Row className="mb-2">
                            <Col lg={4} md={6} sm={12} className="mb-2">
                                <Form.Group>
                                    <Form.Label className="fw-semibold text-muted small mb-1">VOUCHER TYPE</Form.Label>
                                    <Form.Control size="sm" type="text" value="Journal" disabled className="bg-light border-0 fw-semibold rounded-3 text-secondary" />
                                </Form.Group>
                            </Col>
                            <Col lg={4} md={6} sm={12} className="mb-2">
                                <Form.Group>
                                    <Form.Label className="fw-semibold text-muted small mb-1">VOUCHER NO *</Form.Label>
                                    <Form.Control
                                        size="sm"
                                        id="voucher-no-input"
                                        type="text"
                                        value={currentJournal.voucher_no}
                                        onChange={e => handleInputChange('voucher_no', e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                document.getElementById('voucher-date-input')?.focus();
                                            }
                                        }}
                                        required
                                        className="border-secondary border-opacity-25"
                                    />
                                </Form.Group>
                            </Col>
                            <Col lg={4} md={6} sm={12} className="mb-2">
                                <Form.Group>
                                    <Form.Label className="fw-semibold text-muted small mb-1">DATE *</Form.Label>
                                    <Form.Control
                                        size="sm"
                                        id="voucher-date-input"
                                        type="date"
                                        value={currentJournal.voucher_date}
                                        onChange={e => handleInputChange('voucher_date', e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                focusCell(0, 'entry_type');
                                            }
                                        }}
                                        required
                                        className="border-secondary border-opacity-25"
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <div className="table-responsive">
                            <Table bordered className="align-middle journal-entry-table border-secondary border-opacity-10">
                                <thead>
                                    <tr className="table-light">
                                        <th style={{ width: '10%' }}>By/To</th>
                                        <th style={{ width: maintainNarration ? '52%' : '60%' }}>Ledger Account *</th>
                                        <th style={{ width: '15%', textAlign: 'right' }} className="text-end">Debit ()</th>
                                        <th style={{ width: '15%', textAlign: 'right' }} className="text-end">Credit ()</th>
                                        {maintainNarration && <th style={{ width: '8%', textAlign: 'center' }}>Narration</th>}
                                        <th style={{ width: '5%', textAlign: 'center' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentJournal.details.map((row, idx) => (
                                        <React.Fragment key={idx}>
                                            <tr>
                                                <td>
                                                    <Form.Select
                                                        size="sm"
                                                        id={`cell-${idx}-entry_type`}
                                                        value={row.entry_type}
                                                        onChange={e => handleDetailChange(idx, 'entry_type', e.target.value)}
                                                        onKeyDown={e => handleCellKeyDown(e, idx, 'entry_type')}
                                                        className="rounded-3 border-0 py-1 fw-semibold text-center"
                                                        style={{
                                                            height: '30px',
                                                            color: row.entry_type === 'Dr' ? '#2dce89' : '#f5365c',
                                                            backgroundColor: row.entry_type === 'Dr' ? '#e2f7ed' : '#fdebeb'
                                                        }}
                                                    >
                                                        <option value="Dr" className="text-success fw-bold">(Dr)</option>
                                                        <option value="Cr" className="text-danger fw-bold">(Cr)</option>
                                                    </Form.Select>
                                                </td>
                                                <td>
                                                    <Select
                                                        options={[
                                                            { value: '', label: '-- Select Ledger --' },
                                                            ...ledgers.map(l => ({ value: l.id, label: l.name }))
                                                        ]}
                                                        value={row.ledger ? { value: row.ledger, label: ledgers.find(l => String(l.id) === String(row.ledger))?.name || '' } : { value: '', label: '-- Select Ledger --' }}
                                                        onChange={sel => {
                                                             const val = sel ? sel.value : '';
                                                             handleDetailChange(idx, 'ledger', val);
                                                             if (!val) {
                                                                 if (currentJournal.details.length > 2) {
                                                                     removeDetailRow(idx);
                                                                 }
                                                                 setTimeout(() => {
                                                                     const masterNarrationEl = document.getElementById('master-narration');
                                                                     if (masterNarrationEl) {
                                                                         masterNarrationEl.focus();
                                                                     }
                                                                 }, 50);
                                                             } else {
                                                                 setTimeout(() => {
                                                                     const activeCol = row.entry_type === 'Dr' ? 'debit_amount' : 'credit_amount';
                                                                     const el = document.getElementById(`cell-${idx}-${activeCol}`);
                                                                     if (el) {
                                                                         el.focus();
                                                                         if (el.select) el.select();
                                                                     }
                                                                 }, 100);
                                                             }
                                                         }}
                                                        styles={customSelectStyles}
                                                        menuPortalTarget={document.body}
                                                        menuPosition="fixed"
                                                        isSearchable
                                                        isClearable={true}
                                                        openMenuOnFocus={true}
                                                        blurInputOnSelect={true}
                                                        placeholder="-- Select Ledger --"
                                                        inputId={`cell-${idx}-ledger`}
                                                        onKeyDown={e => handleCellKeyDown(e, idx, 'ledger')}
                                                    />
                                                </td>
                                                <td style={{ textAlign: 'right', padding: '4px 8px', verticalAlign: 'middle' }}>
                                                    {row.entry_type === 'Dr' && (
                                                        <>
                                                            <Form.Control
                                                                size="sm"
                                                                id={`cell-${idx}-debit_amount`}
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                value={row.debit_amount || ''}
                                                                onChange={e => handleDetailChange(idx, 'debit_amount', parseFloat(e.target.value) || 0)}
                                                                onKeyDown={e => {
                                                                    const rowAllocs = billAllocations[idx] || [];
                                                                    const totalSettled = rowAllocs.reduce((s, a) => s + (parseFloat(a.settleAmount) || 0), 0);
                                                                    const rowAmt = parseFloat(row.debit_amount) || 0;
                                                                    const isAlreadySettled = rowAllocs.length > 0 && Math.abs(totalSettled - rowAmt) < 0.01;
                                                                    
                                                                    if (e.key === 'Enter' && row.ledger && rowAmt > 0 && !isAlreadySettled) {
                                                                        e.preventDefault();
                                                                        openBillSettlement(idx);
                                                                        return;
                                                                    }
                                                                    handleCellKeyDown(e, idx, 'debit_amount');
                                                                }}
                                                                onFocus={e => handleFocusAmount(idx, 'debit_amount')}
                                                                placeholder="0.00"
                                                                className="text-end font-monospace border-secondary border-opacity-25"
                                                                style={{ height: '30px' }}
                                                            />
                                                            {(() => {
                                                                const rowAllocs = billAllocations[idx] || [];
                                                                const hasBills = rowAllocs.length > 0;
                                                                return hasBills && (
                                                                    <div style={{ fontSize: 10, color: '#3b6fd4', marginTop: 3, fontWeight: 'bold', textAlign: 'right', cursor: 'pointer' }} onClick={() => openBillSettlement(idx)}>
                                                                        <i className="fa fa-check-circle me-1"></i>
                                                                        {rowAllocs.length} Ref{rowAllocs.length > 1 ? 's' : ''} allocated ({rowAllocs.map(a => a.refName || (a.refType === 'on_account' ? 'On Account' : 'Ref')).join(', ')})
                                                                    </div>
                                                                );
                                                            })()}
                                                        </>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'right', padding: '4px 8px', verticalAlign: 'middle' }}>
                                                    {row.entry_type === 'Cr' && (
                                                        <>
                                                            <Form.Control
                                                                size="sm"
                                                                id={`cell-${idx}-credit_amount`}
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                value={row.credit_amount || ''}
                                                                onChange={e => handleDetailChange(idx, 'credit_amount', parseFloat(e.target.value) || 0)}
                                                                onKeyDown={e => {
                                                                    const rowAllocs = billAllocations[idx] || [];
                                                                    const totalSettled = rowAllocs.reduce((s, a) => s + (parseFloat(a.settleAmount) || 0), 0);
                                                                    const rowAmt = parseFloat(row.credit_amount) || 0;
                                                                    const isAlreadySettled = rowAllocs.length > 0 && Math.abs(totalSettled - rowAmt) < 0.01;
                                                                    
                                                                    if (e.key === 'Enter' && row.ledger && rowAmt > 0 && !isAlreadySettled) {
                                                                        e.preventDefault();
                                                                        openBillSettlement(idx);
                                                                        return;
                                                                    }
                                                                    handleCellKeyDown(e, idx, 'credit_amount');
                                                                }}
                                                                onFocus={e => handleFocusAmount(idx, 'credit_amount')}
                                                                placeholder="0.00"
                                                                className="text-end font-monospace border-secondary border-opacity-25"
                                                                style={{ height: '30px' }}
                                                            />
                                                            {(() => {
                                                                const rowAllocs = billAllocations[idx] || [];
                                                                const hasBills = rowAllocs.length > 0;
                                                                return hasBills && (
                                                                    <div style={{ fontSize: 10, color: '#3b6fd4', marginTop: 3, fontWeight: 'bold', textAlign: 'right', cursor: 'pointer' }} onClick={() => openBillSettlement(idx)}>
                                                                        <i className="fa fa-check-circle me-1"></i>
                                                                        {rowAllocs.length} Ref{rowAllocs.length > 1 ? 's' : ''} allocated ({rowAllocs.map(a => a.refName || (a.refType === 'on_account' ? 'On Account' : 'Ref')).join(', ')})
                                                                    </div>
                                                                );
                                                            })()}
                                                        </>
                                                    )}
                                                </td>
                                                {maintainNarration && (
                                                    <td className="text-center">
                                                        <Button
                                                            id={`cell-${idx}-narration`}
                                                            type="button"
                                                            onClick={() => toggleNarration(idx)}
                                                            onKeyDown={e => handleCellKeyDown(e, idx, 'narration')}
                                                            style={{
                                                                width: '30px',
                                                                height: '30px',
                                                                padding: '0',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                borderRadius: '6px'
                                                            }}
                                                            variant={row.narration ? 'primary' : 'outline-secondary'}
                                                            title={row.narration ? 'Edit Narration' : 'Add Narration'}
                                                        >
                                                            <i className="fa fa-comment-alt" style={{ fontSize: '11px' }}></i>
                                                        </Button>
                                                    </td>
                                                )}
                                                <td className="text-center" style={{ whiteSpace: 'nowrap' }}>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                        {/* + button slot — always 30px wide */}
                                                        <div style={{ width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {idx === currentJournal.details.length - 1 && (
                                                                <Button
                                                                    variant="primary"
                                                                    className="rounded d-inline-flex align-items-center justify-content-center"
                                                                    style={{ width: '30px', height: '30px' }}
                                                                    onClick={addDetailRow}
                                                                    title="Add New Row"
                                                                >
                                                                    <i className="fa fa-plus"></i>
                                                                </Button>
                                                            )}
                                                        </div>
                                                        {/* delete button slot — always 30px wide, always same position */}
                                                        <div style={{ width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {currentJournal.details.length > 1 && (
                                                                <Button
                                                                    variant="light"
                                                                    className="text-danger border-0 rounded-circle btn-icon p-2"
                                                                    onClick={() => removeDetailRow(idx)}
                                                                    style={{ width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                                                >
                                                                    <i className="fa fa-trash-alt"></i>
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                            {maintainNarration && expandedNarrations[idx] && (
                                                <tr className="bg-light border-0">
                                                    <td colSpan="6" className="p-2 bg-light border-0">
                                                        <Form.Control
                                                            size="sm"
                                                            as="textarea"
                                                            id={`cell-${idx}-narration-text`}
                                                            rows={1}
                                                            placeholder="Enter narration for this line..."
                                                            value={row.narration || ''}
                                                            onChange={e => handleDetailChange(idx, 'narration', e.target.value)}
                                                            onKeyDown={e => handleCellKeyDown(e, idx, 'narration-text')}
                                                            className="border-secondary border-opacity-25"
                                                        />
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                    {/* Summary Row */}
                                    <tr className="table-light fw-semibold">
                                        <td colSpan="2" className="text-end text-muted">Total:</td>
                                        <td className="text-end font-monospace text-success" style={{ padding: '4px 17px' }}>{totalDebit.toFixed(2)}</td>
                                        <td className="text-end font-monospace text-danger" colSpan={maintainNarration ? 2 : 1} style={{ padding: '4px 17px' }}>{totalCredit.toFixed(2)}</td>
                                        <td></td>
                                    </tr>
                                </tbody>
                            </Table>
                        </div>

                        {/* Master Narration */}
                        <div className="mt-2">
                            <Form.Group>
                                <Form.Label className="fw-semibold text-muted small mb-1">MASTER NARRATION</Form.Label>
                                <Form.Control
                                    size="sm"
                                    id="master-narration"
                                    as="textarea"
                                    rows={2}
                                    value={currentJournal.narration}
                                    onChange={e => handleInputChange('narration', e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            const saveBtn = document.querySelector('.btn-universal-save');
                                            if (saveBtn) saveBtn.focus();
                                        }
                                    }}
                                    placeholder="Optional master narration for this transaction voucher"
                                    className="border-secondary border-opacity-25"
                                />
                            </Form.Group>
                        </div>
                    </Modal.Body>
                    <Modal.Footer className="border-0 px-4 py-2 bg-light rounded-bottom-4 justify-content-between align-items-center">
                        <div>
                            {!isBalanced && totalDebit > 0 && (
                                <div className="text-danger small fw-semibold">
                                    <i className="fa fa-exclamation-triangle me-1"></i>
                                    Total Debit must equal Total Credit. Difference: {Math.abs(totalDebit - totalCredit).toFixed(2)}
                                </div>
                            )}
                            {isBalanced && (
                                <div className="text-success small fw-semibold">
                                    <i className="fa fa-check-circle me-1"></i>
                                    Voucher balanced successfully.
                                </div>
                            )}
                        </div>
                        <div className="d-flex gap-2">
                            <Button 
                                className="btn-universal-close" 
                                onClick={() => setShowModal(false)}
                            >
                                Close
                            </Button>
                            <Button
                                type="submit"
                                className="btn-universal-save"
                                disabled={!isBalanced}
                            >
                                <i className="fa fa-save me-2"></i>
                                {editMode ? 'Update' : 'Save'}
                            </Button>
                        </div>
                    </Modal.Footer>
                </Form>
            </Modal>

            {(() => {
                const activeRow = billSettlementModal.rowIdx !== null ? currentJournal.details[billSettlementModal.rowIdx] : null;
                const activeLedger = activeRow ? ledgers.find(l => String(l.id) === String(activeRow.ledger)) : null;
                const activeLedgerName = activeLedger ? activeLedger.name : '';
                const activeLedgerId = activeLedger ? String(activeLedger.id) : '';
                const activeLedgerInvoices = activeLedgerId ? (ledgerInvoices[activeLedgerId] || []) : [];
                const activeLedgerGroupName = (activeLedger?.account_group_name || '').toLowerCase();
                const isSupplier = activeLedgerGroupName.includes('creditor') || activeLedgerGroupName.includes('supplier') || activeLedgerGroupName.includes('purchase');
                const activeVoucherType = isSupplier ? 'Payment' : 'Receipt';
                const activeTotalAmount = activeRow ? (activeRow.entry_type === 'Dr' ? activeRow.debit_amount : activeRow.credit_amount) : 0;
                const activeAllocations = billSettlementModal.rowIdx !== null ? (billAllocations[billSettlementModal.rowIdx] || []) : [];

                return (
                    <BillSettlementPopup
                        show={billSettlementModal.show}
                        onHide={handleBillSettlementClose}
                        invoices={activeLedgerInvoices}
                        ledgerName={activeLedgerName}
                        totalAmount={activeTotalAmount}
                        existingAllocations={activeAllocations}
                        onApply={handleBillSettlementApply}
                        isDark={isDark}
                        voucherType={activeVoucherType}
                        isEditMode={editMode}
                    />
                );
            })()}
        </div>
    );
};

export default JournalList;
