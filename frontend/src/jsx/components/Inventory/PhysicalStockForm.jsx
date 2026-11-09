import ReactDOM from 'react-dom';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import swal from 'sweetalert';
import InventoryService from '../../../services/InventoryService';
import { useFormConfig } from '../../../hooks/useFormConfig';

const SearchableSelect = ({
    value, options = [], onChange, placeholder = 'Select...', disabled = false,
    className = '', onKeyDown, onCloseEmpty, autoOpen = true, style = {}, name,
    allowCustom = false, ...dataProps
}) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [highlightIdx, setHighlightIdx] = useState(-1);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const listRef = useRef(null);
    const justSelectedRef = useRef(false);

    // Make sure option list has the selected custom value if it isn't already present
    const adjustedOptions = [...options];
    if (value && !options.some(o => String(o.value) === String(value))) {
        adjustedOptions.push({ value: value, label: value });
    }

    const foundOpt = adjustedOptions.find(o => String(o.value) === String(value));
    const selectedLabel = foundOpt && foundOpt.label !== undefined && foundOpt.label !== null ? String(foundOpt.label) : '';

    const baseFiltered = query.trim()
        ? adjustedOptions.filter(o => {
            const labelStr = o && o.label !== undefined && o.label !== null ? String(o.label) : '';
            return labelStr.toLowerCase().includes(query.toLowerCase());
        })
        : adjustedOptions;

    // Append custom add option if query is non-empty and there's no exact match
    const exactMatch = adjustedOptions.some(o => String(o.label).toLowerCase() === query.trim().toLowerCase());
    const filtered = [...baseFiltered];
    if (allowCustom && query.trim() !== '' && !exactMatch) {
        filtered.push({
            value: query.trim(),
            label: `+ Add "${query.trim()}"`
        });
    }

    // Focus the text field whenever the dropdown opens
    useEffect(() => {
        if (open && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [open]);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
                setQuery('');
                setHighlightIdx(-1);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Position listener
    useEffect(() => {
        if (!open) return;
        const updateCoords = () => {
            if (containerRef.current) {
                const triggerEl = containerRef.current.querySelector('[data-ss-trigger]') || containerRef.current;
                const parent = containerRef.current.closest('.sof-input-box') || triggerEl;
                const rect = parent.getBoundingClientRect();
                setCoords({
                    top: rect.bottom + window.scrollY,
                    left: rect.left + window.scrollX,
                    width: rect.width
                });
            }
        };
        updateCoords();
        window.addEventListener('scroll', updateCoords, true);
        window.addEventListener('resize', updateCoords);
        return () => {
            window.removeEventListener('scroll', updateCoords, true);
            window.removeEventListener('resize', updateCoords);
        };
    }, [open]);

    // Scroll highlighted item into view
    useEffect(() => {
        if (!listRef.current || highlightIdx < 0) return;
        const items = listRef.current.querySelectorAll('[data-ss-item]');
        if (items[highlightIdx]) items[highlightIdx].scrollIntoView({ block: 'nearest' });
    }, [highlightIdx]);

    const openDropdown = useCallback(() => {
        if (disabled) return;
        const initIdx = value ? options.findIndex(o => String(o.value) === String(value)) : -1;
        setHighlightIdx(initIdx >= 0 ? initIdx : 0);
        setQuery('');

        if (!containerRef.current) {
            setOpen(true);
            setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 10);
            return;
        }

        const DROPDOWN_HEIGHT = 260;
        const triggerEl = containerRef.current.querySelector('[data-ss-trigger]') || containerRef.current;
        const measureEl = containerRef.current.closest('.sof-input-box') || triggerEl;
        const rect = measureEl.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const needsScroll = spaceBelow < DROPDOWN_HEIGHT;

        const doOpen = () => {
            if (!containerRef.current) return;
            const triggerEl = containerRef.current.querySelector('[data-ss-trigger]') || containerRef.current;
            const parent = containerRef.current.closest('.sof-input-box') || triggerEl;
            const r = parent.getBoundingClientRect();
            setCoords({
                top: r.bottom + window.scrollY,
                left: r.left + window.scrollX,
                width: r.width
            });
            setOpen(true);
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 10);
        };

        if (needsScroll) {
            const getScrollParent = (el) => {
                let node = el.parentElement;
                while (node) {
                    const style = window.getComputedStyle(node);
                    const overflow = style.overflowY;
                    if ((overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight) {
                        return node;
                    }
                    node = node.parentElement;
                }
                return window;
            };
            const scrollParent = getScrollParent(containerRef.current);
            const scrollAmount = DROPDOWN_HEIGHT - spaceBelow + 24;
            // Instant scroll (not 'smooth') — an animated scroll plus a fixed wait
            // before opening was what made this feel sluggish. Jumping straight there
            // and opening immediately removes both sources of delay.
            if (scrollParent === window) {
                window.scrollBy({ top: scrollAmount, behavior: 'auto' });
            } else {
                scrollParent.scrollBy({ top: scrollAmount, behavior: 'auto' });
            }
            doOpen();
        } else {
            doOpen();
        }
    }, [disabled, options, value]);

    const closeDropdown = useCallback((restoreFocus = true, selectedValue = undefined) => {
        setOpen(false);
        setQuery('');
        setHighlightIdx(-1);
        // Use the passed selectedValue (post-select) or fall back to the current value prop
        const effectiveValue = selectedValue !== undefined ? selectedValue : value;
        if (!effectiveValue && onCloseEmpty) {
            // Dropdown closed with no value selected — notify parent
            setTimeout(() => onCloseEmpty(), 20);
            return;
        }
        if (restoreFocus) {
            setTimeout(() => containerRef.current?.querySelector('[data-ss-trigger]')?.focus(), 10);
        }
    }, [value, onCloseEmpty]);

    const selectOption = useCallback((opt) => {
        onChange({ target: { value: opt.value } });
        justSelectedRef.current = true;
        closeDropdown(true, opt.value);
    }, [onChange, closeDropdown]);

    // Keydown on the closed trigger button
    const handleTriggerKeyDown = (e) => {
        if (disabled) return;
        if (e.key === 'Enter') {
            if (justSelectedRef.current) {
                justSelectedRef.current = false;
                // Pass Enter up to grid navigation to move focus forward
                if (onKeyDown) onKeyDown(e);
                return;
            }
            // If autoOpen is false, Enter navigates forward without opening the dropdown.
            // User can press Space or ArrowDown to open manually.
            if (!autoOpen) {
                if (onKeyDown) onKeyDown(e);
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            openDropdown();
            return;
        }
        if (e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            openDropdown();
            return;
        }
        justSelectedRef.current = false;
        // Pass ArrowLeft / ArrowRight / ArrowUp / Tab through to grid navigation
        if (onKeyDown) onKeyDown(e);
    };

    // Keydown on the search input (open state)
    const handleInputKeyDown = (e) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
            e.preventDefault();
            closeDropdown(true);
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightIdx(i => Math.min(i + 1, filtered.length - 1));
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIdx(i => Math.max(i - 1, 0));
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            const target = highlightIdx >= 0 && filtered[highlightIdx]
                ? filtered[highlightIdx]
                : filtered.length === 1 ? filtered[0] : null;
            if (target) selectOption(target);
            return;
        }
        if (e.key === 'Tab') {
            closeDropdown(false);
        }
    };

    return (
        <div
            ref={containerRef}
            style={{ position: 'relative', flex: '1', minWidth: 0, ...style }}
            {...dataProps}
        >
            {open ? (
                /* ── OPEN STATE: the field becomes a text input ── */
                <div style={{ position: 'relative', width: '100%', minWidth: 0 }}>
                    {/* Search input — inherits the same visual container styles as the closed button */}
                    <input
                        ref={inputRef}
                        type="text"
                        data-ss-trigger
                        name={name}
                        className={className}
                        value={query}
                        onChange={e => { setQuery(e.target.value); setHighlightIdx(0); }}
                        onKeyDown={handleInputKeyDown}
                        placeholder={selectedLabel || placeholder}
                        style={{
                            width: '100%', display: 'block', boxSizing: 'border-box',
                            fontFamily: 'inherit',
                            /* reset input defaults so it matches the button appearance */
                            margin: 0, outline: 'none',
                        }}
                    />
                    {ReactDOM.createPortal(
                        <div
                            ref={listRef}
                            style={{
                                position: 'absolute',
                                top: `${coords.top + 1}px`,
                                left: `${coords.left}px`,
                                zIndex: 999999,
                                width: `${coords.width}px`,
                                background: '#fff',
                                border: '1px solid #adb5bd',
                                boxShadow: '2px 4px 10px rgba(0,0,0,0.15)',
                                maxHeight: '240px',
                                overflowY: 'auto',
                                overflowX: 'hidden',
                            }}
                        >
                            {filtered.length === 0 ? (
                                <div style={{ padding: '8px 10px', color: '#94a3b8', fontSize: '0.83rem' }}>No results</div>
                            ) : filtered.map((opt, i) => {
                                const isSelected = String(opt.value) === String(value);
                                const isHigh = i === highlightIdx;
                                return (
                                    <div
                                        key={opt.value}
                                        data-ss-item
                                        onMouseDown={e => { e.preventDefault(); selectOption(opt); }}
                                        onMouseEnter={() => setHighlightIdx(i)}
                                        style={{
                                            padding: '7px 10px',
                                            cursor: 'pointer',
                                            fontSize: '0.84rem',
                                            lineHeight: '1.35',
                                            background: isHigh ? '#0d6efd' : 'transparent',
                                            color: isHigh ? '#fff' : '#212529',
                                            fontWeight: isSelected ? 600 : 400,
                                            userSelect: 'none',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                        }}
                                    >
                                        {opt.label}
                                    </div>
                                );
                            })}
                        </div>,
                        document.body
                    )}
                </div>
            ) : (
                <button
                    type="button"
                    data-ss-trigger
                    name={name}
                    className={className}
                    disabled={disabled}
                    onKeyDown={handleTriggerKeyDown}
                    onClick={openDropdown}
                    onBlur={() => { justSelectedRef.current = false; }}
                    onFocus={(e) => {
                        if (!disabled && !justSelectedRef.current && autoOpen) {
                            openDropdown();
                        }
                    }}
                    style={{
                        width: '100%', textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: '4px', overflow: 'hidden',
                        opacity: disabled ? 0.6 : 1,
                        fontFamily: 'inherit',
                    }}
                    title={selectedLabel || placeholder}
                >
                    <span style={{
                        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        color: selectedLabel ? 'inherit' : '#94a3b8',
                        fontSize: 'inherit',
                    }}>
                        {selectedLabel || placeholder}
                    </span>
                    <svg viewBox="0 0 10 6" fill="currentColor" style={{ width: '10px', height: '6px', flexShrink: 0, opacity: 0.45 }}>
                        <path d="M0 0l5 6 5-6z" />
                    </svg>
                </button>
            )}
        </div>
    );
};

