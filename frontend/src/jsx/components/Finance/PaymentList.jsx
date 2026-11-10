import React, { useState, useEffect, useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Card, Button, Modal, Form, Row, Col, Table } from 'react-bootstrap';
import Swal from 'sweetalert2';
import Select from 'react-select';
import { ThemeContext } from '../../../context/ThemeContext';
import { getLedgers, getPayments, createPayment, updatePayment, deletePayment } from '../../../services/FinanceService';
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

const PaymentList = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [payments, setPayments] = useState([]);
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
    const [billSettlementModal, setBillSettlementModal] = useState({ show: false, drIdx: null });
    const [ledgerInvoices, setLedgerInvoices] = useState({});

    const fetchInvoicesForLedger = async (ledgerIdInput, forceRefresh = false) => {
        if (!ledgerIdInput) return;
        const ledgerId = String(ledgerIdInput?.id || ledgerIdInput);
        if (!forceRefresh && ledgerInvoices[ledgerId]) return;
        
        try {
            const res = await PurchaseService.getPurchaseInvoicesBySupplier(ledgerId);
            const invoicesList = Array.isArray(res.data) ? res.data : [];
            setLedgerInvoices(prev => ({
                ...prev,
                [ledgerId]: invoicesList
            }));
        } catch (error) {
            console.error('Failed to fetch purchase invoices for ledger:', error);
        }
    };

    const openBillSettlement = (drIdx) => {
        const drRowsLocal = currentPayment.details.filter(d => d.entry_type === 'Dr');
        const row = drRowsLocal[drIdx];
        if (!row || !row.ledger) {
            Swal.fire('Select Ledger First', 'Please select a Supplier / Party ledger before opening bill-wise settlement.', 'warning');
            return;
        }
        const ledgerId = String(row.ledger?.id || row.ledger);
        fetchInvoicesForLedger(ledgerId, true);
        setBillSettlementModal({ show: true, drIdx });
    };

    const applyBillSettlement = (drIdx, allocations) => {
        setBillAllocations(prev => ({ ...prev, [drIdx]: allocations }));
        if (allocations.length > 0) {
            const totalSettled = allocations.reduce((s, a) => s + (parseFloat(a.settleAmount) || 0), 0);
            handleDrRowChange(drIdx, 'debit_amount', totalSettled);
        }
        setBillSettlementModal({ show: false, drIdx: null });

        setTimeout(() => {
            const drRowsCount = currentPayment.details.filter(d => d.entry_type === 'Dr').length;
            if (drIdx < drRowsCount - 1) {
                focusCell(drIdx + 1, 'ledger');
            } else {
                addDrRow();
                setTimeout(() => {
                    focusCell(drIdx + 1, 'ledger');
                }, 80);
            }
        }, 100);
    };

    const defaultDetail = {
        entry_type: 'Dr',
        ledger: '',
        debit_amount: 0.00,
        credit_amount: 0.00,
        narration: ''
    };

    const defaultPayment = {
        id: null,
        voucher_no: '',
        voucher_date: new Date().toISOString().split('T')[0],
        narration: '',
        details: [
            { ...defaultDetail, entry_type: 'Cr' },
            { ...defaultDetail, entry_type: 'Dr' }
        ]
    };

    const [currentPayment, setCurrentPayment] = useState(defaultPayment);
    const [cellToFocus, setCellToFocus] = useState(null);

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
                const [paymentsData, ledgersData] = await Promise.all([getPayments(), getLedgers()]);
                setPayments(paymentsData || []);
                setLedgers(ledgersData || []);
                loadCompanyDetails();
                fetchPrefixConfigs();

                const searchParams = new URLSearchParams(location.search);
                const editId = searchParams.get('edit');
                if (editId && paymentsData && paymentsData.length > 0) {
                    const cleanTarget = String(editId).toLowerCase().replace(/[^a-z0-9]/g, '');
                    const itemToEdit = paymentsData.find(p => {
                        const pId = String(p.id);
                        const pVNo = String(p.voucher_no || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                        return pId === String(editId) || pVNo === cleanTarget || (cleanTarget && pVNo.endsWith(cleanTarget));
                    });
                    if (itemToEdit) {
                        await handleShowModal(itemToEdit, ledgersData);
                    }
                }
            } catch (err) {
                console.error('Error initializing payments data:', err);
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
    }, [currentPayment.details, cellToFocus]);

    const fetchConfiguration = async () => {
        try {
            const res = await InventoryService.getProductConfigurations();
            const configs = Array.isArray(res.data) ? res.data : [];
            const myConfig = configs.find(c => 
                (c.voucher_type_name && c.voucher_type_name.toLowerCase() === 'payment') ||
                (c.voucher_type_code && c.voucher_type_code.toLowerCase() === 'pv')
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
            const data = await getPayments();
            setPayments(data);
        } catch (error) {
            Swal.fire('Error', 'Failed to fetch payment vouchers', 'error');
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
        const paymentConfig = configs.find(c => {
            const vName = (c.voucher_type_name || '').toLowerCase().trim();
            return vName === 'payment' || c.prefix === 'PV';
        });
        return generateNextVoucherNumber(paymentConfig, customList || payments, 'PV', branchList);
    };

    const printVoucher = (voucher, type = 'Payment') => {
        printFriendlyVoucher({
            voucher,
            type,
            ledgers,
            companyInfo,
            companyAddress,
            companyContact
        });
    };

    const handleShowModal = async (payment = null, customLedgers = null) => {
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

            if (payment) {
                const initialExpanded = {};
                const loadedAllocations = {};
                const rawDetails = payment.details || [];
                const collapsedDetails = [];
                let drVIdx = 0;

                rawDetails.forEach((d) => {
                    const ledgerId = String(d.ledger?.id || d.ledger);
                    collapsedDetails.push({
                        ...d,
                        ledger: d.ledger?.id || d.ledger,
                        debit_amount: parseFloat(d.debit_amount) || 0,
                        credit_amount: parseFloat(d.credit_amount) || 0
                    });

                    if (d.entry_type === 'Dr') {
                        const allocations = d.bill_allocations || [];
                        const mappedAllocs = allocations.map(a => ({
                            refType: a.allocation_type === 'Agst Ref' ? 'against_ref' : a.allocation_type === 'New Ref' ? 'new_ref' : a.allocation_type === 'Advance' ? 'advance' : 'on_account',
                            invoiceId: a.against_purchase_invoice || '',
                            refName: a.name || '',
                            settleAmount: parseFloat(a.amount) || 0
                        }));
                        if (mappedAllocs.length > 0) {
                            loadedAllocations[drVIdx] = mappedAllocs;
                            fetchInvoicesForLedger(ledgerId);
                        }
                        drVIdx++;
                    }
                });

                if (collapsedDetails.length > 0) {
                    collapsedDetails.forEach((d, idx) => { if (d.narration) initialExpanded[idx] = true; });
                }
                setBillAllocations(loadedAllocations);
                setExpandedNarrations(initialExpanded);
                setCurrentPayment({
                    ...payment,
                    narration: payment.narration || '',
                    details: collapsedDetails.length > 0 ? collapsedDetails : [
                        { ...defaultDetail, entry_type: 'Cr', ledger: '' },
                        { ...defaultDetail, entry_type: 'Dr', ledger: '', debit_amount: 0 }
                    ]
                });
                setEditMode(true);
            } else {
                setExpandedNarrations({});
                const defaultCashLedger = cashBankOptions.find(l => l.name.toLowerCase() === 'cash') || cashBankOptions[0];
                const initialNo = generateVoucherNo();
                setCurrentPayment({
                    ...defaultPayment,
                    voucher_no: initialNo,
                    details: [
                        { ...defaultDetail, entry_type: 'Cr', ledger: defaultCashLedger ? defaultCashLedger.id : '' },
                        { ...defaultDetail, entry_type: 'Dr', ledger: '', debit_amount: 0 }
                    ]
                });
                setEditMode(false);
                fetchPrefixConfigs().then(({ configs, branches: bData }) => {
                    const latestNo = generateVoucherNo(null, configs, bData);
                    setCurrentPayment(prev => ({
                        ...prev,
                        voucher_no: latestNo
                    }));
                });
            }
            setShowModal(true);
        } catch (error) {
            console.error('Failed to prepare payment modal', error);
            Swal.fire('Error', 'Failed to fetch ledgers. Please try again.', 'error');
        }
    };



    const handleDelete = async (id, no) => {
        const result = await Swal.fire({
            title: 'Delete Payment Voucher?',
            text: `Are you sure you want to delete payment voucher "${no}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deletePayment(id);
                Swal.fire('Deleted', 'Voucher deleted successfully', 'success');
                fetchData();
            } catch (error) {
                Swal.fire('Error', 'Failed to delete payment voucher', 'error');
            }
        }
    };

    const handleInputChange = (field, value) => {
        setCurrentPayment({ ...currentPayment, [field]: value });
    };

    const handleCrLedgerChange = (ledgerId) => {
        const details = [...currentPayment.details];
        let crIdx = details.findIndex(d => d.entry_type === 'Cr');
        if (crIdx === -1) {
            details.push({ ...defaultDetail, entry_type: 'Cr', ledger: ledgerId });
            crIdx = details.length - 1;
        } else {
            details[crIdx] = { ...details[crIdx], ledger: ledgerId };
        }
        
        // Recalculate credit amount to match sum of debits
        const totalDebit = details.filter(d => d.entry_type === 'Dr').reduce((sum, d) => sum + (parseFloat(d.debit_amount) || 0), 0);
        details[crIdx].credit_amount = totalDebit;
        details[crIdx].debit_amount = 0;
        
        setCurrentPayment({ ...currentPayment, details });
    };

    const handleDrRowChange = (drIdx, field, value) => {
        const details = [...currentPayment.details];
        
        let drCount = 0;
        let targetIdx = -1;
        for (let i = 0; i < details.length; i++) {
            if (details[i].entry_type === 'Dr') {
                if (drCount === drIdx) {
                    targetIdx = i;
                    break;
                }
                drCount++;
            }
        }
        
        if (targetIdx > -1) {
            const oldLedger = details[targetIdx].ledger;
            details[targetIdx] = { ...details[targetIdx], [field]: value };
            if (field === 'debit_amount') {
                details[targetIdx].credit_amount = 0;
            }
            if (field === 'ledger' && String(oldLedger) !== String(value)) {
                // reset bill allocations for this row
                setBillAllocations(prev => {
                    const next = { ...prev };
                    delete next[drIdx];
                    return next;
                });
                if (value) {
                    fetchInvoicesForLedger(value);
                }
            }
        }
        
        // Update credit amount of Cr row to match sum of debits
        const totalDebit = details.filter(d => d.entry_type === 'Dr').reduce((sum, d) => sum + (parseFloat(d.debit_amount) || 0), 0);
        const crIdx = details.findIndex(d => d.entry_type === 'Cr');
        if (crIdx > -1) {
            details[crIdx].credit_amount = totalDebit;
            details[crIdx].debit_amount = 0;
        }
        
        setCurrentPayment({ ...currentPayment, details });
    };

    const addDrRow = () => {
        const details = [...currentPayment.details];
        details.push({
            ...defaultDetail,
            entry_type: 'Dr',
            debit_amount: 0,
            credit_amount: 0,
            narration: ''
        });
        setCurrentPayment({ ...currentPayment, details });
    };

    const removeDrRow = (drIdx) => {
        const drRowsCount = currentPayment.details.filter(d => d.entry_type === 'Dr').length;
        if (drRowsCount <= 1) {
            Swal.fire('Validation Warning', 'At least one debit entry is required.', 'warning');
            return;
        }
        
        const details = [...currentPayment.details];
        let drCount = 0;
        let targetIdx = -1;
        for (let i = 0; i < details.length; i++) {
            if (details[i].entry_type === 'Dr') {
                if (drCount === drIdx) {
                    targetIdx = i;
                    break;
                }
                drCount++;
            }
        }
        
        if (targetIdx > -1) {
            details.splice(targetIdx, 1);
        }
        
        // Shift allocations
        setBillAllocations(prev => {
            const next = {};
            Object.keys(prev).forEach(keyStr => {
                const key = parseInt(keyStr);
                if (key < drIdx) {
                    next[key] = prev[key];
                } else if (key > drIdx) {
                    next[key - 1] = prev[key];
                }
            });
            return next;
        });

        // Recalculate credit amount of Cr row
        const totalDebit = details.filter(d => d.entry_type === 'Dr').reduce((sum, d) => sum + (parseFloat(d.debit_amount) || 0), 0);
        const crIdx = details.findIndex(d => d.entry_type === 'Cr');
        if (crIdx > -1) {
            details[crIdx].credit_amount = totalDebit;
            details[crIdx].debit_amount = 0;
        }
        
        setCurrentPayment({ ...currentPayment, details });
    };

    const toggleNarration = (idx) => {
        setExpandedNarrations(prev => ({
            ...prev,
            [idx]: !prev[idx]
        }));
    };

    // Live calculations
    const crRow = currentPayment.details.find(d => d.entry_type === 'Cr') || { ...defaultDetail, entry_type: 'Cr' };
    const drRows = currentPayment.details.filter(d => d.entry_type === 'Dr');
    const totalCredit = crRow.credit_amount || 0;
    const totalDebit = drRows.reduce((sum, d) => sum + (parseFloat(d.debit_amount) || 0), 0);
    const isBalanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.01;

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!currentPayment.voucher_no) {
            Swal.fire('Validation Error', 'Voucher Number is required', 'warning');
            return;
        }

        // Clean details by removing any empty debit rows at the end of the table
        const cleanedDetails = currentPayment.details.filter(d => d.entry_type === 'Cr' || (d.ledger && d.ledger !== ''));

        // Recalculate total debit of cleaned rows
        const cleanedTotalDebit = cleanedDetails.filter(d => d.entry_type === 'Dr').reduce((sum, d) => sum + (parseFloat(d.debit_amount) || 0), 0);
        
        // Update Cr row's credit amount
        const crRowIdx = cleanedDetails.findIndex(d => d.entry_type === 'Cr');
        if (crRowIdx > -1) {
            cleanedDetails[crRowIdx].credit_amount = cleanedTotalDebit;
            cleanedDetails[crRowIdx].debit_amount = 0;
        }

        const cleanedTotalCredit = crRowIdx > -1 ? (cleanedDetails[crRowIdx].credit_amount || 0) : 0;
        const cleanedIsBalanced = cleanedTotalDebit > 0 && Math.abs(cleanedTotalDebit - cleanedTotalCredit) < 0.01;

        if (!cleanedIsBalanced) {
            Swal.fire('Validation Error', 'Total Debit must be greater than zero. Please select at least one Debit Ledger Account.', 'warning');
            return;
        }

        const crRowCheck = cleanedDetails.find(d => d.entry_type === 'Cr');
        if (!crRowCheck || !crRowCheck.ledger) {
            Swal.fire('Validation Error', 'Please select a Cash / Bank Account (Credit Account)', 'warning');
            return;
        }
        if ((parseFloat(crRowCheck.credit_amount) || 0) <= 0) {
            Swal.fire('Validation Error', 'Total Payment Amount must be greater than zero', 'warning');
            return;
        }

        const drRowsCheck = cleanedDetails.filter(d => d.entry_type === 'Dr');
        for (let i = 0; i < drRowsCheck.length; i++) {
            const row = drRowsCheck[i];
            if (!row.ledger) {
                Swal.fire('Validation Error', `Please select a Ledger Account for debit row #${i + 1}`, 'warning');
                return;
            }
            if ((parseFloat(row.debit_amount) || 0) <= 0) {
                Swal.fire('Validation Error', `Amount must be greater than zero for debit row #${i + 1}`, 'warning');
                return;
            }
        }

        // Reconstruct bill allocations for nested field
        const expandedDetails = [];
        cleanedDetails.forEach(detail => {
            if (detail.entry_type === 'Cr') {
                expandedDetails.push({
                    ledger: detail.ledger?.id || detail.ledger,
                    entry_type: 'Cr',
                    debit_amount: 0,
                    credit_amount: parseFloat(detail.credit_amount) || 0,
                    narration: detail.narration || ''
                });
                return;
            }
            if (!detail.ledger || detail.ledger === '') return; // skip empty rows
            
            // Find the index of this detail among all 'Dr' rows in cleanedDetails
            let drIdx = -1;
            let drCount = 0;
            for (let i = 0; i < cleanedDetails.length; i++) {
                if (cleanedDetails[i].entry_type === 'Dr') {
                    if (cleanedDetails[i] === detail) {
                        drIdx = drCount;
                        break;
                    }
                    drCount++;
                }
            }
            
            const allocs = drIdx > -1 ? (billAllocations[drIdx] || []) : [];
            const serializedAllocs = allocs.map(alloc => ({
                allocation_type: alloc.refType === 'against_ref' ? 'Agst Ref' : alloc.refType === 'new_ref' ? 'New Ref' : alloc.refType === 'advance' ? 'Advance' : 'On Account',
                against_purchase_invoice: alloc.invoiceId || null,
                name: alloc.refName || (alloc.refType === 'on_account' ? 'On Account' : ''),
                amount: parseFloat(alloc.settleAmount) || 0
            }));
            
            expandedDetails.push({
                ledger: detail.ledger?.id || detail.ledger,
                entry_type: 'Dr',
                debit_amount: parseFloat(detail.debit_amount) || 0,
                credit_amount: 0,
                narration: detail.narration || '',
                bill_allocations: serializedAllocs
            });
        });

        // Recalculate total debit of expanded rows
        const expandedTotalDebit = expandedDetails.filter(d => d.entry_type === 'Dr').reduce((sum, d) => sum + (parseFloat(d.debit_amount) || 0), 0);
        
        // Update Cr row's credit amount
        const expandedCrRowIdx = expandedDetails.findIndex(d => d.entry_type === 'Cr');
        if (expandedCrRowIdx > -1) {
            expandedDetails[expandedCrRowIdx].credit_amount = expandedTotalDebit;
            expandedDetails[expandedCrRowIdx].debit_amount = 0;
        }

        try {
            const savedVoucher = { ...currentPayment, details: expandedDetails };
            if (editMode) {
                await updatePayment(currentPayment.id, savedVoucher);
            } else {
                await createPayment(savedVoucher);
            }
            setShowModal(false);
            setLedgerInvoices({}); // Clear invoice cache so next payment sees fresh outstanding balances
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
                    printVoucher(savedVoucher, 'Payment');
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
        const cols = ['ledger', 'debit_amount', 'narration'];
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

        const drRowsLocal = currentPayment.details.filter(d => d.entry_type === 'Dr');
        const row = drRowsLocal[rowIndex];

        const drRowsCount = drRowsLocal.length;

        if (e.key === 'Enter') {
            if (colName === 'ledger') {
                if (!row || !row.ledger) {
                    e.preventDefault();
                    if (rowIndex >= 1) {
                        removeDrRow(rowIndex);
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
                    removeDrRow(rowIndex);
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
            const cols = ['ledger', 'debit_amount', 'narration'];
            const currentColIdx = cols.indexOf(colName);

            if (colName === 'debit_amount') {
                e.preventDefault();
                if (!row || !row.ledger) {
                    focusCell(rowIndex, 'ledger');
                    return;
                }
                if (rowIndex < drRowsCount - 1) {
                    focusCell(rowIndex + 1, 'ledger');
                } else {
                    addDrRow();
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
                if (rowIndex < drRowsCount - 1) {
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
            } else if (rowIndex < drRowsCount - 1) {
                e.preventDefault();
                focusCell(rowIndex + 1, colName);
            }
        }
    };

    const customSelectStyles = {
        control: (provided, state) => ({
            ...provided,
            backgroundColor: isDark ? '#24292D' : '#ffffff',
            borderColor: state.isFocused ? '#0a500f' : (isDark ? '#475569' : '#cbd5e1'),
            color: isDark ? '#ffffff' : '#2f3f50',
            minHeight: '36px',
            borderRadius: '8px',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 80, 15,0.15)' : 'none',
            '&:hover': { borderColor: '#0a500f' },
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
            '&:hover': { color: '#0a500f' }
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
            color: state.isSelected ? '#0a500f' : (isDark ? '#ffffff' : '#334155'),
            cursor: 'pointer',
            fontWeight: state.isSelected ? '600' : 'normal',
            padding: '8px 12px',
            ':active': {
                backgroundColor: isDark ? '#475569' : '#e2e8f0'
            }
        })
    };

    const filteredPayments = payments.filter(p => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = (
            (p.voucher_no || '').toLowerCase().includes(term) ||
            (p.narration || '').toLowerCase().includes(term) ||
            (p.voucher_date || '').toLowerCase().includes(term)
        );

        let matchesDate = true;
        if (fromDate) {
            const vDate = p.voucher_date ? p.voucher_date.split('T')[0] : '';
            if (!vDate || vDate < fromDate) matchesDate = false;
        }
        if (toDate) {
            const vDate = p.voucher_date ? p.voucher_date.split('T')[0] : '';
            if (!vDate || vDate > toDate) matchesDate = false;
        }

        return matchesSearch && matchesDate;
    });

    const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentPayments = filteredPayments.slice(startIndex, startIndex + itemsPerPage);

    const creditAccountOptions = ledgers.filter(l => {
        const group = (l.account_group_name || '').toLowerCase();
        return group.includes('cash') || group.includes('bank');
    });

    return (
        <div className="container-fluid">
            <div className="row">
            <div className="col-lg-12">
                <Card>
                    <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <Card.Title className="mb-0">Payment Vouchers</Card.Title>
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
                                    placeholder="Search Payment..."
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
                                    module="payment" 
                                    onClick={() => handleShowModal()} 
                                    style={{ height: '34px', display: 'flex', alignItems: 'center', fontSize: '13px' }}
                                >
                                    Payment
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
                                        {currentPayments.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="text-center py-4 text-muted">No vouchers found</td>
                                            </tr>
                                        ) : (
                                            currentPayments.map((p, idx) => {
                                                const dTotal = p.details?.reduce((s, row) => s + (parseFloat(row.debit_amount) || 0), 0) || 0;
                                                const cTotal = p.details?.reduce((s, row) => s + (parseFloat(row.credit_amount) || 0), 0) || 0;
                                                return (
                                                    <tr key={p.id}>
                                                        <td>{startIndex + idx + 1}</td>
                                                        <td>{p.voucher_no}</td>
                                                        <td>{p.voucher_date}</td>
                                                        <td className="text-truncate" style={{ maxWidth: '300px' }}>{p.narration || '-'}</td>
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
                                                                    onClick={() => printVoucher(p, 'Payment')} 
                                                                    title="Print Voucher"
                                                                >
                                                                    <i className="fa fa-print"></i>
                                                                </Button>
                                                                <EditButton module="payment" onClick={() => handleShowModal(p)} className="me-1" />
                                                                <DeleteButton module="payment" onClick={() => handleDelete(p.id, p.voucher_no)} />
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
                                            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredPayments.length)} of {filteredPayments.length} entries
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
                                <i className="fa fa-credit-card text-white fs-4"></i>
                            </div>
                            <div>
                                <h4 className="mb-1">{editMode ? 'Edit Payment Voucher' : 'New Payment Voucher'}</h4>
                                <p className="mb-0 text-muted" style={{ fontSize: '13px', fontWeight: 'normal' }}>
                                    Record cash or bank payment transactions easily. Select credit account and enter particulars.
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
                                        value={currentPayment.voucher_no}
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
                                        value={currentPayment.voucher_date}
                                        onChange={e => handleInputChange('voucher_date', e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const el = document.getElementById('credit-account-select');
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
                                    <Form.Label className="fw-bold text-dark mb-1">Credit Account (Cash / Bank)</Form.Label>
                                    <Select
                                        options={[
                                            { value: '', label: '-- Select Cash / Bank --' },
                                            ...creditAccountOptions.map(l => ({ value: l.id, label: l.name }))
                                        ]}
                                        value={getLedgerOption(crRow.ledger)}
                                        onChange={sel => {
                                            handleCrLedgerChange(sel ? sel.value : '');
                                            if (sel && sel.value) {
                                                setTimeout(() => {
                                                    focusCell(0, 'ledger');
                                                }, 100);
                                            }
                                        }}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                const crRowLocal = currentPayment.details.find(d => d.entry_type === 'Cr');
                                                if (crRowLocal && crRowLocal.ledger) {
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
                                        inputId="credit-account-select"
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <div className="table-responsive">
                            <Table bordered className="align-middle journal-entry-table border-secondary border-opacity-10">
                                <thead>
                                    <tr className="table-light">
                                        <th style={{ width: maintainNarration ? '60%' : '75%' }}>Particulars (Debit)</th>
                                        <th style={{ width: '15%', textAlign: 'right' }} className="text-end">Amount</th>
                                        {maintainNarration && <th style={{ width: '10%', textAlign: 'center' }}>Narration</th>}
                                        <th style={{ width: '10%', textAlign: 'center' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {drRows.map((row, idx) => (
                                        <React.Fragment key={idx}>
                                            <tr>
                                                <td>
                                                    <Select
                                                        options={[
                                                            { value: '', label: '-- Select Ledger --' },
                                                            ...ledgers.map(l => ({ value: l.id, label: l.name }))
                                                        ]}
                                                        value={getLedgerOption(row.ledger)}
                                                        onChange={sel => {
                                                            handleDrRowChange(idx, 'ledger', sel ? sel.value : '');
                                                            if (sel && sel.value) {
                                                                setTimeout(() => {
                                                                    const el = document.getElementById(`cell-${idx}-debit_amount`);
                                                                    if (el) {
                                                                        el.focus();
                                                                        if (el.select) el.select();
                                                                    }
                                                                }, 100);
                                                            } else {
                                                                if (idx >= 1) {
                                                                    removeDrRow(idx);
                                                                }
                                                                setTimeout(() => {
                                                                    const masterNarrationEl = document.getElementById('master-narration');
                                                                    if (masterNarrationEl) {
                                                                        masterNarrationEl.focus();
                                                                    }
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
                                                <td style={{ textAlign: 'right', padding: '4px 8px', verticalAlign: 'middle' }}>
                                                    <Form.Control
                                                        size="sm"
                                                        id={`cell-${idx}-debit_amount`}
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={row.debit_amount || ''}
                                                        onChange={e => handleDrRowChange(idx, 'debit_amount', parseFloat(e.target.value) || 0)}
                                                        onKeyDown={e => {
                                                            const rowAllocs = billAllocations[idx] || [];
                                                            const totalSettled = rowAllocs.reduce((s, a) => s + (parseFloat(a.settleAmount) || 0), 0);
                                                            const isAlreadySettled = rowAllocs.length > 0 && Math.abs(totalSettled - (parseFloat(row.debit_amount) || 0)) < 0.01;
                                                            
                                                            if (e.key === 'Enter' && row.ledger && (parseFloat(row.debit_amount) || 0) > 0 && !isAlreadySettled) {
                                                                e.preventDefault();
                                                                openBillSettlement(idx);
                                                            } else {
                                                                handleCellKeyDown(e, idx, 'debit_amount');
                                                            }
                                                        }}
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
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
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
                                                <td className="text-center" style={{ whiteSpace: 'nowrap' }}>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                        {/* + button slot — always 30px wide */}
                                                        <div style={{ width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {idx === drRows.length - 1 && (
                                                                <Button
                                                                    variant="primary"
                                                                    className="rounded d-inline-flex align-items-center justify-content-center"
                                                                    style={{ width: '30px', height: '30px' }}
                                                                    onClick={() => {
                                                                        addDrRow();
                                                                        setCellToFocus({ rowIndex: drRows.length, colName: 'ledger' });
                                                                    }}
                                                                    title="Add New Row"
                                                                >
                                                                    <i className="fa fa-plus"></i>
                                                                </Button>
                                                            )}
                                                        </div>
                                                        {/* delete button slot — always 30px wide, always same position */}
                                                        <div style={{ width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {drRows.length > 1 && (
                                                                <Button
                                                                    variant="light"
                                                                    className="text-danger border-0 rounded-circle btn-icon p-2"
                                                                    onClick={() => removeDrRow(idx)}
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
                                                    <td colSpan={maintainNarration ? 4 : 3} className="p-2 bg-light border-0">
                                                        <Form.Control
                                                            size="sm"
                                                            as="textarea"
                                                            id={`cell-${idx}-narration-text`}
                                                            rows={1}
                                                            placeholder="Enter narration for this line..."
                                                            value={row.narration || ''}
                                                            onChange={e => handleDrRowChange(idx, 'narration', e.target.value)}
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
                                        <td className="text-end text-muted">Total Debit:</td>
                                        <td className="text-end font-monospace text-primary" style={{ padding: '4px 17px' }}>{totalDebit.toFixed(2)}</td>
                                        {maintainNarration && <td></td>}
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
                                    value={currentPayment.narration}
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
                                    Credit cash/bank account must be selected and balance must equal debit entries.
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
                const activeDrIdx = billSettlementModal.drIdx;
                const drRowsLocal = currentPayment.details.filter(d => d.entry_type === 'Dr');
                const activeRow = activeDrIdx !== null ? drRowsLocal[activeDrIdx] : null;
                const activeLedgerId = activeRow ? String(activeRow.ledger?.id || activeRow.ledger) : '';
                const activeLedgerName = activeRow ? (ledgers.find(l => String(l.id) === activeLedgerId)?.name || 'Supplier') : '';
                const activeInvoices = activeLedgerId ? (ledgerInvoices[activeLedgerId] || []) : [];
                return (
                    <BillSettlementPopup
                        show={billSettlementModal.show}
                        onHide={() => setBillSettlementModal({ show: false, drIdx: null })}
                        invoices={activeInvoices}
                        ledgerName={activeLedgerName}
                        totalAmount={activeRow ? (parseFloat(activeRow.debit_amount) || 0) : 0}
                        existingAllocations={activeDrIdx !== null ? (billAllocations[activeDrIdx] || []) : []}
                        onApply={(allocs) => applyBillSettlement(activeDrIdx, allocs)}
                        isDark={isDark}
                        isEditMode={editMode}
                    />
                );
            })()}
        </div>
    );
};

export default PaymentList;
