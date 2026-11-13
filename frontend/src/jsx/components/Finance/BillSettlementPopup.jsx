import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Table } from 'react-bootstrap';
import Select from 'react-select';

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
        <Modal show={show} onHide={onHide} size="lg" centered>
            <div className={`item-custom-modal ${isDark ? 'dark-mode' : ''}`}>
            <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <i className="fa fa-file-invoice-dollar text-white fs-4"></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                Bill-Wise Settlement
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                {ledgerName} — {voucherType} {parseFloat(totalAmount || 0).toFixed(2)}
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={onHide}>
                        &times;
                    </button>
                </div>

            {/* Summary bar */}
            <div className="px-4 py-2 d-flex gap-5 border-bottom flex-wrap" style={{ backgroundColor: isDark ? '#1a222c' : '#f8f9fa' }}>
                {[
                    { label: `${voucherType.toUpperCase()} AMOUNT`, val: parseFloat(totalAmount || 0).toFixed(2), color: isDark ? '#fff' : '#1a1f3c' },
                    { label: 'ALLOCATED', val: totalAllocated.toFixed(2), color: '#27ae60' },
                    { label: 'UNALLOCATED / ON A/C', val: unallocated.toFixed(2), color: Math.abs(unallocated) > 0.01 ? '#dc3545' : '#27ae60' }
                ].map(item => (
                    <div key={item.label}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7a99', letterSpacing: 0.5, marginBottom: 2 }}>{item.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: item.color }}>{item.val}</div>
                    </div>
                ))}
            </div>

            <div className="modal-body-custom p-0">
                <div className="d-flex justify-content-end align-items-center px-3 pt-3 gap-2">
                    <Button variant="light" size="sm" className="d-flex align-items-center gap-1 fw-bold text-success border border-success border-opacity-25" style={{ borderRadius: '6px', backgroundColor: '#f0fdf4', color: '#16a34a', transition: 'all 0.2s', padding: '3px 12px', fontSize: '13px' }} onClick={addCustomRow}>
                        <i className="fa fa-plus"></i> Row
                    </Button>
                    <Button variant="light" size="sm" onClick={() => onApply([])} className="d-flex align-items-center gap-1 fw-bold text-danger border border-danger border-opacity-25" style={{ borderRadius: '6px', backgroundColor: '#fef2f2', color: '#dc2626', transition: 'all 0.2s', padding: '3px 12px', fontSize: '13px' }}>
                        <i className="fa fa-times"></i> Clear / On Account
                    </Button>
                </div>
                <div className="table-responsive px-3 pb-3 pt-2" style={{ maxHeight: '350px' }}>
                    <Table bordered className="align-middle journal-entry-table border-secondary border-opacity-10 mb-0">
                        <thead>
                            <tr className="table-light">
                                <th className="text-center font-w600" style={{ width: '6%', fontSize: '13px', color: '#4a5568' }}>Select</th>
                                <th className="text-center font-w600" style={{ width: '16%', fontSize: '13px', color: '#4a5568' }}>Type of Ref</th>
                                <th className="text-center font-w600" style={{ width: '18%', fontSize: '13px', color: '#4a5568' }}>Invoice No / Name</th>
                                <th className="text-center font-w600" style={{ width: '10%', fontSize: '13px', color: '#4a5568' }}>Date</th>
                                <th className="text-center font-w600" style={{ width: '11%', fontSize: '13px', color: '#4a5568' }}>Invoice Total ()</th>
                                <th className="text-center font-w600" style={{ width: '11%', fontSize: '13px', color: '#dc3545' }}>Allocated ()</th>
                                <th className="text-center font-w600" style={{ width: '11%', fontSize: '13px', color: '#27ae60' }}>Balance ()</th>
                                <th className="text-center font-w600" style={{ width: '12%', fontSize: '13px', color: '#4a5568' }}>Settle Amount ()</th>
                                <th className="text-center font-w600" style={{ width: '5%', fontSize: '13px', color: '#4a5568' }}>Full</th>
                            </tr>
                        </thead>
                        
                        <tbody>
                            {rows.map((row, idx) => {
                                return (
                                    <tr key={idx} style={{ background: row.isInvoice && row.selected ? (isDark ? '#1e2d4a' : '#f0f4ff') : 'transparent' }}>
                                        {/* Select / Delete Checkbox */}
                                        <td className="p-2">
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
                                                <Button variant="outline-danger" className="shadow" style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px', margin: '0 auto' }} onClick={() => removeCustomRow(idx)}><i className="fa fa-times"></i></Button>
                                            )}
                                        </td>

                                        {/* Type of Ref */}
                                        <td className="p-2">
                                            {row.isInvoice ? (
                                                <span className="badge bg-light text-secondary border px-2 py-1 fw-semibold">
                                                    Against Ref
                                                </span>
                                            ) : (
                                                <Form.Select
                                                    size="sm"
                                                    value={row.refType}
                                                    onChange={e => updateCustomRowField(idx, 'refType', e.target.value)}
                                                    className="form-control-custom py-1"
                                                    style={{ fontSize: 12 }}
                                                >
                                                    <option value="new_ref">New Reference</option>
                                                    <option value="advance">Advance</option>
                                                    <option value="on_account">On Account</option>
                                                </Form.Select>
                                            )}
                                        </td>

                                        {/* Name / Ref Identifier */}
                                        <td className="p-2">
                                            {row.isInvoice ? (
                                                <span className="fw-semibold text-primary">{row.refName}</span>
                                            ) : row.refType === 'on_account' ? (
                                                <Form.Control
                                                    size="sm"
                                                    type="text"
                                                    value="On Account"
                                                    disabled
                                                    className="form-control-custom py-1 bg-light text-muted fw-semibold"
                                                    style={{ fontSize: 12 }}
                                                />
                                            ) : (
                                                <Form.Control
                                                    size="sm"
                                                    type="text"
                                                    placeholder="Reference Name"
                                                    value={row.refName}
                                                    onChange={e => updateCustomRowField(idx, 'refName', e.target.value)}
                                                    className="form-control-custom py-1"
                                                    style={{ fontSize: 12 }}
                                                />
                                            )}
                                        </td>

                                        {/* Date */}
                                        <td className="p-2 text-muted small">
                                            {row.isInvoice ? row.invoiceDate : '—'}
                                        </td>

                                        {/* Invoice Total */}
                                        <td className="p-2 fw-semibold text-dark">
                                            {row.isInvoice ? parseFloat(row.invoiceTotal || row.outstandingAmount).toFixed(2) : '—'}
                                        </td>

                                        {/* Already Allocated */}
                                        <td className="p-2 fw-semibold" style={{ color: row.isInvoice && row.alreadyAllocated > 0.01 ? '#dc3545' : '#aaa' }}>
                                            {row.isInvoice ? parseFloat(row.alreadyAllocated || 0).toFixed(2) : '—'}
                                        </td>

                                        {/* Balance (outstanding) */}
                                        <td className="p-2 fw-semibold text-success">
                                            {row.isInvoice ? parseFloat(row.outstandingAmount).toFixed(2) : '—'}
                                        </td>

                                        {/* Settle Amount */}
                                        <td className="p-2">
                                            <Form.Control
                                                size="sm"
                                                type="number"
                                                step="0.01"
                                                placeholder="0.00"
                                                value={row.settleAmount || ''}
                                                onChange={e => updateAmount(idx, e.target.value)}
                                                className="form-control-custom text-end py-1 no-spinner"
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
            </div>

            <div className="modal-footer-custom">
                <div className="d-flex gap-2 ms-auto">
                    <Button onClick={onHide} className="btn-close-custom btn-universal-close">Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaveDisabled} className="btn-save-custom btn-universal-save"><i className="fa fa-check me-1"></i> Apply {billCount > 0 ? `(${billCount} Bill${billCount > 1 ? 's' : ''})` : ''}</Button>
                </div>
            </div>
        </div>
        </Modal>
    );
};
// ─────────────────────────────────────────────────────────────────────────────


export default BillSettlementPopup;