const PhysicalStockForm = ({
    initialData = null,
    onClose,
    onSave,
}) => {
    const { isFieldVisible } = useFormConfig('inventory_app_physicalstock', 'PhysicalStockForm');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [voucherNo, setVoucherNo] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    const [items, setItems] = useState([{ item_id: '', quantity: 0, amount: 0, splits: [] }]);
    const [activeItemIndex, setActiveItemIndex] = useState(null);
    
    const [allItems, setAllItems] = useState([]);
    const [warehousesCache, setWarehousesCache] = useState({});
    const [batchesCache, setBatchesCache] = useState({});
    const [globalConfig, setGlobalConfig] = useState({
        maintain_warehouse: true,
        maintain_batch: true,
        maintain_manufacture_date: true,
        maintain_expiry_date: true
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch product configurations for 'PS' (Physical Stock)
                if (InventoryService.getProductConfigurations) {
                    try {
                        const resConfig = await InventoryService.getProductConfigurations();
                        const psConfig = resConfig.data.find(c => c.voucher_type_code === 'PS');
                        if (psConfig) {
                            setGlobalConfig({
                                maintain_warehouse: psConfig.maintain_warehouse ?? true,
                                maintain_batch: psConfig.maintain_batch ?? true,
                                maintain_manufacture_date: psConfig.maintain_manufacture_date ?? true,
                                maintain_expiry_date: psConfig.maintain_expiry_date ?? true
                            });
                        }
                    } catch (configErr) {
                        console.error("Error fetching product configurations", configErr);
                    }
                }

                // Fetch next voucher number
                const resNextNo = await InventoryService.getPhysicalStockNextNo();
                setVoucherNo(resNextNo.data?.next_no || 'PS-001');

                // Fetch Stock Items
                const resItems = await InventoryService.getStockItems();
                setAllItems(resItems.data || []);

                if (initialData) {
                    setVoucherNo(initialData.voucher_no || '');
                    setDate(initialData.date || '');
                    if (initialData.items && initialData.items.length > 0) {
                        const grouped = {};
                        initialData.items.forEach(i => {
                            if (!grouped[i.item]) grouped[i.item] = [];
                            grouped[i.item].push({
                                id: i.id || null,
                                warehouse_id: i.warehouse || '',
                                batch_number: i.batch_number || '',
                                manufacture_date: i.manufacture_date || '',
                                expiry_date: i.expiry_date || '',
                                quantity: i.quantity || 0,
                                amount: i.amount || 0,
                            });
                        });
                        const newItems = Object.keys(grouped).map(itemId => {
                            const splits = grouped[itemId];
                            const totalQty = splits.reduce((sum, s) => sum + (parseFloat(s.quantity) || 0), 0);
                            const totalAmt = splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
                            return {
                                item_id: itemId,
                                quantity: totalQty,
                                amount: totalAmt,
                                splits: splits
                            };
                        });
                        setItems(newItems);
                    } else {
                        setItems([{ item_id: '', quantity: 0, amount: 0, splits: [] }]);
                    }
                } else {
                    const resNextNo = await InventoryService.getPhysicalStockNextNo();
                    setVoucherNo(resNextNo.data?.next_no || 'PS-001');
                    setItems([{ item_id: '', quantity: 0, amount: 0, splits: [] }]);
                }
            } catch (err) {
                console.error("Error fetching initial data:", err);
                toast.error("Failed to load items");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [initialData]);

    const handleItemChange = async (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;

        if (field === 'item_id' && value) {
            newItems[index].splits = [];
            newItems[index].quantity = 0;
            newItems[index].amount = 0;

            setActiveItemIndex(index);

            // Prefetch warehouses and batches for the selected item
            if (!warehousesCache[value]) {
                try {
                    const resW = await InventoryService.getItemWarehouses(value);
                    setWarehousesCache(prev => ({ ...prev, [value]: resW.data || [] }));
                } catch (e) {
                    console.error("Error fetching warehouses", e);
                }
            }
            if (!batchesCache[value]) {
                try {
                    const resB = await InventoryService.getItemBatches(value);
                    setBatchesCache(prev => ({ ...prev, [value]: resB.data || [] }));
                } catch (e) {
                    console.error("Error fetching batches", e);
                }
            }
        }
        
        setItems(newItems);
    };

    const consolidateSplits = (itemIndex, isClose = false) => {
        const currentItems = [...items];
        const item = currentItems[itemIndex];
        const splits = item.splits || [];

        const hasInvalidQuantity = splits.some(s => !s.quantity || parseFloat(s.quantity) <= 0);
        if (!isClose && hasInvalidQuantity && splits.length > 0) {
            swal('Validation Error', 'Please enter a valid quantity for all godown allocation rows.', 'warning');
            return;
        }

        let totalQty = 0;
        let totalAmt = 0;
        splits.forEach(s => {
            totalQty += parseFloat(s.quantity) || 0;
            totalAmt += parseFloat(s.amount) || 0;
        });
        item.quantity = totalQty;
        item.amount = totalAmt;
        setItems(currentItems);
        setActiveItemIndex(null);

        // After the popup closes, move focus to that row's Quantity field
        setTimeout(() => {
            const quantityInput = document.getElementById(`quantity-${itemIndex}`);
            if (quantityInput) {
                quantityInput.focus();
                quantityInput.select();
            }
        }, 100);
    };

    
    const handleTableKeyDown = (e, rowIdx, colIdx) => {
        const key = e.key;
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(key)) return;

        if (document.querySelector('.swal-overlay.swal-overlay--show-modal, .swal2-container')) return;

        const itemsLength = (items || []).length;
        const deleteCol = 4;
        const editCol = 3;

        const getEl = (r, c) => {
            const container = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
            if (!container) return null;
            const selectContainer = container.querySelector('[data-ss-trigger], [data-ss-trigger]');
            return selectContainer || container.querySelector('input:not([disabled]), select:not([disabled]), button:not([disabled])') || container;
        };

        // ── Empty item field + Enter: delete this row (same behavior as Purchase Order) ──
        if (key === 'Enter' && colIdx === 0 && !items?.[rowIdx]?.item_id) {
            e.preventDefault();
            e.stopPropagation();
            if (itemsLength > 1) {
                const newItems = items.filter((_, i) => i !== rowIdx);
                setItems(newItems);
                setTimeout(() => {
                    document.querySelector('.sof-btn-save')?.focus();
                }, 100);
            } else {
                // Only one row and it's empty — warn and refocus the item search field
                swal('Required', 'At least one row must have data.', 'warning').then(() => {
                    setTimeout(() => {
                        const container = document.querySelector(`[data-row="${rowIdx}"][data-col="0"]`);
                        const el = container?.querySelector('[data-ss-trigger]') || container;
                        if (el) { el.focus(); el.click(); }
                    }, 100);
                });
            }
            return;
        }

        if (key === 'Enter') {
            e.preventDefault();
            const active = e.target;
            const tagName = active.tagName.toLowerCase();
            
            if (active.closest('[data-ss-item]')) return;

            const isSelectTrigger = tagName === 'button' && active.hasAttribute('data-ss-trigger');
            if (tagName === 'button' && !isSelectTrigger) {
                active.click();
                return;
            }
            if (colIdx === editCol) {
                active.click();
                return;
            } else if (colIdx === deleteCol) {
                if (itemsLength > 1) {
                    const newItems = items.filter((_, i) => i !== rowIdx);
                    setItems(newItems);
                    setTimeout(() => {
                        const nextRowIdx = rowIdx > 0 ? rowIdx - 1 : 0;
                        const el = getEl(nextRowIdx, deleteCol);
                        if (el) el.focus();
                    }, 100);
                }
            } else if (colIdx === 2) {
                if (rowIdx === itemsLength - 1) {
                    addItemRow();
                    setTimeout(() => { const el = getEl(rowIdx + 1, 0); if (el) el.focus(); }, 80);
                } else {
                    const el = getEl(rowIdx + 1, 0);
                    if (el) el.focus();
                }
            } else {
                const el = getEl(rowIdx, colIdx + 1);
                if (el) el.focus();
            }
        } else if (key === 'ArrowUp') {
            if (rowIdx > 0) { const el = getEl(rowIdx - 1, colIdx); if (el) el.focus(); }
        } else if (key === 'ArrowDown') {
            if (rowIdx < itemsLength - 1) { const el = getEl(rowIdx + 1, colIdx); if (el) el.focus(); }
        } else if (key === 'ArrowLeft') {
            if (colIdx > 0) { const el = getEl(rowIdx, colIdx - 1); if (el) el.focus(); }
        } else if (key === 'ArrowRight') {
            if (colIdx < deleteCol) { const el = getEl(rowIdx, colIdx + 1); if (el) el.focus(); }
        }
    };

    const handlePopupKeyDown = (e, rowIdx, colIdx) => {
        const key = e.key;
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(key)) return;

        const splitsLength = (items[activeItemIndex]?.splits || []).length;
        const deleteCol = 8;
        const plusCol = 6;
        const endOfRowCol = 7;

        const getEl = (r, c) => {
            const container = document.querySelector(`[data-prow="${r}"][data-pcol="${c}"]`);
            if (!container) return null;
            const ssTrigger = container.querySelector('[data-ss-trigger]');
            if (ssTrigger) return ssTrigger;
            let el = container.querySelector('input:not([disabled]), select:not([disabled]), button:not([disabled])');
            if (!el) return null;
            return el;
        };

        if (key === 'Enter') {
            const activeItemObj = allItems.find(i => String(i.id) === String(items[activeItemIndex]?.item_id));
            const showGodown = globalConfig.maintain_warehouse && activeItemObj?.maintain_batch;
            const showBatch = globalConfig.maintain_batch && activeItemObj?.maintain_batch;
            const showMfg = globalConfig.maintain_manufacture_date && activeItemObj?.maintain_manufacture_date;
            const showExp = globalConfig.maintain_expiry_date && activeItemObj?.maintain_expiry_date;
            const firstVisibleCol = showGodown ? 0 : showBatch ? 1 : showMfg ? 2 : showExp ? 3 : 4;

            if (colIdx === firstVisibleCol) {
                const split = items[activeItemIndex]?.splits?.[rowIdx] || {};
                const hasGodown = showGodown && split.warehouse_id;
                const hasBatch = showBatch && split.batch_number;
                const hasMfg = showMfg && split.manufacture_date;
                const hasExp = showExp && split.expiry_date;
                const hasQty = split.quantity && parseFloat(split.quantity) !== 0;
                const hasAmt = split.amount && parseFloat(split.amount) !== 0;
                
                const isGodownEmpty = showGodown && !split.warehouse_id;
                const isBatchEmpty = !showGodown && showBatch && !split.batch_number;
                const isQtyEmpty = firstVisibleCol === 4 && !hasQty;
                
                const rowHasData = hasGodown || hasBatch || hasMfg || hasExp || hasQty || hasAmt;

                if ((isGodownEmpty || isBatchEmpty || isQtyEmpty) && !rowHasData) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (splitsLength > 1) {
                        const newItems = [...items];
                        newItems[activeItemIndex].splits = newItems[activeItemIndex].splits.filter((_, i) => i !== rowIdx);
                        setItems(newItems);
                        setTimeout(() => {
                            document.querySelector('.sof-popup-done-btn')?.focus();
                        }, 100);
                    } else {
                        swal('Required', 'At least one row must have data.', 'warning').then(() => {
                            setTimeout(() => {
                                const container = document.querySelector(`[data-prow="${rowIdx}"][data-pcol="${firstVisibleCol}"]`);
                                const el = container?.querySelector('[data-ss-trigger]') || container?.querySelector('input');
                                if (el) { el.focus(); if (typeof el.click === 'function') el.click(); }
                            }, 100);
                        });
                    }
                    return;
                }
            }

            if (colIdx === 5) {
                const split = items[activeItemIndex]?.splits?.[rowIdx] || {};
                const hasGodown = showGodown && split.warehouse_id;
                const hasBatch = showBatch && split.batch_number;
                const hasMfg = showMfg && split.manufacture_date;
                const hasExp = showExp && split.expiry_date;
                const hasQty = split.quantity && parseFloat(split.quantity) !== 0;
                const hasAmt = split.amount && parseFloat(split.amount) !== 0;

                if (!hasGodown && !hasBatch && !hasMfg && !hasExp && !hasQty && !hasAmt) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (splitsLength > 1) {
                        const newItems = [...items];
                        newItems[activeItemIndex].splits = newItems[activeItemIndex].splits.filter((_, i) => i !== rowIdx);
                        setItems(newItems);
                        setTimeout(() => {
                            document.querySelector('.sof-popup-done-btn')?.focus();
                        }, 100);
                    } else {
                        swal('Required', 'At least one row must have data.', 'warning').then(() => {
                            setTimeout(() => {
                                const container = document.querySelector(`[data-prow="${rowIdx}"][data-pcol="5"]`);
                                const el = container?.querySelector('input');
                                if (el) { el.focus(); }
                            }, 100);
                        });
                    }
                    return;
                }
            }

            e.preventDefault();
            const active = e.target;
            const tagName = active.tagName.toLowerCase();
            
            const isSelectTrigger = tagName === 'button' && active.hasAttribute('data-ss-trigger');
            if (tagName === 'button' && !isSelectTrigger) {
                active.click();
                return;
            }
            if (colIdx === endOfRowCol) {
                consolidateSplits(activeItemIndex);
            } else if (colIdx === deleteCol) {
                if (splitsLength > 1) {
                    const newItems = [...items];
                    newItems[activeItemIndex].splits = newItems[activeItemIndex].splits.filter((_, i) => i !== rowIdx);
                    setItems(newItems);
                    setTimeout(() => {
                        const nextRowIdx = rowIdx > 0 ? rowIdx - 1 : 0;
                        const el = getEl(nextRowIdx, deleteCol);
                        if (el) el.focus();
                    }, 100);
                }
            } else if (colIdx === 5 || colIdx === plusCol) {
                if (rowIdx === splitsLength - 1) {
                    const newItems = [...items];
                    newItems[activeItemIndex].splits.push({ warehouse_id: '', batch_number: '', manufacture_date: '', expiry_date: '', quantity: 0, amount: 0 });
                    setItems(newItems);
                    setTimeout(() => {
                        const el = getEl(rowIdx + 1, firstVisibleCol);
                        if (el) {
                            el.focus();
                            if (el.hasAttribute('data-ss-trigger')) setTimeout(() => el.click(), 10);
                        }
                    }, 80);
                } else {
                    const el = getEl(rowIdx + 1, firstVisibleCol);
                    if (el) {
                        el.focus();
                        if (el.hasAttribute('data-ss-trigger')) setTimeout(() => el.click(), 10);
                    }
                }
            } else {
                let nextCol = colIdx + 1;
                let el = getEl(rowIdx, nextCol);
                while (!el && nextCol < 6) {
                    nextCol++;
                    el = getEl(rowIdx, nextCol);
                }
                if (el) {
                    el.focus();
                    if (el.hasAttribute('data-ss-trigger')) {
                        setTimeout(() => el.click(), 10);
                    }
                }
            }
        } else if (key === 'ArrowUp') {
            if (rowIdx > 0) {
                let el = getEl(rowIdx - 1, colIdx);
                if (el) el.focus();
            }
        } else if (key === 'ArrowDown') {
            if (rowIdx < splitsLength - 1) {
                let el = getEl(rowIdx + 1, colIdx);
                if (el) el.focus();
            }
        } else if (key === 'ArrowLeft') {
            if (colIdx > 0) {
                let nextCol = colIdx - 1;
                let el = getEl(rowIdx, nextCol);
                while (!el && nextCol > 0) {
                    nextCol--;
                    el = getEl(rowIdx, nextCol);
                }
                if (el) el.focus();
            }
        } else if (key === 'ArrowRight') {
            if (colIdx < deleteCol) {
                let nextCol = colIdx + 1;
                let el = getEl(rowIdx, nextCol);
                while (!el && nextCol < 6) {
                    nextCol++;
                    el = getEl(rowIdx, nextCol);
                }
                if (el) el.focus();
            }
        }
    };


    const addItemRow = () => {
        setItems([...items, { item_id: '', quantity: 0, amount: 0, splits: [] }]);
    };

    // ── Auto-focus + auto-open the Godown field when the splits popup opens.
    //    A click() shortly after focus() guards against the dropdown opening
    //    with stale layout coordinates right as the popup is still settling. ──
    useEffect(() => {
        if (activeItemIndex === null) return;
        const t = setTimeout(() => {
            const firstGodown = document.querySelector('[data-prow="0"][data-pcol="0"] [data-ss-trigger]');
            if (firstGodown && !firstGodown.disabled) {
                firstGodown.focus();
                setTimeout(() => firstGodown.click(), 10);
                return;
            }
            // Godown field is disabled (e.g. warehouse not maintained) — move to the
            // next enabled field in row 0, scanning columns left to right.
            for (let col = 0; col <= 5; col++) {
                const cell = document.querySelector(`[data-prow="0"][data-pcol="${col}"]`);
                if (!cell) continue;
                const el = cell.querySelector('[data-ss-trigger]:not([disabled]), input:not([disabled])');
                if (el) {
                    el.focus();
                    if (el.matches('[data-ss-trigger]')) setTimeout(() => el.click(), 10);
                    break;
                }
            }
        }, 120);
        return () => clearTimeout(t);
    }, [activeItemIndex]);


    const removeItemRow = (index) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const validItems = items.filter(i => i.item_id && Number(i.quantity) > 0);
        if (validItems.length === 0) {
            swal('Validation Error', 'Item Details and Quantity are mandatory fields. Please add valid data.', 'warning');
            return;
        }

        const payloadItems = [];
        validItems.forEach(item => {
            if (item.splits && item.splits.length > 0) {
                item.splits.forEach(split => {
                    if (Number(split.quantity) > 0) {
                        payloadItems.push({
                            id: split.id || undefined,
                            item: item.item_id,
                            warehouse: split.warehouse_id || null,
                            batch_number: split.batch_number || null,
                            manufacture_date: split.manufacture_date || null,
                            expiry_date: split.expiry_date || null,
                            quantity: Number(split.quantity),
                            amount: Number(split.amount)
                        });
                    }
                });
            } else {
                payloadItems.push({
                    item: item.item_id,
                    warehouse: null,
                    batch_number: null,
                    manufacture_date: null,
                    expiry_date: null,
                    quantity: Number(item.quantity),
                    amount: Number(item.amount)
                });
            }
        });

        const payload = {
            date,
            items: payloadItems
        };

        try {
            setSaving(true);
            if (initialData && initialData.id) {
                await InventoryService.updatePhysicalStock(initialData.id, payload);
                toast.success("Physical Stock updated successfully");
            } else {
                await InventoryService.createPhysicalStock(payload);
                toast.success("Physical Stock created successfully");
            }
            onSave();
        } catch (err) {
            console.error(err);
            toast.error(err?.response?.data?.detail || "Failed to save Physical Stock");
        } finally {
            setSaving(false);
        }
    };

    const selectedItemIds = useMemo(() => items.map(i => String(i.item_id)).filter(Boolean), [items]);



    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', border: '4px solid #e8eaf6', borderTopColor: '#0d9488', borderRadius: '50%', animation: 'sof-spin 0.8s linear infinite' }}></div>
                <p style={{ color: '#0d9488', fontWeight: '600', fontSize: '0.9rem', margin: 0 }}>Loading form data...</p>
                <style>{`@keyframes sof-spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    return (
        <div className="sof-wrap">
            <form onSubmit={handleSubmit}>

                {/* ── SECTION 1: STOCK INFO ──────────────────────────────────────────────── */}
                <div className="sof-section">
                    <div className="sof-section-head">
                        <div className="sof-section-icon" style={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                                <line x1="12" y1="22.08" x2="12" y2="12"></line>
                            </svg>
                        </div>
                        <span>Physical Stock Information</span>
                        <div className="sof-section-line"></div>
                    </div>

                    <div className="row">
                        <div className="col-lg-4 col-md-6 sof-field-group">
                            <label className="sof-label">
                                Physical Stock No.
                                <span className="sof-badge-auto">AUTO</span>
                            </label>
                            <div className="sof-input-box sof-input-locked">
                                <span className="sof-field-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                    </svg>
                                </span>
                                <input type="text" className="sof-input" placeholder="(auto-generated)" readOnly value={voucherNo || ''} />
                            </div>
                        </div>

                        {isFieldVisible('date') && (
                            <div className="col-lg-4 col-md-6 sof-field-group">
                                <label className="sof-label">Date <span className="sof-req">*</span></label>
                                <div className="sof-input-box">
                                    <span className="sof-field-icon">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                            <line x1="16" y1="2" x2="16" y2="6"></line>
                                            <line x1="8" y1="2" x2="8" y2="6"></line>
                                            <line x1="3" y1="10" x2="21" y2="10"></line>
                                        </svg>
                                    </span>
                                    <input
                                        type="date"
                                        className="sof-input"
                                        required
                                        value={date}
                                        onChange={e => setDate(e.target.value)}
                                        autoFocus
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                // Target the actual SearchableSelect trigger for row 0, col 0.
                                                // Focusing it fires the SearchableSelect's own onFocus handler,
                                                // which auto-opens the dropdown (autoOpen={true} on the item select).
                                                const firstItemCell = document.querySelector('[data-row="0"][data-col="0"] [data-ss-trigger]');
                                                if (firstItemCell) {
                                                    firstItemCell.focus();
                                                    setTimeout(() => firstItemCell.click(), 10);
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── SECTION 2: ITEMS TABLE ─────────────────────────────────────────────── */}
                    <div className="sof-section-head" style={{ marginTop: '2rem' }}>
                        <div className="sof-section-icon sof-icon-amber">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="8" y1="6" x2="21" y2="6"></line>
                                <line x1="8" y1="12" x2="21" y2="12"></line>
                                <line x1="8" y1="18" x2="21" y2="18"></line>
                                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                                <line x1="3" y1="18" x2="3.01" y2="18"></line>
                            </svg>
                        </div>
                        <span>Stock Details</span>
                        <span className="sof-items-count">{items.length} Item(s)</span>
                        <div className="sof-section-line"></div>
                    </div>

                    <div className="sof-table-wrapper">
                        <div className="sof-table-scroll">
                            <table className="sof-table sof-item-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '5%' }} className="sof-th-center">Sl.No</th>
                                        <th style={{ width: '35%' }}>Item Details</th>
                                        <th style={{ width: '20%' }} className="sof-th-right">Quantity</th>
                                        <th style={{ width: '20%' }} className="sof-th-right">Amount</th>
                                        <th style={{ width: '20%' }} className="sof-th-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((row, index) => {
                                        const availableItems = allItems.filter(i => !selectedItemIds.includes(String(i.id)) || String(i.id) === String(row.item_id));

                                        return (
                                            <tr key={index} className="sof-tr">
                                                <td className="sof-th-center">
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>{index + 1}</span>
                                                </td>
                                                <td data-row={index} data-col={0}>
                                                    <SearchableSelect
                                                        inputId={`item-${index}`}
                                                        className="sof-table-input"
                                                        style={{ fontWeight: 600, color: '#1e293b' }}
                                                        options={[{ value: '', label: 'Search and select item...' }, ...availableItems.map(item => ({ value: item.id, label: item.current_quantity !== undefined ? `${item.name} (${item.current_quantity} ${item.base_unit_name || 'units'})` : item.name }))]}
                                                        value={row.item_id}
                                                        onChange={(e) => handleItemChange(index, 'item_id', e.target.value)}
                                                        onKeyDown={(e) => handleTableKeyDown(e, index, 0)}
                                                        placeholder="Select Item"
                                                        autoOpen={true}
                                                    />
                                                </td>
                                                <td data-row={index} data-col={1}>
                                                    <input
                                                        id={`quantity-${index}`}
                                                        type="number"
                                                        className={`sof-table-input ${(row.splits && row.splits.length > 0) ? 'sof-table-input-ro' : ''}`}
                                                        style={{ textAlign: 'right', fontWeight: 600, color: '#0d9488' }}
                                                        step="0.001"
                                                        min="0"
                                                        value={row.quantity}
                                                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                                        onKeyDown={(e) => handleTableKeyDown(e, index, 1)}
                                                        readOnly={row.splits && row.splits.length > 0}
                                                        required
                                                    />
                                                </td>
                                                <td data-row={index} data-col={2}>
                                                    <input
                                                        id={`amount-${index}`}
                                                        type="number"
                                                        className={`sof-table-input ${(row.splits && row.splits.length > 0) ? 'sof-table-input-ro' : ''}`}
                                                        style={{ textAlign: 'right' }}
                                                        step="0.01"
                                                        min="0"
                                                        value={row.amount}
                                                        onChange={(e) => handleItemChange(index, 'amount', e.target.value)}
                                                        onKeyDown={(e) => handleTableKeyDown(e, index, 2)}
                                                        readOnly={row.splits && row.splits.length > 0}
                                                    />
                                                </td>
                                                <td className="sof-th-center">
                                                    <div className="d-flex justify-content-center gap-2">
                                                        <button
                                                            type="button"
                                                            className="sof-popup-btn-action"
                                                            style={{
                                                                width: '28px',
                                                                height: '28px',
                                                                borderRadius: '6px',
                                                                background: '#e0f2fe',
                                                                color: '#0284c7',
                                                                border: '1.5px solid #bae6fd',
                                                                cursor: !row.item_id ? 'not-allowed' : 'pointer',
                                                                opacity: !row.item_id ? 0.5 : 1
                                                            }}
                                                            onClick={() => setActiveItemIndex(index)}
                                                            disabled={!row.item_id}
                                                            title="Edit Godown Details"
                                                        >
                                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                            </svg>
                                                        </button>
                                                        <button
                                                            data-row={index} data-col={4} onKeyDown={(e) => handleTableKeyDown(e, index, 4)}
                                                            type="button"
                                                            className="sof-popup-btn-action sof-popup-btn-delete"
                                                            onClick={() => removeItemRow(index)}
                                                            disabled={items.length === 1}
                                                            style={{ opacity: items.length === 1 ? 0.3 : 1, cursor: items.length === 1 ? 'not-allowed' : 'pointer' }}
                                                            title="Delete Row"
                                                        >
                                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {/* <div style={{ padding: '12px 18px', background: '#fafbff', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <button type="button" className="sof-popup-btn-action sof-popup-btn-add" style={{ width: 'auto', padding: '0 14px', gap: '6px', height: '32px' }} onClick={addItemRow}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                                Add Row
                            </button>
                            
                            <div style={{ display: 'flex', gap: '30px', alignItems: 'center', paddingRight: '20px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Qty</span>
                                    <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0d9488' }}>{totalQty}</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Grand Total</span>
                                    <span style={{ font Size: '1.2rem', fontWeight: 800, color: '#1e293b' }}>{totalAmount}</span>
                                </div>
                            </div>
                        </div> */}
                    </div>

                    {/* ── ACTION BAR ─────────────────────────────────────────────── */}
                    <div className="sof-action-bar">
                        <button type="button" className="sof-btn-cancel" onClick={onClose}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="sof-btn-save"
                            disabled={saving}
                            style={{
                                background: 'linear-gradient(135deg, #0d9488, #0f766e)',
                                boxShadow: '0 4px 16px rgba(13, 148, 136, 0.35)',
                                opacity: saving ? 0.7 : 1,
                                cursor: saving ? 'not-allowed' : 'pointer'
                            }}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                                <polyline points="7 3 7 8 15 8"></polyline>
                            </svg>
                            {saving ? 'Saving...' : (initialData ? 'Update Physical Stock' : 'Save Physical Stock')}
                        </button>
                    </div>
                </div>
            </form>

            {/* SPLITS POPUP MODAL */}
            {activeItemIndex !== null && (
                <div className="sof-modal-backdrop" onClick={() => consolidateSplits(activeItemIndex, true)}>
                    <div className="sof-modal" style={{ maxWidth: '1050px', width: '95%' }} onClick={e => e.stopPropagation()}>
                        <div className="sof-modal-header d-flex align-items-center justify-content-between gap-3" style={{ background: '#ffffff', borderBottom: 'none', padding: '20px 24px 0 24px' }}>
                            <div className="d-flex align-items-center gap-3">
                                <div
                                    style={{
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 20h9" />
                                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                    </svg>
                                </div>
                                <div>
                                    <h5 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem', color: '#1e293b' }}>
                                        Godown Allocation Details
                                    </h5>
                                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', fontWeight: '500' }}>
                                        Product: {allItems.find(i => String(i.id) === String(items[activeItemIndex].item_id))?.name || '—'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="sof-modal-close"
                                onClick={() => consolidateSplits(activeItemIndex, true)}
                                style={{ border: '1px solid #cbd5e1' }}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>

                        <div style={{ padding: '0 24px' }}>
                            <div style={{ borderBottom: '1.5px solid #f1f5f9', marginTop: '12px', marginBottom: '0px' }} />
                        </div>

                        <div className="sof-modal-body" style={{ padding: '20px 24px' }}>
                            <div className="sof-table-scroll">
                                {(() => {
                                    const activeItemObj = allItems.find(i => String(i.id) === String(items[activeItemIndex].item_id));
                                    const showGodown = globalConfig.maintain_warehouse && activeItemObj?.maintain_batch;
                                    const showBatch = globalConfig.maintain_batch && activeItemObj?.maintain_batch;
                                    const showMfg = globalConfig.maintain_manufacture_date && activeItemObj?.maintain_manufacture_date;
                                    const showExp = globalConfig.maintain_expiry_date && activeItemObj?.maintain_expiry_date;

                                    return (
                                        <table className="sof-table">
                                            <thead>
                                                <tr>
                                                    {showGodown && <th style={{ minWidth: '180px' }}>Godown</th>}
                                                    {showBatch && <th style={{ minWidth: '180px' }}>Batch No</th>}
                                                    {showMfg && <th style={{ minWidth: '130px' }}>Mfg Date</th>}
                                                    {showExp && <th style={{ minWidth: '130px' }}>Expiry Date</th>}
                                                    <th className="sof-th-right" style={{ minWidth: '90px' }}>Quantity</th>
                                                    <th className="sof-th-right" style={{ minWidth: '120px' }}>Amount</th>
                                                    <th className="sof-th-center" style={{ minWidth: '110px' }}>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(items[activeItemIndex].splits || []).map((s, idx) => {
                                                    const warehouses = warehousesCache[items[activeItemIndex].item_id] || [];
                                                    const batches = batchesCache[items[activeItemIndex].item_id] || [];

                                                    return (
                                                        <tr key={idx} className="sof-tr">
                                                            {showGodown && (
                                                                <td data-prow={idx} data-pcol={0}>
                                                                    <SearchableSelect
                                                                        className="sof-table-input"
    value={s.warehouse_id || ''}
    options={[{ value: '', label: 'Select Godown...' }, ...warehouses.filter(w =>
        String(w.id) === String(s.warehouse_id) ||
        !(items[activeItemIndex].splits || []).some((row, rIdx) => rIdx !== idx && String(row.warehouse_id) === String(w.id))
    ).map(w => ({ value: String(w.id), label: w.available_quantity !== undefined ? `${w.name} (${w.available_quantity} ${activeItemObj?.base_unit_name || 'units'})` : w.name }))]}
    onChange={e => {
        const newItems = [...items];
        newItems[activeItemIndex].splits[idx].warehouse_id = e.target.value;
        setItems(newItems);
    }}
                                                                        onKeyDown={(e) => handlePopupKeyDown(e, idx, 0)}
                                                                        onCloseEmpty={() => {
                                                                            if ((items[activeItemIndex]?.splits || []).length === 1) {
                                                                                toast.warning('At least one row is required.');
                                                                                setTimeout(() => {
                                                                                    const el = document.querySelector(`[data-prow="${idx}"][data-pcol="0"] [data-ss-trigger]`);
                                                                                    if (el) { el.focus(); el.click(); }
                                                                                }, 100);
                                                                            } else {
                                                                                const newItems = [...items];
                                                                                newItems[activeItemIndex].splits = newItems[activeItemIndex].splits.filter((_, i) => i !== idx);
                                                                                setItems(newItems);
                                                                                setTimeout(() => {
                                                                                    const doneBtn = document.querySelector('.sof-popup-done-btn');
                                                                                    if (doneBtn) doneBtn.focus();
                                                                                }, 80);
                                                                            }
                                                                        }}
                                                                        placeholder="Select Godown..."
                                                                    />
                                                                </td>
                                                            )}
                                                            {showBatch && (
                                                                <td data-prow={idx} data-pcol={1}>
                                                                    <SearchableSelect
                                                                        className="sof-table-input"
                                                                        value={s.batch_number || ''}
                                                                        allowCustom={true}
                                                                        options={[
                                                                            { value: '', label: 'Select Batch...' },
                                                                            ...batches
                                                                                .filter(b => !s.warehouse_id || String(b.warehouse_id) === String(s.warehouse_id))
                                                                                .map(b => ({ value: b.batch_number, label: b.available_quantity !== undefined ? `${b.batch_number} (${b.available_quantity} ${activeItemObj?.base_unit_name || 'units'})` : b.batch_number }))
                                                                        ]}
                                                                        onChange={e => {
                                                                            const newItems = [...items];
                                                                            newItems[activeItemIndex].splits[idx].batch_number = e.target.value;
                                                                            const b = batches.find(b => b.batch_number === e.target.value && String(b.warehouse_id) === String(s.warehouse_id || ''));
                                                                            if (b) {
                                                                                newItems[activeItemIndex].splits[idx].manufacture_date = b.manufacture_date || '';
                                                                                newItems[activeItemIndex].splits[idx].expiry_date = b.expiry_date || '';
                                                                            }
                                                                            setItems(newItems);
                                                                        }}
                                                                        onKeyDown={(e) => handlePopupKeyDown(e, idx, 1)}
                                                                        placeholder="Select Batch..."
                                                                    />
                                                                </td>
                                                            )}
                                                            {showMfg && (
                                                                <td data-prow={idx} data-pcol={2}>
                                                                    <input
                                                                        onKeyDown={(e) => handlePopupKeyDown(e, idx, 2)}
                                                                        type="date"
                                                                        className="sof-table-input"
                                                                        value={s.manufacture_date || ''}
                                                                        onChange={e => {
                                                                            const newItems = [...items];
                                                                            newItems[activeItemIndex].splits[idx].manufacture_date = e.target.value;
                                                                            setItems(newItems);
                                                                        }}
                                                                    />
                                                                </td>
                                                            )}
                                                            {showExp && (
                                                                <td data-prow={idx} data-pcol={3}>
                                                                    <input
                                                                        onKeyDown={(e) => handlePopupKeyDown(e, idx, 3)}
                                                                        type="date"
                                                                        className="sof-table-input"
                                                                        value={s.expiry_date || ''}
                                                                        onChange={e => {
                                                                            const newItems = [...items];
                                                                            newItems[activeItemIndex].splits[idx].expiry_date = e.target.value;
                                                                            setItems(newItems);
                                                                        }}
                                                                    />
                                                                </td>
                                                            )}
                                                    <td data-prow={idx} data-pcol={4}>
                                                        <input
                                                            onKeyDown={(e) => handlePopupKeyDown(e, idx, 4)}
                                                            type="number"
                                                            className="sof-table-input"
                                                            style={{ textAlign: 'right' }}
                                                            value={s.quantity || ''}
                                                            onChange={e => {
                                                                const newItems = [...items];
                                                                newItems[activeItemIndex].splits[idx].quantity = e.target.value;
                                                                setItems(newItems);
                                                            }}
                                                        />
                                                    </td>
                                                    <td data-prow={idx} data-pcol={5}>
                                                        <input
                                                            onKeyDown={(e) => handlePopupKeyDown(e, idx, 5)}
                                                            type="number"
                                                            className="sof-table-input"
                                                            style={{ textAlign: 'right' }}
                                                            value={s.amount || ''}
                                                            onChange={e => {
                                                                const newItems = [...items];
                                                                newItems[activeItemIndex].splits[idx].amount = e.target.value;
                                                                setItems(newItems);
                                                            }}
                                                        />
                                                    </td>
                                                    <td style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                                                        <div className="d-flex justify-content-center align-items-center gap-2">
                                                            <button
                                                                type="button"
                                                                className="sof-popup-btn-action sof-popup-btn-add"
                                                                onClick={() => {
                                                                    const newItems = [...items];
                                                                    newItems[activeItemIndex].splits.splice(idx + 1, 0, { warehouse_id: '', batch_number: '', manufacture_date: '', expiry_date: '', quantity: 0, amount: 0 });
                                                                    setItems(newItems);
                                                                }}
                                                            >
                                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                                                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                                                </svg>
                                                            </button>
                                                            <button
                                                                data-prow={idx} data-pcol={7} onKeyDown={(e) => handlePopupKeyDown(e, idx, 7)}
                                                                type="button"
                                                                className="sof-popup-btn-action sof-popup-btn-end"
                                                                onClick={() => consolidateSplits(activeItemIndex)}
                                                            >
                                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                                                                    <polyline points="20 6 9 17 4 12"></polyline>
                                                                </svg>
                                                                End of Row
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="sof-popup-btn-action sof-popup-btn-delete"
                                                                onClick={() => {
                                                                    const newItems = [...items];
                                                                    newItems[activeItemIndex].splits.splice(idx, 1);
                                                                    if (newItems[activeItemIndex].splits.length === 0) {
                                                                        newItems[activeItemIndex].splits.push({ warehouse_id: '', batch_number: '', manufacture_date: '', expiry_date: '', quantity: 0, amount: 0 });
                                                                    }
                                                                    setItems(newItems);
                                                                }}
                                                            >
                                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                                                                    <polyline points="3 6 5 6 21 6"></polyline>
                                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {(items[activeItemIndex].splits || []).length === 0 && (() => {
                                            const newItems = [...items];
                                            newItems[activeItemIndex].splits = [{ warehouse_id: '', batch_number: '', manufacture_date: '', expiry_date: '', quantity: 0, amount: 0 }];
                                            setItems(newItems);
                                            return null;
                                        })()}
                                    </tbody>
                                </table>
                                    );
                                })()}
                            </div>
                        </div>

                        <div className="sof-modal-footer" style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 16px 16px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button type="button" className="sof-popup-btn-save sof-popup-done-btn" onClick={() => consolidateSplits(activeItemIndex)}>
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── ALL STYLES ─────────────────────────────────────────────────── */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

                .sof-input[type="date"]::-webkit-calendar-picker-indicator {
                    display: none !important;
                    -webkit-appearance: none !important;
                }

                .sof-input[type="date"]:not(.sof-input-edit-segments)::-webkit-datetime-edit-month-field:focus,
                .sof-input[type="date"]:not(.sof-input-edit-segments)::-webkit-datetime-edit-day-field:focus,
                .sof-input[type="date"]:not(.sof-input-edit-segments)::-webkit-datetime-edit-year-field:focus,
                .sof-table-input[type="date"]:not(.sof-input-edit-segments)::-webkit-datetime-edit-month-field:focus,
                .sof-table-input[type="date"]:not(.sof-input-edit-segments)::-webkit-datetime-edit-day-field:focus,
                .sof-table-input[type="date"]:not(.sof-input-edit-segments)::-webkit-datetime-edit-year-field:focus {
                    background-color: transparent !important;
                    color: inherit !important;
                }

                .sof-wrap {
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    color: #1e293b;
                }

                .sof-section {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 14px;
                    padding: 22px 24px;
                    margin-bottom: 24px;
                    box-shadow: 0 2px 12px rgba(0,0,0,0.04);
                    transition: box-shadow 0.25s ease;
                }
                .sof-section:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.07); }
                .sof-table-section { padding: 0; overflow: hidden; }
                .sof-section-head {
                    display: flex; align-items: center; gap: 10px;
                    margin-bottom: 20px;
                    padding: 22px 24px 0 24px;
                }
                .sof-table-section .sof-section-head { padding: 18px 20px 14px 20px; margin-bottom: 0; border-bottom: 1px solid #f1f5f9; }
                .sof-section-icon {
                    width: 32px; height: 32px;
                    border-radius: 8px;
                    display: flex; align-items: center; justify-content: center;
                    color: #fff; flex-shrink: 0;
                }
                .sof-section-icon svg { width: 16px; height: 16px; }
                .sof-icon-teal { background: linear-gradient(135deg, #0d9488, #0f766e); }
                .sof-icon-amber { background: linear-gradient(135deg, #f59e0b, #d97706); }
                .sof-section-head > span {
                    font-size: 0.95rem; font-weight: 700;
                    color: #1e293b; white-space: nowrap;
                }
                .sof-section-line {
                    flex: 1; height: 1px;
                    background: linear-gradient(to right, #e2e8f0, transparent);
                }

                .sof-field-group { margin-bottom: 16px; }
                .sof-label {
                    display: flex; align-items: center; gap: 6px;
                    font-size: 0.7rem; font-weight: 700;
                    color: #64748b;
                    text-transform: uppercase; letter-spacing: 0.06em;
                    margin-bottom: 7px;
                }
                .sof-req { color: #ef4444; font-weight: 900; }
                .sof-badge-auto {
                    font-size: 0.6rem; font-weight: 700;
                    background: #ccfbf1; color: #0f766e;
                    padding: 1px 6px; border-radius: 20px;
                    letter-spacing: 0.04em;
                }
                .sof-input-box {
                    display: flex; align-items: center;
                    background: #f8fafc;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 10px;
                    transition: all 0.2s ease;
                    position: relative;
                }
                .sof-input-box:focus-within {
                    background: #fff;
                    border-color: #0d9488;
                    box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.12);
                }
                .sof-input-locked { background: #f1f5f9; }
                .sof-input-locked:focus-within { border-color: #e2e8f0; box-shadow: none; }
                .sof-field-icon {
                    padding: 0 12px;
                    color: #94a3b8; flex-shrink: 0;
                }
                .sof-field-icon svg { width: 16px; height: 16px; display: block; }
                .sof-input {
                    flex: 1;
                    border: none; background: transparent;
                    padding: 11px 14px;
                    font-size: 0.88rem; font-weight: 500;
                    color: #1e293b; outline: none;
                    width: 100%;
                    font-family: inherit;
                }
                .sof-field-icon + .sof-input { padding-left: 0; }
                .sof-input-locked .sof-input { color: #64748b; cursor: not-allowed; }
                .sof-textarea { resize: vertical; min-height: 80px; border-radius: 10px; border: 1.5px solid #e2e8f0; padding: 11px 14px; font-family: inherit; transition: all 0.2s ease; }
                .sof-textarea:focus { border-color: #0d9488; box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.12); outline: none; background: #fff; }
                select.sof-input { cursor: pointer; }
                button.sof-input { cursor: pointer; }
                button.sof-table-input { cursor: pointer; text-align: left; }
                
                .sof-subhead {
                    display: flex; align-items: center; gap: 8px;
                }
                .sof-subhead-icon {
                    color: #0d9488;
                    display: flex; align-items: center; justify-content: center;
                }
                .sof-subhead-icon svg { width: 16px; height: 16px; display: block; }
                .sof-subhead-title {
                    font-size: 0.72rem; font-weight: 700;
                    color: #64748b;
                    text-transform: uppercase; letter-spacing: 0.05em;
                }
                .sof-subhead-line {
                    flex: 1; height: 1.5px;
                    background: linear-gradient(to right, #e2e8f0 30%, transparent 100%);
                }

                .sof-table-scroll { overflow-x: auto; }
                .sof-table { width: 100%; border-collapse: collapse; }
                .sof-table thead tr {
                    background: linear-gradient(to right, #0f766e, #0d9488);
                }
                .sof-table th {
                    color: rgba(255,255,255,0.9);
                    font-size: 0.66rem; font-weight: 700;
                    text-transform: uppercase; letter-spacing: 0.07em;
                    padding: 13px 10px;
                    border: none; white-space: nowrap;
                }
                .sof-th-center { text-align: center; }
                .sof-th-right { text-align: right; }
                .sof-tr { transition: background-color 0.12s ease; }
                .sof-tr:nth-child(even) { background-color: #fafbff; }
                .sof-tr:hover { background-color: #f0f4ff; }
                .sof-table td { padding: 5px 6px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
                
                .sof-table-input {
                    width: 100%;
                    padding: 6px 10px;
                    font-size: 0.82rem;
                    font-weight: 500;
                    color: #1e293b;
                    border: 1px solid #cbd5e1;
                    border-radius: 6px;
                    background-color: #ffffff;
                    outline: none;
                    transition: all 0.15s ease;
                    font-family: inherit;
                }
                .sof-table-input:focus {
                    border-color: #0d9488;
                    box-shadow: 0 0 0 2px rgba(13, 148, 136, 0.1);
                    background-color: #ffffff;
                }
                .sof-table-input-ro {
                    background-color: #f8fafc;
                    color: #64748b;
                    cursor: not-allowed;
                    border-color: #cbd5e1;
                }

                .sof-receipt {
                    background: #fff;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 14px;
                    overflow: hidden;
                    height: 100%;
                    display: flex; flex-direction: column;
                    box-shadow: 0 2px 12px rgba(0,0,0,0.04);
                }
                .sof-receipt-header {
                    color: #fff;
                    padding: 14px 20px;
                    font-size: 0.88rem; font-weight: 800;
                    letter-spacing: 0.04em;
                    display: flex; align-items: center; gap: 10px;
                    text-transform: uppercase;
                }
                .sof-receipt-body { padding: 16px 20px; flex: 1; }
                .sof-receipt-row {
                    display: flex; justify-content: space-between; align-items: center;
                    padding: 8px 0; border-bottom: 1px dashed #f1f5f9;
                    font-size: 0.83rem;
                }
                .sof-receipt-row:last-child { border-bottom: none; }
                .sof-receipt-row-tax { margin-top: 6px; }
                .sof-receipt-key { color: #64748b; font-weight: 500; }
                .sof-receipt-val { font-weight: 700; color: #1e293b; font-feature-settings: "tnum"; }
                .sof-gst-row { margin-bottom: 10px; background: #f8fafc; border-radius: 10px; padding: 10px 12px; }
                .sof-gst-label { font-size: 0.65rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 7px; }
                .sof-gst-fields { display: flex; align-items: center; gap: 10px; }
                .sof-gst-select {
                    flex: 1; border: 1.5px solid #e2e8f0;
                    border-radius: 8px; padding: 7px 10px;
                    font-size: 0.8rem; font-weight: 500;
                    color: #374151; background: #fff;
                    outline: none; font-family: inherit;
                    transition: border-color 0.2s ease;
                }
                .sof-gst-select:focus { border-color: #0d9488; box-shadow: 0 0 0 2px rgba(13, 148, 136, 0.12); }
                .sof-gst-amount {
                    font-size: 0.82rem; font-weight: 700;
                    color: #0f766e; white-space: nowrap;
                    background: #ccfbf1; padding: 5px 10px;
                    border-radius: 7px; min-width: 70px; text-align: right;
                    font-feature-settings: "tnum";
                }
                .sof-receipt-total {
                    padding: 18px 22px;
                    display: flex; align-items: center; justify-content: space-between;
                }
                .sof-total-label {
                    color: rgba(255,255,255,0.8);
                    font-size: 0.78rem; font-weight: 700;
                    text-transform: uppercase; letter-spacing: 0.08em;
                }
                .sof-total-value {
                    color: #fff; font-size: 1.65rem; font-weight: 800;
                    letter-spacing: -0.5px;
                    font-feature-settings: "tnum";
                }

                .sof-action-bar {
                    display: flex; justify-content: flex-end; align-items: center;
                    gap: 14px;
                    padding: 20px 0 4px 0;
                    border-top: 1.5px solid #f1f5f9;
                    margin-top: 8px;
                }
                .sof-btn-cancel {
                    display: inline-flex; align-items: center; gap: 8px;
                    background: #fff; color: #64748b;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 10px; padding: 11px 22px;
                    font-size: 0.88rem; font-weight: 700;
                    cursor: pointer; transition: all 0.2s ease;
                    font-family: inherit;
                }
                .sof-btn-cancel:hover { background: #f8fafc; color: #334155; border-color: #94a3b8; }
                .sof-btn-save {
                    display: inline-flex; align-items: center; gap: 8px;
                    color: #fff; border: none;
                    border-radius: 10px; padding: 12px 30px;
                    font-size: 0.9rem; font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    font-family: inherit;
                    position: relative;
                    animation: sof-save-pulse 2s ease-in-out infinite;
                }
                .sof-btn-save:hover {
                    transform: translateY(-2px);
                    animation-play-state: paused;
                }
                .sof-btn-save:active { transform: translateY(0); }
                .sof-btn-save:focus-visible,
                .sof-btn-save:focus {
                    outline: 3px solid #facc15;
                    outline-offset: 3px;
                    box-shadow: 0 4px 16px rgba(13, 148, 136, 0.35), 0 0 0 5px rgba(250, 204, 21, 0.35);
                }
                .sof-btn-save:disabled {
                    animation: none;
                    transform: none;
                }
                .sof-btn-save:disabled:hover {
                    transform: none;
                }
                @keyframes sof-save-pulse {
                    0%, 100% {
                        box-shadow: 0 4px 16px rgba(13, 148, 136, 0.35), 0 0 0 0 rgba(13, 148, 136, 0.5);
                    }
                    50% {
                        box-shadow: 0 4px 16px rgba(13, 148, 136, 0.35), 0 0 0 8px rgba(13, 148, 136, 0);
                    }
                }

                .sof-items-count {
                    font-size: 0.72rem; font-weight: 700;
                    background: #ccfbf1; color: #0f766e;
                    padding: 2px 9px; border-radius: 20px;
                    letter-spacing: 0.03em;
                }

                .sof-modal-backdrop {
                    position: fixed; inset: 0;
                    background: rgba(15, 15, 35, 0.55);
                    backdrop-filter: blur(3px);
                    display: flex; align-items: center; justify-content: center;
                    z-index: 9999; padding: 20px;
                    animation: sof-backdrop-in 0.18s ease;
                }
                @keyframes sof-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
                .sof-modal {
                    background: #fff;
                    border-radius: 16px;
                    width: 100%; display: flex; flex-direction: column;
                    max-height: 90vh; overflow: hidden;
                    box-shadow: 0 24px 60px rgba(15,15,35,0.22);
                    animation: sof-modal-in 0.22s cubic-bezier(0.34,1.56,0.64,1);
                }
                @keyframes sof-modal-in {
                    from { opacity: 0; transform: scale(0.94) translateY(10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .sof-modal-header {
                    display: flex; align-items: flex-start;
                    justify-content: space-between;
                    padding: 20px 22px 18px;
                    border-bottom: 1.5px solid #f1f5f9;
                }
                .sof-modal-close {
                    background: rgba(255, 255, 255, 0.08);
                    border: none;
                    border-radius: 50%;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: #64748b;
                    flex-shrink: 0;
                    transition: all 0.2s ease;
                }
                .sof-modal-close svg { width: 16px; height: 16px; display: block; }
                .sof-modal-close:hover {
                    background: rgba(0, 0, 0, 0.05);
                    color: #000000;
                    transform: rotate(90deg);
                }

                .sof-modal-body { padding: 20px 22px; overflow-y: auto; }
                .sof-modal-net {
                    display: flex; align-items: center;
                    justify-content: space-between;
                    background: linear-gradient(135deg, #ccfbf1, #ede9fe);
                    border: 1.5px solid #99f6e4;
                    border-radius: 10px; padding: 14px 18px;
                    margin-top: 4px;
                }
                .sof-modal-net-label { font-size: 0.85rem; font-weight: 700; color: #0f766e; }
                .sof-modal-net-value {
                    font-size: 1.1rem; font-weight: 800; color: #115e59;
                    font-feature-settings: "tnum";
                }
                .sof-modal-footer {
                    display: flex; justify-content: flex-end; gap: 12px;
                    padding: 16px 22px;
                    border-top: 1.5px solid #f1f5f9;
                    background: #fafbff;
                }

                .sof-popup-btn-action {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    height: 28px;
                    border-radius: 6px;
                    font-size: 0.72rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    font-family: inherit;
                    outline: none;
                }
                .sof-popup-btn-add {
                    width: 28px;
                    border: 1.5px solid #ccfbf1;
                    color: #0d9488;
                    background: #f0fdfa;
                }
                .sof-popup-btn-add:hover, .sof-popup-btn-add:focus {
                    background: #0d9488;
                    color: #fff;
                    border-color: #0d9488;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(13, 148, 136, 0.2);
                }
                .sof-popup-btn-end {
                    padding: 0 12px;
                    border: 1.5px solid #d1fae5;
                    color: #065f46;
                    background: #ecfdf5;
                    gap: 4px;
                }
                .sof-popup-btn-end:hover, .sof-popup-btn-end:focus {
                    background: #10b981;
                    color: #fff;
                    border-color: #10b981;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
                }
                .sof-popup-btn-delete {
                    width: 28px;
                    border: 1.5px solid #fee2e2;
                    color: #dc2626;
                    background: #fef2f2;
                }
                .sof-popup-btn-delete:hover, .sof-popup-btn-delete:focus {
                    background: #dc2626;
                    color: #fff;
                    border-color: #dc2626;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.2);
                }

                .sof-popup-btn-cancel {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background: #ffffff;
                    color: #64748b;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 8px 18px;
                    font-size: 0.82rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-family: inherit;
                }
                .sof-popup-btn-cancel:hover {
                    background: #f8fafc;
                    color: #334155;
                    border-color: #cbd5e1;
                }
                .sof-popup-btn-save {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background: linear-gradient(135deg, #0d9488, #0f766e);
                    color: #ffffff;
                    border: none;
                    border-radius: 8px;
                    padding: 9px 24px;
                    font-size: 0.84rem;
                    font-weight: 700;
                    cursor: pointer;
                    box-shadow: 0 4px 12px rgba(13, 148, 136, 0.25);
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    font-family: inherit;
                }
                .sof-popup-btn-save:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 6px 16px rgba(13, 148, 136, 0.35);
                    background: linear-gradient(135deg, #0f766e, #115e59);
                }
                .sof-popup-btn-save:active {
                    transform: translateY(0);
                }
                
                .sof-table-input:focus, .sof-cell-input:focus, .sof-cell-select:focus, select.sof-table-input:focus {
                    border: 2px solid #0d9488 !important;
                    box-shadow: 0 0 0 4px rgba(13, 148, 136, 0.2) !important;
                    background-color: #f0fdfa !important;
                    outline: none !important;
                }
                .d-flex button:focus, .gap-2 button:focus, .sof-modal button:focus {
                    outline: none !important;
                    box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.3) !important;
                    border-color: #0d9488 !important;
                    transform: translateY(-1px);
                }

                .sof-modal-body-view { padding: 20px 22px 16px; }
                .sof-view-net-bar {
                    background: linear-gradient(135deg, #0f766e, #0d9488);
                    border-radius: 0 0 14px 14px;
                    border: none; margin: 0;
                }
                .sof-view-net-bar .sof-modal-net-label { color: rgba(255,255,255,0.8); }
                .sof-view-net-bar .sof-modal-net-value { color: #fff; }

                .sof-modal .sof-table-scroll {
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.02);
                    overflow: hidden;
                }
                .sof-modal .sof-table {
                    background: #ffffff;
                }
                .sof-modal .sof-table thead tr {
                    background: linear-gradient(135deg, #0f766e 0%, #0d9488 100%) !important;
                }
                .sof-modal .sof-table th {
                    color: #ffffff;
                    font-size: 0.72rem;
                    font-weight: 700;
                    padding: 13px 12px;
                    border-bottom: 2px solid #0f766e;
                    letter-spacing: 0.05em;
                }
                .sof-modal .sof-table td {
                    padding: 10px 12px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .sof-modal .sof-table-input {
                    border: 1.5px solid #e2e8f0;
                    background-color: #f8fafc;
                    padding: 8px 12px;
                    border-radius: 8px;
                    font-size: 0.84rem;
                    font-weight: 500;
                    color: #1e293b;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .sof-modal .sof-table-input:hover {
                    border-color: #cbd5e1;
                    background-color: #f1f5f9;
                }
            ` }} />
        </div>
    );
};

export default PhysicalStockForm;