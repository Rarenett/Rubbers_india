import React, { useState, useEffect } from 'react';
import { Modal, Form, Table, Alert, Spinner, Row, Col } from 'react-bootstrap';
import ProductionService from '../../../services/ProductionService';
import Swal from 'sweetalert2';

const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const cleanDate = String(dateStr).split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
        if (parts[0].length === 4) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return cleanDate;
    }
    return dateStr;
};

const AdjustmentModal = ({ show, onHide, onSuccess, adjustment = null }) => {
    const isEdit = Boolean(adjustment && adjustment.id);

    const [stockItems, setStockItems] = useState([]);
    const [selectedStockItemId, setSelectedStockItemId] = useState('');
    const [selectedStockItem, setSelectedStockItem] = useState(null);
    const [availableEntries, setAvailableEntries] = useState([]);
    const [selectedEntryIds, setSelectedEntryIds] = useState([]);
    const [consumeQuantities, setConsumeQuantities] = useState({});
    const [loadingItems, setLoadingItems] = useState(false);
    const [loadingEntries, setLoadingEntries] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (show) {
            initModal();
        } else {
            resetModalState();
        }
    }, [show, adjustment]);

    const resetModalState = () => {
        setSelectedStockItemId('');
        setSelectedStockItem(null);
        setAvailableEntries([]);
        setSelectedEntryIds([]);
        setConsumeQuantities({});
        setSubmitting(false);
    };

    const initModal = async () => {
        setLoadingItems(true);
        try {
            const params = isEdit ? `?adjustment_id=${adjustment.id}` : '';
            const res = await ProductionService.getAdjustmentStockItems(params);
            let items = res.data.results || res.data || [];

            if (isEdit && adjustment) {
                const targetId = String(adjustment.stock_item);
                const exists = items.some(it => String(it.id) === targetId);
                if (!exists) {
                    items = [
                        {
                            id: adjustment.stock_item,
                            name: adjustment.stock_item_name,
                            item_code: adjustment.stock_item_code,
                            base_unit_name: adjustment.primary_unit_name,
                            alternate_unit_name: adjustment.alternate_unit_name,
                            conversion_value: 1,
                            total_available_alt_qty: 0,
                            available_entries_count: 0
                        },
                        ...items
                    ];
                }
                setStockItems(items);
                setSelectedStockItemId(targetId);
                const found = items.find(it => String(it.id) === targetId);
                setSelectedStockItem(found || null);
                await loadEntries(targetId, adjustment.id);
            } else {
                setStockItems(items);
            }
        } catch (err) {
            console.error('Failed to load stock items for adjustment:', err);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to load stock items with extra quantities.'
            });
        } finally {
            setLoadingItems(false);
        }
    };

    const loadEntries = async (itemId, adjId = '') => {
        setLoadingEntries(true);
        try {
            const res = await ProductionService.getAdjustmentAvailableEntries(itemId, adjId);
            const entries = res.data.results || res.data || [];
            setAvailableEntries(entries);

            if (isEdit && adjId) {
                // Auto-select allocated entries and prefill their quantities
                const allocated = entries.filter(e => e.is_allocated);
                const preselectedIds = allocated.map(e => e.id);
                const prefilledQuantities = {};
                allocated.forEach(e => {
                    prefilledQuantities[e.id] = Number(e.allocated_quantity || e.in_quantity);
                });
                setSelectedEntryIds(preselectedIds);
                setConsumeQuantities(prefilledQuantities);
            }
        } catch (err) {
            console.error('Failed to load available entries:', err);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to load available extra quantity entries for this item.'
            });
        } finally {
            setLoadingEntries(false);
        }
    };

    const handleStockItemChange = async (e) => {
        const itemId = e.target.value;
        setSelectedStockItemId(itemId);
        setSelectedEntryIds([]);
        setConsumeQuantities({});
        setAvailableEntries([]);

        if (!itemId) {
            setSelectedStockItem(null);
            return;
        }

        const found = stockItems.find(item => String(item.id) === String(itemId));
        setSelectedStockItem(found || null);
        await loadEntries(itemId, isEdit ? adjustment?.id : '');
    };

    const conversionVal = Number(selectedStockItem?.conversion_value) || 1;

    const handleToggleEntry = (entryId, availableQty) => {
        setSelectedEntryIds(prev => {
            if (prev.includes(entryId)) {
                // Uncheck
                const next = prev.filter(id => id !== entryId);
                setConsumeQuantities(cq => {
                    const copy = { ...cq };
                    delete copy[entryId];
                    return copy;
                });
                return next;
            } else {
                // Check: calculate smart default quantity
                const currentTotal = prev.reduce((sum, id) => {
                    const entry = availableEntries.find(e => e.id === id);
                    const q = consumeQuantities[id] !== undefined && consumeQuantities[id] !== ''
                        ? Number(consumeQuantities[id])
                        : (Number(entry?.in_quantity) || 0);
                    return sum + q;
                }, 0);

                const remToNextCase = conversionVal > 0 ? (conversionVal - (currentTotal % conversionVal)) : conversionVal;
                let defaultQty = Number(availableQty);

                // If adding the full row would overshoot the next case, smartly default to what is needed to reach the exact case!
                if (remToNextCase > 0 && remToNextCase < defaultQty) {
                    defaultQty = remToNextCase;
                }

                setConsumeQuantities(cq => ({
                    ...cq,
                    [entryId]: defaultQty
                }));
                return [...prev, entryId];
            }
        });
    };

    const handleQtyChange = (entryId, value, maxAvailable) => {
        if (value === '') {
            setConsumeQuantities(prev => ({
                ...prev,
                [entryId]: ''
            }));
            return;
        }
        const num = parseFloat(value);
        const clamped = isNaN(num) ? 0 : Math.min(Math.max(0, num), maxAvailable);
        setConsumeQuantities(prev => ({
            ...prev,
            [entryId]: clamped
        }));
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedEntryIds(availableEntries.map(entry => entry.id));
            const allQty = {};
            availableEntries.forEach(entry => {
                allQty[entry.id] = Number(entry.in_quantity);
            });
            setConsumeQuantities(allQty);
        } else {
            setSelectedEntryIds([]);
            setConsumeQuantities({});
        }
    };

    // Calculate totals
    const selectedEntries = availableEntries.filter(entry => selectedEntryIds.includes(entry.id));
    const totalSelectedAltQty = selectedEntries.reduce((sum, entry) => {
        const val = consumeQuantities[entry.id];
        const qty = val !== undefined && val !== '' ? Number(val) : Number(entry.in_quantity);
        return sum + (isNaN(qty) ? 0 : qty);
    }, 0);
    const roundedTotalSelected = Math.round(totalSelectedAltQty * 100) / 100;
    const isExactMultiple = conversionVal > 0 && roundedTotalSelected > 0 && (roundedTotalSelected % conversionVal === 0);
    const casesCreated = isExactMultiple ? Math.round(roundedTotalSelected / conversionVal) : 0;
    const canCreateAdjustment = isExactMultiple && selectedEntryIds.length > 0;
    const currentCasesFloor = conversionVal > 0 ? Math.floor(roundedTotalSelected / conversionVal) : 0;
    const remainder = conversionVal > 0 ? Math.round((roundedTotalSelected % conversionVal) * 100) / 100 : 0;
    const deficitToNext = remainder > 0 ? Math.round((conversionVal - remainder) * 100) / 100 : (roundedTotalSelected === 0 ? conversionVal : 0);

    const unconsumedFromSelected = selectedEntries.reduce((sum, entry) => {
        const fullQty = Number(entry.in_quantity) || 0;
        const usedQty = Number(consumeQuantities[entry.id] !== undefined && consumeQuantities[entry.id] !== '' ? consumeQuantities[entry.id] : fullQty) || 0;
        return sum + Math.max(0, fullQty - usedQty);
    }, 0);
    const roundedUnconsumed = Math.round(unconsumedFromSelected * 100) / 100;

    const handleSubmit = async () => {
        if (isEdit && adjustment?.has_rnd_entry) {
            Swal.fire({
                icon: 'error',
                title: 'Action Not Allowed',
                text: 'This adjustment entry cannot be edited because an R&D entry has already been saved for it.'
            });
            return;
        }

        if (!canCreateAdjustment) return;

        const primaryUnit = selectedStockItem?.base_unit_name || 'Case';
        const altUnit = selectedStockItem?.alternate_unit_name || 'Nos';

        const result = await Swal.fire({
            title: isEdit ? 'Confirm Update Adjustment' : 'Confirm Adjustment',
            html: `You are about to adjust exactly <b>${roundedTotalSelected} ${altUnit}</b> into <b>${casesCreated} ${primaryUnit}${casesCreated > 1 ? 's' : ''}</b>.<br/>` +
                  (roundedUnconsumed > 0 ? `<div class="mt-2 text-info small">Note: <b>${roundedUnconsumed} ${altUnit}</b> remaining unconsumed from selected entries will stay available in balance for future adjustments.</div><br/>` : '') +
                  (isEdit
                    ? `This will update Post Production Adjustment #${adjustment.id} with <b>manufactured quantity = ${casesCreated}</b>.`
                    : `This will create a new Post Production entry with <b>manufactured quantity = ${casesCreated}</b>.`),
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: isEdit ? 'Update' : 'Save',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#0a500f',
            cancelButtonColor: '#d33'
        });

        if (!result.isConfirmed) return;

        setSubmitting(true);
        try {
            const entriesPayload = selectedEntries.map(entry => {
                const val = consumeQuantities[entry.id];
                const q = val !== undefined && val !== '' ? Number(val) : Number(entry.in_quantity);
                return {
                    id: entry.id,
                    consume_quantity: q
                };
            });

            if (isEdit) {
                await ProductionService.updateAdjustment(adjustment.id, {
                    stock_item_id: Number(selectedStockItemId),
                    entries: entriesPayload
                });

                Swal.fire({
                    icon: 'success',
                    title: 'Adjustment Updated',
                    text: `Successfully updated ${casesCreated} ${primaryUnit} adjustment!`,
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                await ProductionService.createAdjustment({
                    stock_item_id: Number(selectedStockItemId),
                    entries: entriesPayload
                });

                Swal.fire({
                    icon: 'success',
                    title: 'Adjustment Created',
                    text: `Successfully created ${casesCreated} ${primaryUnit} adjustment!`,
                    timer: 2000,
                    showConfirmButton: false
                });
            }

            if (onSuccess) onSuccess();
            onHide();
        } catch (err) {
            console.error('Failed to save adjustment:', err);
            const errorMsg = err.response?.data?.detail || `Failed to ${isEdit ? 'update' : 'create'} adjustment. Please try again.`;
            Swal.fire({
                icon: 'error',
                title: isEdit ? 'Update Failed' : 'Adjustment Failed',
                text: errorMsg
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <style>{`
                .adj-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.12) !important;
                    overflow: hidden;
                }
                .adj-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .adj-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background: var(--form-icon-color, #0a500f);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15,.2);
                }
                .adj-modal .modal-close-x {
                    border: none;
                    background: transparent;
                    font-size: 24px;
                    color: #aaa;
                    cursor: pointer;
                    line-height: 1;
                }
                .adj-modal .modal-close-x:hover {
                    color: #555;
                }
                .adj-modal .modal-body-custom {
                    padding: 24px 28px;
                }
                .adj-modal .modal-footer-custom {
                    display: flex;
                    justify-content: flex-end;
                    padding: 20px 28px 24px;
                    border-top: 1px solid #f1f5f9;
                    background: #fafbfc;
                    gap: 12px;
                }
                .adj-modal .form-label-custom {
                    font-size: 14px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 8px;
                }
                .adj-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 14px;
                    color: inherit;
                    width: 100%;
                    transition: border-color .2s, box-shadow .2s;
                }
                .adj-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15,.15);
                }
                .adj-modal .btn-close-custom {
                    background: var(--cancel-btn-color, #dc3545) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                }
                .adj-modal .btn-save-custom {
                    background: var(--save-btn-color, #0a500f) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                }
                .adj-modal .btn-save-custom:disabled {
                    opacity: 0.6 !important;
                    cursor: not-allowed !important;
                }

                .adj-qty-control {
                    display: inline-flex;
                    align-items: center;
                    background: #ffffff;
                    border: 1px solid #cbd5e1;
                    border-radius: 6px;
                    height: 26px;
                    transition: border-color .2s, box-shadow .2s;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.03);
                    overflow: hidden;
                }
                .adj-qty-control:focus-within {
                    border-color: #0a500f;
                    box-shadow: 0 0 0 2px rgba(10, 80, 15, 0.2);
                }
                .adj-qty-control.is-partial {
                    border-color: #f59e0b;
                }
                .adj-qty-control.is-partial:focus-within {
                    border-color: #f59e0b;
                    box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
                }
                .adj-qty-input {
                    width: 46px;
                    height: 24px;
                    line-height: 24px;
                    border: none !important;
                    outline: none !important;
                    padding: 0 6px !important;
                    font-size: 12px !important;
                    font-weight: 600 !important;
                    color: #1e293b !important;
                    text-align: right;
                    background: transparent !important;
                    box-shadow: none !important;
                    -moz-appearance: textfield;
                }
                .adj-qty-input::-webkit-outer-spin-button,
                .adj-qty-input::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
                .adj-qty-max-btn {
                    border: none !important;
                    border-left: 1px solid #e2e8f0 !important;
                    background: #f1f5f9;
                    color: #475569;
                    font-size: 10px !important;
                    font-weight: 700 !important;
                    letter-spacing: 0.3px;
                    padding: 0 6px !important;
                    height: 24px;
                    line-height: 24px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: background-color .15s, color .15s;
                    user-select: none;
                }
                .adj-qty-max-btn:hover {
                    background: #0a500f;
                    color: #ffffff;
                }
                .adj-qty-control.is-partial .adj-qty-max-btn:hover {
                    background: #f59e0b;
                    color: #ffffff;
                }

                /* Dark mode overrides */
                [data-theme-version="dark"] .adj-modal .modal-content {
                    background-color: #2F363E !important;
                }
                [data-theme-version="dark"] .adj-modal .modal-header-custom {
                    border-bottom-color: #3d464e !important;
                }
                [data-theme-version="dark"] .adj-modal .modal-footer-custom {
                    background-color: #24292D !important;
                    border-top-color: #3d464e !important;
                }
                [data-theme-version="dark"] .adj-modal .form-label-custom {
                    color: #a0aec0 !important;
                }
                [data-theme-version="dark"] .adj-modal .form-control-custom {
                    background-color: #24292D !important;
                    border-color: #4a5568 !important;
                    color: #fff !important;
                }
                [data-theme-version="dark"] .adj-modal .modal-title {
                    color: #fff !important;
                }
                [data-theme-version="dark"] .adj-calc-box {
                    background-color: #24292D !important;
                    border-color: #3d464e !important;
                    color: #fff !important;
                }
                [data-theme-version="dark"] .adj-table-container {
                    border-color: #3d464e !important;
                }
                [data-theme-version="dark"] .adj-qty-control {
                    background: #24292D !important;
                    border-color: #4a5568 !important;
                }
                [data-theme-version="dark"] .adj-qty-input {
                    color: #f8fafc !important;
                }
                [data-theme-version="dark"] .adj-qty-max-btn {
                    background: #2F363E !important;
                    border-left-color: #4a5568 !important;
                    color: #94a3b8 !important;
                }
                [data-theme-version="dark"] .adj-qty-max-btn:hover {
                    background: #0a500f !important;
                    color: #ffffff !important;
                }
            `}</style>

            <Modal show={show} onHide={onHide} size="lg" backdrop="static" centered dialogClassName="adj-modal">
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <i className="fa fa-cubes text-white" style={{ fontSize: '20px' }}></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px' }}>
                                {isEdit ? `Edit Production Adjustment #${adjustment.id}` : 'Create Production Adjustment'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                {isEdit
                                    ? `Modify selected extra quantity entries and quantities for Adjustment #${adjustment.id}`
                                    : 'Convert accumulated extra units into manufactured whole cases'}
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={onHide}>&times;</button>
                </div>

                <div className="modal-body-custom">
                    {isEdit && Boolean(adjustment?.has_rnd_entry) && (
                        <Alert variant="warning" className="d-flex align-items-center gap-2 mb-3">
                            <i className="fa fa-lock text-danger" style={{ fontSize: '18px' }}></i>
                            <div>
                                <strong>Cannot Edit:</strong> An R&D entry has already been saved for this adjustment entry. Modifications are locked.
                            </div>
                        </Alert>
                    )}

                    {/* Stock Item Selection */}
                    <div className="mb-3">
                        <label className="form-label-custom" htmlFor="adjustmentStockItemSelect">
                            Select Stock Item <span className="text-danger">*</span>
                        </label>
                        {loadingItems ? (
                            <div className="d-flex align-items-center text-muted py-2">
                                <Spinner animation="border" size="sm" className="me-2" />
                                Loading stock items...
                            </div>
                        ) : (
                            <Form.Select
                                id="adjustmentStockItemSelect"
                                value={selectedStockItemId}
                                onChange={handleStockItemChange}
                                className="form-control-custom"
                                disabled={isEdit}
                            >
                                <option value="">-- Choose a stock item with extra quantities --</option>
                                {stockItems.map(item => (
                                    <option key={item.id} value={item.id}>
                                        {item.name} {item.item_code ? `(${item.item_code})` : ''} — Available: {item.total_available_alt_qty} {item.alternate_unit_name || 'units'}
                                    </option>
                                ))}
                            </Form.Select>
                        )}
                        {isEdit && (
                            <div className="text-muted small mt-1">
                                <i className="fa fa-info-circle me-1"></i> Stock item is locked for existing adjustment #{adjustment.id}.
                            </div>
                        )}
                        {stockItems.length === 0 && !loadingItems && !isEdit && (
                            <div className="text-muted small mt-1">
                                No stock items currently have unadjusted extra quantities available.
                            </div>
                        )}
                    </div>

                    {/* Conversion Info Badge */}
                    {/* {selectedStockItem && (
                        <div className="alert alert-info py-2 px-3 mb-3 d-flex align-items-center justify-content-between">
                            <div className="d-flex align-items-center">
                                <i className="fa fa-info-circle me-2 text-info fs-5"></i>
                                <span>
                                    <strong>Conversion Rule:</strong> 1 {selectedStockItem.base_unit_name || 'Case'} = {selectedStockItem.conversion_value} {selectedStockItem.alternate_unit_name || 'Nos'}
                                </span>
                            </div>
                            <span className="badge badge-primary light font-w600">
                                {selectedStockItem.conversion_value} {selectedStockItem.alternate_unit_name} / {selectedStockItem.base_unit_name}
                            </span>
                        </div>
                    )} */}

                    {/* Available Extra Quantity Entries */}
                    {selectedStockItemId && (
                        <div className="mb-3">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <h6 className="font-w600 mb-0">
                                    Available Extra Quantity Entries (IN)
                                </h6>
                                {availableEntries.length > 0 && (
                                    <div className="d-flex align-items-center gap-2">
                                        <span className="badge badge-secondary light font-w500">
                                            {selectedEntryIds.length} of {availableEntries.length} selected ({roundedTotalSelected} {selectedStockItem?.alternate_unit_name || 'Nos'})
                                        </span>
                                        {isExactMultiple ? (
                                            <span className="badge badge-success light font-w600">
                                                Exact Match: {casesCreated} {selectedStockItem?.base_unit_name || 'Case'}{casesCreated > 1 ? 's' : ''}
                                            </span>
                                        ) : roundedTotalSelected > 0 ? (
                                            <span className="badge badge-warning light font-w600">
                                                {remainder > 0 ? `${remainder} extra` : 'Incomplete'}
                                            </span>
                                        ) : null}
                                    </div>
                                )}
                            </div>

                            {loadingEntries ? (
                                <div className="text-center py-4">
                                    <Spinner animation="border" variant="primary" />
                                    <div className="mt-2 text-muted">Loading entries...</div>
                                </div>
                            ) : availableEntries.length === 0 ? (
                                <Alert variant="warning" className="text-center py-3 mb-0">
                                    No unadjusted extra quantity entries found for this stock item.
                                </Alert>
                            ) : (
                                <div className="table-responsive border rounded adj-table-container" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                    <Table hover className="table-sm align-middle mb-0">
                                        <thead className="table-light sticky-top">
                                            <tr>
                                                <th style={{ width: '40px' }} className="text-center">
                                                    <Form.Check
                                                        type="checkbox"
                                                        checked={selectedEntryIds.length === availableEntries.length && availableEntries.length > 0}
                                                        onChange={handleSelectAll}
                                                    />
                                                </th>
                                                <th>Line</th>
                                                <th>Date</th>
                                                <th>Shift</th>
                                                <th className="text-end">Available</th>
                                                <th className="text-center" style={{ width: '130px' }}>Qty to Use</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {availableEntries.map(entry => {
                                                const isSelected = selectedEntryIds.includes(entry.id);
                                                const currentQty = consumeQuantities[entry.id] !== undefined ? consumeQuantities[entry.id] : entry.in_quantity;
                                                const isPartial = isSelected && Number(currentQty) < Number(entry.in_quantity);
                                                return (
                                                    <tr
                                                        key={entry.id}
                                                        onClick={() => handleToggleEntry(entry.id, entry.in_quantity)}
                                                        style={{ cursor: 'pointer' }}
                                                        className={isSelected ? 'table-active' : ''}
                                                    >
                                                        <td className="text-center" onClick={(e) => e.stopPropagation()}>
                                                            <Form.Check
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => handleToggleEntry(entry.id, entry.in_quantity)}
                                                            />
                                                        </td>
                                                        <td className="font-w500">
                                                            {entry.production_line_name || 'Line'}
                                                        </td>
                                                        <td>
                                                            {formatDate(entry.date || entry.plan_date || entry.created_at)}
                                                        </td>
                                                        <td>
                                                            <span className="badge badge-light border">
                                                                {entry.shift_name || '-'}
                                                            </span>
                                                        </td>
                                                        <td className="text-end font-w600 text-muted">
                                                            {entry.in_quantity} {entry.unit_name || selectedStockItem?.alternate_unit_name || 'Nos'}
                                                        </td>
                                                        <td className="text-center" onClick={(e) => e.stopPropagation()}>
                                                            {isSelected ? (
                                                                <div className="d-flex align-items-center justify-content-center">
                                                                    <div className={`adj-qty-control ${isPartial ? 'is-partial' : ''}`}>
                                                                        <input
                                                                            type="number"
                                                                            min="0.01"
                                                                            max={entry.in_quantity}
                                                                            step="any"
                                                                            className="adj-qty-input"
                                                                            value={currentQty}
                                                                            onChange={(e) => handleQtyChange(entry.id, e.target.value, Number(entry.in_quantity))}
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            className="adj-qty-max-btn"
                                                                            title="Use full available quantity"
                                                                            onClick={() => handleQtyChange(entry.id, entry.in_quantity, Number(entry.in_quantity))}
                                                                        >
                                                                            Max
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted small">—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </Table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Calculation & Progress Box */}
                    {selectedStockItem && availableEntries.length > 0 && (
                        <div className="border rounded p-3 adj-calc-box mb-2" style={{ backgroundColor: '#f8fafc' }}>
                            <Row className="g-2 text-center align-items-center">
                                <Col xs={4}>
                                    <div className="text-muted small">Total Extra Quantity Selected</div>
                                    <div className="fs-5 font-w700 text-dark">
                                        {roundedTotalSelected} {selectedStockItem.alternate_unit_name || 'Nos'}
                                    </div>
                                </Col>
                                <Col xs={4}>
                                    <div className="text-muted small">Required per {selectedStockItem.base_unit_name || 'Case'}</div>
                                    <div className="fs-5 font-w700 text-primary">
                                        {conversionVal} {selectedStockItem.alternate_unit_name || 'Nos'}
                                    </div>
                                </Col>
                                <Col xs={4}>
                                    <div className="text-muted small">Manufactured Whole Cases</div>
                                    <div className={`fs-5 font-w700 ${isExactMultiple ? 'text-success' : 'text-danger'}`}>
                                        {isExactMultiple ? (
                                            `${casesCreated} ${selectedStockItem.base_unit_name || 'Case'}${casesCreated > 1 ? 's' : ''}`
                                        ) : roundedTotalSelected > 0 ? (
                                            `${currentCasesFloor} Valid Cases`
                                        ) : (
                                            `0 ${selectedStockItem.base_unit_name || 'Case'}`
                                        )}
                                    </div>
                                </Col>
                            </Row>

                            <hr className="my-2" />

                            {roundedTotalSelected === 0 ? (
                                <div className="text-muted small text-center">
                                    Please check the extra quantity entries you want to adjust. Selection must total exactly {conversionVal} (or a multiple like {conversionVal * 2}) {selectedStockItem.alternate_unit_name || 'units'}.
                                </div>
                            ) : roundedTotalSelected < conversionVal ? (
                                <Alert variant="warning" className="py-2 px-3 mb-0 text-center small font-w500">
                                    <i className="fa fa-exclamation-triangle me-2"></i>
                                    Selected <strong>{roundedTotalSelected} {selectedStockItem.alternate_unit_name}</strong> is insufficient.
                                    You need exactly <strong>{deficitToNext} more {selectedStockItem.alternate_unit_name}</strong> to produce 1 {selectedStockItem.base_unit_name}.
                                </Alert>
                            ) : !isExactMultiple ? (
                                <Alert variant="danger" className="py-2 px-3 mb-0 text-center small font-w500">
                                    <i className="fa fa-times-circle me-2"></i>
                                    Quantity must be exactly the conversion value ({conversionVal * currentCasesFloor} for {currentCasesFloor} {selectedStockItem.base_unit_name || 'Case'}{currentCasesFloor > 1 ? 's' : ''}, or {conversionVal * (currentCasesFloor + 1)} for {currentCasesFloor + 1} cases).
                                    You have <strong>{remainder} extra {selectedStockItem.alternate_unit_name}</strong> (or need {deficitToNext} more).
                                    You can adjust the <strong>Qty to Use</strong> input on any selected row.
                                </Alert>
                            ) : (
                                <Alert variant="success" className="py-2 px-3 mb-0 text-center small font-w500">
                                    <i className="fa fa-check-circle me-2"></i>
                                    Ready to adjust! Exactly <strong>{roundedTotalSelected} {selectedStockItem.alternate_unit_name}</strong> selected = <strong>{casesCreated} {selectedStockItem.base_unit_name}{casesCreated > 1 ? 's' : ''}</strong> (exactly {casesCreated} × {conversionVal} {selectedStockItem.alternate_unit_name}).
                                    {roundedUnconsumed > 0 && (
                                        <span className="d-block mt-1">
                                            <strong>{roundedUnconsumed} {selectedStockItem.alternate_unit_name}</strong> unconsumed extra quantity will remain available for future adjustments.
                                        </span>
                                    )}
                                </Alert>
                            )}
                        </div>
                    )}
                </div>

                <div className="modal-footer-custom">
                    <button
                        type="button"
                        className="btn-close-custom"
                        onClick={onHide}
                        disabled={submitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn-save-custom"
                        onClick={handleSubmit}
                        disabled={!canCreateAdjustment || submitting || (isEdit && Boolean(adjustment?.has_rnd_entry))}
                    >
                        {submitting ? (
                            <>
                                <Spinner animation="border" size="sm" className="me-2" />
                                {isEdit ? 'Updating...' : 'Creating...'}
                            </>
                        ) : isExactMultiple ? (
                            `${isEdit ? 'Update' : 'Create'} Adjustment (${casesCreated} ${selectedStockItem?.base_unit_name || 'Case'}${casesCreated > 1 ? 's' : ''})`
                        ) : roundedTotalSelected === 0 ? (
                            `Select Entries to Adjust`
                        ) : roundedTotalSelected < conversionVal ? (
                            `Incomplete (${roundedTotalSelected}/${conversionVal} ${selectedStockItem?.alternate_unit_name || 'units'})`
                        ) : (
                            `Not Exact Multiple (${remainder} excess ${selectedStockItem?.alternate_unit_name || 'units'})`
                        )}
                    </button>
                </div>
            </Modal>
        </>
    );
};

export default AdjustmentModal;
