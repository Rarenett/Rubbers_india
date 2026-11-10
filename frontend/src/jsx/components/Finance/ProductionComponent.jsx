import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Button, Form } from 'react-bootstrap';
import Select, { components } from 'react-select';
import ItemDetailPopup from './ItemDetailPopup';
import { emptyRow } from './emptyRow';

const CustomOption = (props) => {
    const { onMouseMove, onMouseOver, ...otherInnerProps } = props.innerProps;
    return (
        <components.Option {...props} innerProps={otherInnerProps} />
    );
};

/**
 * ProductionComponent
 *
 * Displays a table of stock items for PRODUCTION (stock increases / OUT movement).
 * Structure identical to ConsumptionComponent; visual differentiation via colours.
 *
 * Props:
 *   rows              - array of row objects
 *   onRowsChange      - (rows) => void
 *   stockItems        - array of stock item objects
 *   productConfig     - ProductConfiguration for Stock Journal
 */
const ProductionComponent = ({ rows, onRowsChange, stockItems = [], productConfig, autoFocus = true, isEdit = false, isManufacturalJournal = false }) => {
    const firstSelectRef = useRef(null);
    const [isKeyboard, setIsKeyboard] = useState(false);
    const [activePopupIdx, setActivePopupIdx] = useState(null);

    const stockItemOptions = useMemo(() => [
        { value: '', label: '-------------', original: null },
        ...stockItems.map(s => ({ value: s.id, label: s.name, original: s }))
    ], [stockItems]);

    useEffect(() => {
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
    }, []);

    // Autofocus the first Stock Item select when component mounts in new mode only.
    useEffect(() => {
        if (!autoFocus || isEdit) return;
        const timer = setTimeout(() => {
            if (firstSelectRef.current) {
                firstSelectRef.current.focus();
                firstSelectRef.current.openMenu();
            }
        }, 200);
        return () => clearTimeout(timer);
    }, [autoFocus, isEdit]);

    const prevLengthRef = useRef(rows.length);
    const deletingRef = useRef(false);
    useEffect(() => {
        if (rows.length > prevLengthRef.current && !deletingRef.current) {
            // Avoid stealing focus if user is working in the header
            const active = document.activeElement;
            if (active && active.closest('.journal-header-box')) {
                prevLengthRef.current = rows.length;
                return;
            }

            const timer = setTimeout(() => {
                const selects = document.querySelectorAll('.production-sec .item-select');
                const lastSelect = selects[selects.length - 1];
                if (lastSelect) {
                    const input = lastSelect.querySelector('input');
                    if (input) {
                        input.focus();
                    }
                }
            }, 100);
            prevLengthRef.current = rows.length;
            return () => clearTimeout(timer);
        }
        prevLengthRef.current = rows.length;
        deletingRef.current = false;
    }, [rows.length]);

    const updateRow = useCallback((idx, updates) => {
        onRowsChange(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], ...updates };
            return next;
        });
    }, [onRowsChange]);

    const addRow = () => {
        onRowsChange(prev => [...prev, emptyRow()]);
    };

    const removeRow = (idx) => {
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }

        deletingRef.current = true;
        onRowsChange(prev => prev.filter((_, i) => i !== idx));

        setTimeout(() => {
            const narrationInput =
                document.querySelector('textarea[name="narration"]') ||
                document.getElementById('narration');

            if (narrationInput) {
                narrationInput.focus();
            }
        }, 150);
    };

    const handleQtyBlur = (idx) => {
        // Intentionally left blank
    };

    const handleQtyKeyDown = (idx, e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const row = rows[idx];
            if (row?.stock_item_obj && parseFloat(row.quantity) > 0) {
                setActivePopupIdx(idx);
            }
        }
    };

    const handlePopupConfirm = (idx, detailsArray) => {
        onRowsChange(prev => {
            const next = [...prev];
            const baseRow = next[idx];
            next[idx] = {
                ...baseRow,
                splits: detailsArray,
                warehouse: detailsArray.length === 1 ? detailsArray[0].warehouse : null,
                batch_number: detailsArray.length === 1 ? detailsArray[0].batch_number : '',
                expiry_date: detailsArray.length === 1 ? detailsArray[0].expiry_date : null,
                manufacture_date: detailsArray.length === 1 ? detailsArray[0].manufacture_date : null,
            };
            return next;
        });

        setActivePopupIdx(null);

        // Focus the rate input of the confirmed row (scoped to production section)
        setTimeout(() => {
            const prodSec = document.querySelector('.production-sec');
            const rateInputs = (prodSec || document).querySelectorAll('.rate-input');
            if (rateInputs && rateInputs[idx]) {
                rateInputs[idx].focus();
            }
        }, 100);
    };

    const handleRateKeyDown = (idx, e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            if (idx === rows.length - 1) {
                addRow();
            } else {
                setTimeout(() => {
                    const prodSec = document.querySelector('.production-sec');
                    const selects = (prodSec || document).querySelectorAll('.item-select');
                    if (selects && selects[idx + 1]) {
                        const input = selects[idx + 1].querySelector('input');
                        if (input) {
                            input.focus();
                        }
                    }
                }, 50);
            }
        }
    };

    const handleQtyChange = (idx, val) => {
        const qty = parseFloat(val) || 0;
        const rate = parseFloat(rows[idx]?.rate) || 0;
        updateRow(idx, { quantity: val, amount: +(qty * rate).toFixed(2) });
    };

    const handleRateChange = (idx, val) => {
        const rate = parseFloat(val) || 0;
        const qty = parseFloat(rows[idx]?.quantity) || 0;
        updateRow(idx, { rate: val, amount: +(qty * rate).toFixed(2) });
    };

    const totalAmount = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

    const inputStyle = {
        borderRadius: '8px',
        fontSize: '13px',
        padding: '6px 12px',
        borderColor: '#cbd5e1',
        height: '36px',
        color: '#334155',
        backgroundColor: '#fff',
    };

    const thStyle = {
        background: '#f8fafc',
        color: '#64748b',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        padding: '10px 12px',
        textTransform: 'uppercase',
        borderBottom: '1px solid #cbd5e1',
        whiteSpace: 'nowrap',
    };

    return (
        <div>
            <style>{`
                .btn-add-item-row {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background: none;
                    border: 1.5px dashed #0a500f;
                    color: #16a34a;
                    border-radius: 8px;
                    padding: 8px 16px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.15s, border-color 0.2s;
                }
                .btn-add-item-row:hover {
                    background: #f0fdf4;
                    border-color: #073d0b;
                }
                .btn-remove-item-row {
                    background: none;
                    border: none;
                    color: #ef4444;
                    font-size: 16px;
                    cursor: pointer;
                    padding: 4px 6px;
                    border-radius: 6px;
                    line-height: 1;
                    transition: background 0.15s;
                }
                .btn-remove-item-row:hover {
                    background: #fef2f2;
                }
                .btn-details-fill {
                    background-color: #0a500f !important;
                    color: white !important;
                    border: none !important;
                    border-radius: 6px !important;
                    font-size: 12px !important;
                    font-weight: 500 !important;
                    padding: 5px 12px !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .btn-details-fill:hover {
                    background-color: #073d0b !important;
                }
                .btn-details-filled {
                    background-color: #0a500f !important;
                    color: white !important;
                    border: none !important;
                    border-radius: 6px !important;
                    font-size: 12px !important;
                    font-weight: 500 !important;
                    padding: 5px 12px !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .btn-details-filled:hover {
                    background-color: #073d0b !important;
                }
                .info-banner-production {
                    display: flex;
                    align-items: center;
                    margin-bottom: 16px;
                    background-color: #f0fdf4;
                    border-left: 4px solid #10b981;
                    border-radius: 4px 8px 8px 4px;
                    padding: 12px 16px;
                    border-top: 1px solid #d1fae5;
                    border-right: 1px solid #d1fae5;
                    border-bottom: 1px solid #d1fae5;
                }
                .info-banner-icon-production {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background-color: #d1fae5;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-right: 12px;
                    color: #10b981;
                    font-size: 16px;
                }
            `}</style>

            {/* Section Header Banner */}
            <div className="info-banner-production">
                <div className="info-banner-icon-production">
                    <i className="fas fa-plus-circle" />
                </div>
                <div>
                    <div style={{ fontWeight: 600, color: '#065f46', fontSize: '14px' }}>Production</div>
                    <div style={{ color: '#047857', fontSize: '12px' }}>Stock will be increased (Movement: Production)</div>
                </div>
            </div>

            {/* Table */}
            <div className="table-responsive" style={{ borderRadius: '10px', border: '1px solid #e2e8f0', overflowX: 'auto', marginBottom: '16px' }}>
                <table className="table mb-0" style={{ background: '#fff' }}>
                    <thead>
                        <tr>
                            <th style={{ ...thStyle, width: '40px' }}>#</th>
                            <th style={{ ...thStyle, width: '36%' }}>Stock Item</th>
                            <th style={{ ...thStyle, width: '20%' }}>Quantity</th>
                            <th style={{ ...thStyle, width: '20%' }}>Rate ()</th>
                            <th style={{ ...thStyle, width: '20%' }}>Amount ()</th>
                            <th style={{ ...thStyle, width: '40px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="text-center py-4" style={{ color: '#94a3b8', fontSize: '13px', background: '#fafafa' }}>
                                    <i className="fas fa-inbox me-2" />
                                    No items added. Click "Add Row" to start.
                                </td>
                            </tr>
                        ) : (
                            rows.map((row, idx) => (
                                <tr
                                    key={row._key}
                                    data-row-idx={idx}
                                    style={{
                                        background: idx % 2 === 0 ? '#fff' : '#fafbfe',
                                        borderBottom: '1px solid #f1f5f9',
                                    }}
                                >
                                    <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: '13px', verticalAlign: 'middle' }}>
                                        {idx + 1}
                                    </td>
                                    <td style={{ padding: '8px 8px', verticalAlign: 'middle' }}>
                                        <Select
                                            ref={idx === 0 ? firstSelectRef : null}
                                            className="item-select"
                                            openMenuOnFocus={true}
                                            components={{ Option: CustomOption }}
                                            options={stockItemOptions}
                                            value={
                                                stockItemOptions.find(o => String(o.value) === String(row.stock_item || '')) || null
                                            }
                                            onChange={(opt) => {
                                                const itemId = opt ? opt.value : '';
                                                // Ignore blank separator selection — preserve existing row data
                                                if (!itemId) return;
                                                const itemObj = opt ? opt.original : null;
                                                const isSameItem = String(row.stock_item) === String(itemId);
                                                const itemRate = itemObj ? (parseFloat(itemObj.sb_rate) || parseFloat(itemObj.opening_rate) || parseFloat(itemObj.ss_rate) || parseFloat(itemObj.mrp) || 0) : 0;
                                                const currentRate = parseFloat(row.rate) || 0;
                                                const effectiveRate = isSameItem ? currentRate : (itemRate || currentRate);
                                                const qty = parseFloat(row.quantity) || 0;
                                                const amount = +(qty * effectiveRate).toFixed(2);
                                                updateRow(idx, {
                                                    stock_item: itemId,
                                                    stock_item_obj: itemObj,
                                                    rate: effectiveRate ? String(effectiveRate) : (row.rate || ''),
                                                    amount: amount || row.amount || 0,
                                                    ...(isSameItem ? {} : {
                                                        warehouse: null,
                                                        batch_number: '',
                                                        expiry_date: null,
                                                        manufacture_date: null,
                                                        splits: [],
                                                    })
                                                });
                                                if (itemObj) {
                                                    setTimeout(() => {
                                                        const prodSec = document.querySelector('.production-sec');
                                                        const qtyInputs = (prodSec || document).querySelectorAll('.qty-input');
                                                        if (qtyInputs && qtyInputs[idx]) {
                                                            qtyInputs[idx].focus();
                                                        }
                                                    }, 50);
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    const menuOpen = !!document.querySelector('.react-select__menu');
                                                    if (menuOpen) {
                                                        // Let react-select handle option selection normally.
                                                        // Our onChange will ignore blank selections.
                                                        e.stopPropagation();
                                                        return;
                                                    }

                                                    // Helper: go to narration
                                                    const focusNextSection = () => {
                                                        const narrationInput =
                                                            document.querySelector('textarea[name="narration"]') ||
                                                            document.getElementById('narration');
                                                        if (narrationInput) narrationInput.focus();
                                                    };

                                                    if (!row.stock_item) {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        if (document.activeElement && typeof document.activeElement.blur === 'function') {
                                                            document.activeElement.blur();
                                                        }
                                                        deletingRef.current = true;
                                                        onRowsChange(prev => prev.filter((_, i) => i !== idx));
                                                        setTimeout(focusNextSection, 200);
                                                    } else {
                                                        // Row has data — move focus to quantity field
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setTimeout(() => {
                                                            const prodSec = document.querySelector('.production-sec');
                                                            const qtyInputs = (prodSec || document).querySelectorAll('.qty-input');
                                                            if (qtyInputs && qtyInputs[idx]) {
                                                                qtyInputs[idx].focus();
                                                            }
                                                        }, 50);
                                                    }
                                                }
                                            }}
                                            placeholder="— Select Item —"
                                            isClearable
                                            classNamePrefix="react-select"
                                            menuPortalTarget={document.body}
                                            styles={{
                                                control: (base, state) => ({
                                                    ...base,
                                                    minHeight: '36px',
                                                    fontSize: '13px',
                                                    borderRadius: '8px',
                                                    borderColor: state.isFocused ? '#0a500f' : '#cbd5e1',
                                                    boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 80, 15,0.15)' : 'none',
                                                    '&:hover': { borderColor: '#0a500f' },
                                                }),
                                                menu: base => ({ ...base, zIndex: 9999, fontSize: '13px' }),
                                                menuPortal: base => ({ ...base, zIndex: 99999 }),
                                                singleValue: (base, state) => ({
                                                    ...base,
                                                    opacity: state.selectProps.inputValue ? 0 : 1,
                                                }),
                                                option: (base, state) => ({
                                                    ...base,
                                                    backgroundColor: state.isSelected
                                                        ? '#0a500f'
                                                        : (state.isFocused && isKeyboard)
                                                            ? '#f0fdf4'
                                                            : 'white',
                                                    color: state.isSelected ? 'white' : '#334155',
                                                    cursor: 'pointer',
                                                    '&:hover': {
                                                        backgroundColor: state.isSelected ? '#0a500f' : '#f0fdf4',
                                                        color: state.isSelected ? 'white' : '#334155',
                                                    }
                                                }),
                                            }}
                                        />
                                    </td>
                                    <td style={{ padding: '8px 8px', verticalAlign: 'middle' }}>
                                        <Form.Control
                                            type="number"
                                            min="0"
                                            step="0.001"
                                            value={row.quantity}
                                            onChange={(e) => handleQtyChange(idx, e.target.value)}
                                            onBlur={() => handleQtyBlur(idx)}
                                            onKeyDown={(e) => handleQtyKeyDown(idx, e)}
                                            placeholder="0.000"
                                            style={inputStyle}
                                            className="qty-input"
                                        />
                                    </td>
                                    <td style={{ padding: '8px 8px', verticalAlign: 'middle' }}>
                                        <Form.Control
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={row.rate}
                                            onChange={(e) => handleRateChange(idx, e.target.value)}
                                            onKeyDown={(e) => handleRateKeyDown(idx, e)}
                                            placeholder="0.00"
                                            style={inputStyle}
                                            className="rate-input"
                                        />
                                    </td>
                                    <td style={{ padding: '8px 8px', verticalAlign: 'middle' }}>
                                        <div
                                            style={{
                                                background: '#f0fdf4',
                                                border: '1px solid #bbf7d0',
                                                borderRadius: '8px',
                                                padding: '6px 12px',
                                                fontWeight: 600,
                                                color: '#16a34a',
                                                fontSize: '13px',
                                                textAlign: 'right',
                                              }}
                                        >
                                            {parseFloat(row.amount || 0).toFixed(2)}
                                        </div>
                                    </td>
                                    <td style={{ padding: '8px 8px', verticalAlign: 'middle', textAlign: 'center' }}>
                                        <button
                                            type="button"
                                            className="btn-remove-item-row"
                                            onClick={() => removeRow(idx)}
                                            title="Remove row"
                                        >
                                            &times;
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                    {rows.length > 0 && (
                        <tfoot>
                            <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1' }}>
                                <td colSpan={4} style={{ padding: '12px', color: '#475569', fontWeight: 600, fontSize: '13px' }}>
                                    Total Production
                                </td>
                                <td style={{ padding: '12px', color: '#16a34a', fontWeight: 700, fontSize: '14px', textAlign: 'right' }}>
                                    {totalAmount.toFixed(2)}
                                </td>
                                <td colSpan={1} />
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {/* Add Row Button */}
            <div>
                <button type="button" className="btn-add-item-row" onClick={addRow}>
                    + Add Item Row
                </button>
            </div>

            {/* Item Detail Popup */}
            {activePopupIdx !== null && rows[activePopupIdx] && (
                <ItemDetailPopup
                    show={activePopupIdx !== null}
                    onHide={() => setActivePopupIdx(null)}
                    onConfirm={(details) => handlePopupConfirm(activePopupIdx, details)}
                    stockItem={rows[activePopupIdx]?.stock_item_obj}
                    productConfig={productConfig}
                    initialValues={
                        (rows[activePopupIdx]?.splits && rows[activePopupIdx].splits.length > 0)
                            ? rows[activePopupIdx].splits
                            : [{
                                warehouse: rows[activePopupIdx]?.warehouse,
                                batch_number: rows[activePopupIdx]?.batch_number,
                                expiry_date: rows[activePopupIdx]?.expiry_date,
                                manufacture_date: rows[activePopupIdx]?.manufacture_date,
                                quantity: rows[activePopupIdx]?.quantity,
                              }]
                    }
                    expectedTotalQuantity={parseFloat(rows[activePopupIdx]?.quantity) || 0}
                    movementType="IN"
                    isManufacturalJournal={isManufacturalJournal}
                />
            )}
        </div>
    );
};

export default ProductionComponent;
