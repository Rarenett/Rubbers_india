import './FinanceForms.css';
import React from 'react';
import { Modal, Form, Row, Col, Table, Button } from 'react-bootstrap';
import Select from 'react-select';
import BillSettlementPopup from './BillSettlementPopup';

const JournalForm = (props) => {

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

    const {
        showModal, setShowModal, editMode, currentJournal, handleInputChange, handleSubmit,
        ledgers, maintainNarration, expandedNarrations, toggleNarration, handleDetailChange,
        handleCellKeyDown, handleFocusAmount, openBillSettlement, billAllocations, totalDebit,
        totalCredit, isBalanced, addDetailRow, removeDetailRow, focusCell, billSettlementModal,
        setBillSettlementModal, ledgerInvoices, handleBillSettlementApply, isDark, customSelectStyles
    } = props;

    return (
        <>
            <Modal
                show={showModal}
                onHide={() => setShowModal(false)}
                size="xl"
                centered
                dialogClassName="item-custom-modal"
backdrop="static"
keyboard={false}
                onEntered={() => {
                    document.getElementById('voucher-no-input')?.focus();
                }}
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <i className="fa fa-book text-white fs-4"></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editMode ? 'Edit Journal Voucher' : 'New Journal Voucher'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Double-entry book keeping record. Debit and Credit totals must balance.
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
                                    value={currentJournal.voucher_no}
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
                                    value={currentJournal.voucher_date}
                                    onChange={e => handleInputChange('voucher_date', e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            focusCell(0, 'entry_type');
                                        }
                                    }}
                                    required
                                />
                            </div>
                        </div>

                        <div className="table-responsive">
                            <Table bordered className="align-middle journal-entry-table border-secondary border-opacity-10">
                                <thead>
                                    <tr className="table-light">
                                        <th style={{ width: '12%', fontSize: '13px', color: '#4a5568', fontWeight: 600, textAlign: 'center' }}>By/To</th>
                                        <th style={{ width: maintainNarration ? '43%' : '53%', fontSize: '13px', color: '#4a5568', fontWeight: 600 }}>Ledger Account *</th>
                                        <th style={{ width: '15%', fontSize: '13px', color: '#4a5568', fontWeight: 600 }}>Debit ()</th>
                                        <th style={{ width: '15%', fontSize: '13px', color: '#4a5568', fontWeight: 600 }}>Credit ()</th>
                                        {maintainNarration && <th style={{ width: '8%', textAlign: 'center', fontSize: '13px', color: '#4a5568', fontWeight: 600 }}>Note</th>}
                                        <th style={{ width: '5%', textAlign: 'center', fontSize: '13px', color: '#4a5568', fontWeight: 600 }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentJournal.details.map((row, idx) => (
                                        <React.Fragment key={idx}>
                                            <tr>
                                                <td>
                                                    <Select
                                                        options={[{value: 'Dr', label: '(Dr)'}, {value: 'Cr', label: '(Cr)'}]}
                                                        value={{value: row.entry_type, label: `(${row.entry_type})`}}
                                                        onChange={sel => {
                                                            handleDetailChange(idx, 'entry_type', sel.value);
                                                            setTimeout(() => {
                                                                const el = document.getElementById(`cell-${idx}-ledger`);
                                                                if (el) el.focus();
                                                            }, 10);
                                                        }}
                                                        styles={{
                                                            ...selectStyles,
                                                            singleValue: (base) => ({
                                                                ...base,
                                                                color: row.entry_type === 'Dr' ? '#2ece8a' : '#f5365c',
                                                                fontWeight: '600',
                                                                textAlign: 'center'
                                                            }),
                                                            control: (base, state) => ({
                                                                ...selectStyles.control(base, state),
                                                                textAlign: 'center'
                                                            })
                                                        }}
                                                        menuPosition="fixed"
                                                        isSearchable={false}
                                                        inputId={`cell-${idx}-entry_type`}
                                                        onKeyDown={e => handleCellKeyDown(e, idx, 'entry_type')}
                                                    />
                                                </td>
                                                <td>
                                                    <Select
                                                        options={ledgers.map(l => ({ value: l.id, label: l.name }))}
                                                        value={row.ledger ? { value: row.ledger, label: ledgers.find(l => l.id === row.ledger)?.name } : null}
                                                        onChange={sel => {
                                                            handleDetailChange(idx, 'ledger', sel ? sel.value : '');
                                                            if (sel) {
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
                                                        styles={selectStyles}
                                                        menuPosition="fixed"
                                                        isSearchable
                                                        openMenuOnFocus={true}
                                                        blurInputOnSelect={true}
                                                        placeholder="-- Select Ledger --"
                                                        inputId={`cell-${idx}-ledger`}
                                                        onKeyDown={e => handleCellKeyDown(e, idx, 'ledger')}
                                                    />
                                                </td>
                                                <td>
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
                                                                className="form-control-custom text-end py-1 no-spinner"
                                                                style={{ height: '38px' }}
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
                                                <td>
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
                                                                className="form-control-custom text-end py-1 no-spinner"
                                                                style={{ height: '38px' }}
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
                                                <td className="text-center">
                                                    <div className="d-flex align-items-center justify-content-center gap-2">
                                                        {idx === currentJournal.details.length - 1 && (
                                                            <Button
                                                                variant="outline-success"
                                                                className="shadow"
                                                                style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                                onClick={addDetailRow}
                                                                title="Add New Row"
                                                            >
                                                                <i className="fa fa-plus"></i>
                                                            </Button>
                                                        )}
                                                        {currentJournal.details.length > 1 && (
                                                            <Button
                                                                variant="outline-danger"
                                                                className="shadow"
                                                                style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                                onClick={() => removeDetailRow(idx)}
                                                                title="Remove Row"
                                                            >
                                                                <i className="fa fa-trash"></i>
                                                            </Button>
                                                        )}
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
                                        <td colSpan="2" className="text-end text-muted py-2" style={{ fontSize: '13px' }}>Total:</td>
                                        <td className="text-end text-primary py-2" style={{ fontSize: '14px', color: '#2ece8a !important' }}>{totalDebit.toFixed(2)}</td>
                                        <td className="text-end text-primary py-2" style={{ fontSize: '14px', color: '#f5365c !important' }}>{totalCredit.toFixed(2)}</td>
                                        {maintainNarration && <td></td>}
                                        <td className="text-center p-2">
                                            <Button
                                                variant="outline-success"
                                                className="shadow"
                                                style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                onClick={addDetailRow}
                                                title="Add New Row"
                                            >
                                                <i className="fa fa-plus"></i>
                                            </Button>
                                        </td>
                                    </tr>
                                </tbody>
                            </Table>
                        </div>

                        {/* Master Narration */}
                        <div className="mt-2">
                            <Form.Group>
                                <Form.Label className="form-label-custom">MASTER NARRATION</Form.Label>
                                <Form.Control
                                    size="sm"
                                    id="master-narration"
                                    as="textarea"
                                    rows={2}
                                    value={currentJournal.narration}
                                    onChange={e => handleInputChange('narration', e.target.value)}
                                    placeholder="Optional master narration for this transaction voucher"
                                    className="form-control-custom"
                                />
                            </Form.Group>
                        </div>
                    </div>
                    <div className="modal-footer-custom">
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
                        <div className="d-flex align-items-center gap-2">
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
                        onHide={() => setBillSettlementModal({ show: false, rowIdx: null })}
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
        </>
    );
};

export default JournalForm;
