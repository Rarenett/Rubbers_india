import './FinanceForms.css';
import React, { useState, useEffect } from 'react';
import { Modal, Form, Row, Col, Table, Button } from 'react-bootstrap';
import Select from 'react-select';
import BillSettlementPopup from './BillSettlementPopup';

// ─── Bill Settlement Popup Component ───────────────────────────────────────
const PaymentForm = (props) => {
    const {
        showModal,
        setShowModal,
        editMode,
        currentPayment,
        handleInputChange,
        handleCrLedgerChange,
        handleDrRowChange,
        addDrRow,
        removeDrRow,
        handleSubmit,
        getLedgerOption,
        handleCellKeyDown,
        creditAccountOptions,
        ledgers,
        maintainNarration,
        expandedNarrations,
        toggleNarration,
        billAllocations,
        openBillSettlement,
        isBalanced,
        totalDebit,
        totalCredit,
        setCellToFocus,
        drRows,
        crRow,
        isDark,
        billSettlementModal,
        setBillSettlementModal,
        ledgerInvoices,
        applyBillSettlement,
        focusCell,
        animateTrigger
    } = props;

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '38px',
            borderColor: state.isFocused ? '#2ece8a' : '#cbd5e1',
            boxShadow: state.isFocused ? '0 0 0 2px rgba(46,206,138,0.15)' : 'none',
            '&:hover': { borderColor: '#2ece8a' },
            borderRadius: '10px',
            fontSize: '13px',
        }),
        menu: base => ({ ...base, zIndex: 9999, fontSize: '0.875rem' }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#2ece8a' : state.isFocused ? '#f0fdf6' : 'white',
            color: state.isSelected ? 'white' : '#333',
            cursor: 'pointer',
        }),
    };

    return (
        <>
            
            
            <Modal 
                show={showModal} 
                onHide={() => setShowModal(false)} 
                dialogClassName={`item-custom-modal ${animateTrigger ? 'modal-feedback' : ''}`}
                backdrop="static"
                keyboard={false}
                size="xl"
                centered
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <i className="fa fa-money-bill-wave text-white fs-4"></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editMode ? 'Edit Payment Voucher' : 'New Payment Voucher'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Record cash or bank payment transactions easily. Select debit account and enter particulars.
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowModal(false)}>
                        &times;
                    </button>
                </div>

                <Form onSubmit={handleSubmit}>
                    <div className="modal-body-custom">
                        <div className="row mb-3">
                            <div className="col-md-3 mb-3">
                                <Form.Label className="form-label-custom">Voucher no:</Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom bg-light fw-bold"
                                    value={currentPayment.voucher_no}
                                    readOnly
                                    disabled
                                />
                            </div>
                            <div className="col-md-3 mb-3">
                                <Form.Label className="form-label-custom">Date:</Form.Label>
                                <Form.Control
                                    id="voucher-date-input"
                                    type="date"
                                    className="form-control-custom"
                                    value={currentPayment.voucher_date}
                                    onChange={e => handleInputChange('voucher_date', e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const el = document.getElementById('debit-account-select');
                                            if (el) el.focus();
                                        }
                                    }}
                                    required
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Credit Account (Cash / Bank) <span className="text-danger">*</span></Form.Label>
                                <Select
                                    styles={selectStyles}
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
                                            const crRowLocal = currentPayment.details.find(d => d.entry_type === 'Dr');
                                            if (crRowLocal && crRowLocal.ledger) {
                                                e.preventDefault();
                                                focusCell(0, 'ledger');
                                            }
                                        }
                                    }}
                                    isSearchable
                                    isClearable={true}
                                    placeholder="-- Select Cash / Bank --"
                                    inputId="debit-account-select"
                                />
                            </div>
                        </div>

                        <div className="mb-4">
                            <Table bordered className="align-middle journal-entry-table border-secondary border-opacity-10 mb-0">
                                <thead>
                                    <tr className="table-light">
                                        <th style={{ width: maintainNarration ? '62%' : '72%', fontSize: '13px', color: '#4a5568', fontWeight: 600 }}>Particulars (Debit)</th>
                                        <th style={{ width: '18%', fontSize: '13px', color: '#4a5568', fontWeight: 600 }}>Amount</th>
                                        {maintainNarration && <th style={{ width: '10%', textAlign: 'center', fontSize: '13px', color: '#4a5568', fontWeight: 600 }}>Note</th>}
                                        <th style={{ width: '10%', textAlign: 'center', fontSize: '13px', color: '#4a5568', fontWeight: 600 }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {drRows.map((row, idx) => {
                                        const rowAllocs = billAllocations[idx] || [];
                                        const hasBills = rowAllocs.length > 0;
                                        return (
                                        <React.Fragment key={idx}>
                                            <tr>
                                                {/* Particulars */}
                                                <td className="p-2">
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
                                                                    if (el) { el.focus(); if (el.select) el.select(); }
                                                                }, 100);
                                                            } else {
                                                                if (idx >= 1) removeDrRow(idx);
                                                                setTimeout(() => {
                                                                    const saveBtn = document.querySelector('.btn-universal-save');
                                                                    if (saveBtn) saveBtn.focus();
                                                                }, 50);
                                                            }
                                                        }}
                                                        styles={selectStyles}
                                                        isSearchable
                                                        isClearable={true}
                                                        menuPosition="fixed"
                                                        placeholder="-- Select Ledger --"
                                                        inputId={`cell-${idx}-ledger`}
                                                        onKeyDown={e => handleCellKeyDown(e, idx, 'ledger')}
                                                    />
                                                </td>

                                                {/* Amount */}
                                                <td className="p-2">
                                                    <Form.Control
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
                                                        className="form-control-custom text-end py-1 no-spinner"
                                                        style={{ height: '38px' }}
                                                    />
                                                    {hasBills && (
                                                        <div style={{ fontSize: 11, color: '#2ece8a', marginTop: 4, fontWeight: 'bold', textAlign: 'right', cursor: 'pointer' }} onClick={() => openBillSettlement(idx)}>
                                                            <i className="fa fa-check-circle me-1"></i>
                                                            {rowAllocs.length} Ref{rowAllocs.length > 1 ? 's' : ''} allocated
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Narration button */}
                                                {maintainNarration && (
                                                    <td className="text-center p-2">
                                                        <Button
                                                            id={`cell-${idx}-narration`}
                                                            type="button"
                                                            onClick={() => toggleNarration(idx)}
                                                            onKeyDown={e => handleCellKeyDown(e, idx, 'narration')}
                                                            style={{
                                                                width: '34px', height: '34px',
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
                                                <td className="text-center p-2">
                                                    <div className="d-flex align-items-center justify-content-center gap-2">
                                                        {idx === drRows.length - 1 && (
                                                            <Button
                                                                variant="outline-primary"
                                                                className="shadow"
                                                                style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                                onClick={() => {
                                                                    addDrRow();
                                                                    setCellToFocus({ rowIndex: drRows.length, colName: 'ledger' });
                                                                }}
                                                                title="Add New Row"
                                                            >
                                                                <i className="fa fa-plus"></i>
                                                            </Button>
                                                        )}
                                                        {drRows.length > 1 && (
                                                            <Button
                                                                variant="outline-danger"
                                                                className="shadow"
                                                                onClick={() => removeDrRow(idx)}
                                                                style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                            >
                                                                <i className="fa fa-trash"></i>
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Narration expand row */}
                                            {maintainNarration && expandedNarrations[idx] && (
                                                <tr className="bg-light border-0">
                                                    <td colSpan={maintainNarration ? 4 : 3} className="p-3 bg-light border-0">
                                                        <Form.Control
                                                            as="textarea"
                                                            id={`cell-${idx}-narration-text`}
                                                            rows={1}
                                                            placeholder="Enter narration for this line..."
                                                            value={row.narration || ''}
                                                            onChange={e => handleDrRowChange(idx, 'narration', e.target.value)}
                                                            onKeyDown={e => handleCellKeyDown(e, idx, 'narration-text')}
                                                            className="form-control-custom"
                                                        />
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                        );
                                    })}

                                    {/* Summary Row */}
                                    <tr className="table-light fw-semibold">
                                        <td className="text-end text-muted py-2" style={{ fontSize: '13px' }}>Total Debit:</td>
                                        <td className="text-end text-primary py-2" style={{ fontSize: '14px', color: '#2ece8a !important' }}>{totalDebit.toFixed(2)}</td>
                                        {maintainNarration && <td></td>}
                                        <td></td>
                                    </tr>
                                </tbody>
                            </Table>
                        </div>

                        {/* Master Narration */}
                        <div className="row">
                            <div className="col-md-12">
                                <Form.Label className="form-label-custom">MASTER NARRATION</Form.Label>
                                <Form.Control
                                    id="master-narration"
                                    as="textarea"
                                    rows={2}
                                    value={currentPayment.narration}
                                    onChange={e => handleInputChange('narration', e.target.value)}
                                    placeholder="Optional master narration for this transaction voucher"
                                    className="form-control-custom"
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
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer-custom">
                        <div>
                            {!isBalanced && totalDebit > 0 && (
                                <div className="text-danger small fw-semibold">
                                    <i className="fa fa-exclamation-triangle me-1"></i>
                                    Debit cash/bank account must be selected and balance must equal credit entries.
                                </div>
                            )}
                            {isBalanced && (
                                <div className="text-success small fw-semibold" style={{ color: '#2ece8a' }}>
                                    <i className="fa fa-check-circle me-1"></i>
                                    Voucher balanced successfully.
                                </div>
                            )}
                        </div>
                        <div className="d-flex gap-2">
                            <button type="button" className="btn-close-custom btn-universal-close" onClick={() => setShowModal(false)}>
                                Close
                            </button>
                            <button type="submit" className="btn-save-custom btn-universal-save" disabled={!isBalanced}>
                                <i className="fa fa-save me-2" style={{ display: 'none' }}></i>
                                {editMode ? 'Update' : 'Save'}
                            </button>
                        </div>
                    </div>
                </Form>
            </Modal>

            {/* Bill Settlement Popup */}
            {(() => {
                const activeCrIdx = billSettlementModal.drIdx;
                const activeDrRow = activeCrIdx !== null ? drRows[activeCrIdx] : null;
                const activeLedgerId = activeDrRow?.ledger ? String(activeDrRow?.ledger?.id || activeDrRow?.ledger) : '';
                const activeInvoices = activeLedgerId ? (ledgerInvoices[activeLedgerId] || []) : [];
                const activeLedgerName = activeLedgerId
                    ? (ledgers.find(l => String(l.id) === activeLedgerId)?.name || '')
                    : '';
                return (
                    <BillSettlementPopup
                        show={billSettlementModal.show}
                        onHide={() => setBillSettlementModal({ show: false, drIdx: null })}
                        invoices={activeInvoices}
                        ledgerName={activeLedgerName}
                        totalAmount={activeDrRow?.debit_amount || 0}
                        existingAllocations={activeCrIdx !== null ? (billAllocations[activeCrIdx] || []) : []}
                        onApply={(allocs) => applyBillSettlement(activeCrIdx, allocs)}
                        isDark={isDark}
                        isEditMode={editMode}
                    />
                );
            })()}
        </>
    );
};

export default PaymentForm;
