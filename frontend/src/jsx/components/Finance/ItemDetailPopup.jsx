import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import Select, { components } from 'react-select';
import CreatableSelect from 'react-select/creatable';
import InventoryService from '../../../services/InventoryService';

const CustomOption = (props) => {
    const { onMouseMove, onMouseOver, ...otherInnerProps } = props.innerProps;
    return (
        <components.Option {...props} innerProps={otherInnerProps} />
    );
};

/**
 * ItemDetailPopup
 *
 * Appears when a stock item is selected in a journal line.
 * Displays a table where the user can enter multiple rows of details (splits).
 *
 * Fields shown depend on:
 *   - The stock item's own maintain_* flags
 *   - The ProductConfiguration flags for the Stock Journal voucher type
 *
 * Props:
 *   show              - boolean
 *   onHide            - () => void
 *   onConfirm         - (splits: Array) => void
 *   stockItem         - the full stock item object (with maintain_batch, etc.)
 *   productConfig     - ProductConfiguration object for Stock Journal (may be null)
 *   initialValues     - pre-filled values when editing (Array of splits)
 */

const EMPTY_ROW = () => ({
    _id: Date.now() + Math.random(),
    warehouse: '',
    batch_number: '',
    expiry_date: '',
    manufacture_date: '',
    quantity: '',
});

