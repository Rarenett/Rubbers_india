import React, { useState, useEffect, useRef } from 'react';
import { Modal } from 'react-bootstrap';
import Select, { components } from 'react-select';

const CustomOption = (props) => {
    const { onMouseMove, onMouseOver, ...otherInnerProps } = props.innerProps;
    return (
        <components.Option {...props} innerProps={otherInnerProps} />
    );
};

/**
 * BatchEntryModal
 *
 * Props:
 *  show              – boolean
 *  onHide            – () => void
 *  openingStock      – number  (total qty that must be balanced)
 *  maintainMfgDate   – boolean (show Manufacture Date column)
 *  maintainExpiry    – boolean (show Expiry Date column)
 *  warehouses        – [{ id, name }]
 *  initialBatches    – existing batch rows (for edit mode)
 *  onConfirm         – (rows) => void
 */

const EMPTY_ROW = () => ({
    _id: Date.now() + Math.random(),
    warehouse: '',
    batch_number: '',
    manufacture_date: '',
    expiry_date: '',
    quantity: '',
});

const BatchEntryModal = ({
    show,
    onHide,
    openingStock = 0,
    maintainMfgDate = false,
    maintainExpiry = false,
    warehouses = [],
    initialBatches = [],
    onConfirm,
    maintainBatch = false,
}) => {
    const [rows, setRows] = useState([EMPTY_ROW()]);
    const [isKeyboard, setIsKeyboard] = useState(false);

    useEffect(() => {
        if (!show) return;
        const handleKeyDown = (e) => {
            if (['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
                setIsKeyboard(prev => {
                    if (!prev) return true;
                    return prev;
                });
            }
        };
        const handleMouseMove = () => {
            setIsKeyboard(prev => {
                if (prev) return false;
                return prev;
            });
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('mousemove', handleMouseMove);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, [show]);

    // Populate rows from existing batches when editing, or reset to one blank row
    useEffect(() => {
        if (show) {
            autoCreatedRows.current.clear();
            if (initialBatches && initialBatches.length > 0) {
                setRows(
                    initialBatches.map(b => ({
                        _id: Date.now() + Math.random(),
                        warehouse: b.warehouse || '',
                        batch_number: b.batch_number || '',
                        manufacture_date: b.manufacture_date || '',
                        expiry_date: b.expiry_date || '',
                        quantity: b.quantity !== undefined ? String(b.quantity) : '',
                    }))
                );
            } else {
                const defaultWh = warehouses.find(w => w.is_default) || warehouses[0];
                setRows([
                    {
                        _id: Date.now() + Math.random(),
                        warehouse: defaultWh ? defaultWh.id : '',
                        batch_number: '',
                        manufacture_date: '',
                        expiry_date: '',
                        quantity: openingStock ? String(openingStock) : '',
                    }
                ]);
            }
        }
    }, [show, initialBatches]);

    // Refs for each cell: rowRefs.current[rowIdx][fieldName]
    const rowRefs = useRef([]);
    const ensureRef = (idx) => {
        if (!rowRefs.current[idx]) rowRefs.current[idx] = {};
        return rowRefs.current[idx];
    };

    // Ref for the Save/Confirm button (so Enter on last empty row focuses it)
    const saveButtonRef = useRef(null);

    // When this is set to a row index, that row's warehouse dropdown will open after render
    const [pendingOpenRow, setPendingOpenRow] = useState(null);

    // Tracks rows that were auto-created by pressing Enter on the quantity field.
    // If the user presses Enter on the warehouse dropdown without selecting anything,
    // we delete the row and focus the Confirm button instead.
    const autoCreatedRows = useRef(new Set());

    // Navigate to the next focusable cell after a given TD element
    const focusNextFromTd = (td) => {
        const wrap = document.querySelector('.batch-table-wrap');
        if (!wrap) return;
        const allInputs = Array.from(
            wrap.querySelectorAll('input.bm-input, .react-select__control')
        ).filter(el => el.offsetParent !== null);
        // For a react-select control, the real input is inside it
        const resolveInput = (el) =>
            el.classList.contains('react-select__control')
                ? el.querySelector('input')
                : el;
        const currentInputs = td
            ? Array.from(td.querySelectorAll('input.bm-input, .react-select__control'))
            : [];
        const currentEl = currentInputs[0];
        const idx = allInputs.indexOf(currentEl);
        if (idx === -1 || idx >= allInputs.length - 1) return;
        const nextEl = allInputs[idx + 1];
        resolveInput(nextEl)?.focus();
    };

    // Shared keydown for warehouse react-select:
    // • If menu is open, let react-select handle Enter (to select); onChange will navigate.
    // • If menu is closed and warehouse is empty:
    //     – If this row was auto-created from qty Enter → delete it and focus Save.
    //     – Otherwise delete (if not last) and focus Save.
    // • If menu is closed and warehouse has a value → navigate to next field.
    const handleSelectKeyDown = (e, td, rowIdx) => {
        if (e.key !== 'Enter') return;
        const menuOpen = !!document.querySelector('.react-select__menu');
        if (menuOpen) {
            // Let react-select handle the selection.
            // If nothing is highlighted (no option focused), treat as "no selection":
            // close the menu and, if this was an auto-created row, delete it.
            const focused = document.querySelector('.react-select__option--is-focused');
            if (!focused) {
                // No option is highlighted — user pressed Enter without choosing anything
                e.preventDefault();
                // Close the dropdown by blurring the input
                const input = td?.querySelector('input');
                if (input) input.blur();

                if (autoCreatedRows.current.has(rowIdx)) {
                    autoCreatedRows.current.delete(rowIdx);
                    setRows(prev => {
                        // Only delete if there's more than one row
                        if (prev.length > 1) {
                            return prev.filter((_, i) => i !== rowIdx);
                        }
                        return prev;
                    });
                } else if (rows.length > 1) {
                    setRows(prev => prev.filter((_, i) => i !== rowIdx));
                }
                setTimeout(() => saveButtonRef.current?.focus(), 60);
            }
            // else: an option is highlighted → let react-select select it via its own Enter handler
            return;
        }

        e.preventDefault();
        const currentRow = rows[rowIdx];
        if (!currentRow.warehouse) {
            // Empty warehouse → delete row (if more than one) and focus Save
            autoCreatedRows.current.delete(rowIdx);
            if (rows.length > 1) {
                setRows(prev => prev.filter((_, i) => i !== rowIdx));
            }
            setTimeout(() => saveButtonRef.current?.focus(), 50);
        } else {
            autoCreatedRows.current.delete(rowIdx);
            focusNextFromTd(td);
        }
    };

    const handleInputKeyDown = (e, td, isQty = false, rowIdx = null) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (isQty && rowIdx !== null) {
            // Add new row, mark it as auto-created, and schedule opening its warehouse dropdown.
            // NOTE: setPendingOpenRow must be called *outside* the setRows updater so React
            // treats it as a separate state update and the effect fires after the new row renders.
            setRows(prev => {
                const next = [...prev, EMPTY_ROW()];
                autoCreatedRows.current.add(next.length - 1);
                return next;
            });
            // rows.length is the current count, so new row index = rows.length
            setPendingOpenRow(rows.length);
        } else {
            focusNextFromTd(td);
        }
    };

    // Open the first warehouse dropdown when the modal first shows
    const [firstOpenDone, setFirstOpenDone] = useState(false);
    useEffect(() => {
        if (show) setFirstOpenDone(false);
    }, [show]);

    // After a new row is added via Enter on quantity, focus + open its warehouse dropdown.
    // Use the react-select instance ref to call focus() and openMenu() directly —
    // this is reliable and avoids any DOM click/timing races.
    useEffect(() => {
        if (pendingOpenRow === null) return;
        const t = setTimeout(() => {
            const sel = rowRefs.current[pendingOpenRow]?.selectRef;
            if (!sel) return;
            sel.focus();     // moves keyboard focus into the Select
            sel.openMenu(); // opens the dropdown
            setPendingOpenRow(null);
        }, 80);
        return () => clearTimeout(t);
    }, [pendingOpenRow, rows.length]);

    const totalAllocated = rows.reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);
    const remaining = parseFloat((openingStock - totalAllocated).toFixed(3));
    const isBalanced = Math.abs(remaining) < 0.0005;

    const DIVIDER_OPTION = { value: null, label: '-------------', isDisabled: false, isDivider: true };
    const warehouseOptions = [DIVIDER_OPTION, ...warehouses.map(w => ({ value: w.id, label: w.name }))];
    const findWHOption = (val) => warehouseOptions.find(o => o.value !== null && String(o.value) === String(val)) || null;

    const updateRow = (idx, field, value) => {
        setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
    };

    const addRow = () => setRows(prev => [...prev, EMPTY_ROW()]);

    const removeRow = (idx) => {
        if (rows.length === 1) return; // keep at least one
        setRows(prev => prev.filter((_, i) => i !== idx));
    };

    const handleConfirm = () => {
        // Validate: all rows must have warehouse and quantity > 0
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            if (!r.warehouse) {
                alert(`Row ${i + 1}: Warehouse is required.`);
                return;
            }
            if (maintainBatch && !r.batch_number.trim()) {
                alert(`Row ${i + 1}: Batch number is required.`);
                return;
            }
            const qty = parseFloat(r.quantity);
            if (!qty || qty <= 0) {
                alert(`Row ${i + 1}: Quantity must be greater than 0.`);
                return;
            }
        }
        if (!isBalanced) {
            alert(`Quantities don't balance. Allocated: ${totalAllocated}, Opening Stock: ${openingStock}. Remaining: ${remaining}`);
            return;
        }
        onConfirm(
            rows.map(({ _id, ...rest }) => ({
                ...rest,
                quantity: parseFloat(rest.quantity),
            }))
        );
    };

    return (
        <>
            <style>{`
                .batch-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.15) !important;
                    overflow: hidden;
                }
                .batch-modal .modal-header-bm {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 20px 24px 16px 24px;
                    border-bottom: 1px solid #f1f5f9;
                    background: #fff;
                }
                .batch-modal .modal-title-bm {
                    font-size: 17px;
                    font-weight: 600;
                    color: #1e293b;
                    margin: 0;
                }
                .batch-modal .modal-close-bm {
                    border: none;
                    background: transparent;
                    font-size: 22px;
                    color: #aaa;
                    cursor: pointer;
                    line-height: 1;
                }
                .batch-modal .modal-close-bm:hover { color: #555; }
                .batch-modal .balance-bar {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    padding: 12px 24px;
                    background: #f8fafc;
                    border-bottom: 1px solid #e2e8f0;
                    font-size: 13px;
                    flex-wrap: wrap;
                }
                .batch-modal .balance-chip {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-weight: 500;
                }
                .batch-modal .balance-chip .label { color: #64748b; }
                .batch-modal .balance-chip .value { color: #1e293b; font-weight: 600; }
                .batch-modal .balance-chip .value.ok { color: #16a34a; }
                .batch-modal .balance-chip .value.warn { color: #dc2626; }
                .batch-modal .batch-table-wrap {
                    padding: 16px 24px 20px 24px;
                    max-height: 55vh;
                    overflow-y: auto;
                }
                .batch-modal .batch-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 13px;
                }
                .batch-modal .batch-table th {
                    text-align: left;
                    padding: 8px 10px;
                    background: #f8fafc;
                    color: #64748b;
                    font-weight: 600;
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    border-bottom: 1px solid #e2e8f0;
                    white-space: nowrap;
                }
                .batch-modal .batch-table td {
                    padding: 6px 6px;
                    vertical-align: middle;
                    border-bottom: 1px solid #f1f5f9;
                }
                .batch-modal .batch-table tr:last-child td { border-bottom: none; }
                .batch-modal .bm-input {
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                    padding: 7px 10px;
                    font-size: 13px;
                    color: #334155;
                    background: #fff;
                    width: 100%;
                    transition: border-color 0.2s, box-shadow 0.2s;
                }
                .batch-modal .bm-input:focus {
                    outline: none;
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46,206,138,0.15);
                }
                .batch-modal .bm-input::placeholder { color: #94a3b8; }
                .batch-modal .btn-add-row {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background: none;
                    border: 1.5px dashed #2ece8a;
                    color: #16a34a;
                    border-radius: 8px;
                    padding: 7px 14px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.15s;
                    margin-top: 10px;
                }
                .batch-modal .btn-add-row:hover { background: #f0fdf4; }
                .batch-modal .btn-remove-row {
                    background: none;
                    border: none;
                    color: #ef4444;
                    font-size: 16px;
                    cursor: pointer;
                    padding: 4px 6px;
                    border-radius: 6px;
                    line-height: 1;
                }
                .batch-modal .btn-remove-row:hover { background: #fef2f2; }
                .batch-modal .btn-remove-row:disabled { opacity: 0.3; cursor: not-allowed; }
                .batch-modal .modal-footer-bm {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    gap: 10px;
                    padding: 16px 24px;
                    border-top: 1px solid #f1f5f9;
                    background: #fafbfc;
                }
                .batch-modal .btn-cancel-bm {
                    background: #7A70BA !important;
                    color: white !important;
                    border: none !important;
                    border-radius: 8px !important;
                    font-size: 13px !important;
                    font-weight: 500 !important;
                    padding: 9px 20px !important;
                    cursor: pointer;
                }
                .batch-modal .btn-confirm-bm {
                    background: #2ece8a !important;
                    color: white !important;
                    border: none !important;
                    border-radius: 8px !important;
                    font-size: 13px !important;
                    font-weight: 500 !important;
                    padding: 9px 20px !important;
                    cursor: pointer;
                }
                .batch-modal .btn-confirm-bm:disabled {
                    background: #a7f3d0 !important;
                    cursor: not-allowed;
                }
                .batch-qty-col { width: 100px; }
                .batch-wh-col  { width: 150px; }
                .batch-date-col { width: 140px; }
                .batch-bn-col  { width: 130px; }
                .batch-del-col { width: 40px; text-align: center; }
            `}</style>

            <Modal
                show={show}
                onHide={onHide}
                dialogClassName="batch-modal"
                size="xl"
                centered
                backdrop="static"
            >
                {/* Header */}
                <div className="modal-header-bm">
                    <div className="d-flex align-items-center gap-3">
                        <div style={{
                            width: 40, height: 40, borderRadius: '50%',
                            background: '#2ece8a', display: 'flex',
                            alignItems: 'center', justifyContent: 'center'
                        }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                                <path d="M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.5 15.5 0 12.36 0c-1.73 0-3.24.86-4.36 2.18L12 6H20zm-7.64 0L8 1.82C7.01.68 5.55 0 4 0 1.79 0 0 1.79 0 4c0 .48.1.92.18 1.36H0L2 20c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2l2-14H12.36z" />
                            </svg>
                        </div>
                        <div>
                            <p className="modal-title-bm">{maintainBatch ? 'Batch / Opening Stock Details' : 'Opening Stock Warehouse Allocation'}</p>
                            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                                {maintainBatch ? 'Distribute opening stock across batches & warehouses' : 'Distribute opening stock across warehouses'}
                            </p>
                        </div>
                    </div>
                    <button className="modal-close-bm" onClick={onHide}>&times;</button>
                </div>

                {/* Balance bar */}
                <div className="balance-bar">
                    <div className="balance-chip">
                        <span className="label">Opening Stock:</span>
                        <span className="value">{openingStock}</span>
                    </div>
                    <div className="balance-chip">
                        <span className="label">Allocated:</span>
                        <span className={`value ${isBalanced ? 'ok' : totalAllocated > openingStock ? 'warn' : ''}`}>
                            {totalAllocated.toFixed(3)}
                        </span>
                    </div>
                    <div className="balance-chip">
                        <span className="label">Remaining:</span>
                        <span className={`value ${isBalanced ? 'ok' : 'warn'}`}>
                            {remaining.toFixed(3)}
                        </span>
                    </div>
                    {isBalanced && (
                        <span style={{ color: '#16a34a', fontWeight: 600, fontSize: 12 }}>
                            ✓ Balanced
                        </span>
                    )}
                </div>

                {/* Table */}
                <div className="batch-table-wrap">
                    <table className="batch-table">
                        <thead>
                            <tr>
                                <th className="batch-wh-col">Warehouse <span style={{ color: '#ef4444' }}>*</span></th>
                                {maintainBatch && <th className="batch-bn-col">Batch Number <span style={{ color: '#ef4444' }}>*</span></th>}
                                {maintainBatch && maintainMfgDate && <th className="batch-date-col">Mfg. Date</th>}
                                {maintainBatch && maintainExpiry && <th className="batch-date-col">Expiry Date</th>}
                                <th className="batch-qty-col">Quantity <span style={{ color: '#ef4444' }}>*</span></th>
                                <th className="batch-del-col"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, idx) => (
                                <tr key={row._id}>
                                    {/* Warehouse */}
                                    <td className="batch-wh-col" ref={(el) => { ensureRef(idx).wh_td = el; }}>
                                        <Select
                                            ref={(el) => { ensureRef(idx).selectRef = el; }}
                                            classNamePrefix="react-select"
                                            components={{ Option: CustomOption }}
                                            options={warehouseOptions}
                                            value={findWHOption(row.warehouse)}
                                            onChange={(opt) => {
                                                // Selecting the divider row clears the value
                                                const val = (opt && opt.value !== null) ? opt.value : '';
                                                updateRow(idx, 'warehouse', val);
                                                if (val) {
                                                    // Selection made — this row is no longer "auto-created pending"
                                                    autoCreatedRows.current.delete(idx);
                                                    // After react-select closes the menu, move to next field
                                                    setTimeout(() => focusNextFromTd(rowRefs.current[idx]?.wh_td), 50);
                                                }
                                            }}
                                            onKeyDown={(e) => handleSelectKeyDown(e, rowRefs.current[idx]?.wh_td, idx)}
                                            onMenuClose={() => { if (idx === 0) setFirstOpenDone(true); }}
                                            placeholder="Select..."
                                            isClearable
                                            autoFocus={idx === 0 && !firstOpenDone}
                                            defaultMenuIsOpen={idx === 0 && !firstOpenDone}
                                            menuPortalTarget={document.body}
                                            styles={{
                                                control: (base, state) => ({
                                                    ...base,
                                                    minHeight: '34px',
                                                    fontSize: '13px',
                                                    borderRadius: '8px',
                                                    borderColor: state.isFocused ? '#2ece8a' : '#cbd5e1',
                                                    boxShadow: state.isFocused ? '0 0 0 3px rgba(46,206,138,0.15)' : 'none',
                                                    '&:hover': { borderColor: '#2ece8a' },
                                                }),
                                                menu: base => ({ ...base, zIndex: 9999, fontSize: '13px' }),
                                                singleValue: (base, state) => ({
                                                    ...base,
                                                    opacity: state.selectProps.inputValue ? 0 : 1,
                                                }),
                                                option: (base, state) => ({
                                                    ...base,
                                                    backgroundColor: state.data.isDivider
                                                        ? 'white'
                                                        : state.isSelected
                                                            ? '#2ece8a'
                                                            : (state.isFocused && isKeyboard)
                                                                ? '#f0fdf4'
                                                                : 'white',
                                                    color: state.data.isDivider ? '#94a3b8' : state.isSelected ? 'white' : '#334155',
                                                    cursor: state.data.isDivider ? 'default' : 'pointer',
                                                    textAlign: state.data.isDivider ? 'center' : 'left',
                                                    letterSpacing: state.data.isDivider ? '0.1em' : 'normal',
                                                    fontSize: state.data.isDivider ? '11px' : '13px',
                                                    pointerEvents: state.data.isDivider ? 'none' : 'auto',
                                                    '&:hover': {
                                                        backgroundColor: state.data.isDivider
                                                            ? 'white'
                                                            : state.isSelected
                                                                ? '#2ece8a'
                                                                : '#f0fdf4',
                                                        color: state.data.isDivider ? '#94a3b8' : state.isSelected ? 'white' : '#334155',
                                                    }
                                                }),
                                                menuPortal: base => ({ ...base, zIndex: 9999 }),
                                            }}
                                        />
                                    </td>
                                    {/* Batch Number */}
                                    {maintainBatch && (
                                        <td className="batch-bn-col" ref={(el) => { ensureRef(idx).bn_td = el; }}>
                                            <input
                                                type="text"
                                                className="bm-input"
                                                value={row.batch_number}
                                                onChange={(e) => updateRow(idx, 'batch_number', e.target.value)}
                                                onKeyDown={(e) => handleInputKeyDown(e, rowRefs.current[idx]?.bn_td)}
                                                placeholder="e.g. BT-001"
                                            />
                                        </td>
                                    )}
                                    {/* Manufacture Date */}
                                    {maintainBatch && maintainMfgDate && (
                                        <td className="batch-date-col" ref={(el) => { ensureRef(idx).mfg_td = el; }}>
                                            <input
                                                type="date"
                                                className="bm-input"
                                                value={row.manufacture_date}
                                                onChange={(e) => updateRow(idx, 'manufacture_date', e.target.value)}
                                                onKeyDown={(e) => handleInputKeyDown(e, rowRefs.current[idx]?.mfg_td)}
                                            />
                                        </td>
                                    )}
                                    {/* Expiry Date */}
                                    {maintainBatch && maintainExpiry && (
                                        <td className="batch-date-col" ref={(el) => { ensureRef(idx).exp_td = el; }}>
                                            <input
                                                type="date"
                                                className="bm-input"
                                                value={row.expiry_date}
                                                onChange={(e) => updateRow(idx, 'expiry_date', e.target.value)}
                                                onKeyDown={(e) => handleInputKeyDown(e, rowRefs.current[idx]?.exp_td)}
                                            />
                                        </td>
                                    )}
                                    {/* Quantity */}
                                    <td className="batch-qty-col" ref={(el) => { ensureRef(idx).qty_td = el; }}>
                                        <input
                                            type="number"
                                            step="0.001"
                                            min="0"
                                            className="bm-input"
                                            value={row.quantity}
                                            onChange={(e) => updateRow(idx, 'quantity', e.target.value)}
                                            onKeyDown={(e) => handleInputKeyDown(e, rowRefs.current[idx]?.qty_td, true, idx)}
                                            placeholder="0.000"
                                            style={{ textAlign: 'right' }}
                                        />
                                    </td>
                                    {/* Delete */}
                                    <td className="batch-del-col">
                                        <button
                                            type="button"
                                            className="btn-remove-row"
                                            onClick={() => removeRow(idx)}
                                            disabled={rows.length === 1}
                                            title="Remove row"
                                        >
                                            ×
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Add row button */}
                    <button type="button" className="btn-add-row" onClick={addRow}>
                        <span style={{ fontSize: 16, fontWeight: 700 }}>+</span> {maintainBatch ? 'Add Batch Row' : 'Add Allocation Row'}
                    </button>
                </div>

                {/* Footer */}
                <div className="modal-footer-bm">
                    <button type="button" className="btn-cancel-bm" onClick={onHide}>
                        Cancel
                    </button>
                    <button
                        ref={saveButtonRef}
                        type="button"
                        className="btn-confirm-bm"
                        onClick={(e) => { e.currentTarget.blur(); handleConfirm(); }}
                    >
                        {maintainBatch ? 'Confirm Batches' : 'Confirm Allocations'}
                    </button>
                </div>
            </Modal>
        </>
    );
};

export default BatchEntryModal;