import React, { useState, useEffect, useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Card, Button, Modal, Form, Row, Col, Table } from 'react-bootstrap';
import Swal from 'sweetalert2';
import Select from 'react-select';
import { ThemeContext } from '../../../context/ThemeContext';
import { getLedgers, getReceipts, createReceipt, updateReceipt, deleteReceipt } from '../../../services/FinanceService';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import InventoryService from '../../../services/InventoryService';
import SalesService from '../../../services/SalesService';
import PurchaseService from '../../../services/PurchaseService';
import { fetchCompany, fetchCompanyAddresses, fetchCompanyContacts, fetchBranches } from '../../../services/CompanyService';
import { fetchPrefixConfigurations, generateNextVoucherNumber } from '../../../services/PrefixService';
import { printFriendlyVoucher } from '../../../services/VoucherPrintService';

// ─── Bill Settlement Popup Component ───────────────────────────────────────
const BillSettlementPopup = ({ show, onHide, invoices, ledgerName, totalAmount, existingAllocations, onApply, isDark, voucherType = 'Receipt', isEditMode = false }) => {
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
        
        // Filter out invoices that are already settled (excluding allocations in this receipt)
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
                // For new unsaved receipts, server hasn't deducted anything, so outstanding is already correct.
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
// ─────────────────────────────────────────────────────────────────────────────

const ReceiptList = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [receipts, setReceipts] = useState([]);
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

    // Bill-wise settlement state
    // billAllocations: { [crIdx]: [{invoiceId, invoiceNo, invoiceAmount, settleAmount, status}] }
    const [billAllocations, setBillAllocations] = useState({});
    const [billSettlementModal, setBillSettlementModal] = useState({ show: false, crIdx: null });

    const defaultDetail = {
        entry_type: 'Dr',
        ledger: '',
        debit_amount: 0.00,
        credit_amount: 0.00,
        narration: '',
        against_invoice: ''
    };

    const defaultReceipt = {
        id: null,
        voucher_no: '',
        voucher_date: new Date().toISOString().split('T')[0],
        narration: '',
        details: [
            { ...defaultDetail, entry_type: 'Dr' },
            { ...defaultDetail, entry_type: 'Cr' }
        ]
    };

    const [currentReceipt, setCurrentReceipt] = useState(defaultReceipt);
    const [cellToFocus, setCellToFocus] = useState(null);

    const [ledgerInvoices, setLedgerInvoices] = useState({});

    const fetchInvoicesForLedger = async (ledgerIdInput, forceRefresh = false) => {
        if (!ledgerIdInput) return;
        const ledgerId = String(ledgerIdInput?.id || ledgerIdInput);
        if (!forceRefresh && ledgerInvoices[ledgerId]) return;
        
        try {
            const res = await SalesService.getSalesInvoices(ledgerId);
            const invoicesList = Array.isArray(res.data) ? res.data : [];
            setLedgerInvoices(prev => ({
                ...prev,
                [ledgerId]: invoicesList
            }));
        } catch (error) {
            console.error('Failed to fetch invoices for ledger:', error);
        }
    };

    useEffect(() => {
        if (showModal && currentReceipt.details) {
            currentReceipt.details.forEach(d => {
                if (d.entry_type === 'Cr' && d.ledger) {
                    const ledgerId = String(d.ledger?.id || d.ledger);
                    fetchInvoicesForLedger(ledgerId);
                }
            });
        }
    }, [showModal, currentReceipt.details]);

    const { background } = useContext(ThemeContext);
    const isDark = background?.value === 'dark';

    const [companyInfo, setCompanyInfo] = useState(null);
    const [companyAddress, setCompanyAddress] = useState(null);
    const [companyContact, setCompanyContact] = useState(null);
    const [prefixConfigs, setPrefixConfigs] = useState([]);
    const [branches, setBranches] = useState([]);

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

    useEffect(() => {
        const initData = async () => {
            setLoading(true);
            try {
                const [receiptsData, ledgersData] = await Promise.all([getReceipts(), getLedgers()]);
                setReceipts(receiptsData || []);
                setLedgers(ledgersData || []);
                loadCompanyDetails();
                fetchPrefixConfigs();

                const searchParams = new URLSearchParams(location.search);
                const editId = searchParams.get('edit');
                if (editId && receiptsData && receiptsData.length > 0) {
                    const cleanTarget = String(editId).toLowerCase().replace(/[^a-z0-9]/g, '');
                    const itemToEdit = receiptsData.find(r => {
                        const rId = String(r.id);
                        const rVNo = String(r.voucher_no || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                        return rId === String(editId) || rVNo === cleanTarget || (cleanTarget && rVNo.endsWith(cleanTarget));
                    });
                    if (itemToEdit) {
                        await handleShowModal(itemToEdit, ledgersData);
                    }
                }
            } catch (err) {
                console.error('Error initializing receipts data:', err);
            } finally {
                setLoading(false);
            }
            fetchConfiguration();
        };
        initData();
    }, [location.search]);



    useEffect(() => {
        if (!cellToFocus) return;

        let mounted = true;
        const tryFocus = (attempts = 0) => {
            if (!mounted) return;
            const id = `cell-${cellToFocus.rowIndex}-${cellToFocus.colName}`;
            const element = document.getElementById(id);
            if (element && !element.disabled && element.offsetParent !== null) {
                element.focus();
                if (element.select) {
                    element.select();
                }
                setCellToFocus(null);
            } else if (attempts < 15) {
                setTimeout(() => tryFocus(attempts + 1), 20);
            } else {
                // Fallback to master narration if element is really not found
                const masterNarrationEl = document.getElementById('master-narration');
                if (masterNarrationEl) {
                    masterNarrationEl.focus();
                }
                setCellToFocus(null);
            }
        };

        tryFocus();

        return () => {
            mounted = false;
        };
    }, [currentReceipt.details, cellToFocus]);

    const fetchConfiguration = async () => {
        try {
            const res = await InventoryService.getProductConfigurations();
            const configs = Array.isArray(res.data) ? res.data : [];
            const myConfig = configs.find(c => 
                (c.voucher_type_name && c.voucher_type_name.toLowerCase() === 'receipt') ||
                (c.voucher_type_code && c.voucher_type_code.toLowerCase() === 'rv')
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
            const data = await getReceipts();
            setReceipts(data);
        } catch (error) {
            Swal.fire('Error', 'Failed to fetch receipt vouchers', 'error');
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
        const receiptConfig = configs.find(c => {
            const vName = (c.voucher_type_name || '').toLowerCase().trim();
            return vName === 'receipt' || c.prefix === 'RV';
        });
        return generateNextVoucherNumber(receiptConfig, customList || receipts, 'RV', branchList);
    };

    const printVoucher = (voucher, type = 'Receipt') => {
        printFriendlyVoucher({
            voucher,
            type,
            ledgers,
            companyInfo,
            companyAddress,
            companyContact
        });
    };

    const handleShowModal = async (receipt = null, customLedgers = null) => {
        try {
            let data = customLedgers || ledgers;
            if (!data || data.length === 0) {
                data = await getLedgers();
                setLedgers(data);
            }
            
            const cashBankOptions = data.filter(l => {
                const group = (l.account_group_name || '').toLowerCase();
                return group.includes('cash') || group.includes('bank');
            });

            setLedgerInvoices({}); // always reset invoice cache when opening modal
            setBillAllocations({}); // always reset allocations when opening

            if (receipt) {
                const initialExpanded = {};
                const loadedAllocations = {};
                const rawDetails = receipt.details || [];
                const collapsedDetails = [];
                let crVIdx = 0;

                rawDetails.forEach((d) => {
                    const ledgerId = String(d.ledger?.id || d.ledger);
                    collapsedDetails.push({
                        ...d,
                        ledger: d.ledger?.id || d.ledger,
                        debit_amount: parseFloat(d.debit_amount) || 0,
                        credit_amount: parseFloat(d.credit_amount) || 0
                    });

                    if (d.entry_type === 'Cr') {
                        const allocations = d.bill_allocations || [];
                        const mappedAllocs = allocations.map(a => ({
                            refType: a.allocation_type === 'Agst Ref' ? 'against_ref' : a.allocation_type === 'New Ref' ? 'new_ref' : a.allocation_type === 'Advance' ? 'advance' : 'on_account',
                            invoiceId: a.against_sales_invoice || '',
                            refName: a.name || '',
                            settleAmount: parseFloat(a.amount) || 0
                        }));
                        if (mappedAllocs.length > 0) {
                            loadedAllocations[crVIdx] = mappedAllocs;
                            fetchInvoicesForLedger(ledgerId);
                        }
                        crVIdx++;
                    }
                });

                if (collapsedDetails.length > 0) {
                    collapsedDetails.forEach((d, idx) => { if (d.narration) initialExpanded[idx] = true; });
                }
                setBillAllocations(loadedAllocations);
                setExpandedNarrations(initialExpanded);
                setCurrentReceipt({
                    ...receipt,
                    narration: receipt.narration || '',
                    details: collapsedDetails.length > 0 ? collapsedDetails : [
                        { ...defaultDetail, entry_type: 'Dr', ledger: '' },
                        { ...defaultDetail, entry_type: 'Cr', ledger: '', credit_amount: 0 }
                    ]
                });
                setEditMode(true);
            } else {
                setExpandedNarrations({});
                const defaultCashLedger = cashBankOptions.find(l => l.name.toLowerCase() === 'cash') || cashBankOptions[0];
                const initialNo = generateVoucherNo();
                setCurrentReceipt({
                    ...defaultReceipt,
                    voucher_no: initialNo,
                    details: [
                        { ...defaultDetail, entry_type: 'Dr', ledger: defaultCashLedger ? defaultCashLedger.id : '' },
                        { ...defaultDetail, entry_type: 'Cr', ledger: '', credit_amount: 0 }
                    ]
                });
                setEditMode(false);
                fetchPrefixConfigs().then(({ configs, branches: bData }) => {
                    const latestNo = generateVoucherNo(null, configs, bData);
                    setCurrentReceipt(prev => ({
                        ...prev,
                        voucher_no: latestNo
                    }));
                });
            }
            setShowModal(true);
        } catch (error) {
            console.error('Failed to prepare receipt modal', error);
            Swal.fire('Error', 'Failed to fetch ledgers. Please try again.', 'error');
        }
    };





    const handleDelete = async (id, no) => {
        const result = await Swal.fire({
            title: 'Delete Receipt Voucher?',
            text: `Are you sure you want to delete receipt voucher "${no}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deleteReceipt(id);
                Swal.fire('Deleted', 'Voucher deleted successfully', 'success');
                fetchData();
            } catch (error) {
                Swal.fire('Error', 'Failed to delete receipt voucher', 'error');
            }
        }
    };

    const handleInputChange = (field, value) => {
        setCurrentReceipt({ ...currentReceipt, [field]: value });
    };

    const handleDrLedgerChange = (ledgerId) => {
        const details = [...currentReceipt.details];
        let drIdx = details.findIndex(d => d.entry_type === 'Dr');
        if (drIdx === -1) {
            details.push({ ...defaultDetail, entry_type: 'Dr', ledger: ledgerId });
            drIdx = details.length - 1;
        } else {
            details[drIdx] = { ...details[drIdx], ledger: ledgerId };
        }
        
        // Recalculate debit amount to match sum of credits
        const totalCredit = details.filter(d => d.entry_type === 'Cr').reduce((sum, d) => sum + (parseFloat(d.credit_amount) || 0), 0);
        details[drIdx].debit_amount = totalCredit;
        details[drIdx].credit_amount = 0;
        
        setCurrentReceipt({ ...currentReceipt, details });
    };

    const handleCrRowChange = (crIdx, field, value) => {
        const details = [...currentReceipt.details];
        
        let crCount = 0;
        let targetIdx = -1;
        for (let i = 0; i < details.length; i++) {
            if (details[i].entry_type === 'Cr') {
                if (crCount === crIdx) {
                    targetIdx = i;
                    break;
                }
                crCount++;
            }
        }
        
        if (targetIdx > -1) {
            details[targetIdx] = { ...details[targetIdx], [field]: value };
            if (field === 'ledger' && value) {
                fetchInvoicesForLedger(value);
                details[targetIdx].against_invoice = '';
                // Clear bill allocations when ledger changes
                setBillAllocations(prev => { const n = {...prev}; delete n[crIdx]; return n; });
            }
            if (field === 'credit_amount') {
                details[targetIdx].debit_amount = 0;
            }
        }
        
        // Update debit amount of the Dr row to match the sum of credits
        const totalCredit = details.filter(d => d.entry_type === 'Cr').reduce((sum, d) => sum + (parseFloat(d.credit_amount) || 0), 0);
        const drIdx = details.findIndex(d => d.entry_type === 'Dr');
        if (drIdx > -1) {
            details[drIdx].debit_amount = totalCredit;
            details[drIdx].credit_amount = 0;
        }
        
        setCurrentReceipt({ ...currentReceipt, details });
    };


    const addCrRow = () => {
        const details = [...currentReceipt.details];
        details.push({
            ...defaultDetail,
            entry_type: 'Cr',
            debit_amount: 0,
            credit_amount: 0,
            narration: ''
        });
        setCurrentReceipt({ ...currentReceipt, details });
    };

    const removeCrRow = (crIdx) => {
        const crRowsCount = currentReceipt.details.filter(d => d.entry_type === 'Cr').length;
        if (crRowsCount <= 1) {
            Swal.fire('Validation Warning', 'At least one credit entry is required.', 'warning');
            return;
        }
        
        const details = [...currentReceipt.details];
        let crCount = 0;
        let targetIdx = -1;
        for (let i = 0; i < details.length; i++) {
            if (details[i].entry_type === 'Cr') {
                if (crCount === crIdx) {
                    targetIdx = i;
                    break;
                }
                crCount++;
            }
        }
        
        if (targetIdx > -1) {
            details.splice(targetIdx, 1);
        }
        
        // Re-index billAllocations: remove crIdx, shift subsequent keys down by 1
        setBillAllocations(prev => {
            const next = {};
            Object.keys(prev).forEach(k => {
                const kNum = parseInt(k);
                if (kNum < crIdx) next[kNum] = prev[k];
                else if (kNum > crIdx) next[kNum - 1] = prev[k];
            });
            return next;
        });

        // Recalculate debit amount of Dr row
        const totalCredit = details.filter(d => d.entry_type === 'Cr').reduce((sum, d) => sum + (parseFloat(d.credit_amount) || 0), 0);
        const drIdx = details.findIndex(d => d.entry_type === 'Dr');
        if (drIdx > -1) {
            details[drIdx].debit_amount = totalCredit;
            details[drIdx].credit_amount = 0;
        }
        
        setCurrentReceipt({ ...currentReceipt, details });
    };

    const openBillSettlement = (crIdx) => {
        const crRowsLocal = currentReceipt.details.filter(d => d.entry_type === 'Cr');
        const row = crRowsLocal[crIdx];
        if (!row || !row.ledger) {
            Swal.fire('Select Ledger First', 'Please select a Customer / Party ledger before opening bill-wise settlement.', 'warning');
            return;
        }
        const ledgerId = String(row.ledger?.id || row.ledger);
        fetchInvoicesForLedger(ledgerId, true);
        setBillSettlementModal({ show: true, crIdx });
    };

    // Apply bill settlement: store allocations and update credit_amount of the Cr row
    const applyBillSettlement = (crIdx, allocations) => {
        setBillAllocations(prev => ({ ...prev, [crIdx]: allocations }));
        if (allocations.length > 0) {
            const totalSettled = allocations.reduce((s, a) => s + (parseFloat(a.settleAmount) || 0), 0);
            handleCrRowChange(crIdx, 'credit_amount', totalSettled);
        }
        setBillSettlementModal({ show: false, crIdx: null });

        setTimeout(() => {
            const crRowsCount = currentReceipt.details.filter(d => d.entry_type === 'Cr').length;
            if (crIdx < crRowsCount - 1) {
                focusCell(crIdx + 1, 'ledger');
            } else {
                addCrRow();
                setTimeout(() => {
                    focusCell(crIdx + 1, 'ledger');
                }, 80);
            }
        }, 100);
    };

    const toggleNarration = (idx) => {
        setExpandedNarrations(prev => ({
            ...prev,
            [idx]: !prev[idx]
        }));
    };

    // Live calculations
    const drRow = currentReceipt.details.find(d => d.entry_type === 'Dr') || { ...defaultDetail, entry_type: 'Dr' };
    const crRows = currentReceipt.details.filter(d => d.entry_type === 'Cr');
    const totalDebit = drRow.debit_amount || 0;
    const totalCredit = crRows.reduce((sum, d) => sum + (parseFloat(d.credit_amount) || 0), 0);
    const isBalanced = totalCredit > 0 && Math.abs(totalDebit - totalCredit) < 0.01;

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!currentReceipt.voucher_no) {
            Swal.fire('Validation Error', 'Voucher Number is required', 'warning');
            return;
        }

        // Expand bill allocations: one Cr row per invoice / reference selected in the popup
        const expandedDetails = [];
        currentReceipt.details.forEach(detail => {
            if (detail.entry_type === 'Dr') {
                expandedDetails.push({
                    ledger: detail.ledger?.id || detail.ledger,
                    entry_type: 'Dr',
                    debit_amount: parseFloat(detail.debit_amount) || 0,
                    credit_amount: 0,
                    narration: detail.narration || ''
                });
                return;
            }
            if (!detail.ledger || detail.ledger === '') return; // skip empty rows
            
            // Find the index of this detail among all 'Cr' rows in currentReceipt.details
            let crIdx = -1;
            let crCount = 0;
            for (let i = 0; i < currentReceipt.details.length; i++) {
                if (currentReceipt.details[i].entry_type === 'Cr') {
                    if (currentReceipt.details[i] === detail) {
                        crIdx = crCount;
                        break;
                    }
                    crCount++;
                }
            }
            
            const allocs = crIdx > -1 ? (billAllocations[crIdx] || []) : [];
            const serializedAllocs = allocs.map(alloc => ({
                allocation_type: alloc.refType === 'against_ref' ? 'Agst Ref' : alloc.refType === 'new_ref' ? 'New Ref' : alloc.refType === 'advance' ? 'Advance' : 'On Account',
                against_sales_invoice: alloc.invoiceId || null,
                name: alloc.refName || (alloc.refType === 'on_account' ? 'On Account' : ''),
                amount: parseFloat(alloc.settleAmount) || 0
            }));
            
            expandedDetails.push({
                ledger: detail.ledger?.id || detail.ledger,
                entry_type: 'Cr',
                debit_amount: 0,
                credit_amount: parseFloat(detail.credit_amount) || 0,
                narration: detail.narration || '',
                bill_allocations: serializedAllocs
            });
        });

        // Recalculate total credit of expanded rows
        const cleanedTotalCredit = expandedDetails.filter(d => d.entry_type === 'Cr').reduce((sum, d) => sum + (parseFloat(d.credit_amount) || 0), 0);
        
        // Update Dr row's debit amount
        const drRowIdx = expandedDetails.findIndex(d => d.entry_type === 'Dr');
        if (drRowIdx > -1) {
            expandedDetails[drRowIdx].debit_amount = cleanedTotalCredit;
            expandedDetails[drRowIdx].credit_amount = 0;
        }

        const cleanedTotalDebit = drRowIdx > -1 ? (expandedDetails[drRowIdx].debit_amount || 0) : 0;
        const cleanedIsBalanced = cleanedTotalCredit > 0 && Math.abs(cleanedTotalDebit - cleanedTotalCredit) < 0.01;

        if (!cleanedIsBalanced) {
            Swal.fire('Validation Error', 'Total Credit must be greater than zero. Please select at least one Credit Ledger Account.', 'warning');
            return;
        }

        const drRowCheck = expandedDetails.find(d => d.entry_type === 'Dr');
        if (!drRowCheck || !drRowCheck.ledger) {
            Swal.fire('Validation Error', 'Please select a Cash / Bank Account (Debit Account)', 'warning');
            return;
        }
        if ((parseFloat(drRowCheck.debit_amount) || 0) <= 0) {
            Swal.fire('Validation Error', 'Total Receipt Amount must be greater than zero', 'warning');
            return;
        }

        const crRowsCheck = expandedDetails.filter(d => d.entry_type === 'Cr');
        for (let i = 0; i < crRowsCheck.length; i++) {
            const row = crRowsCheck[i];
            if (!row.ledger) {
                Swal.fire('Validation Error', `Please select a Ledger Account for credit row #${i + 1}`, 'warning');
                return;
            }
            if ((parseFloat(row.credit_amount) || 0) <= 0) {
                Swal.fire('Validation Error', `Amount must be greater than zero for credit row #${i + 1}`, 'warning');
                return;
            }
        }

        try {
            const savedVoucher = { ...currentReceipt, details: expandedDetails };
            if (editMode) {
                await updateReceipt(currentReceipt.id, savedVoucher);
            } else {
                await createReceipt(savedVoucher);
            }
            setShowModal(false);
            setLedgerInvoices({}); // Clear invoice cache so next receipt sees fresh outstanding balances
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
                    printVoucher(savedVoucher, 'Receipt');
                }
                const searchParams = new URLSearchParams(location.search);
                if (searchParams.get('edit')) {
                    navigate('/finance/ledger-book');
                }
            });
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'Failed to save voucher. Ensure Voucher Number is unique.', 'error');
        }
    };

    // Helper to format option object for react-select value
    const getLedgerOption = (ledgerId) => {
        if (!ledgerId) return null;
        const ledger = ledgers.find(l => String(l.id) === String(ledgerId));
        if (!ledger) return null;
        return {
            value: ledger.id,
            label: ledger.name
        };
    };

    // Spreadsheet keyboard navigation
    const focusCell = (rowIndex, colName) => {
        const cols = ['ledger', 'against_invoice', 'credit_amount', 'narration'];
        let curColIdx = cols.indexOf(colName);
        let curRowIdx = rowIndex;

        let found = false;
        // Search forward up to 5 cells to find a focusable one
        for (let i = 0; i < 5; i++) {
            const id = `cell-${curRowIdx}-${cols[curColIdx]}`;
            const element = document.getElementById(id);
            if (element && !element.disabled && element.offsetParent !== null) {
                setTimeout(() => {
                    element.focus();
                    if (element.select) {
                        element.select();
                    }
                }, 0);
                found = true;
                break;
            }
            curColIdx++;
            if (curColIdx >= cols.length) {
                curColIdx = 0;
                curRowIdx++;
            }
        }

        if (!found) {
            const masterNarrationEl = document.getElementById('master-narration');
            if (masterNarrationEl) {
                setTimeout(() => masterNarrationEl.focus(), 0);
            }
        }
    };

    const handleCellKeyDown = (e, rowIndex, colName) => {
        const target = e.target;
        const isReactSelectOpen = target.getAttribute('aria-expanded') === 'true';

        if (isReactSelectOpen && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter')) {
            return; // Let react-select handle dropdown navigation and selection
        }

        const crRowsLocal = currentReceipt.details.filter(d => d.entry_type === 'Cr');
        const row = crRowsLocal[rowIndex];

        const crRowsCount = currentReceipt.details.filter(d => d.entry_type === 'Cr').length;

        if (e.key === 'Enter') {
            if (colName === 'ledger') {
                if (!row || !row.ledger) {
                    e.preventDefault();
                    if (rowIndex >= 1) {
                        removeCrRow(rowIndex);
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
                if (rowIndex >= 1) {
                    removeCrRow(rowIndex);
                }
                setTimeout(() => {
                    const saveBtn = document.querySelector('.btn-universal-save');
                    if (saveBtn) {
                        saveBtn.focus();
                    }
                }, 50);
                return;
            }

            e.preventDefault();
            const cols = ['ledger', 'against_invoice', 'credit_amount', 'narration'];
            const currentColIdx = cols.indexOf(colName);

            if (colName === 'against_invoice') {
                e.preventDefault();
                focusCell(rowIndex, 'credit_amount');
                return;
            }

            if (colName === 'credit_amount') {
                e.preventDefault();
                if (!row || !row.ledger) {
                    focusCell(rowIndex, 'ledger');
                    return;
                }
                if (rowIndex < crRowsCount - 1) {
                    focusCell(rowIndex + 1, 'ledger');
                } else {
                    addCrRow();
                    setTimeout(() => {
                        focusCell(rowIndex + 1, 'ledger');
                    }, 80);
                }
                return;
            }

            if (colName === 'narration') {
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
                e.preventDefault();
                if (!row || !row.ledger) {
                    focusCell(rowIndex, 'ledger');
                    return;
                }
                if (rowIndex < crRowsCount - 1) {
                    focusCell(rowIndex + 1, 'ledger');
                } else {
                    const masterNarrationEl = document.getElementById('master-narration');
                    if (masterNarrationEl) {
                        masterNarrationEl.focus();
                    }
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
            } else if (rowIndex < crRowsCount - 1) {
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

    const filteredReceipts = receipts.filter(r => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = (
            (r.voucher_no || '').toLowerCase().includes(term) ||
            (r.narration || '').toLowerCase().includes(term) ||
            (r.voucher_date || '').toLowerCase().includes(term)
        );

        let matchesDate = true;
        if (fromDate) {
            const vDate = r.voucher_date ? r.voucher_date.split('T')[0] : '';
            if (!vDate || vDate < fromDate) matchesDate = false;
        }
        if (toDate) {
            const vDate = r.voucher_date ? r.voucher_date.split('T')[0] : '';
            if (!vDate || vDate > toDate) matchesDate = false;
        }

        return matchesSearch && matchesDate;
    });

    const totalPages = Math.ceil(filteredReceipts.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentReceipts = filteredReceipts.slice(startIndex, startIndex + itemsPerPage);

    const debitAccountOptions = ledgers.filter(l => {
        const group = (l.account_group_name || '').toLowerCase();
        return group.includes('cash') || group.includes('bank');
    });

    return (
        <div className="container-fluid">
            <div className="row">
            <div className="col-lg-12">
                <Card>
                    <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <Card.Title className="mb-0">Receipt Vouchers</Card.Title>
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
                                    placeholder="Search Receipt..."
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
                                    module="receipt" 
                                    onClick={() => handleShowModal()} 
                                    style={{ height: '34px', display: 'flex', alignItems: 'center', fontSize: '13px' }}
                                >
                                    Receipt
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
                                        {currentReceipts.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="text-center py-4 text-muted">No vouchers found</td>
                                            </tr>
                                        ) : (
                                            currentReceipts.map((r, idx) => {
                                                const dTotal = r.details?.reduce((s, row) => s + (parseFloat(row.debit_amount) || 0), 0) || 0;
                                                const cTotal = r.details?.reduce((s, row) => s + (parseFloat(row.credit_amount) || 0), 0) || 0;
                                                return (
                                                    <tr key={r.id}>
                                                        <td>{startIndex + idx + 1}</td>
                                                        <td>{r.voucher_no}</td>
                                                        <td>{r.voucher_date}</td>
                                                        <td className="text-truncate" style={{ maxWidth: '300px' }}>{r.narration || '-'}</td>
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
                                                                    onClick={() => printVoucher(r, 'Receipt')} 
                                                                    title="Print Voucher"
                                                                >
                                                                    <i className="fa fa-print"></i>
                                                                </Button>
                                                                <EditButton module="receipt" onClick={() => handleShowModal(r)} className="me-1" />
                                                                <DeleteButton module="receipt" onClick={() => handleDelete(r.id, r.voucher_no)} />
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
                                            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredReceipts.length)} of {filteredReceipts.length} entries
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
                    document.getElementById('voucher-date-input')?.focus();
                }}
            >
                <Modal.Header closeButton>
                    <Modal.Title className="w-100">
                        <div className="d-flex align-items-center">
                            <div
                                className="d-flex align-items-center justify-content-center rounded-circle me-3 form-icon-circle"
                                style={{ width: '48px', height: '48px' }}
                            >
                                <i className="fa fa-receipt text-white fs-4"></i>
                            </div>
                            <div>
                                <h4 className="mb-1">{editMode ? 'Edit Receipt Voucher' : 'New Receipt Voucher'}</h4>
                                <p className="mb-0 text-muted" style={{ fontSize: '13px', fontWeight: 'normal' }}>
                                    Record cash or bank receipt transactions easily. Select debit account and enter particulars.
                                </p>
                            </div>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleSubmit}>
                    <Modal.Body className="py-2">
                        <Row className="mb-3">
                            <Col lg={4} md={6} sm={12} className="mb-2">
                                <Form.Group>
                                    <Form.Label className="fw-semibold text-muted small mb-1">Voucher no:</Form.Label>
                                    <Form.Control
                                        size="sm"
                                        type="text"
                                        value={currentReceipt.voucher_no}
                                        readOnly
                                        disabled
                                        className="border-secondary border-opacity-25 bg-light fw-bold"
                                    />
                                </Form.Group>
                            </Col>
                            <Col lg={4} md={6} sm={12} className="mb-2">
                                <Form.Group>
                                    <Form.Label className="fw-semibold text-muted small mb-1">Date:</Form.Label>
                                    <Form.Control
                                        size="sm"
                                        id="voucher-date-input"
                                        type="date"
                                        value={currentReceipt.voucher_date}
                                        onChange={e => handleInputChange('voucher_date', e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const el = document.getElementById('debit-account-select');
                                                if (el) el.focus();
                                            }
                                        }}
                                        required
                                        className="border-secondary border-opacity-25"
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <Row className="mb-3">
                            <Col lg={12}>
                                <Form.Group>
                                    <Form.Label className="fw-bold text-dark mb-1">Debit Account (Cash / Bank)</Form.Label>
                                    <Select
                                        options={[
                                            { value: '', label: '-- Select Cash / Bank --' },
                                            ...debitAccountOptions.map(l => ({ value: l.id, label: l.name }))
                                        ]}
                                        value={getLedgerOption(drRow.ledger)}
                                        onChange={sel => {
                                            handleDrLedgerChange(sel ? sel.value : '');
                                            if (sel && sel.value) {
                                                setTimeout(() => {
                                                    focusCell(0, 'ledger');
                                                }, 100);
                                            }
                                        }}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                const drRowLocal = currentReceipt.details.find(d => d.entry_type === 'Dr');
                                                if (drRowLocal && drRowLocal.ledger) {
                                                    e.preventDefault();
                                                    focusCell(0, 'ledger');
                                                }
                                            }
                                        }}
                                        styles={customSelectStyles}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        isSearchable
                                        isClearable={true}
                                        openMenuOnFocus={true}
                                        blurInputOnSelect={true}
                                        placeholder="-- Select Cash / Bank --"
                                        inputId="debit-account-select"
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <div className="table-responsive">
                            <Table bordered className="align-middle journal-entry-table border-secondary border-opacity-10">
                                <thead>
                                    <tr className="table-light">
                                        <th style={{ width: maintainNarration ? '62%' : '72%' }}>Particulars (Credit)</th>
                                        <th style={{ width: '18%', textAlign: 'right' }} className="text-end">Amount</th>
                                        {maintainNarration && <th style={{ width: '10%', textAlign: 'center' }}>Note</th>}
                                        <th style={{ width: '10%', textAlign: 'center' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {crRows.map((row, idx) => {
                                        const rowAllocs = billAllocations[idx] || [];
                                        const hasBills = rowAllocs.length > 0;
                                        return (
                                        <React.Fragment key={idx}>
                                            <tr>
                                                {/* Particulars */}
                                                <td>
                                                    <Select
                                                        options={[
                                                            { value: '', label: '-- Select Ledger --' },
                                                            ...ledgers.map(l => ({ value: l.id, label: l.name }))
                                                        ]}
                                                        value={getLedgerOption(row.ledger)}
                                                        onChange={sel => {
                                                            handleCrRowChange(idx, 'ledger', sel ? sel.value : '');
                                                            if (sel && sel.value) {
                                                                setTimeout(() => {
                                                                    const el = document.getElementById(`cell-${idx}-credit_amount`);
                                                                    if (el) { el.focus(); if (el.select) el.select(); }
                                                                }, 100);
                                                            } else {
                                                                if (idx >= 1) removeCrRow(idx);
                                                                setTimeout(() => {
                                                                    const saveBtn = document.querySelector('.btn-universal-save');
                                                                    if (saveBtn) saveBtn.focus();
                                                                }, 50);
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

                                                {/* Amount */}
                                                <td style={{ textAlign: 'right', padding: '4px 8px', verticalAlign: 'middle' }}>
                                                    <Form.Control
                                                        size="sm"
                                                        id={`cell-${idx}-credit_amount`}
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={row.credit_amount || ''}
                                                        onChange={e => handleCrRowChange(idx, 'credit_amount', parseFloat(e.target.value) || 0)}
                                                        onKeyDown={e => {
                                                            const rowAllocs = billAllocations[idx] || [];
                                                            const totalSettled = rowAllocs.reduce((s, a) => s + (parseFloat(a.settleAmount) || 0), 0);
                                                            const isAlreadySettled = rowAllocs.length > 0 && Math.abs(totalSettled - (parseFloat(row.credit_amount) || 0)) < 0.01;
                                                            
                                                            if (e.key === 'Enter' && row.ledger && (parseFloat(row.credit_amount) || 0) > 0 && !isAlreadySettled) {
                                                                e.preventDefault();
                                                                openBillSettlement(idx);
                                                            } else {
                                                                handleCellKeyDown(e, idx, 'credit_amount');
                                                            }
                                                        }}
                                                        placeholder="0.00"
                                                        className="text-end font-monospace border-secondary border-opacity-25"
                                                        style={{ height: '30px' }}
                                                    />
                                                    {hasBills && (
                                                        <div style={{ fontSize: 10, color: '#3b6fd4', marginTop: 3, fontWeight: 'bold', textAlign: 'right', cursor: 'pointer' }} onClick={() => openBillSettlement(idx)}>
                                                            <i className="fa fa-check-circle me-1"></i>
                                                            {rowAllocs.length} Ref{rowAllocs.length > 1 ? 's' : ''} allocated ({rowAllocs.map(a => a.refName || (a.refType === 'on_account' ? 'On Account' : 'Ref')).join(', ')})
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Narration button */}
                                                {maintainNarration && (
                                                    <td className="text-center">
                                                        <Button
                                                            id={`cell-${idx}-narration`}
                                                            type="button"
                                                            onClick={() => toggleNarration(idx)}
                                                            onKeyDown={e => handleCellKeyDown(e, idx, 'narration')}
                                                            style={{
                                                                width: '30px', height: '30px',
                                                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                                borderRadius: '8px',
                                                                backgroundColor: (row.narration || expandedNarrations[idx]) ? '#f3b73e' : '#e4e7ed',
                                                                color: (row.narration || expandedNarrations[idx]) ? '#ffffff' : '#a0aec0',
                                                                borderColor: (row.narration || expandedNarrations[idx]) ? '#f3b73e' : '#e4e7ed',
                                                                boxShadow: 'none'
                                                            }}
                                                            className="p-0 border-0"
                                                        >
                                                            <i className="fa fa-file-alt"></i>
                                                        </Button>
                                                    </td>
                                                )}

                                                {/* Action */}
                                                <td className="text-center" style={{ whiteSpace: 'nowrap' }}>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                        {/* + button slot — always 30px wide */}
                                                        <div style={{ width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {idx === crRows.length - 1 && (
                                                                <Button
                                                                    variant="primary"
                                                                    className="rounded d-inline-flex align-items-center justify-content-center"
                                                                    style={{ width: '30px', height: '30px' }}
                                                                    onClick={() => {
                                                                        addCrRow();
                                                                        setCellToFocus({ rowIndex: crRows.length, colName: 'ledger' });
                                                                    }}
                                                                    title="Add New Row"
                                                                >
                                                                    <i className="fa fa-plus"></i>
                                                                </Button>
                                                            )}
                                                        </div>
                                                        {/* delete button slot — always 30px wide, always same position */}
                                                        <div style={{ width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {crRows.length > 1 && (
                                                                <Button
                                                                    variant="light"
                                                                    className="text-danger border-0 rounded-circle btn-icon p-2"
                                                                    onClick={() => removeCrRow(idx)}
                                                                    style={{ width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                                                >
                                                                    <i className="fa fa-trash-alt"></i>
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Narration expand row */}
                                            {maintainNarration && expandedNarrations[idx] && (
                                                <tr className="bg-light border-0">
                                                    <td colSpan={maintainNarration ? 4 : 3} className="p-2 bg-light border-0">
                                                        <Form.Control
                                                            size="sm"
                                                            as="textarea"
                                                            id={`cell-${idx}-narration-text`}
                                                            rows={1}
                                                            placeholder="Enter narration for this line..."
                                                            value={row.narration || ''}
                                                            onChange={e => handleCrRowChange(idx, 'narration', e.target.value)}
                                                            onKeyDown={e => handleCellKeyDown(e, idx, 'narration-text')}
                                                            className="border-secondary border-opacity-25"
                                                        />
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                        );
                                    })}

                                    {/* Summary Row */}
                                    <tr className="table-light fw-semibold">
                                        <td className="text-end text-muted">Total Credit:</td>
                                        <td className="text-end font-monospace text-primary" style={{ padding: '4px 17px' }}>{totalCredit.toFixed(2)}</td>
                                        {maintainNarration && <td></td>}
                                        <td></td>
                                    </tr>
                                </tbody>
                            </Table>
                        </div>

                        {/* Bill Settlement Popup */}
                        {(() => {
                            const activeCrIdx = billSettlementModal.crIdx;
                            const activeCrRow = activeCrIdx !== null ? crRows[activeCrIdx] : null;
                            const activeLedgerId = activeCrRow?.ledger ? String(activeCrRow.ledger?.id || activeCrRow.ledger) : '';
                            const activeInvoices = activeLedgerId ? (ledgerInvoices[activeLedgerId] || []) : [];
                            const activeLedgerName = activeLedgerId
                                ? (ledgers.find(l => String(l.id) === activeLedgerId)?.name || '')
                                : '';
                            return (
                                <BillSettlementPopup
                                    show={billSettlementModal.show}
                                    onHide={() => setBillSettlementModal({ show: false, crIdx: null })}
                                    invoices={activeInvoices}
                                    ledgerName={activeLedgerName}
                                    totalAmount={activeCrRow?.credit_amount || 0}
                                    existingAllocations={activeCrIdx !== null ? (billAllocations[activeCrIdx] || []) : []}
                                    onApply={(allocs) => applyBillSettlement(activeCrIdx, allocs)}
                                    isDark={isDark}
                                    isEditMode={editMode}
                                />
                            );
                        })()}

                        {/* Master Narration */}
                        <div className="mt-2">
                            <Form.Group>
                                <Form.Label className="fw-semibold text-muted small mb-1">MASTER NARRATION</Form.Label>
                                <Form.Control
                                    size="sm"
                                    id="master-narration"
                                    as="textarea"
                                    rows={2}
                                    value={currentReceipt.narration}
                                    onChange={e => handleInputChange('narration', e.target.value)}
                                    placeholder="Optional master narration for this transaction voucher"
                                    className="border-secondary border-opacity-25"
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            const submitBtn = document.querySelector('.btn-universal-save');
                                            if (submitBtn && !submitBtn.disabled) {
                                                submitBtn.click();
                                            }
                                        }
                                    }}
                                />
                            </Form.Group>
                        </div>
                    </Modal.Body>
                    <Modal.Footer className="border-0 px-4 py-2 bg-light rounded-bottom-4 justify-content-between align-items-center">
                        <div>
                            {!isBalanced && totalCredit > 0 && (
                                <div className="text-danger small fw-semibold">
                                    <i className="fa fa-exclamation-triangle me-1"></i>
                                    Debit cash/bank account must be selected and balance must equal credit entries.
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
                                type="button"
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
        </div>
    );
};

export default ReceiptList;