const ItemDetailPopup = ({
    show,
    onHide,
    onConfirm,
    stockItem,
    productConfig,
    initialValues = [],
    expectedTotalQuantity = 0,
    movementType = 'IN',
    isManufacturalJournal = false,
}) => {
    // Note: batch select always uses CreatableSelect (defined per-row below)

    const [warehouses, setWarehouses] = useState([]);
    const [availableBatches, setAvailableBatches] = useState([]);
    const [rows, setRows] = useState([EMPTY_ROW()]);
    const firstWhSelectRef = useRef(null);
    const [isKeyboard, setIsKeyboard] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [hasAutofocused, setHasAutofocused] = useState(false);

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

    // Compute which fields to show
    const showWarehouse = productConfig?.maintain_warehouse === true;
    const showBatch =
        (stockItem?.maintain_batch === true || isManufacturalJournal) &&
        productConfig?.maintain_batch === true;
    const showExpiry =
        (stockItem?.maintain_expiry_date === true || isManufacturalJournal) &&
        productConfig?.maintain_expiry_date === true;
    const showManufacture =
        (stockItem?.maintain_manufacture_date === true || isManufacturalJournal) &&
        productConfig?.maintain_manufacture_date === true;

    const noFieldsToShow = !showWarehouse && !showBatch && !showExpiry && !showManufacture;

    useEffect(() => {
        if (show && stockItem) {
            // Populate rows first
            if (Array.isArray(initialValues) && initialValues.length > 0) {
                setRows(
                    initialValues.map(v => ({
                        _id: Date.now() + Math.random(),
                        warehouse: v.warehouse || '',
                        batch_number: v.batch_number || '',
                        expiry_date: v.expiry_date || '',
                        manufacture_date: v.manufacture_date || '',
                        quantity: v.quantity !== undefined ? String(v.quantity) : '',
                    }))
                );
            } else {
                setRows([EMPTY_ROW()]);
            }

            // Load warehouses and batches asynchronously
            setIsLoading(true);
            Promise.all([
                loadWarehouses(stockItem.id),
                loadBatches(stockItem.id)
            ]).finally(() => {
                setIsLoading(false);
            });
        }
    }, [show, stockItem]);

    const loadWarehouses = async (itemId) => {
        try {
            // For IN movements (Production), show ALL active warehouses.
            // For OUT movements (Consumption), show only warehouses with stock.
            const res = movementType === 'IN'
                ? await InventoryService.getItemAllWarehouses(itemId)
                : await InventoryService.getItemWarehouses(itemId);
            setWarehouses(Array.isArray(res.data) ? res.data : []);
        } catch {
            setWarehouses([]);
        }
    };

    const loadBatches = async (itemId) => {
        try {
            const res = await InventoryService.getItemBatches(itemId);
            setAvailableBatches(Array.isArray(res.data) ? res.data : []);
        } catch {
            setAvailableBatches([]);
        }
    };

    const updateRow = (idx, field, value) => {
        setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
    };

    const addRow = () => {
        setRows(prev => [...prev, EMPTY_ROW()]);
    };

    const removeRow = (idx) => {
        if (rows.length === 1) return;
        setRows(prev => prev.filter((_, i) => i !== idx));
    };

    const totalQuantity = rows.reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);
    const isTotalValid = expectedTotalQuantity > 0 ? (Math.abs(totalQuantity - expectedTotalQuantity) < 0.001) : true;

    const getBatchError = () => {
        if (movementType !== 'OUT' || !showBatch) return null;
        const batchTotals = {};
        rows.forEach(r => {
            if (r.batch_number) {
                const wId = showWarehouse ? (r.warehouse || 'null') : 'null';
                // Use a separator that won't conflict with batch names
                const key = `${wId}|||${r.batch_number}`;
                batchTotals[key] = (batchTotals[key] || 0) + (parseFloat(r.quantity) || 0);
            }
        });

        for (const key of Object.keys(batchTotals)) {
            const sepIdx = key.indexOf('|||');
            const wId = key.slice(0, sepIdx);
            const bNum = key.slice(sepIdx + 3);
            // Match batches for this batch_number — also include null-warehouse entries
            const matchedBatches = availableBatches.filter(
                b => b.batch_number === bNum &&
                    (!showWarehouse || b.warehouse_id == null || String(b.warehouse_id) === wId)
            );
            const avail = matchedBatches.reduce((sum, b) => sum + Math.max(0, b.available_quantity ?? 0), 0);
            if (matchedBatches.length > 0 && batchTotals[key] > avail) {
                return `Total quantity for batch ${bNum} (${batchTotals[key]}) exceeds available stock (${avail}).`;
            }
        }
        return null;
    };

    const getWarehouseError = () => {
        if (!isManufacturalJournal || movementType !== 'OUT' || !showWarehouse) return null;
        const warehouseTotals = {};
        rows.forEach(r => {
            if (r.warehouse) {
                warehouseTotals[r.warehouse] = (warehouseTotals[r.warehouse] || 0) + (parseFloat(r.quantity) || 0);
            }
        });

        for (const wId of Object.keys(warehouseTotals)) {
            const wh = warehouses.find(w => String(w.id) === String(wId));
            const avail = wh ? Math.max(0, wh.available_quantity ?? 0) : 0;
            if (warehouseTotals[wId] > avail) {
                return `Total quantity for warehouse ${wh?.name || wId} (${warehouseTotals[wId]}) exceeds available stock (${avail}).`;
            }
        }
        return null;
    };
    
    const batchError = getBatchError();
    const warehouseError = getWarehouseError();
    const isValid = isTotalValid && !batchError && !warehouseError;

    const validateAndConfirm = (rowsToConfirm) => {
        // Validation
        for (let i = 0; i < rowsToConfirm.length; i++) {
            const r = rowsToConfirm[i];
            if (showWarehouse && !r.warehouse) {
                alert(`Row ${i + 1}: Warehouse is required.`);
                return;
            }
            if (showBatch && !r.batch_number && stockItem?.maintain_batch === true) {
                alert(`Row ${i + 1}: Batch number is required.`);
                return;
            }
            const qty = parseFloat(r.quantity);
            if (isNaN(qty) || qty <= 0) {
                alert(`Row ${i + 1}: Quantity must be greater than 0.`);
                return;
            }
        }

        // Expected total quantity validation
        const totalQty = rowsToConfirm.reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);
        if (expectedTotalQuantity > 0 && Math.abs(totalQty - expectedTotalQuantity) >= 0.001) {
            alert(`Total quantity (${totalQty}) must equal the entered quantity (${expectedTotalQuantity}).`);
            return;
        }

        // Warehouse stock check
        if (isManufacturalJournal && movementType === 'OUT' && showWarehouse) {
            const warehouseTotals = {};
            rowsToConfirm.forEach(r => {
                if (r.warehouse) {
                    warehouseTotals[r.warehouse] = (warehouseTotals[r.warehouse] || 0) + (parseFloat(r.quantity) || 0);
                }
            });

            for (const wId of Object.keys(warehouseTotals)) {
                const wh = warehouses.find(w => String(w.id) === String(wId));
                const avail = wh ? Math.max(0, wh.available_quantity ?? 0) : 0;
                if (warehouseTotals[wId] > avail) {
                    alert(`Total quantity for warehouse ${wh?.name || wId} (${warehouseTotals[wId]}) exceeds available stock (${avail}).`);
                    return;
                }
            }
        }

        // Batch error check for OUT movements
        if (movementType === 'OUT' && showBatch) {
            const batchTotals = {};
            rowsToConfirm.forEach(r => {
                if (r.batch_number) {
                    const wId = showWarehouse ? (r.warehouse || 'null') : 'null';
                    const key = `${wId}|||${r.batch_number}`;
                    batchTotals[key] = (batchTotals[key] || 0) + (parseFloat(r.quantity) || 0);
                }
            });

            for (const key of Object.keys(batchTotals)) {
                const sepIdx = key.indexOf('|||');
                const wId = key.slice(0, sepIdx);
                const bNum = key.slice(sepIdx + 3);
                // Include null-warehouse batches in available qty calculation
                const matchedBatches = availableBatches.filter(
                    b => b.batch_number === bNum &&
                        (!showWarehouse || b.warehouse_id == null || String(b.warehouse_id) === wId)
                );
                const avail = matchedBatches.reduce((sum, b) => sum + Math.max(0, b.available_quantity ?? 0), 0);
                if (matchedBatches.length > 0 && batchTotals[key] > avail) {
                    alert(`Total quantity for batch ${bNum} (${batchTotals[key]}) exceeds available stock (${avail}).`);
                    return;
                }
            }
        }

        onConfirm(
            rowsToConfirm.map(({ _id, ...rest }) => ({
                ...rest,
                warehouse: showWarehouse ? (rest.warehouse ? parseInt(rest.warehouse) : null) : null,
                batch_number: showBatch ? rest.batch_number : '',
                expiry_date: showExpiry ? rest.expiry_date || null : null,
                manufacture_date: showManufacture ? rest.manufacture_date || null : null,
                quantity: parseFloat(rest.quantity),
            }))
        );
    };

    const handleConfirm = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (!isValid) return;

        validateAndConfirm(rows);
    };

    useEffect(() => {
        if (!show) {
            setHasAutofocused(false);
            return;
        }
        if (hasAutofocused || isLoading) return;

        const t = setTimeout(() => {
            if (showWarehouse && firstWhSelectRef.current) {
                firstWhSelectRef.current.focus();
                firstWhSelectRef.current.openMenu();
                setHasAutofocused(true);
            } else {
                const firstInput = document.querySelector('.item-custom-modal .bm-input');
                if (firstInput) {
                    firstInput.focus();
                    setHasAutofocused(true);
                }
            }
        }, 100);
        return () => clearTimeout(t);
    }, [show, showWarehouse, isLoading, hasAutofocused]);

    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        
        const active = document.activeElement;
        if (!active) return;

        // If react-select dropdown is open, let react-select handle option selection natively
        const menuOpen = !!document.querySelector('.react-select__menu');
        if (menuOpen) return;

        // Stop Enter key from bubbling up to parent form
        e.stopPropagation();

        // Empty select Enter in table -> delete row and save popup
        const trEl = active.closest('tr');
        if (trEl && active.closest('.bm-input-container')) {
            const rowIdx = parseInt(trEl.getAttribute('data-row-idx'));
            const row = rows[rowIdx];
            if (row) {
                const selectContainers = Array.from(trEl.querySelectorAll('.bm-input-container'));
                const selectIndex = selectContainers.indexOf(active.closest('.bm-input-container'));
                
                let isEmptySelect = false;
                if (selectIndex === 0) {
                    if (showWarehouse && !row.warehouse) isEmptySelect = true;
                    else if (!showWarehouse && showBatch && !row.batch_number) isEmptySelect = true;
                } else if (selectIndex === 1) {
                    if (showWarehouse && showBatch && !row.batch_number) isEmptySelect = true;
                }
                
                if (isEmptySelect) {
                    e.preventDefault();
                    const remainingRows = rows.filter((_, i) => i !== rowIdx);
                    setRows(remainingRows);
                    validateAndConfirm(remainingRows);
                    return;
                }
            }
        }

        const inputs = Array.from(
            document.querySelectorAll(
                '.item-custom-modal .bm-input-container, .item-custom-modal .bm-input'
            )
        ).filter(
            el => el.offsetParent !== null && !el.disabled && el.getAttribute('readonly') === null
        );

        const currentEl = active.closest('.bm-input-container') || active;
        const index = inputs.indexOf(currentEl);

        if (index > -1) {
            e.preventDefault();
            const isQty = active.type === 'number' || active.placeholder === '0.000';
            if (isQty) {
                if (index === inputs.length - 1) {
                    // Always create a new row when Enter is pressed from the last quantity field
                    addRow();
                    setTimeout(() => {
                        const newInputs = Array.from(
                            document.querySelectorAll(
                                '.item-custom-modal .bm-input-container, .item-custom-modal .bm-input'
                            )
                        ).filter(
                            el => el.offsetParent !== null && !el.disabled && el.getAttribute('readonly') === null
                        );
                        if (newInputs[inputs.length]) {
                            const nextInput = newInputs[inputs.length];
                            if (nextInput.classList.contains('bm-input-container')) {
                                nextInput.querySelector('input')?.focus();
                            } else {
                                nextInput.focus();
                            }
                        }
                    }, 80);
                } else {
                    const next = inputs[index + 1];
                    if (next.classList.contains('bm-input-container')) {
                        next.querySelector('input')?.focus();
                    } else {
                        next.focus();
                    }
                }
            } else {
                if (index < inputs.length - 1) {
                    const next = inputs[index + 1];
                    if (next.classList.contains('bm-input-container')) {
                        next.querySelector('input')?.focus();
                    } else {
                        next.focus();
                    }
                }
            }
        }
    };


    if (!stockItem) return null;

    // Calculate dynamic modal size — always at least 'lg' when warehouse or batch are shown
    let modalSize = "md";
    let activeColsCount = 1; // Quantity is always active
    if (showWarehouse) activeColsCount++;
    if (showBatch) activeColsCount++;
    if (showExpiry) activeColsCount++;
    if (showManufacture) activeColsCount++;

    if (activeColsCount >= 2) {
        modalSize = "lg";   // warehouse + quantity already needs lg
    }
    if (activeColsCount >= 4) {
        modalSize = "xl";
    }

    return (
        <>
            <style>{`
                .item-custom-modal .modal-dialog {
                    min-width: min(680px, 95vw);
                }
                .item-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .item-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                    background: #fff;
                }
                .item-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #2ece8a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
                }
                .item-custom-modal .modal-close-x {
                    border: none;
                    background: transparent;
                    font-size: 24px;
                    color: #aaa;
                    cursor: pointer;
                    transition: color 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 4px;
                    line-height: 1;
                }
                .item-custom-modal .modal-close-x:hover {
                    color: #555;
                }
                .item-custom-modal .modal-body-custom {
                    padding: 24px 28px;
                    max-height: 65vh;
                    overflow-y: auto;
                }
                .item-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .item-custom-modal .bm-input {
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                    padding: 7px 10px;
                    font-size: 13px;
                    color: #334155;
                    background: #fff;
                    width: 100%;
                    height: 36px;
                    transition: border-color 0.2s, box-shadow 0.2s;
                }
                .item-custom-modal .bm-input:focus {
                    outline: none;
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46,206,138,0.15);
                }
                .item-custom-modal .btn-add-row {
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
                    margin-top: 12px;
                }
                .item-custom-modal .btn-add-row:hover { background: #f0fdf4; }
                .item-custom-modal .btn-remove-row {
                    background: none;
                    border: none;
                    color: #ef4444;
                    font-size: 16px;
                    cursor: pointer;
                    padding: 4px 6px;
                    border-radius: 6px;
                    line-height: 1;
                }
                .item-custom-modal .btn-remove-row:hover { background: #fef2f2; }
                .item-custom-modal .btn-remove-row:disabled { opacity: 0.3; cursor: not-allowed; }
                .item-custom-modal .btn-close-custom {
                    background-color: #7A70BA !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .item-custom-modal .btn-close-custom:hover {
                    background-color: #6357a7 !important;
                }
                .item-custom-modal .btn-save-custom {
                    background-color: #2ece8a !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .item-custom-modal .btn-save-custom:hover {
                    background-color: #26b277 !important;
                }
                .item-custom-modal .popup-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 13px;
                }
                .item-custom-modal .popup-table th {
                    text-align: left;
                    padding: 8px 10px;
                    background: #f8fafc;
                    color: #64748b;
                    font-weight: 600;
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    border-bottom: 1px solid #cbd5e1;
                    white-space: nowrap;
                }
                .item-custom-modal .popup-table td {
                    padding: 8px 6px;
                    vertical-align: middle;
                    border-bottom: 1px solid #f1f5f9;
                }
            `}</style>

            <Modal
                show={show}
                onHide={onHide}
                dialogClassName="item-custom-modal"
                size={modalSize}
                centered
                backdrop="static"
            >
                {/* Header */}
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="white"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '17px', color: '#1e293b' }}>
                                Item Details
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                {stockItem.name}
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={onHide}>
                        &times;
                    </button>
                </div>

                {/* Form Body */}
                <Form onSubmit={handleConfirm} onKeyDown={handleKeyDown}>
                    <div className="modal-body-custom">
                        {noFieldsToShow ? (
                            <div
                                className="text-center py-4"
                                style={{
                                    background: '#f8fafc',
                                    borderRadius: '10px',
                                    color: '#64748b',
                                    fontSize: '13px',
                                    border: '1px dashed #cbd5e1',
                                }}
                            >
                                No additional tracking configurations required for this item.
                            </div>
                        ) : (
                            <div>
                                <div className="table-responsive" style={{ borderRadius: '10px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
                                    <table className="popup-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '40px' }}>#</th>
                                                {showWarehouse && <th style={{ minWidth: '180px', width: '34%' }}>Warehouse <span className="text-danger">*</span></th>}
                                                {showBatch && <th style={{ minWidth: '180px', width: '24%' }}>Batch Number{stockItem?.maintain_batch === true && <span className="text-danger"> *</span>}</th>}
                                                {showManufacture && <th style={{ width: '140px' }}>Mfg. Date</th>}
                                                {showExpiry && <th style={{ width: '140px' }}>Expiry Date</th>}
                                                <th style={{ minWidth: '130px', width: '130px' }}>Quantity <span className="text-danger">*</span></th>
                                                <th style={{ width: '40px' }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map((row, idx) => {
                                                // Show batches that belong to the selected warehouse,
                                                // OR batches with no warehouse assigned (warehouse_id=null/undefined)
                                                // so stock recorded without warehouse tracking is never hidden.
                                                const filteredBatches = availableBatches.filter(b => {
                                                    if (!showWarehouse || !row.warehouse) return true;
                                                    const bWhId = b.warehouse_id;
                                                    // include if matches selected warehouse OR has no warehouse set
                                                    return bWhId == null || String(bWhId) === String(row.warehouse);
                                                });

                                                // Deduplicate by batch_number — sum qty if same batch appears
                                                // under different warehouse_id entries (e.g. null + warehouse-specific)
                                                const mergedBatches = Object.values(
                                                    filteredBatches.reduce((acc, b) => {
                                                        const key = b.batch_number;
                                                        if (!acc[key]) {
                                                            acc[key] = { ...b };
                                                        } else {
                                                            // keep expiry/manufacture from the more specific (non-null) entry
                                                            if (b.warehouse_id != null) {
                                                                acc[key].warehouse_id = b.warehouse_id;
                                                                if (b.expiry_date) acc[key].expiry_date = b.expiry_date;
                                                                if (b.manufacture_date) acc[key].manufacture_date = b.manufacture_date;
                                                            }
                                                            acc[key].available_quantity = (acc[key].available_quantity || 0) + (b.available_quantity || 0);
                                                        }
                                                        return acc;
                                                    }, {})
                                                );

                                                const batchOptions = [
                                                    { value: '', label: '-------------', original: null },
                                                    ...mergedBatches.map(b => ({
                                                        value: b.batch_number,
                                                        label: `${b.batch_number}${b.expiry_date ? ` (Exp: ${b.expiry_date})` : ''} [Avail: ${Math.max(0, b.available_quantity ?? 0)}]`,
                                                        original: b
                                                    }))
                                                ];

                                                const rowWarehouseOptions = warehouses.map(w => {
                                                    let avail = w.available_quantity ?? 0;
                                                    if (showBatch && row.batch_number) {
                                                        // Find qty for this batch in this warehouse — also check null-warehouse entries
                                                        const matchedBatches = availableBatches.filter(
                                                            b => b.batch_number === row.batch_number &&
                                                                (b.warehouse_id == null || String(b.warehouse_id) === String(w.id))
                                                        );
                                                        avail = matchedBatches.reduce((sum, b) => sum + (b.available_quantity ?? 0), 0);
                                                    }
                                                    const displayAvail = Math.max(0, avail);
                                                    return {
                                                        value: w.id,
                                                        label: `${w.name}${isManufacturalJournal ? ` [Avail: ${displayAvail}]` : ''}`
                                                    };
                                                });
                                                const warehouseOptions = [
                                                    { value: '', label: '-------------' },
                                                    ...rowWarehouseOptions
                                                ];

                                                // Always allow typing a new batch number (CreatableSelect)
                                                const SelectComponent = CreatableSelect;

                                                return (
                                                    <tr key={row._id} data-row-idx={idx}>
                                                        <td style={{ color: '#94a3b8', fontWeight: 600 }}>{idx + 1}</td>
                                                        
                                                        {/* Warehouse select */}
                                                        {showWarehouse && (
                                                            <td>
                                                                <Select
                                                                    ref={idx === 0 ? firstWhSelectRef : null}
                                                                    className="bm-input-container"
                                                                    components={{ Option: CustomOption }}
                                                                    options={warehouseOptions}
                                                                    value={warehouseOptions.find(o => String(o.value) === String(row.warehouse || '')) || null}
                                                                    onChange={(opt) => {
                                                                        const val = opt ? opt.value : '';
                                                                        updateRow(idx, 'warehouse', val);
                                                                        if (val !== '') {
                                                                            setTimeout(() => {
                                                                                const inputs = Array.from(document.querySelectorAll('.item-custom-modal .bm-input-container, .item-custom-modal .bm-input')).filter(el => el.offsetParent !== null && !el.disabled);
                                                                                const currentEl = document.activeElement.closest('.bm-input-container') || document.activeElement;
                                                                                const curIdx = inputs.indexOf(currentEl);
                                                                                if (curIdx > -1 && curIdx < inputs.length - 1) {
                                                                                    const next = inputs[curIdx + 1];
                                                                                    if (next.classList.contains('bm-input-container')) {
                                                                                        next.querySelector('input')?.focus();
                                                                                    } else {
                                                                                        next.focus();
                                                                                    }
                                                                                }
                                                                            }, 50);
                                                                        }
                                                                    }}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            const menuOpen = !!document.querySelector('.react-select__menu');
                                                                            if (menuOpen) {
                                                                                e.stopPropagation();
                                                                            }
                                                                        }
                                                                    }}
                                                                    placeholder="— Select —"
                                                                    isClearable
                                                                    openMenuOnFocus={true}
                                                                    classNamePrefix="react-select"
                                                                    menuPortalTarget={document.body}
                                                                    styles={{
                                                                        control: (base, state) => ({
                                                                            ...base,
                                                                            minHeight: '36px',
                                                                            fontSize: '13px',
                                                                            borderRadius: '8px',
                                                                            borderColor: state.isFocused ? '#2ece8a' : '#cbd5e1',
                                                                            boxShadow: state.isFocused ? '0 0 0 3px rgba(46,206,138,0.15)' : 'none',
                                                                            '&:hover': { borderColor: '#2ece8a' },
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
                                                                                ? '#2ece8a'
                                                                                : (state.isFocused && isKeyboard)
                                                                                    ? '#f0fdf4'
                                                                                    : 'white',
                                                                            color: state.isSelected ? 'white' : '#334155',
                                                                            cursor: 'pointer',
                                                                            '&:hover': {
                                                                                backgroundColor: state.isSelected ? '#2ece8a' : '#f0fdf4',
                                                                                color: state.isSelected ? 'white' : '#334155',
                                                                            }
                                                                        }),
                                                                    }}
                                                                />
                                                            </td>
                                                        )}
 
                                                        {/* Batch number select dropdown */}
                                                        {showBatch && (
                                                            <td>
                                                                <SelectComponent
                                                                    className="bm-input-container"
                                                                    components={{ Option: CustomOption }}
                                                                    options={batchOptions}
                                                                    value={batchOptions.find(o => String(o.value) === String(row.batch_number || '')) || (row.batch_number ? { value: row.batch_number, label: row.batch_number } : null)}
                                                                    onChange={(opt) => {
                                                                        const val = opt ? opt.value : '';
                                                                        updateRow(idx, 'batch_number', val);
                                                                        if (val === '') {
                                                                            if (showManufacture) updateRow(idx, 'manufacture_date', '');
                                                                            if (showExpiry) updateRow(idx, 'expiry_date', '');
                                                                        } else {
                                                                            const matched = opt ? opt.original : null;
                                                                            if (matched) {
                                                                                if (showManufacture && matched.manufacture_date) {
                                                                                    updateRow(idx, 'manufacture_date', matched.manufacture_date);
                                                                                }
                                                                                if (showExpiry && matched.expiry_date) {
                                                                                    updateRow(idx, 'expiry_date', matched.expiry_date);
                                                                                }
                                                                                // Only auto-fill warehouse if the batch has a specific warehouse
                                                                                // (don't overwrite with null — user already selected warehouse)
                                                                                if (showWarehouse && matched.warehouse_id != null && !row.warehouse) {
                                                                                    updateRow(idx, 'warehouse', matched.warehouse_id);
                                                                                }
                                                                            }
                                                                            setTimeout(() => {
                                                                                const inputs = Array.from(document.querySelectorAll('.item-custom-modal .bm-input-container, .item-custom-modal .bm-input')).filter(el => el.offsetParent !== null && !el.disabled);
                                                                                const currentEl = document.activeElement.closest('.bm-input-container') || document.activeElement;
                                                                                const curIdx = inputs.indexOf(currentEl);
                                                                                if (curIdx > -1 && curIdx < inputs.length - 1) {
                                                                                    const next = inputs[curIdx + 1];
                                                                                    if (next.classList.contains('bm-input-container')) {
                                                                                        next.querySelector('input')?.focus();
                                                                                    } else {
                                                                                        next.focus();
                                                                                    }
                                                                                }
                                                                            }, 50);
                                                                        }
                                                                    }}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            const menuOpen = !!document.querySelector('.react-select__menu');
                                                                            if (menuOpen) {
                                                                                e.stopPropagation();
                                                                            }
                                                                        }
                                                                    }}
                                                                    placeholder="— Select Batch —"
                                                                    isClearable
                                                                    openMenuOnFocus={true}
                                                                    classNamePrefix="react-select"
                                                                    menuPortalTarget={document.body}
                                                                    styles={{
                                                                        control: (base, state) => ({
                                                                            ...base,
                                                                            minHeight: '36px',
                                                                            fontSize: '13px',
                                                                            borderRadius: '8px',
                                                                            borderColor: state.isFocused ? '#2ece8a' : '#cbd5e1',
                                                                            boxShadow: state.isFocused ? '0 0 0 3px rgba(46,206,138,0.15)' : 'none',
                                                                            '&:hover': { borderColor: '#2ece8a' },
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
                                                                                ? '#2ece8a'
                                                                                : (state.isFocused && isKeyboard)
                                                                                    ? '#f0fdf4'
                                                                                    : 'white',
                                                                            color: state.isSelected ? 'white' : '#334155',
                                                                            cursor: 'pointer',
                                                                            '&:hover': {
                                                                                backgroundColor: state.isSelected ? '#2ece8a' : '#f0fdf4',
                                                                                color: state.isSelected ? 'white' : '#334155',
                                                                            }
                                                                        }),
                                                                    }}
                                                                />
                                                            </td>
                                                        )}

                                                    {/* Manufacture Date */}
                                                    {showManufacture && (
                                                        <td>
                                                            <Form.Control
                                                                type="date"
                                                                value={row.manufacture_date}
                                                                onChange={(e) => updateRow(idx, 'manufacture_date', e.target.value)}
                                                                className="bm-input"
                                                            />
                                                        </td>
                                                    )}

                                                    {/* Expiry Date */}
                                                    {showExpiry && (
                                                        <td>
                                                            <Form.Control
                                                                type="date"
                                                                value={row.expiry_date}
                                                                onChange={(e) => updateRow(idx, 'expiry_date', e.target.value)}
                                                                className="bm-input"
                                                            />
                                                        </td>
                                                    )}

                                                    {/* Quantity */}
                                                    <td>
                                                        <Form.Control
                                                            type="number"
                                                            step="0.001"
                                                            min="0"
                                                            value={row.quantity}
                                                            onChange={(e) => updateRow(idx, 'quantity', e.target.value)}
                                                            placeholder="0.000"
                                                            className="bm-input"
                                                            style={{ textAlign: 'right' }}
                                                            required
                                                        />
                                                    </td>

                                                    {/* Delete button */}
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="btn-remove-row"
                                                            onClick={() => removeRow(idx)}
                                                            disabled={rows.length === 1}
                                                            title="Remove row"
                                                        >
                                                            &times;
                                                        </button>
                                                    </td>
                                                </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <button type="button" className="btn-add-row" onClick={addRow}>
                                    + Add Row
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="modal-footer-custom" style={{ flexDirection: 'column', gap: '10px' }}>
                        {expectedTotalQuantity > 0 && !isTotalValid && (
                            <div style={{ color: '#ef4444', fontSize: '13px', fontWeight: 500, textAlign: 'left', width: '100%' }}>
                                <i className="fas fa-exclamation-circle me-1"></i>
                                Total quantity ({totalQuantity}) must equal the entered quantity ({expectedTotalQuantity}).
                            </div>
                        )}
                        {batchError && (
                            <div style={{ color: '#ef4444', fontSize: '13px', fontWeight: 500, textAlign: 'left', width: '100%' }}>
                                <i className="fas fa-exclamation-triangle me-1"></i>
                                {batchError}
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', width: '100%' }}>
                            <Button type="button" className="btn-close-custom" onClick={onHide}>
                                Cancel
                            </Button>
                            <Button type="submit" className="btn-save-custom" disabled={!isValid}>
                                Confirm
                            </Button>
                        </div>
                    </div>
                </Form>
            </Modal>
        </>
    );
};

export default ItemDetailPopup;
