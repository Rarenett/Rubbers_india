import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { State } from 'country-state-city';
import SalesService from '../../../services/SalesService';
import InventoryService from '../../../services/InventoryService';
import { fetchPrefixConfigurations } from '../../../services/PrefixService';
import { getAccountGroups } from '../../../services/FinanceService';
import LedgerFormModal from '../Finance/LedgerFormModal';
import swal from 'sweetalert';
import CompanyDatePicker from '../Common/CompanyDatePicker';
import { useFormConfig } from '../../../hooks/useFormConfig';

/* ── helper: format default numeric values as empty strings for placeholders ── */
const cleanZeroValue = (val) => {
    if (val === undefined || val === null || val === '') return '';
    const num = parseFloat(val);
    if (isNaN(num) || num === 0) return '';
    return val;
};

/* ── helper: calculate a single item's derived values ── */
const calcItemDerived = (item, isInterState) => {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    const disPct = parseFloat(item.discount_percent) || 0;
    const gstPct = parseFloat(item.gst_percent) || 0;
    const base = qty * rate;
    const disAmt = (base * disPct) / 100;
    const net = base - disAmt;
    const totalGst = (net * gstPct) / 100;
    const cgst = isInterState ? 0 : totalGst / 2;
    const sgst = isInterState ? 0 : totalGst / 2;
    const igst = isInterState ? totalGst : 0;
    return {
        ...item,
        discount_amount: disAmt.toFixed(2),
        cgst_amount: cgst.toFixed(2),
        sgst_amount: sgst.toFixed(2),
        igst_amount: igst.toFixed(2),
        amount: net.toFixed(2),
    };
};

/* ── helper: create a blank split ── */
const createBlankSplit = (item = {}) => ({
    warehouse: item.warehouse || '',
    warehouseName: item.warehouseName || '',
    batch_number: item.batch_number || '',
    manufacture_date: item.manufacture_date || '',
    expiry_date: item.expiry_date || '',
    per: item.per || '',
    perName: item.perName || '',
    quantity: cleanZeroValue(item.quantity),
    rate: cleanZeroValue(item.rate),
    discount_percent: cleanZeroValue(item.discount_percent),
    discount_amount: item.discount_amount || '0.00',
    amount: item.amount || '0.00'
});

/* ── helper: consolidate splits for an item ── */
const consolidateSplits = (item, isInterState) => {
    const splits = item.splits || [];
    if (splits.length === 0) {
        return calcItemDerived(item, isInterState);
    }

    let totalQty = 0;
    let totalAmt = 0;
    let totalDiscountAmt = 0;

    const finalSplits = splits.map(s => {
        const qty = parseFloat(s.quantity) || 0;
        const rate = parseFloat(s.rate) || 0;
        const disc = parseFloat(s.discount_percent) || 0;
        const base = qty * rate;
        const disAmt = (base * disc) / 100;
        const net = base - disAmt;
        const gstPct = parseFloat(item.gst_percent) || 0;
        const totalGst = (net * gstPct) / 100;

        const cgst = isInterState ? 0 : totalGst / 2;
        const sgst = isInterState ? 0 : totalGst / 2;
        const igst = isInterState ? totalGst : 0;

        totalQty += qty;
        totalAmt += net;
        totalDiscountAmt += disAmt;

        return {
            ...s,
            discount_amount: disAmt.toFixed(2),
            cgst_amount: cgst.toFixed(2),
            sgst_amount: sgst.toFixed(2),
            igst_amount: igst.toFixed(2),
            amount: net.toFixed(2)
        };
    });

    const gstPct = parseFloat(item.gst_percent) || 0;
    const consolidatedGst = (totalAmt * gstPct) / 100;
    const cgst = isInterState ? 0 : consolidatedGst / 2;
    const sgst = isInterState ? 0 : consolidatedGst / 2;
    const igst = isInterState ? consolidatedGst : 0;

    return {
        ...item,
        warehouse: finalSplits[0]?.warehouse || '',
        warehouseName: finalSplits[0]?.warehouseName || '',
        quantity: totalQty.toFixed(2),
        rate: finalSplits[0]?.rate || '0.00',
        discount_percent: finalSplits[0]?.discount_percent || '0.00',
        discount_amount: totalDiscountAmt.toFixed(2),
        cgst_amount: cgst.toFixed(2),
        sgst_amount: sgst.toFixed(2),
        igst_amount: igst.toFixed(2),
        amount: totalAmt.toFixed(2),
        splits: finalSplits
    };
};

/* ── helper: open date picker on mouse click ── */
const openDatePickerOnClick = (e) => {
    try {
        e.target.showPicker();
    } catch (err) {
        // showPicker not supported
    }
};

/* ── helper: validate a date field value ── */
const validateDateValue = (value, label = 'Date') => {
    if (!value) return null;
    const parts = value.split('-');
    if (parts.length !== 3) return `${label}: Invalid date format.`;
    const year = parseInt(parts[0], 10);
    if (isNaN(year) || year < 1000 || year > 9999) {
        return `${label}: Please enter a valid 4-digit year (e.g. ${new Date().getFullYear()}).`;
    }
    return null;
};

/* ── helper: validate a date field on Enter ── */
const advanceDateSegment = (active, e) => {
    active.removeAttribute('data-seg-idx');
    if (active.value) {
        const errMsg = validateDateValue(active.value, active.getAttribute('data-label') || 'Date');
        if (errMsg) {
            e.preventDefault();
            import('sweetalert2').then(({ default: Swal }) => {
                Swal.fire({ icon: 'warning', title: 'Invalid Date', text: errMsg });
            }).catch(() => {
                alert(errMsg);
            });
            return true;
        }
    }
    return false;
};

/* ── helper: track select picker state ── */
const trackSelectOpen = (active) => {
    if (!active || active.dataset.open === 'true') return;

    try {
        active.showPicker();
    } catch (err) {
        console.error('showPicker is not supported on select in this browser:', err);
    }
    active.dataset.open = 'true';

    const clearOpen = () => {
        active.removeAttribute('data-open');
        active.removeEventListener('change', clearOpen);
        active.removeEventListener('click', clearOpen);
        active.removeEventListener('blur', clearOpen);
        active.removeEventListener('keydown', handleKeysWhileOpen);
    };

    const handleKeysWhileOpen = (evt) => {
        if (evt.key === 'Escape') {
            clearOpen();
        } else if (evt.key === 'Enter') {
            clearOpen();
        }
    };

    active.addEventListener('change', clearOpen);
    active.addEventListener('click', clearOpen);
    active.addEventListener('blur', clearOpen);
    active.addEventListener('keydown', handleKeysWhileOpen);
};

/* ── helper: handle Enter key focus navigation ── */
const handleEnterNavigation = (e) => {
    if (e.key === 'Enter') {
        const active = document.activeElement;
        if (!active) return;

        // If a sweetalert dialog is currently open, do not navigate — let swal handle Enter.
        if (document.querySelector('.swal-overlay.swal-overlay--show-modal, .swal2-container')) {
            return;
        }

        // If focus was just restored to this element after a swal dismissal, skip navigation.
        if (active.dataset.swalRestored === 'true') {
            return;
        }

        const tagName = active.tagName.toLowerCase();

        // Plain buttons (submit / action buttons) are never auto-navigated.
        // Exception: the closed SearchableSelect trigger (button[data-ss-trigger])
        // is allowed to navigate forward. The Save button keeps native submit behavior.
        const isSelectTrigger = tagName === 'button' && active.hasAttribute('data-ss-trigger');
        if (tagName === 'button' && !isSelectTrigger) {
            return;
        }
        if (active.type === 'submit') {
            return;
        }

        if (active.type === 'date' || active.type === 'datetime-local') {
            // On Enter: validate and immediately move to next field.
            // No segment cycling — one Enter press is enough.
            e.preventDefault();
            if (active.value) {
                const errMsg = validateDateValue(
                    active.value,
                    active.getAttribute('data-label') || 'Date'
                );
                if (errMsg) {
                    import('sweetalert2').then(({ default: Swal }) => {
                        Swal.fire({ icon: 'warning', title: 'Invalid Date', text: errMsg });
                    }).catch(() => alert(errMsg));
                    return;
                }
            }
            active.removeAttribute('data-seg-idx');
            // Fall through to focus next field below
        }

        if (tagName === 'select') {
            if (active.dataset.open === 'true') {
                return;
            }
        }

        // ── Mandatory field check: block Enter-navigation and show a popup
        //    if the current field is required but left empty. ──
        const isRequiredField = active.hasAttribute('required') || active.parentElement?.hasAttribute('data-required');
        if (isRequiredField) {
            const isEmptySelectTrigger = isSelectTrigger && active.getAttribute('data-empty') === 'true';
            const isEmptyPlainField = !isSelectTrigger && !active.value;
            if (isEmptySelectTrigger || isEmptyPlainField) {
                e.preventDefault();
                const label = active.getAttribute('data-label') || active.parentElement?.getAttribute('data-label') || 'This field';
                swal('Required', `${label} is mandatory. Please fill it before continuing.`, 'warning').then(() => {
                    active.focus();
                });
                return;
            }
        }

        e.preventDefault();

        const container = e.currentTarget;
        const focusables = Array.from(
            container.querySelectorAll(
                'input[name="return_no"], input:not([readonly]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button[data-ss-trigger]:not([disabled]), .sof-btn-save'
            )
        );

        const index = focusables.indexOf(active);
        if (index > -1 && index < focusables.length - 1) {
            focusables[index + 1].focus();
        }
    }
};

/* ══════════════════════════════════════════════════════════
   SEARCHABLE SELECT COMPONENT (Custom Dropdown)
   ══════════════════════════════════════════════════════════ */
const SearchableSelect = ({
    value, options = [], onChange, placeholder = 'Select...', disabled = false,
    className = '', onKeyDown, onCloseEmpty, autoOpen = true, style = {}, name,
    allowCustom = false, required = false, 'data-label': dataLabel, ...dataProps
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
                // Measure the actual trigger/input element when available (most accurate),
                // falling back to the .sof-input-box wrapper (header fields) or the
                // SearchableSelect's own container (table/popup fields).
                const trigger = containerRef.current.querySelector('[data-ss-trigger]');
                const parent = trigger || containerRef.current.closest('.sof-input-box') || containerRef.current;
                const rect = parent.getBoundingClientRect();
                setCoords({
                    top: rect.bottom + window.scrollY,
                    left: rect.left + window.scrollX,
                    width: rect.width
                });
            }
        };
        updateCoords();
        // Re-measure once the browser has finished layout/paint, in case the trigger
        // was still mid-transition (e.g. a parent modal's open animation) when first measured.
        const raf1 = requestAnimationFrame(() => requestAnimationFrame(updateCoords));
        const settleTimer = setTimeout(updateCoords, 200);
        window.addEventListener('scroll', updateCoords, true);
        window.addEventListener('resize', updateCoords);
        return () => {
            cancelAnimationFrame(raf1);
            clearTimeout(settleTimer);
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
        const measureEl = containerRef.current.closest('.sof-input-box') || containerRef.current;
        const rect = measureEl.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const needsScroll = spaceBelow < DROPDOWN_HEIGHT;

        const doOpen = () => {
            if (!containerRef.current) return;
            const parent = containerRef.current.closest('.sof-input-box') || containerRef.current;
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
        const effectiveValue = selectedValue !== undefined ? selectedValue : value;
        if (!effectiveValue && onCloseEmpty) {
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

    const handleTriggerKeyDown = (e) => {
        if (disabled) return;
        if (e.key === 'Enter') {
            if (justSelectedRef.current) {
                justSelectedRef.current = false;
                if (onKeyDown) onKeyDown(e);
                return;
            }
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
        if (onKeyDown) onKeyDown(e);
    };

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
            if (target && required && String(target.value) === '') {
                // Block selecting the blank placeholder option on a required field.
                // Close the dropdown first so its portal list doesn't render above the popup.
                closeDropdown(false);
                swal('Required', `${dataLabel || 'This field'} is mandatory. Please select a value.`, 'warning').then(() => {
                    setTimeout(() => containerRef.current?.querySelector('[data-ss-trigger]')?.focus(), 10);
                });
                return;
            }
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
            data-required={required ? 'true' : undefined}
            data-label={dataLabel}
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
                                width: 'max-content',
                                minWidth: `${coords.width}px`,
                                maxWidth: '400px',
                                background: '#fff',
                                border: '1px solid #adb5bd',
                                boxShadow: '2px 4px 10px rgba(0,0,0,0.15)',
                                maxHeight: '240px',
                                overflowY: 'auto',
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
                /* ── CLOSED STATE: looks like a native select ── */
                <button
                    type="button"
                    data-ss-trigger
                    data-empty={selectedLabel ? 'false' : 'true'}
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

/* ══════════════════════════════════════════════════════════
   ITEM ENTRY POPUP
   ══════════════════════════════════════════════════════════ */
const ItemEntryPopup = ({ item, isInterState, warehouses, stockItems, units, onSave, onClose, isEdit, productConfig }) => {
    const { maintain_warehouse, maintain_batch: configBatch, maintain_manufacture_date: configMfg, maintain_expiry_date: configExp } = productConfig || {};
    const selectedStockItem = stockItems?.find(p => String(p.id) === String(item.product));
    const maintain_batch = !!(configBatch && selectedStockItem?.maintain_batch);
    const maintain_manufacture_date = !!(configMfg && selectedStockItem?.maintain_manufacture_date);
    const maintain_expiry_date = !!(configExp && selectedStockItem?.maintain_expiry_date);

    const saveBtnRef = useRef(null);
    const [batches, setBatches] = useState([]);

    useEffect(() => {
        if (item && item.product && maintain_batch && selectedStockItem?.existing_batch_entries) {
            const uniqueBatches = Array.from(new Set(
                selectedStockItem.existing_batch_entries
                    .map(e => e.batch_number)
                    .filter(b => b)
            ));
            setBatches(uniqueBatches);
        }
    }, [item, maintain_batch, selectedStockItem]);

    useEffect(() => {
        const t = setTimeout(() => {
            const firstContainer = document.querySelector('[data-prow="0"][data-pcol="0"]');
            if (firstContainer) {
                const target = firstContainer.querySelector('[data-ss-trigger], input, select, textarea, button');
                if (target) {
                    target.focus();
                } else {
                    firstContainer.focus();
                }
            }
        }, 180);
        return () => clearTimeout(t);
    }, []);

    let dynamicMaxWidth = 670;
    dynamicMaxWidth += 140; // Per (units) column
    if (maintain_warehouse) dynamicMaxWidth += 180;
    if (maintain_batch) dynamicMaxWidth += 140;
    if (maintain_manufacture_date) dynamicMaxWidth += 150;
    if (maintain_expiry_date) dynamicMaxWidth += 150;

    const [splits, setSplits] = useState(() => {
        if (item.splits && item.splits.length > 0) {
            return item.splits.map(s => ({
                ...s,
                quantity: cleanZeroValue(s.quantity),
                rate: cleanZeroValue(s.rate),
                discount_percent: cleanZeroValue(s.discount_percent)
            }));
        }
        return [createBlankSplit(item)];
    });

    const addSplitRow = () => {
        setSplits(prev => {
            const firstRow = prev[0] || {};
            return [
                ...prev,
                {
                    warehouse: '',
                    warehouseName: '',
                    batch_number: '',
                    manufacture_date: '',
                    expiry_date: '',
                    per: firstRow.per || '',
                    perName: firstRow.perName || '',
                    quantity: '',
                    rate: '',
                    discount_percent: '',
                    discount_amount: '0.00',
                    amount: '0.00'
                }
            ];
        });
    };

    const deleteSplitRow = (idx) => {
        if (splits.length === 1) {
            swal('Warning', 'At least one row is required.', 'warning').then(() => {
                setTimeout(() => {
                    const firstInput = document.querySelector('[data-prow="0"] [data-ss-trigger], [data-prow="0"] input, [data-prow="0"] select');
                    if (firstInput) { firstInput.focus(); firstInput.click(); }
                }, 100);
            });
            return;
        }
        setSplits(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSplitChange = (idx, field, value, perColIdx) => {
        if (field === 'per' && splits.length > 1) {
            const otherRow = splits.find((s, i) => i !== idx && s.per);
            if (otherRow && value && String(otherRow.per) !== String(value)) {
                const revertedPer = otherRow.per;
                const found = units.find(u => String(u.id) === String(revertedPer));
                setSplits(prev => prev.map((s, i) => {
                    if (i !== idx) return s;
                    return { ...s, per: revertedPer, perName: found ? found.name : '' };
                }));
                const newUnitName = units.find(u => String(u.id) === String(value))?.name || value;
                setTimeout(() => {
                    swal({ title: 'Unit Mismatch', text: `All splits for the same item must use the same unit (${found ? found.name : revertedPer}). You selected "${newUnitName}".`, icon: 'warning', button: 'OK' }).then(() => {
                        setTimeout(() => {
                            const container = document.querySelector(`[data-prow="${idx}"][data-pcol="${perColIdx}"]`);
                            const trigger = container?.querySelector('[data-ss-trigger]');
                            if (trigger) trigger.focus();
                        }, 150);
                    });
                }, 50);
                return;
            }
        }

        setSplits(prev => prev.map((s, i) => {
            if (i !== idx) return s;
            const updated = { ...s, [field]: value };
            if (field === 'per') {
                const found = units.find(u => String(u.id) === String(value));
                updated.perName = found ? found.name : '';
            } else if (field === 'warehouse') {
                const found = warehouses.find(w => String(w.id) === String(value));
                updated.warehouseName = found ? found.name : '';
            }
            return updated;
        }));
    };

    const handlePopupKeyDown = (e, rowIdx, colIdx, totalCols) => {
        // If a sweetalert dialog is currently open, do not intercept — let swal handle Enter.
        if (document.querySelector('.swal-overlay.swal-overlay--show-modal, .swal2-container')) {
            return;
        }

        const key = e.key;
        const active = e.target;
        const tagName = active.tagName.toLowerCase();
        const splitsLength = splits.length;
        const whCol = maintain_warehouse ? 0 : -1;

        const getPopupInputElement = (r, c) => {
            const container = document.querySelector(`[data-prow="${r}"][data-pcol="${c}"]`);
            if (!container) return null;
            const ssTrigger = container.querySelector('[data-ss-trigger]');
            if (ssTrigger) return ssTrigger;
            const tag = container.tagName.toLowerCase();
            if (tag === 'input' || tag === 'select' || tag === 'textarea' || tag === 'button') {
                return container;
            }
            return container.querySelector('input, select, textarea, button');
        };

        if (active.type === 'date') {
            if (active.dataset.pickerOpen === 'true') {
                return;
            }
        }

        if (tagName === 'select') {
            if (active.dataset.open === 'true') {
                if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter') {
                    return;
                }
            } else {
                if (key === 'ArrowDown') {
                    e.preventDefault();
                    trackSelectOpen(active);
                    return;
                }
            }
        }

        if (key === 'ArrowUp') {
            e.preventDefault();
            if (rowIdx > 0) {
                const el = getPopupInputElement(rowIdx - 1, colIdx);
                if (el) el.focus();
            }
        } else if (key === 'ArrowDown') {
            e.preventDefault();
            if (rowIdx < splitsLength - 1) {
                const el = getPopupInputElement(rowIdx + 1, colIdx);
                if (el) el.focus();
            } else {
                if (colIdx === totalCols - 2) {
                    addSplitRow();
                    setTimeout(() => {
                        const el = getPopupInputElement(rowIdx + 1, 0);
                        if (el) el.focus();
                    }, 80);
                }
            }
        } else if (key === 'ArrowLeft') {
            if (active.type === 'date') return;
            const isTextInput = active.tagName.toLowerCase() === 'input' && active.type !== 'button';
            let shouldMove = true;
            if (isTextInput) {
                try {
                    if (active.selectionStart !== null && active.selectionEnd !== null) {
                        shouldMove = active.selectionStart === 0 && active.selectionEnd === 0;
                    }
                } catch (err) {
                    shouldMove = true;
                }
            }
            if (shouldMove) {
                if (colIdx > 0) {
                    e.preventDefault();
                    const el = getPopupInputElement(rowIdx, colIdx - 1);
                    if (el) el.focus();
                }
            }
        } else if (key === 'ArrowRight') {
            if (active.type === 'date') return;
            const isTextInput = active.tagName.toLowerCase() === 'input' && active.type !== 'button';
            let shouldMove = true;
            if (isTextInput) {
                try {
                    if (active.selectionStart !== null && active.selectionEnd !== null) {
                        const valLen = active.value ? active.value.length : 0;
                        shouldMove = active.selectionStart === valLen && active.selectionEnd === valLen;
                    }
                } catch (err) {
                    shouldMove = true;
                }
            }
            if (shouldMove) {
                if (colIdx < totalCols - 1) {
                    e.preventDefault();
                    const el = getPopupInputElement(rowIdx, colIdx + 1);
                    if (el) el.focus();
                }
            }
        } else if (key === 'Enter') {
            if (active.type === 'date') {
                e.preventDefault();
                const blocked = advanceDateSegment(active, e);
                if (blocked) return;
            }

            e.preventDefault();
            if (colIdx === whCol && !splits[rowIdx].warehouse) {
                if (splits.length === 1) {
                    swal('Required', 'At least one row is required.', 'warning').then(() => {
                        setTimeout(() => {
                            const el = getPopupInputElement(rowIdx, colIdx);
                            if (el) { el.focus(); el.click(); }
                        }, 100);
                    });
                    return;
                }
                deleteSplitRow(rowIdx);
                setTimeout(() => {
                    if (saveBtnRef.current) {
                        saveBtnRef.current.focus();
                    }
                }, 150);
                return;
            }

            const _currentRow = splits[rowIdx];
            const _rowHasData = (_currentRow.batch_number && _currentRow.batch_number.trim() !== '') ||
                (_currentRow.manufacture_date && _currentRow.manufacture_date.trim() !== '') ||
                (_currentRow.expiry_date && _currentRow.expiry_date.trim() !== '') ||
                (parseFloat(_currentRow.rate) > 0);
            if (whCol === -1 && colIdx === 0 && (!_currentRow.quantity || parseFloat(_currentRow.quantity) === 0) && !_rowHasData) {
                if (splits.length === 1) {
                    swal('Required', 'At least one row must have data.', 'warning').then(() => {
                        setTimeout(() => {
                            const el = getPopupInputElement(rowIdx, 0);
                            if (el) { el.focus(); el.click(); }
                        }, 100);
                    });
                    return;
                }
                deleteSplitRow(rowIdx);
                setTimeout(() => {
                    if (saveBtnRef.current) {
                        saveBtnRef.current.focus();
                    }
                }, 150);
                return;
            }

            if (colIdx === totalCols - 2) {
                handleSave();
            } else if (colIdx === totalCols - 1) {
                deleteSplitRow(rowIdx);
                setTimeout(() => {
                    if (saveBtnRef.current) {
                        saveBtnRef.current.focus();
                    }
                }, 100);
            } else if (colIdx === totalCols - 4 || colIdx === totalCols - 3) {
                addSplitRow();
                setTimeout(() => {
                    const el = getPopupInputElement(splitsLength, 0);
                    if (el) el.focus();
                }, 80);
            } else {
                const el = getPopupInputElement(rowIdx, colIdx + 1);
                if (el) el.focus();
            }
        }
    };

    const handleSave = () => {
        // Use the isInterState prop (not item.isInterState which is never set on the item object)
        const validSplits = splits.filter(s => s.quantity && parseFloat(s.quantity) > 0);

        if (validSplits.length === 0) {
            swal('Validation Error', 'Please enter a valid quantity for at least one split.', 'warning');
            return;
        }

        const cleanedSplits = splits.map(s => {
            const qty = parseFloat(s.quantity) || 0;
            const rate = parseFloat(s.rate) || 0;
            return {
                ...s,
                quantity: qty.toFixed(2),
                rate: rate.toFixed(2),
                discount_percent: (parseFloat(s.discount_percent) || 0).toFixed(2)
            };
        });

        const dummyItem = {
            ...item,
            gst_percent: item.gst_percent || '0.00',
            splits: cleanedSplits
        };
        const consolidated = consolidateSplits(dummyItem, isInterState);
        onSave(consolidated);
    };

    return (
        <div className="sof-modal-backdrop" onClick={onClose}>
            <div className="sof-modal" style={{ maxWidth: `${dynamicMaxWidth}px`, width: '95%' }} onClick={e => e.stopPropagation()}>
                <div className="sof-modal-header d-flex align-items-center justify-content-between gap-3" style={{ background: '#ffffff', borderBottom: 'none', padding: '20px 24px 0 24px' }}>
                    <div className="d-flex align-items-center gap-3">
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                                <path d="m10 8 4 4-4 4" />
                            </svg>
                        </div>
                        <div>
                            <h5 style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem', color: '#1e293b' }}>
                                {isEdit ? 'Edit Item Allocations' : 'Add Item Allocations'}
                            </h5>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                                {item.productName || '—'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="sof-modal-close"
                        onClick={onClose}
                        aria-label="Close"
                        style={{ border: '1px solid #cbd5e1' }}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
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
                        <table className="sof-table">
                            <thead>
                                <tr>
                                    {maintain_warehouse && <th style={{ minWidth: '150px' }}>Warehouse</th>}
                                    {maintain_batch && <th style={{ minWidth: '120px' }}>Batch No</th>}
                                    {maintain_manufacture_date && <th style={{ minWidth: '130px' }}>Mfg Date</th>}
                                    {maintain_expiry_date && <th style={{ minWidth: '130px' }}>Expiry Date</th>}

                                    <th className="sof-th-right" style={{ minWidth: '90px' }}>Quantity</th>
                                    <th className="sof-th-right" style={{ minWidth: '110px' }}>Rate</th>
                                    <th style={{ minWidth: '120px' }}>Per</th>
                                    <th className="sof-th-right" style={{ minWidth: '80px' }}>Disc %</th>
                                    <th className="sof-th-right" style={{ minWidth: '120px' }}>Amount</th>
                                    <th className="sof-th-center" style={{ minWidth: '190px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {splits.map((s, idx) => {
                                    let colCounter = 0;
                                    const whCol = maintain_warehouse ? colCounter++ : -1;
                                    const batchCol = maintain_batch ? colCounter++ : -1;
                                    const mfgCol = maintain_manufacture_date ? colCounter++ : -1;
                                    const expCol = maintain_expiry_date ? colCounter++ : -1;
                                    const qtyCol = colCounter++;
                                    const rateCol = colCounter++;
                                    const perCol = colCounter++;
                                    const discCol = colCounter++;
                                    const plusCol = colCounter++;
                                    const endOfRowCol = colCounter++;
                                    const deleteCol = colCounter++;
                                    const totalCols = colCounter;

                                    return (
                                        <tr key={idx} className="sof-tr">
                                            {maintain_warehouse && (
                                                <td style={{ verticalAlign: 'middle' }} data-prow={idx} data-pcol={whCol}>
                                                    <SearchableSelect
                                                        className="sof-table-input"
                                                        value={s.warehouse || ''}
                                                        options={[{ value: '', label: 'Select Warehouse...' }, ...warehouses.map(w => {
                                                            const whQty = selectedStockItem?.existing_batch_entries?.filter(e => String(e.warehouse) === String(w.id)).reduce((sum, e) => sum + parseFloat(e.quantity || 0), 0) || 0;
                                                            return { value: String(w.id), label: `${w.name} (${whQty})` };
                                                        })]}
                                                        onChange={e => handleSplitChange(idx, 'warehouse', e.target.value)}
                                                        onKeyDown={e => handlePopupKeyDown(e, idx, whCol, totalCols)}
                                                        onCloseEmpty={() => {
                                                            if (splits.length === 1) {
                                                                swal('Required', 'At least one row is required.', 'warning').then(() => {
                                                                    setTimeout(() => {
                                                                        const el = document.querySelector('[data-prow="0"] [data-ss-trigger], [data-prow="0"] input, [data-prow="0"] select');
                                                                        if (el) { el.focus(); el.click(); }
                                                                    }, 100);
                                                                });
                                                            } else {
                                                                deleteSplitRow(idx);
                                                                setTimeout(() => {
                                                                    if (saveBtnRef.current) {
                                                                        saveBtnRef.current.focus();
                                                                    }
                                                                }, 80);
                                                            }
                                                        }}
                                                        placeholder="Select Warehouse..."
                                                    />
                                                </td>
                                            )}

                                            {maintain_batch && (
                                                <td style={{ verticalAlign: 'middle' }} data-prow={idx} data-pcol={batchCol}>
                                                    <SearchableSelect
                                                        className="sof-table-input"
                                                        value={s.batch_number || ''}
                                                        options={[
                                                            { value: '', label: 'Select Batch...' },
                                                            ...batches.map(b => ({ value: b, label: b }))
                                                        ]}
                                                        onChange={e => handleSplitChange(idx, 'batch_number', e.target.value)}
                                                        onKeyDown={e => handlePopupKeyDown(e, idx, batchCol, totalCols)}
                                                        placeholder="Select Batch..."
                                                        allowCustom={true}
                                                    />
                                                </td>
                                            )}

                                            {maintain_manufacture_date && (
                                                <td style={{ verticalAlign: 'middle' }} data-prow={idx} data-pcol={mfgCol}>
                                                    <input
                                                        type="date"
                                                        className="sof-table-input"
                                                        data-label="Manufacture Date"
                                                        value={s.manufacture_date || ''}
                                                        onChange={e => handleSplitChange(idx, 'manufacture_date', e.target.value)}
                                                        onKeyDown={e => handlePopupKeyDown(e, idx, mfgCol, totalCols)}
                                                    />
                                                </td>
                                            )}

                                            {maintain_expiry_date && (
                                                <td style={{ verticalAlign: 'middle' }} data-prow={idx} data-pcol={expCol}>
                                                    <input
                                                        type="date"
                                                        className="sof-table-input"
                                                        data-label="Expiry Date"
                                                        value={s.expiry_date || ''}
                                                        onChange={e => handleSplitChange(idx, 'expiry_date', e.target.value)}
                                                        onKeyDown={e => handlePopupKeyDown(e, idx, expCol, totalCols)}
                                                    />
                                                </td>
                                            )}

                                            <td style={{ verticalAlign: 'middle' }} data-prow={idx} data-pcol={qtyCol}>
                                                <input
                                                    type="text"
                                                    className="sof-table-input"
                                                    style={{ textAlign: 'right' }}
                                                    placeholder="0.00"
                                                    value={s.quantity}
                                                    onChange={e => handleSplitChange(idx, 'quantity', e.target.value)}
                                                    onKeyDown={e => handlePopupKeyDown(e, idx, qtyCol, totalCols)}
                                                />
                                            </td>

                                            <td style={{ verticalAlign: 'middle' }} data-prow={idx} data-pcol={rateCol}>
                                                <input
                                                    type="text"
                                                    className="sof-table-input"
                                                    style={{ textAlign: 'right' }}
                                                    placeholder="0.00"
                                                    value={s.rate}
                                                    onChange={e => handleSplitChange(idx, 'rate', e.target.value)}
                                                    onKeyDown={e => handlePopupKeyDown(e, idx, rateCol, totalCols)}
                                                />
                                            </td>

                                            <td style={{ verticalAlign: 'middle' }} data-prow={idx} data-pcol={perCol}>
                                                <input
                                                    type="text"
                                                    className="sof-table-input sof-table-input-ro"
                                                    readOnly
                                                    value={units.find(u => String(u.id) === String(s.per))?.name || item.perName || s.per || ''}
                                                    tabIndex="-1"
                                                />
                                            </td>

                                            <td style={{ verticalAlign: 'middle' }} data-prow={idx} data-pcol={discCol}>
                                                <input
                                                    type="text"
                                                    className="sof-table-input"
                                                    style={{ textAlign: 'right' }}
                                                    placeholder="0.00"
                                                    value={s.discount_percent}
                                                    onChange={e => handleSplitChange(idx, 'discount_percent', e.target.value)}
                                                    onKeyDown={e => handlePopupKeyDown(e, idx, discCol, totalCols)}
                                                />
                                            </td>

                                            <td style={{ verticalAlign: 'middle', textAlign: 'right' }} className="fw-semibold text-slate">
                                                {s.quantity && s.rate ? ((parseFloat(s.quantity) || 0) * (parseFloat(s.rate) || 0) - ((parseFloat(s.quantity) || 0) * (parseFloat(s.rate) || 0) * (parseFloat(s.discount_percent) || 0) / 100)).toFixed(2) : '0.00'}
                                            </td>

                                            <td style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                                                <div className="d-flex justify-content-center align-items-center gap-2">
                                                    <button
                                                        type="button"
                                                        className="sof-popup-btn-action sof-popup-btn-add"
                                                        title="Add split row"
                                                        onClick={addSplitRow}
                                                        data-prow={idx}
                                                        data-pcol={plusCol}
                                                        onKeyDown={e => handlePopupKeyDown(e, idx, plusCol, totalCols)}
                                                    >
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                                                            <line x1="12" y1="5" x2="12" y2="19"></line>
                                                            <line x1="5" y1="12" x2="19" y2="12"></line>
                                                        </svg>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="sof-popup-btn-action sof-popup-btn-end"
                                                        data-prow={idx}
                                                        data-pcol={endOfRowCol}
                                                        onKeyDown={e => handlePopupKeyDown(e, idx, endOfRowCol, totalCols)}
                                                        onClick={handleSave}
                                                        title="End of Row"
                                                    >
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                                                            <polyline points="20 6 9 17 4 12"></polyline>
                                                        </svg>
                                                        End of Row
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="sof-popup-btn-action sof-popup-btn-delete"
                                                        title="Delete split row"
                                                        onClick={() => { deleteSplitRow(idx); setTimeout(() => { if (saveBtnRef.current) saveBtnRef.current.focus(); }, 0); }}
                                                        data-prow={idx}
                                                        data-pcol={deleteCol}
                                                        onKeyDown={e => handlePopupKeyDown(e, idx, deleteCol, totalCols)}
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
                </div>

                <div className="sof-modal-footer d-flex justify-content-end gap-3" style={{ padding: '0 24px 20px 24px', background: '#ffffff', borderTop: 'none' }}>
                    <button type="button" className="sof-btn-cancel" onClick={onClose} style={{ padding: '8px 18px', fontSize: '0.85rem' }}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="sof-btn-save"
                        onClick={handleSave}
                        ref={saveBtnRef}
                        style={{
                            background: 'linear-gradient(135deg, #4f46e5, #3730a3)',
                            boxShadow: '0 4px 16px rgba(79, 70, 229, 0.35)',
                            padding: '8px 20px',
                            fontSize: '0.85rem'
                        }}
                    >
                        Save Allocations
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════
   ITEM VIEW POPUP
   ══════════════════════════════════════════════════════════ */
const ItemViewPopup = ({ item, isInterState, onClose, productConfig, stockItems }) => {
    const { maintain_warehouse, maintain_batch: configBatch, maintain_manufacture_date: configMfg, maintain_expiry_date: configExp } = productConfig || {};
    const selectedStockItem = stockItems?.find(p => String(p.id) === String(item.product));
    const maintain_batch = !!(configBatch && selectedStockItem?.maintain_batch);
    const maintain_manufacture_date = !!(configMfg && selectedStockItem?.maintain_manufacture_date);
    const maintain_expiry_date = !!(configExp && selectedStockItem?.maintain_expiry_date);

    let dynamicMaxWidth = 480;
    dynamicMaxWidth += 100; // Per (units) column width
    if (maintain_warehouse) dynamicMaxWidth += 180;
    if (maintain_batch) dynamicMaxWidth += 140;
    if (maintain_manufacture_date) dynamicMaxWidth += 150;
    if (maintain_expiry_date) dynamicMaxWidth += 150;

    const fmtAmt = n => (parseFloat(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const viewSplits = item.splits && item.splits.length > 0 ? item.splits : [item];

    return (
        <div className="sof-modal-backdrop" onClick={onClose}>
            <div className="sof-modal" style={{ maxWidth: `${dynamicMaxWidth}px`, width: '90%' }} onClick={e => e.stopPropagation()}>
                <div className="sof-modal-header d-flex align-items-center justify-content-between gap-3" style={{ background: '#ffffff', borderBottom: 'none', padding: '18px 24px 0 24px' }}>
                    <div className="d-flex align-items-center gap-3">
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="16" x2="12" y2="12" />
                                <line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                        </div>
                        <div>
                            <h5 style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem', color: '#1e293b' }}>
                                Item Details View
                            </h5>
                            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                                {item.productName || '—'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="sof-modal-close"
                        onClick={onClose}
                        aria-label="Close"
                        style={{ border: '1px solid #cbd5e1' }}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div style={{ padding: '0 24px' }}>
                    <div style={{ borderBottom: '1px solid #e2e8f0', marginTop: '12px', marginBottom: '0px' }} />
                </div>
                <div className="sof-modal-body">
                    <div className="sof-table-scroll">
                        <table className="sof-table">
                            <thead>
                                <tr>
                                    {maintain_warehouse && <th style={{ minWidth: '150px' }}>Warehouse</th>}
                                    {maintain_batch && <th style={{ minWidth: '120px' }}>Batch No</th>}
                                    {maintain_manufacture_date && <th style={{ minWidth: '120px' }}>Mfg Date</th>}
                                    {maintain_expiry_date && <th style={{ minWidth: '120px' }}>Expiry Date</th>}
                                    <th style={{ minWidth: '100px' }}>Per</th>
                                    <th className="sof-th-right" style={{ minWidth: '90px' }}>Qty</th>
                                    <th className="sof-th-right" style={{ minWidth: '110px' }}>Rate</th>
                                    <th className="sof-th-right" style={{ minWidth: '80px' }}>Disc %</th>
                                    <th className="sof-th-right" style={{ minWidth: '120px' }}>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {viewSplits.map((s, idx) => (
                                    <tr key={idx} className="sof-tr">
                                        {maintain_warehouse && <td>{s.warehouseName || '—'}</td>}
                                        {maintain_batch && <td>{s.batch_number || '—'}</td>}
                                        {maintain_manufacture_date && <td>{s.manufacture_date || '—'}</td>}
                                        {maintain_expiry_date && <td>{s.expiry_date || '—'}</td>}
                                        <td>{s.perName || '—'}</td>
                                        <td className="sof-cell-right">{s.quantity || '0.00'}</td>
                                        <td className="sof-cell-right">{fmtAmt(s.rate)}</td>
                                        <td className="sof-cell-right">{s.discount_percent || '0.00'}%</td>
                                        <td className="sof-cell-right">{fmtAmt(s.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="sof-modal-net sof-view-net-bar">
                    <span className="sof-modal-net-label">Net amount</span>
                    <span className="sof-modal-net-value">{fmtAmt(item.amount)}</span>
                </div>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════
   MAIN SALES RETURN FORM COMPONENT
   ══════════════════════════════════════════════════════════ */
const getDebtorCreditorGroupIds = (groups) => {
    if (!groups || !Array.isArray(groups)) return new Set();
    const targetNames = ['sundry debtors', 'sundry creditors'];
    const validIds = new Set();
    const rootGroups = groups.filter(g => targetNames.includes((g.name || '').toLowerCase()));
    rootGroups.forEach(rg => validIds.add(rg.id));
    let added;
    do {
        added = false;
        groups.forEach(g => {
            if (g.parent && validIds.has(g.parent) && !validIds.has(g.id)) {
                validIds.add(g.id);
                added = true;
            }
        });
    } while (added);
    return validIds;
};

const SalesReturnForm = ({ formData = {}, setFormData, onSave, onCancel, isEditing, isSubmitting = false }) => {
    const { isFieldVisible } = useFormConfig('sales_app_salesreturn', 'SalesReturnForm');
    const [ledgers, setLedgers] = useState([]);
    const [accountGroups, setAccountGroups] = useState([]);
    const validCustomerGroupIds = React.useMemo(() => getDebtorCreditorGroupIds(accountGroups), [accountGroups]);
    const [showLedgerModal, setShowLedgerModal] = useState(false);
    const [stockItems, setStockItems] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [units, setUnits] = useState([]);
    const [allConfigs, setAllConfigs] = useState([]);
    const [prefixConfigs, setPrefixConfigs] = useState([]);
    const [allInvoices, setAllInvoices] = useState([]);
    const [productConfig, setProductConfig] = useState({
        maintain_batch: false,
        maintain_manufacture_date: false,
        maintain_expiry_date: false,
        maintain_warehouse: false
    });
    const [loadingOptions, setLoadingOptions] = useState(true);
    const [itemPopup, setItemPopup] = useState(null);
    const [viewPopup, setViewPopup] = useState(null);

    const salesLedgerOptions = React.useMemo(() => {
        const isSelected = (ledger) => String(ledger.id) === String(formData.sales_ledger);

        const isKeralaLedger = (ledger) => {
            if (!ledger) return false;
            const stateVal = String(ledger.state || '').trim().toLowerCase();
            const posVal = String(ledger.placeofsupply || '').trim().toLowerCase();
            const gstVal = String(ledger.gst_number || '').trim();

            if (stateVal === 'kl' || stateVal === '32' || stateVal.includes('kerala')) return true;
            if (posVal === 'kl' || posVal === '32' || posVal.includes('kerala')) return true;
            if (gstVal.length >= 2 && gstVal.substring(0, 2) === '32') return true;

            if (ledger.state) {
                try {
                    const stateObj = State.getStateByCodeAndCountry(ledger.state, ledger.country || 'IN');
                    if (stateObj && stateObj.name && stateObj.name.toLowerCase().includes('kerala')) {
                        return true;
                    }
                } catch (e) { }
            }
            if (ledger.placeofsupply) {
                try {
                    const posObj = State.getStateByCodeAndCountry(ledger.placeofsupply, 'IN');
                    if (posObj && posObj.name && posObj.name.toLowerCase().includes('kerala')) {
                        return true;
                    }
                } catch (e) { }
            }

            return false;
        };

        const prefix = prefixConfigs.find(p => 
            String(p.id) === String(formData.voucher_type) ||
            (p.subvoucher_type_name && p.subvoucher_type_name.toLowerCase() === String(formData.voucher_type || '').toLowerCase()) ||
            (p.sub_type && p.sub_type.toLowerCase() === String(formData.voucher_type || '').toLowerCase())
        );
        const categoryName = (
            prefix
                ? (prefix.subvoucher_type_name || prefix.sub_type || prefix.prefix || '')
                : (formData.category || '')
        ).toString().trim().toLowerCase();

        const matchesReturnCategory = (ledger) => {
            if (!categoryName) return true;

            const isKerala = isKeralaLedger(ledger);
            const hasGst = String(ledger.gst_number || '').trim() !== '';

            if (categoryName.includes('b2b')) {
                return isKerala && hasGst;
            }
            if (categoryName.includes('b2c')) {
                return isKerala && !hasGst;
            }
            if (categoryName.includes('igst') || categoryName.includes('inter')) {
                return !isKerala;
            }

            return true;
        };

        const filteredLedgers = ledgers.filter((ledger) => {
            if (isSelected(ledger)) return true;
            const isGroupValid = ledger.account_group_name === 'Sales Accounts';
            return isGroupValid && matchesReturnCategory(ledger);
        });

        return [
            { value: '', label: 'Select Sales Ledger...' },
            ...filteredLedgers.map((ledger) => ({ value: String(ledger.id), label: ledger.name }))
        ];
    }, [ledgers, formData.sales_ledger, formData.voucher_type, formData.category, prefixConfigs]);

    useEffect(() => {
        const fetchOptions = async () => {
            try {
                const callSpecs = [
                    { key: 'ledgers', call: () => SalesService.getLedgers() },
                    { key: 'stockItems', call: () => SalesService.getStockItems() },
                    { key: 'warehouses', call: () => SalesService.getWarehouses() },
                    { key: 'units', call: () => InventoryService.getUnits() },
                    { key: 'configs', call: () => InventoryService.getProductConfigurations() },
                    { key: 'invoices', call: () => SalesService.getSalesInvoices() },
                    { key: 'prefixConfigs', call: () => fetchPrefixConfigurations({ prefix_type__type_name: 'Sales Return' }) },
                    { key: 'accountGroups', call: () => getAccountGroups() }
                ];

                const results = await Promise.allSettled(callSpecs.map(s => s.call()));

                const failed = [];
                results.forEach((result, idx) => {
                    const { key } = callSpecs[idx];
                    if (result.status === 'rejected') {
                        failed.push(key);
                        console.error(`Failed to load ${key}:`, result.reason);
                        return;
                    }
                    const data = Array.isArray(result.value?.data) ? result.value.data : [];
                    if (key === 'ledgers') setLedgers(data);
                    else if (key === 'stockItems') setStockItems(data);
                    else if (key === 'warehouses') setWarehouses(data);
                    else if (key === 'units') setUnits(data);
                    else if (key === 'configs') setAllConfigs(data);
                    else if (key === 'invoices') setAllInvoices(data);
                    else if (key === 'prefixConfigs') setPrefixConfigs(data);
                    else if (key === 'accountGroups') {
                        setAccountGroups(Array.isArray(result.value) ? result.value : (Array.isArray(result.value?.results) ? result.value.results : []));
                    }
                });

                if (failed.length > 0) {
                    swal('Error', `Failed to load: ${failed.join(', ')}. Check the console for details.`, 'error');
                }

                // Removed hardcoded B2B sales return so it starts empty and forces user to select from Credit Note configs

                // Fetch next Sales Return No if creating a new one
                if (!isEditing && !formData.return_no) {
                    try {
                        const returnsRes = await SalesService.getSalesReturns();
                        const lastSr = returnsRes.data[0];
                        let nextReturnNo = 'SR00001';
                        if (lastSr && lastSr.return_no) {
                            try {
                                const lastNumber = parseInt(lastSr.return_no.replace('SR', ''), 10);
                                nextReturnNo = `SR${String(lastNumber + 1).padStart(5, '0')}`;
                            } catch (err) {
                                console.error(err);
                            }
                        }
                        setFormData(prev => ({
                            ...prev,
                            return_no: nextReturnNo
                        }));
                    } catch (err) {
                        console.error('Failed to fetch next Sales Return number:', err);
                    }
                }
            } catch (err) {
                console.error('Error fetching master data:', err);
                swal('Error', 'Failed to load form options.', 'error');
            } finally {
                setLoadingOptions(false);
            }
        };
        fetchOptions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ── Auto-open the Return Category dropdown when creating a new return ── */
    useEffect(() => {
        if (loadingOptions || isEditing) return;
        const timer = setTimeout(() => {
            const trigger = document.querySelector('[name="voucher_type"][data-ss-trigger]');
            if (trigger) trigger.click();
        }, 150);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingOptions]);

    useEffect(() => {
        if (allConfigs.length === 0) return;

        // Wait for the user to select a configuration from the Return Category dropdown
        let matchedConfig = null;

        if (matchedConfig) {
            setProductConfig({
                maintain_batch: !!matchedConfig.maintain_batch,
                maintain_manufacture_date: !!matchedConfig.maintain_manufacture_date,
                maintain_expiry_date: !!matchedConfig.maintain_expiry_date,
                maintain_warehouse: !!matchedConfig.maintain_warehouse
            });
        } else {
            setProductConfig({
                maintain_batch: true,
                maintain_manufacture_date: true,
                maintain_expiry_date: true,
                maintain_warehouse: true
            });
        }
    }, [formData.voucher_type, allConfigs]);

    useEffect(() => {
        if (!isEditing && ledgers.length > 0 && (!formData.items || formData.items.length === 0)) {
            const cgstLedger = ledgers.find(l => l.name.toLowerCase().includes('output cgst')) || ledgers.find(l => l.name.toLowerCase().includes('cgst'));
            const sgstLedger = ledgers.find(l => l.name.toLowerCase().includes('output sgst')) || ledgers.find(l => l.name.toLowerCase().includes('sgst'));
            setFormData(prev => ({
                return_type: 'STATE',
                entry_date: new Date().toISOString().split('T')[0],
                gst_ledger_1: cgstLedger ? cgstLedger.id : '',
                gst_ledger_2: sgstLedger ? sgstLedger.id : '',
                gst_amount_1: '0.00',
                gst_amount_2: '0.00',
                total_amount: '0.00',
                is_posted: false,
                items: [{
                    product: '',
                    productName: '',
                    warehouse: '',
                    warehouseName: '',
                    quantity: '',
                    rate: '',
                    discount_percent: '',
                    discount_amount: '0.00',
                    gst_percent: '0.00',
                    cgst_amount: '0.00',
                    sgst_amount: '0.00',
                    igst_amount: '0.00',
                    amount: '0.00',
                    splits: []
                }]
            }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ledgers]);

    const handleInputChange = async (field, value) => {
        let updated = { ...formData, [field]: value };

        // 🔄 When Return Category changes, auto-update return_type and GST ledgers 🔄
        if (field === 'voucher_type') {
            const config = prefixConfigs.find(c => String(c.id) === String(value));
            if (config) {
                const subType = (config.sub_type || config.subvoucher_type_name || '').toLowerCase();
                const isInterState = subType.includes('igst');
                updated.return_type = isInterState ? 'INTER_STATE' : 'STATE';

                if (config.ledger) {
                    updated.sales_ledger = String(config.ledger);
                }

                if (config.gst_ledger && config.gst_ledger.length > 0) {
                    updated.gst_ledger_1 = String(config.gst_ledger[0] || '');
                    updated.gst_ledger_2 = String(config.gst_ledger[1] || '');
                    if (!updated.gst_ledger_2) updated.gst_amount_2 = '0.00';
                } else {
                    if (isInterState) {
                        const igstLedger = ledgers.find(l => l.name.toLowerCase().includes('output igst')) || ledgers.find(l => l.name.toLowerCase().includes('igst'));
                        updated.gst_ledger_1 = igstLedger ? String(igstLedger.id) : '';
                        updated.gst_ledger_2 = '';
                        updated.gst_amount_2 = '0.00';
                    } else {
                        const cgstLedger = ledgers.find(l => l.name.toLowerCase().includes('output cgst')) || ledgers.find(l => l.name.toLowerCase().includes('cgst'));
                        const sgstLedger = ledgers.find(l => l.name.toLowerCase().includes('output sgst')) || ledgers.find(l => l.name.toLowerCase().includes('sgst'));
                        updated.gst_ledger_1 = cgstLedger ? String(cgstLedger.id) : '';
                        updated.gst_ledger_2 = sgstLedger ? String(sgstLedger.id) : '';
                    }
                }

                if (!isEditing) {
                    SalesService.getSalesReturnNextNo(config.id).then(res => {
                        setFormData(prev => {
                            const current = { ...prev, ...updated, return_no: res.data.next_return_no };
                            recalculateForm(current);
                            return current;
                        });
                    }).catch(err => {
                        console.error('Error fetching next return no', err);
                        recalculateForm(updated);
                    });
                    return; // Skip recalculateForm here since it's in the then block
                }
            } else {
                updated.return_type = 'STATE';
            }
            recalculateForm(updated);
            return;
        }

        if (field === 'return_type') {
            const cgstLedger = ledgers.find(l => l.name.toLowerCase().includes('cgst'));
            const sgstLedger = ledgers.find(l => l.name.toLowerCase().includes('sgst'));
            const igstLedger = ledgers.find(l => l.name.toLowerCase().includes('igst'));

            if (value === 'INTER_STATE') {
                updated.gst_ledger_1 = igstLedger ? igstLedger.id : '';
                updated.gst_ledger_2 = '';
            } else {
                updated.gst_ledger_1 = cgstLedger ? cgstLedger.id : '';
                updated.gst_ledger_2 = sgstLedger ? sgstLedger.id : '';
            }
        }

        recalculateForm(updated);
    };

    const handleLoadInvoiceItems = async () => {
        if (!formData.sales_invoice_no) {
            swal('Missing Field', 'Please enter a Sales Invoice No first.', 'warning');
            return;
        }

        try {
            const res = await SalesService.getSalesInvoices();
            const invoice = res.data.find(inv => inv.invoice_no === formData.sales_invoice_no);

            if (!invoice) {
                swal('Not Found', `No invoice found with number: ${formData.sales_invoice_no}`, 'error');
                return;
            }

            // Map invoice items to return items
            const newItems = invoice.items.map(item => ({
                product: item.product ? String(item.product) : '',
                productName: item.product_name || '',
                warehouse: item.warehouse ? String(item.warehouse) : '',
                warehouseName: item.warehouse_name || '',
                per: item.per ? String(item.per) : '',
                perName: item.per_name || '',
                quantity: item.quantity || '',
                rate: item.rate || '',
                discount_percent: item.discount_percent || '',
                discount_amount: item.discount_amount || '0.00',
                gst_percent: item.gst_percent || '0.00',
                cgst_amount: item.cgst_amount || '0.00',
                sgst_amount: item.sgst_amount || '0.00',
                igst_amount: item.igst_amount || '0.00',
                amount: item.amount || '0.00',
                splits: []
            }));

            const updated = { ...formData, items: newItems };
            if (!updated.sales_invoice_date && invoice.entry_date) {
                updated.sales_invoice_date = invoice.entry_date;
            }
            if (!updated.customer_ledger && invoice.customer_ledger) {
                updated.customer_ledger = String(invoice.customer_ledger);
            }
            if (!updated.sales_ledger && invoice.sales_ledger) {
                updated.sales_ledger = String(invoice.sales_ledger);
            }

            recalculateForm(updated);
            swal('Success', 'Invoice loaded successfully.', 'success');
        } catch (error) {
            console.error('Failed to load invoice items:', error);
            swal('Error', 'Failed to load invoice items.', 'error');
        }
    };

    const handleTableProductChange = (rowIdx, productId) => {
        const items = [...(formData.items || [])];
        if (!productId) {
            items[rowIdx] = {
                product: '',
                productName: '',
                warehouse: '',
                warehouseName: '',
                per: '',
                perName: '',
                quantity: '',
                rate: '',
                discount_percent: '',
                discount_amount: '0.00',
                gst_percent: '0.00',
                cgst_amount: '0.00',
                sgst_amount: '0.00',
                igst_amount: '0.00',
                amount: '0.00',
                splits: []
            };
            recalculateForm({ ...formData, items });
            return;
        }

        const found = stockItems.find(p => String(p.id) === String(productId));
        const productName = found ? found.name : '';
        const baseUnit = found ? found.base_unit : '';
        const baseUnitName = found ? found.base_unit_name : '';

        const currentItem = items[rowIdx] || {};
        const baseItem = {
            ...currentItem,
            product: productId,
            productName: productName,
            rate: currentItem.rate || '',
            gst_percent: '0.00',
            gstResolving: true,
            per: baseUnit ? String(baseUnit) : '',
            perName: baseUnitName || '',
            quantity: currentItem.quantity || '',
            discount_percent: currentItem.discount_percent || '',
            warehouse: currentItem.warehouse || '',
            warehouseName: currentItem.warehouseName || ''
        };
        baseItem.splits = [createBlankSplit(baseItem)];

        items[rowIdx] = baseItem;

        recalculateForm({ ...formData, items });
        setItemPopup({ item: baseItem, editIndex: rowIdx });

        // Resolve HSN/GST from backend
        SalesService.resolveReturnGstHsn(productId, formData.entry_date)
            .then(res => {
                const gstPercent = res.data ? (parseFloat(res.data.gst_percent) || 0).toFixed(2) : '0.00';
                setFormData(prev => {
                    const newItems = [...(prev.items || [])];
                    if (newItems[rowIdx] && newItems[rowIdx].product === productId) {
                        const updatedItem = {
                            ...newItems[rowIdx],
                            gst_percent: gstPercent,
                            gstResolving: false
                        };
                        const isInterState = prev.return_type === 'INTER_STATE';
                        const consolidated = consolidateSplits(updatedItem, isInterState);
                        newItems[rowIdx] = consolidated;

                        setItemPopup(curr => {
                            if (curr && curr.editIndex === rowIdx && curr.item.product === productId) {
                                return { ...curr, item: consolidated };
                            }
                            return curr;
                        });

                        return getRecalculatedFormState({ ...prev, items: newItems });
                    }
                    return prev;
                });
            })
            .catch(err => {
                console.error('Failed to resolve GST/HSN:', err);
                setFormData(prev => {
                    const newItems = [...(prev.items || [])];
                    if (newItems[rowIdx] && newItems[rowIdx].product === productId) {
                        newItems[rowIdx] = { ...newItems[rowIdx], gstResolving: false };
                        setItemPopup(curr => {
                            if (curr && curr.editIndex === rowIdx && curr.item.product === productId) {
                                return { ...curr, item: { ...curr.item, gstResolving: false } };
                            }
                            return curr;
                        });
                        return prev;
                    }
                    return prev;
                });
            });
    };

    const handleTableFieldChange = (rowIdx, field, value) => {
        const items = [...(formData.items || [])];
        let item = { ...items[rowIdx] };

        const isInterState = formData.return_type === 'INTER_STATE';

        let itemSplits = item.splits ? [...item.splits] : [];
        if (itemSplits.length === 0) {
            itemSplits = [createBlankSplit(item)];
        }
        itemSplits[0] = {
            ...itemSplits[0],
            [field]: value
        };
        item.splits = itemSplits;
        item = consolidateSplits(item, isInterState);

        items[rowIdx] = item;
        recalculateForm({ ...formData, items });
    };

    const recalculateForm = (state) => {
        const nextState = getRecalculatedFormState(state);
        setFormData(nextState);
    };

    const getRecalculatedFormState = (state) => {
        const isInterState = state.return_type === 'INTER_STATE';
        const isUnregistered = state.return_type === 'UNREGISTERED';

        const updatedItems = (state.items || []).map(item => {
            if (!item.product) return item;
            return consolidateSplits(item, isInterState);
        });

        let totalGstAmount = 0;
        updatedItems.forEach(item => {
            if (!item.product) return;
            const cgst = parseFloat(item.cgst_amount) || 0;
            const sgst = parseFloat(item.sgst_amount) || 0;
            const igst = parseFloat(item.igst_amount) || 0;
            totalGstAmount += cgst + sgst + igst;
        });

        const itemsSubtotal = updatedItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        let totalAmount = itemsSubtotal;

        if (!isUnregistered) {
            totalAmount += totalGstAmount;
        }

        let gstAmount1 = '0.00';
        let gstAmount2 = '0.00';

        if (!isUnregistered) {
            if (isInterState) {
                gstAmount1 = totalGstAmount.toFixed(2);
            } else {
                gstAmount1 = (totalGstAmount / 2).toFixed(2);
                gstAmount2 = (totalGstAmount / 2).toFixed(2);
            }
        }

        return {
            ...state,
            items: updatedItems,
            gst_amount_1: gstAmount1,
            gst_amount_2: gstAmount2,
            total_amount: totalAmount.toFixed(2)
        };
    };

    const addNewBlankRow = () => {
        setFormData(prev => {
            const items = [...(prev.items || [])];
            items.push({
                product: '',
                productName: '',
                warehouse: '',
                warehouseName: '',
                quantity: '',
                rate: '',
                discount_percent: '',
                discount_amount: '0.00',
                gst_percent: '0.00',
                cgst_amount: '0.00',
                sgst_amount: '0.00',
                igst_amount: '0.00',
                amount: '0.00',
                splits: []
            });
            return { ...prev, items };
        });
    };

    const removeRow = (rowIdx) => {
        const items = (formData.items || []).filter((_, idx) => idx !== rowIdx);
        recalculateForm({ ...formData, items });
    };

    const openEditItemPopup = (item, idx) => {
        setItemPopup({ item, editIndex: idx });
    };

    const savePopupItem = (updatedItem) => {
        const items = [...(formData.items || [])];
        const editIdx = itemPopup ? itemPopup.editIndex : undefined;
        if (editIdx !== undefined && items[editIdx]) {
            items[editIdx] = updatedItem;
        } else {
            items.push(updatedItem);
        }
        recalculateForm({ ...formData, items });
        setItemPopup(null);

        if (editIdx !== undefined) {
            const focusGstCell = (attemptsLeft) => {
                const gstInput = document.querySelector(`[data-row="${editIdx}"][data-col="4"]`);
                if (gstInput) {
                    gstInput.focus();
                    return;
                }
                if (attemptsLeft > 0) {
                    setTimeout(() => focusGstCell(attemptsLeft - 1), 60);
                }
            };
            setTimeout(() => focusGstCell(6), 100);
        }
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        onSave(e);
    };

    // ── Full keyboard navigation for the items table (mirrors Purchase Return) ──
    const handleTableKeyDown = (e, rowIdx, colIdx) => {
        const key = e.key;
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Delete'].includes(key)) return;

        // If a sweetalert dialog is currently open, do not intercept — let swal handle Enter.
        if (document.querySelector('.swal-overlay.swal-overlay--show-modal, .swal2-container')) {
            return;
        }

        // Delete key on product col → delete row or clear it
        if (key === 'Delete' && colIdx === 0) {
            e.preventDefault();
            e.stopPropagation();
            if ((formData.items || []).length > 1) {
                removeRow(rowIdx);
                setTimeout(() => {
                    const nextRowIdx = rowIdx > 0 ? rowIdx - 1 : 0;
                    const el = getEl(nextRowIdx, 0);
                    if (el) el.focus();
                }, 100);
            } else {
                handleTableProductChange(rowIdx, '');
            }
            return;
        }

        // Enter on empty product col → delete row or warn
        if (key === 'Enter' && colIdx === 0 && !formData.items?.[rowIdx]?.product) {
            e.preventDefault();
            e.stopPropagation();
            if ((formData.items || []).length > 1) {
                removeRow(rowIdx);
                setTimeout(() => {
                    const ledgerEl = document.querySelector('[data-field="gst_ledger_1"] [data-ss-trigger]');
                    if (ledgerEl) {
                        ledgerEl.focus();
                    } else {
                        const saveBtn = document.querySelector('.sof-btn-save');
                        if (saveBtn) saveBtn.focus();
                    }
                }, 100);
            } else {
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

        const active = e.target;
        const tagName = active.tagName.toLowerCase();
        const itemsLength = (formData.items || []).length;
        const isInterState = formData.return_type === 'INTER_STATE';
        const amountColIdx = isInterState ? 6 : 7;
        // eslint-disable-next-line no-unused-vars
        const editCol = amountColIdx + 1;
        const plusCol = amountColIdx + 2;
        const endOfRowCol = amountColIdx + 3;
        const deleteCol = amountColIdx + 4;

        const getEl = (r, c) => {
            const container = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
            if (!container) return null;
            const trigger = container.querySelector('[data-ss-trigger]');
            return trigger || container;
        };

        e.stopPropagation();

        if (tagName === 'select') {
            if (active.dataset.open === 'true') {
                if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter') return;
            } else {
                if (key === 'ArrowDown') {
                    e.preventDefault();
                    active.click();
                    return;
                }
            }
        }

        e.preventDefault();

        if (key === 'ArrowUp') {
            if (rowIdx > 0) {
                const el = getEl(rowIdx - 1, colIdx);
                if (el) el.focus();
            }
        } else if (key === 'ArrowDown') {
            if (rowIdx < itemsLength - 1) {
                const el = getEl(rowIdx + 1, colIdx);
                if (el) el.focus();
            } else if (colIdx === endOfRowCol) {
                addNewBlankRow();
                setTimeout(() => { const el = getEl(rowIdx + 1, 0); if (el) el.focus(); }, 80);
            }
        } else if (key === 'ArrowLeft') {
            if (colIdx > 0) {
                const el = getEl(rowIdx, colIdx - 1);
                if (el) el.focus();
            }
        } else if (key === 'ArrowRight') {
            if (colIdx < deleteCol) {
                const el = getEl(rowIdx, colIdx + 1);
                if (el) el.focus();
            }
        } else if (key === 'Enter') {
            if (tagName === 'button') {
                active.click();
                return;
            }
            if (colIdx === 3 || colIdx === 4 || colIdx === amountColIdx || (colIdx >= 5 && colIdx < editCol)) {
                // Last editable / read-only cols → jump to next row start or add new row
                if (rowIdx === itemsLength - 1) {
                    addNewBlankRow();
                    setTimeout(() => { const el = getEl(rowIdx + 1, 0); if (el) el.focus(); }, 80);
                } else {
                    const el = getEl(rowIdx + 1, 0);
                    if (el) el.focus();
                }
            } else if (colIdx === plusCol) {
                addNewBlankRow();
                setTimeout(() => { const el = getEl(itemsLength, 0); if (el) el.focus(); }, 80);
            } else if (colIdx === endOfRowCol) {
                // Click the main form submit button (type=submit), not the popup save button
                document.querySelector('button[type="submit"].sof-btn-save')?.click();
            } else if (colIdx === deleteCol) {
                removeRow(rowIdx);
                setTimeout(() => {
                    const nextRowIdx = rowIdx > 0 ? rowIdx - 1 : 0;
                    const el = getEl(nextRowIdx, deleteCol);
                    if (el) el.focus();
                }, 100);
            } else {
                const el = getEl(rowIdx, colIdx + 1);
                if (el) el.focus();
            }
        }
    };

    const handleKeyDownNavigation = (e) => {
        if (e.key === 'Enter') {
            handleEnterNavigation(e);
        }
    };

    const handleSelectChangeNavigation = (e) => {
        // Automatically advance focus on change if appropriate
    };

    const getSubtotal = () => (formData.items || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0).toFixed(2);
    const getTotalTax = () => {
        const t1 = parseFloat(formData.gst_amount_1) || 0;
        const t2 = parseFloat(formData.gst_amount_2) || 0;
        return (t1 + t2).toFixed(2);
    };

    if (loadingOptions) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', border: '4px solid #e8eaf6', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'sof-spin 0.8s linear infinite' }}></div>
                <p style={{ color: '#4f46e5', fontWeight: '600', fontSize: '0.9rem', margin: 0 }}>Loading form data...</p>
                <style>{`@keyframes sof-spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    const isInterState = formData.return_type === 'INTER_STATE';
    const customerInvoices = allInvoices.filter(inv => String(inv.customer_ledger) === String(formData.customer_ledger));

    let showGst2 = true;
    const currentPrefixConfig = prefixConfigs.find(p => 
        String(p.id) === String(formData.voucher_type) ||
        (p.subvoucher_type_name && p.subvoucher_type_name.toLowerCase() === String(formData.voucher_type || '').toLowerCase()) ||
        (p.sub_type && p.sub_type.toLowerCase() === String(formData.voucher_type || '').toLowerCase())
    );
    if (currentPrefixConfig && currentPrefixConfig.gst_ledger && currentPrefixConfig.gst_ledger.length === 1) {
        showGst2 = false;
    }

    return (
        <div className="sof-wrap">
            <form onSubmit={handleFormSubmit} onKeyDown={handleKeyDownNavigation} onChange={handleSelectChangeNavigation}>

                {/* ── SECTION 1: RETURN INFO ──────────────────────────────────────────────── */}
                <div className="sof-section">
                    <div className="sof-section-head">
                        <div className="sof-section-icon" style={{ background: 'linear-gradient(135deg, #4f46e5, #3730a3)' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                        </div>
                        <span>Sales Return Information</span>
                        <div className="sof-section-line"></div>
                    </div>

                    <div className="row">
                        {isFieldVisible('voucher_type') && (
                            <div className="col-lg-3 col-md-6 sof-field-group">
                                <label className="sof-label">Return Category <span className="sof-req">*</span></label>
                                <div className="sof-input-box">
                                    <span className="sof-field-icon">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                                        </svg>
                                    </span>
                                    <SearchableSelect
                                        name="voucher_type"
                                        className="sof-input"
                                        value={currentPrefixConfig ? String(currentPrefixConfig.id) : (formData.voucher_type || '')}
                                        options={prefixConfigs.filter(c => c.voucher_type_name && c.voucher_type_name.toLowerCase() === 'credit note').map(c => ({
                                            value: String(c.id),
                                            label: c.subvoucher_type_name || c.prefix || c.voucher_type_name || 'Return Category'
                                        }))}
                                        onChange={e => handleInputChange('voucher_type', e.target.value)}
                                        placeholder="Select Return Category..."
                                    />
                                </div>
                            </div>
                        )}

                        {isFieldVisible('return_no') && (
                            <div className="col-lg-3 col-md-6 sof-field-group">
                                <label className="sof-label">
                                    Return No.
                                    <span className="sof-badge-auto">AUTO</span>
                                </label>
                                <div className="sof-input-box sof-input-locked">
                                    <input type="text" name="return_no" className="sof-input" placeholder="(auto-generated)" readOnly value={formData.return_no || ''} />
                                </div>
                            </div>
                        )}

                        {isFieldVisible('entry_date') && (
                            <div className="col-lg-3 col-md-6 sof-field-group">
                                <label className="sof-label">Entry Date <span className="sof-req">*</span></label>
                                <div className="sof-input-box">
                                    <span className="sof-field-icon">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                            <line x1="16" y1="2" x2="16" y2="6"></line>
                                            <line x1="8" y1="2" x2="8" y2="6"></line>
                                            <line x1="3" y1="10" x2="21" y2="10"></line>
                                        </svg>
                                    </span>
                                    <CompanyDatePicker
                                        name="entry_date"
                                        className="sof-input"
                                        required
                                        value={formData.entry_date || ''}
                                        onChange={(e, val) => handleInputChange('entry_date', val || e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        {isFieldVisible('sales_ledger') && (
                            <div className="col-lg-3 col-md-6 sof-field-group">
                                <label className="sof-label">Sales Ledger <span className="sof-req">*</span></label>
                                <div className="sof-input-box" data-field="sales_ledger">
                                    <span className="sof-field-icon">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 7v6h-6"></path>
                                            <path d="M3 17a9 9 0 0 1 15-6.7L21 13"></path>
                                        </svg>
                                    </span>
                                    <SearchableSelect
                                        name="sales_ledger"
                                        className="sof-input"
                                        required
                                        data-label="Sales Ledger"
                                        value={formData.sales_ledger || ''}
                                        options={salesLedgerOptions}
                                        onChange={e => handleInputChange('sales_ledger', e.target.value)}
                                        placeholder="Select Sales Ledger..."
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="row" style={{ marginTop: '16px' }}>
                        {isFieldVisible('customer_ledger') && (
                            <div className="col-lg-4 col-md-4 sof-field-group">
                                <label className="sof-label">Customer Name <span className="sof-req">*</span></label>
                                <div className="d-flex align-items-stretch" style={{ gap: '8px' }}>
                                    <div className="sof-input-box" style={{ flex: 1, margin: 0, minWidth: 0, width: 0 }} data-field="customer_ledger">
                                        <span className="sof-field-icon">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                                <circle cx="12" cy="7" r="4"></circle>
                                            </svg>
                                        </span>
                                        <SearchableSelect
                                            name="customer_ledger"
                                            className="sof-input"
                                            required
                                            data-label="Customer Name"
                                            value={formData.customer_ledger || ''}
                                            options={[{ value: '', label: 'Select Customer...' }, ...ledgers.filter(l => validCustomerGroupIds.has(l.accountGroup) || String(l.id) === String(formData.customer_ledger)).map(l => ({ value: String(l.id), label: l.name }))]}
                                            onChange={e => handleInputChange('customer_ledger', e.target.value)}
                                            placeholder="Select Customer..."
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        className="sof-add-customer-btn"
                                        style={{ height: '42px' }}
                                        onClick={() => setShowLedgerModal(true)}
                                        title="Add New Customer"
                                    >
                                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                    </button>
                                </div>
                            </div>
                        )}

                        {isFieldVisible('sales_invoice_no') && (
                            <div className="col-lg-3 col-md-3 sof-field-group">
                                <label className="sof-label">Sales Invoice No</label>
                                <div className="sof-input-box" data-field="sales_invoice_no">
                                    <span className="sof-field-icon">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                            <polyline points="14 2 14 8 20 8"></polyline>
                                            <line x1="16" y1="13" x2="8" y2="13"></line>
                                            <line x1="16" y1="17" x2="8" y2="17"></line>
                                            <polyline points="10 9 9 9 8 9"></polyline>
                                        </svg>
                                    </span>
                                    <SearchableSelect
                                        name="sales_invoice_no"
                                        className="sof-input"
                                        data-label="Sales Invoice No"
                                        value={formData.sales_invoice_no || ''}
                                        options={[{ value: '', label: 'Select Invoice No.' }, ...customerInvoices.map(inv => ({ value: String(inv.invoice_no), label: inv.invoice_no }))]}
                                        onChange={e => handleInputChange('sales_invoice_no', e.target.value)}
                                        placeholder="Select Invoice No."
                                    />
                                </div>
                            </div>
                        )}

                        {isFieldVisible('sales_invoice_date') && (
                            <div className="col-lg-3 col-md-3 sof-field-group">
                                <label className="sof-label">Sales Invoice Date</label>
                                <div className="sof-input-box" data-field="sales_invoice_date">
                                    <input
                                        type="date"
                                        name="sales_invoice_date"
                                        className="sof-input"
                                        data-label="Sales Invoice Date"
                                        value={formData.sales_invoice_date || ''}
                                        onChange={e => handleInputChange('sales_invoice_date', e.target.value)}
                                        onClick={openDatePickerOnClick}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="col-lg-2 col-md-2 sof-field-group">
                            <label className="sof-label" style={{ visibility: 'hidden' }}>Load</label>
                            <div className="sof-input-box" style={{ border: 'none', background: 'transparent', padding: 0 }}>
                                <button
                                    type="button"
                                    className="btn sof-load-invoice-btn w-100"
                                    onClick={handleLoadInvoiceItems}
                                    style={{ height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600' }}
                                >
                                    Load Invoice
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── SECTION 2: RETURN ITEMS (grid table layout) ──────────────────── */}
                <div className="sof-section sof-table-section">
                    <div className="sof-section-head">
                        <div className="sof-section-icon" style={{ background: '#4f46e5' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                <line x1="12" y1="22.08" x2="12" y2="12" />
                            </svg>
                        </div>
                        <span>Return Items</span>
                        {(formData.items || []).filter(item => item.product).length > 0 && (
                            <span className="sof-items-count" style={{ backgroundColor: '#e0e7ff', color: '#4f46e5' }}>
                                {(formData.items || []).filter(item => item.product).length} {(formData.items || []).filter(item => item.product).length === 1 ? 'item' : 'items'}
                            </span>
                        )}
                        <div className="sof-section-line"></div>
                    </div>

                    <div className="sof-table-scroll" style={{ padding: '0 20px 20px 20px' }}>
                        <table className="sof-table">
                            <thead>
                                <tr>
                                    <th className="sof-th-center" style={{ width: '50px' }}>SL.NO</th>
                                    <th style={{ minWidth: '220px' }}>Name of Item</th>
                                    <th className="sof-th-right" style={{ width: '100px' }}>Quantity</th>
                                    <th className="sof-th-right" style={{ width: '110px' }}>Rate</th>
                                    <th className="sof-th-right" style={{ width: '80px' }}>Dis %</th>
                                    <th className="sof-th-right" style={{ width: '90px' }}>GST %</th>
                                    {isInterState ? (
                                        <th className="sof-th-right" style={{ width: '110px' }}>IGST</th>
                                    ) : (
                                        <>
                                            <th className="sof-th-right" style={{ width: '100px' }}>CGST</th>
                                            {showGst2 && (
                                                <th className="sof-th-right" style={{ width: '100px' }}>SGST</th>
                                            )}
                                        </>
                                    )}
                                    <th className="sof-th-right" style={{ width: '120px' }}>Amount</th>
                                    <th className="sof-th-center" style={{ width: '240px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(formData.items || []).map((item, idx) => {
                                    const amountColIdx = isInterState ? 6 : 7;
                                    const editCol = amountColIdx + 1;
                                    const plusCol = amountColIdx + 2;
                                    const endOfRowCol = amountColIdx + 3;
                                    const deleteCol = amountColIdx + 4;
                                    return (
                                        <tr key={idx} className="sof-tr">
                                            <td className="sof-th-center" style={{ verticalAlign: 'middle', fontWeight: '600', color: '#64748b' }}>{idx + 1}</td>
                                            <td style={{ verticalAlign: 'middle' }}>
                                                <SearchableSelect
                                                    className="sof-table-input"
                                                    data-row={idx}
                                                    data-col={0}
                                                    value={item.product || ''}
                                                    options={[{ value: '', label: 'Search and select item...' }, ...stockItems.map(p => ({ value: String(p.id), label: p.name }))]}
                                                    onChange={e => handleTableProductChange(idx, e.target.value)}
                                                    onKeyDown={e => handleTableKeyDown(e, idx, 0)}
                                                    onCloseEmpty={() => {
                                                        if ((formData.items || []).length > 1) {
                                                            removeRow(idx);
                                                            setTimeout(() => {
                                                                const ledgerEl = document.querySelector('[data-field="gst_ledger_1"] [data-ss-trigger]');
                                                                if (ledgerEl) ledgerEl.focus();
                                                            }, 100);
                                                        } else {
                                                            // Single row closed empty — warn and refocus
                                                            swal('Required', 'At least one row must have data.', 'warning').then(() => {
                                                                setTimeout(() => {
                                                                    const container = document.querySelector(`[data-row="${idx}"][data-col="0"]`);
                                                                    const el = container?.querySelector('[data-ss-trigger]') || container;
                                                                    if (el) { el.focus(); el.click(); }
                                                                }, 100);
                                                            });
                                                        }
                                                    }}
                                                    placeholder="Search and select item..."
                                                />






                                            </td>
                                            <td style={{ verticalAlign: 'middle' }}>
                                                <input
                                                    type="text"
                                                    className="sof-table-input"
                                                    style={{ textAlign: 'right' }}
                                                    data-row={idx}
                                                    data-col={1}
                                                    placeholder="0.00"
                                                    value={item.quantity}
                                                    onChange={e => handleTableFieldChange(idx, 'quantity', e.target.value)}
                                                    onKeyDown={e => handleTableKeyDown(e, idx, 1)}
                                                    disabled={!item.product}
                                                />
                                            </td>
                                            <td style={{ verticalAlign: 'middle' }}>
                                                <input
                                                    type="text"
                                                    className="sof-table-input"
                                                    style={{ textAlign: 'right' }}
                                                    data-row={idx}
                                                    data-col={2}
                                                    placeholder="0.00"
                                                    value={item.rate}
                                                    onChange={e => handleTableFieldChange(idx, 'rate', e.target.value)}
                                                    onKeyDown={e => handleTableKeyDown(e, idx, 2)}
                                                    disabled={!item.product}
                                                />
                                            </td>
                                            <td style={{ verticalAlign: 'middle' }}>
                                                <input
                                                    type="text"
                                                    className="sof-table-input"
                                                    style={{ textAlign: 'right' }}
                                                    data-row={idx}
                                                    data-col={3}
                                                    placeholder="0.00"
                                                    value={item.discount_percent}
                                                    onChange={e => handleTableFieldChange(idx, 'discount_percent', e.target.value)}
                                                    onKeyDown={e => handleTableKeyDown(e, idx, 3)}
                                                    disabled={!item.product}
                                                />
                                            </td>
                                            <td style={{ verticalAlign: 'middle' }}>
                                                <input
                                                    type="text"
                                                    className="sof-table-input sof-table-input-ro"
                                                    style={{ textAlign: 'right' }}
                                                    readOnly
                                                    data-row={idx}
                                                    data-col={4}
                                                    placeholder="0.00"
                                                    value={item.gstResolving ? '…' : (item.gst_percent || '0.00')}
                                                    onKeyDown={e => handleTableKeyDown(e, idx, 4)}
                                                />
                                            </td>
                                            {isInterState ? (
                                                <td style={{ verticalAlign: 'middle' }}>
                                                    <input
                                                        type="text"
                                                        className="sof-table-input sof-table-input-ro"
                                                        style={{ textAlign: 'right' }}
                                                        readOnly
                                                        data-row={idx}
                                                        data-col={5}
                                                        value={item.igst_amount || '0.00'}
                                                        onKeyDown={e => handleTableKeyDown(e, idx, 5)}
                                                    />
                                                </td>
                                            ) : (
                                                <>
                                                    <td style={{ verticalAlign: 'middle' }}>
                                                        <input
                                                            type="text"
                                                            className="sof-table-input sof-table-input-ro"
                                                            style={{ textAlign: 'right' }}
                                                            readOnly
                                                            data-row={idx}
                                                            data-col={5}
                                                            value={item.cgst_amount || '0.00'}
                                                            onKeyDown={e => handleTableKeyDown(e, idx, 5)}
                                                        />
                                                    </td>
                                                    {showGst2 && (
                                                        <td style={{ verticalAlign: 'middle' }}>
                                                            <input
                                                                type="text"
                                                                className="sof-table-input sof-table-input-ro"
                                                                style={{ textAlign: 'right' }}
                                                                readOnly
                                                                data-row={idx}
                                                                data-col={6}
                                                                value={item.sgst_amount || '0.00'}
                                                                onKeyDown={e => handleTableKeyDown(e, idx, 6)}
                                                            />
                                                        </td>
                                                    )}


                                                </>
                                            )}
                                            <td style={{ verticalAlign: 'middle' }}>
                                                <input
                                                    type="text"
                                                    className="sof-table-input sof-table-input-ro"
                                                    style={{ textAlign: 'right' }}
                                                    readOnly
                                                    data-row={idx}
                                                    data-col={amountColIdx}
                                                    value={item.amount || '0.00'}
                                                    onKeyDown={e => handleTableKeyDown(e, idx, amountColIdx)}
                                                />
                                            </td>
                                            <td style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                                                <div className="d-flex justify-content-center align-items-center gap-1">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center"
                                                        style={{ width: '28px', height: '28px', padding: '0', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                                        title="Edit details (warehouse, batch, etc.)"
                                                        onClick={() => openEditItemPopup(item, idx)}
                                                        disabled={!item.product}
                                                        data-row={idx}
                                                        data-col={editCol}
                                                        onKeyDown={e => handleTableKeyDown(e, idx, editCol)}
                                                    >
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center"
                                                        style={{ width: '28px', height: '28px', padding: '0', borderRadius: '4px', border: '1.5px solid #4f46e5', color: '#4f46e5', background: 'none' }}
                                                        title="Add new row"
                                                        onClick={addNewBlankRow}
                                                        data-row={idx}
                                                        data-col={plusCol}
                                                        onKeyDown={e => handleTableKeyDown(e, idx, plusCol)}
                                                    >
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                                                            <line x1="12" y1="5" x2="12" y2="19"></line>
                                                            <line x1="5" y1="12" x2="19" y2="12"></line>
                                                        </svg>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="sof-popup-btn-action sof-popup-btn-end"
                                                        title="Save return (End of Row)"
                                                        data-row={idx}
                                                        data-col={endOfRowCol}
                                                        onKeyDown={e => handleTableKeyDown(e, idx, endOfRowCol)}
                                                        onClick={() => {
                                                            document.querySelector('button[type="submit"].sof-btn-save')?.click();
                                                        }}
                                                    >
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                                                            <polyline points="20 6 9 17 4 12"></polyline>
                                                        </svg>
                                                        End of Row
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center"
                                                        style={{ width: '28px', height: '28px', padding: '0', borderRadius: '4px' }}
                                                        title="Remove row"
                                                        onClick={() => removeRow(idx)}
                                                        data-row={idx}
                                                        data-col={deleteCol}
                                                        onKeyDown={e => handleTableKeyDown(e, idx, deleteCol)}
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
                </div>

                {/* ── SECTION 3: NOTES + RETURN SUMMARY ─────────────────────── */}
                <div className="row">
                    {/* Narration */}
                    {isFieldVisible('narration') ? (
                        <div className="col-lg-7 mb-4">
                            <div className="sof-section h-100 mb-0" style={{ display: 'flex', flexDirection: 'column' }}>
                                <div className="sof-section-head">
                                    <div className="sof-section-icon" style={{ background: '#eab308' }}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                        </svg>
                                    </div>
                                    <span>Narration & Notes</span>
                                    <div className="sof-section-line"></div>
                                </div>
                                <textarea
                                    className="sof-input sof-textarea"
                                    rows="6"
                                    style={{ flex: 1 }}
                                    placeholder="Enter return notes, reason for return, or special instructions..."
                                    value={formData.narration || ''}
                                    onChange={e => handleInputChange('narration', e.target.value)}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="col-lg-7 mb-4"></div>
                    )}

                    {/* Return Summary */}
                    <div className="col-lg-5 mb-4">
                        <div className="sof-receipt">
                            <div className="sof-receipt-header">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                                    <line x1="6" y1="5" x2="18" y2="5"></line>
                                    <line x1="6" y1="9" x2="16" y2="9"></line>
                                    <path d="M9 5C15 5 15 13 9 13"></path>
                                    <line x1="9" y1="13" x2="17" y2="20"></line>
                                </svg>
                                Return Summary
                            </div>

                            <div className="sof-receipt-body">
                                {/* Subtotal */}
                                <div className="sof-receipt-row">
                                    <span className="sof-receipt-key">Subtotal (excl. tax)</span>
                                    <span className="sof-receipt-val">{getSubtotal()}</span>
                                </div>

                                {/* GST Ledger 1 */}
                                <div className="sof-gst-row" data-field="gst_ledger_1">
                                    <div className="sof-gst-label">
                                        {isInterState ? 'IGST' : 'CGST'} Ledger
                                    </div>
                                    <div className="sof-gst-fields">
                                        <SearchableSelect
                                            className="sof-gst-select"
                                            value={formData.gst_ledger_1 || ''}
                                            options={[{ value: '', label: 'Select Ledger' }, ...ledgers.map(l => ({ value: String(l.id), label: l.name }))]}
                                            onChange={e => handleInputChange('gst_ledger_1', e.target.value)}
                                            placeholder="Select Ledger"
                                            onKeyDown={e => {
                                                if (e.key !== 'Enter') return;
                                                const isUnregistered = formData.return_type === 'UNREGISTERED';
                                                const isInterState = formData.return_type === 'INTER_STATE';
                                                if (!isUnregistered && !isInterState) {
                                                    e.preventDefault();
                                                    document.querySelector('[data-field="gst_ledger_2"] [data-ss-trigger]')?.focus();
                                                } else {
                                                    e.preventDefault();
                                                    document.querySelector('.sof-btn-save')?.focus();
                                                }
                                            }}
                                        />
                                        <span className="sof-gst-amount">{formData.gst_amount_1 || '0.00'}</span>
                                    </div>
                                </div>

                                {/* GST Ledger 2 */}
                                {!isInterState && formData.return_type !== 'UNREGISTERED' && showGst2 && (
                                    <div className="sof-gst-row" data-field="gst_ledger_2">
                                        <div className="sof-gst-label">SGST Ledger</div>
                                        <div className="sof-gst-fields">
                                            <SearchableSelect
                                                className="sof-gst-select"
                                                value={formData.gst_ledger_2 || ''}
                                                options={[{ value: '', label: 'Select Ledger' }, ...ledgers.map(l => ({ value: String(l.id), label: l.name }))]}
                                                onChange={e => handleInputChange('gst_ledger_2', e.target.value)}
                                                placeholder="Select Ledger"
                                                onKeyDown={e => {
                                                    if (e.key !== 'Enter') return;
                                                    e.preventDefault();
                                                    document.querySelector('.sof-btn-save')?.focus();
                                                }}
                                            />
                                            <span className="sof-gst-amount">{formData.gst_amount_2 || '0.00'}</span>
                                        </div>
                                    </div>
                                )}

                                <div className="sof-receipt-row sof-receipt-row-tax">
                                    <span className="sof-receipt-key">Total Tax</span>
                                    <span className="sof-receipt-val">{getTotalTax()}</span>
                                </div>
                            </div>

                            <div className="sof-receipt-total">
                                <span className="sof-total-label">Grand Total</span>
                                <span className="sof-total-value">{formData.total_amount || '0.00'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── ACTION BAR ─────────────────────────────────────────────── */}
                <div className="sof-action-bar d-flex justify-content-end gap-3">
                    <button type="button" className="sof-btn-cancel" onClick={onCancel}>
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="sof-btn-save"
                        disabled={isSubmitting}
                        style={{
                            background: 'linear-gradient(135deg, #4f46e5, #3730a3)',
                            boxShadow: '0 4px 16px rgba(79, 70, 229, 0.35)',
                            opacity: isSubmitting ? 0.7 : 1,
                            cursor: isSubmitting ? 'not-allowed' : 'pointer'
                        }}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" style={{ marginRight: '6px' }}>
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        {isSubmitting ? 'Saving...' : (isEditing ? 'Update Sales Return' : 'Save Sales Return')}
                    </button>
                </div>
                <LedgerFormModal
                    show={showLedgerModal}
                    onHide={() => setShowLedgerModal(false)}
                    accountGroups={accountGroups}
                    onSave={(newLedger) => {
                        setLedgers(prev => [...prev, newLedger]);
                        setShowLedgerModal(false);
                        if (validCustomerGroupIds.has(newLedger.accountGroup)) {
                            handleInputChange('customer_ledger', String(newLedger.id));
                        } else {
                            setTimeout(() => {
                                swal("Notice", "You have created a ledger under an Account Group other than Sundry Debtors/Creditors. It will not be selected here.", "info");
                            }, 300);
                        }
                    }}
                />
            </form>

            {/* ── ITEM ENTRY POPUP ────────────────────────────────────────── */}
            {itemPopup && (
                <ItemEntryPopup
                    item={itemPopup.item}
                    isInterState={isInterState}
                    warehouses={warehouses}
                    stockItems={stockItems}
                    units={units}
                    onSave={savePopupItem}
                    onClose={() => setItemPopup(null)}
                    isEdit={itemPopup.editIndex !== undefined}
                    productConfig={productConfig}
                />
            )}

            {/* ── VIEW DETAILS POPUP ───────────────────────────────────────── */}
            {viewPopup && (
                <ItemViewPopup
                    item={viewPopup}
                    isInterState={isInterState}
                    onClose={() => setViewPopup(null)}
                    productConfig={productConfig}
                    stockItems={stockItems}
                />
            )}

            {/* ── ALL STYLES ─────────────────────────────────────────────────── */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

                .sof-wrap {
                    font-family: 'Inter', sans-serif;
                    background-color: #f8fafc;
                    padding: 4px;
                    border-radius: 12px;
                }

                .sof-section {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 24px;
                    margin-bottom: 24px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.02);
                }

                .sof-section-head {
                    display: flex !important;
                    align-items: center !important;
                    gap: 12px !important;
                    margin-bottom: 24px !important;
                }

                .sof-section-icon {
                    width: 36px !important;
                    height: 36px !important;
                    min-width: 36px !important;
                    min-height: 36px !important;
                    max-width: 36px !important;
                    max-height: 36px !important;
                    border-radius: 8px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    color: #ffffff !important;
                    flex-shrink: 0 !important;
                    line-height: 1 !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    box-sizing: border-box !important;
                }

                .sof-section-icon svg {
                    width: 18px !important;
                    height: 18px !important;
                    stroke: currentColor !important;
                    display: block !important;
                    margin: 0 !important;
                }

                .sof-section-head span {
                    font-weight: 700;
                    font-size: 0.95rem;
                    color: #1e293b;
                    letter-spacing: -0.01em;
                    line-height: 1.2 !important;
                    display: inline-flex !important;
                    align-items: center !important;
                }

                .sof-section-line {
                    flex: 1;
                    height: 1px;
                    background-color: #f1f5f9;
                }

                .sof-items-count {
                    font-size: 0.72rem;
                    font-weight: 700;
                    padding: 4px 10px;
                    border-radius: 20px;
                    display: inline-flex !important;
                    align-items: center !important;
                    line-height: 1 !important;
                }

                /* Defensive: keep Return Items header aligned the same as other sections
                   even if .sof-table-section padding or other global styles interfere */
                .sof-table-section > .sof-section-head {
                    margin-bottom: 24px !important;
                    padding-left: 24px !important;
                    padding-right: 24px !important;
                    align-items: center !important;
                }

                .sof-field-group {
                    margin-bottom: 16px;
                }

                .sof-label {
                    font-size: 0.78rem;
                    font-weight: 600;
                    color: #475569;
                    margin-bottom: 6px;
                    display: block;
                }

                .sof-req {
                    color: #ef4444;
                    margin-left: 2px;
                }

                .sof-input-box {
                    position: relative;
                    display: flex;
                    align-items: center;
                }

                .sof-field-icon {
                    position: absolute;
                    left: 12px;
                    color: #94a3b8;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .sof-field-icon svg {
                    width: 15px;
                    height: 15px;
                }

                .sof-input {
                    width: 100%;
                    height: 38px;
                    padding: 6px 12px 6px 36px;
                    border: 1.5px solid #cbd5e1;
                    border-radius: 8px;
                    font-size: 0.82rem;
                    font-weight: 500;
                    color: #334155;
                    background-color: #ffffff;
                    transition: all 0.15s ease-in-out;
                }

                .sof-input:focus {
                    outline: none;
                    border-color: #4f46e5;
                    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
                }

                .sof-input-locked {
                    background-color: #f8fafc;
                }

                .sof-input-locked input {
                    background-color: #f8fafc;
                    cursor: not-allowed;
                }

                .sof-load-invoice-btn {
                    border: 1.5px solid #4f46e5 !important;
                    color: #4f46e5 !important;
                    background-color: #ffffff !important;
                    transition: all 0.15s ease-in-out;
                }

                .sof-load-invoice-btn:hover,
                .sof-load-invoice-btn:focus {
                    background: linear-gradient(135deg, #4f46e5, #3730a3) !important;
                    border-color: #4f46e5 !important;
                    color: #ffffff !important;
                    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
                }

                .sof-badge-auto {
                    background-color: #e0e7ff;
                    color: #4f46e5;
                    font-size: 0.6rem;
                    font-weight: 800;
                    padding: 2px 6px;
                    border-radius: 4px;
                    margin-left: 6px;
                    vertical-align: middle;
                }

                .sof-textarea {
                    min-height: 100px;
                    padding: 12px;
                    line-height: 1.5;
                }

                /* Table Styling */
                .sof-table-section {
                    padding: 24px 0 0 0;
                }

                .sof-table-scroll {
                    overflow-x: auto;
                    width: 100%;
                }

                .sof-table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .sof-table th {
                    background-color: #4f46e5;
                    border-bottom: 1.5px solid #3730a3;
                    padding: 10px 12px;
                    font-size: 0.72rem;
                    font-weight: 700;
                    color: #ffffff !important;
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                }

                .sof-th-right {
                    text-align: right;
                }

                .sof-th-center {
                    text-align: center;
                }

                .sof-tr {
                    border-bottom: 1px solid #f1f5f9;
                    transition: background-color 0.1s ease;
                }

                .sof-tr:hover {
                    background-color: #f8fafc;
                }

                .sof-table td {
                    padding: 8px 12px;
                    font-size: 0.8rem;
                }

                .sof-table-input {
                    border: 1px solid #cbd5e1;
                    border-radius: 6px;
                    height: 32px;
                    padding: 4px 8px;
                    font-size: 0.78rem;
                    font-weight: 500;
                    width: 100%;
                    transition: border-color 0.1s ease;
                }

                .sof-table-input:focus {
                    outline: none;
                    border-color: #4f46e5;
                    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.1);
                }

                .sof-table-input-ro {
                    background-color: #f8fafc;
                    border-color: #e2e8f0;
                    cursor: not-allowed;
                    color: #64748b;
                }

                /* Flat Inputs in Summary Box */
                .sof-flat-label {
                    font-size: 0.72rem;
                    font-weight: 700;
                    color: #64748b;
                    margin-bottom: 4px;
                    text-transform: uppercase;
                }

                .sof-flat-input {
                    border: 1px solid #cbd5e1;
                    border-radius: 6px;
                    height: 34px;
                    padding: 4px 10px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: #334155;
                    width: 100%;
                }

                .sof-flat-input:focus {
                    outline: none;
                    border-color: #4f46e5;
                }

                .sof-flat-input-ro {
                    background-color: #f8fafc;
                    border-color: #e2e8f0;
                    color: #475569;
                    cursor: not-allowed;
                }

                .sof-icon-amber { background: linear-gradient(135deg, #f59e0b, #d97706); }
                .sof-icon-blue { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }

                /* Invoice/Return Summary receipt card */
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
                    background: linear-gradient(135deg, #312e81, #4338ca);
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
                button.sof-gst-select { cursor: pointer; text-align: left; }
                .sof-gst-select:focus { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.12); }
                .sof-gst-amount {
                    font-size: 0.82rem; font-weight: 700;
                    color: #1d4ed8; white-space: nowrap;
                    background: #dbeafe; padding: 5px 10px;
                    border-radius: 7px; min-width: 70px; text-align: right;
                    font-feature-settings: "tnum";
                }
                .sof-receipt-total {
                    background: linear-gradient(135deg, #312e81, #4338ca);
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

                /* Action bar */
                .sof-action-bar {
                    margin-top: 24px;
                    padding: 16px 0 0 0;
                }

                .sof-btn-cancel {
                    background: #ffffff;
                    border: 1.5px solid #cbd5e1;
                    color: #475569;
                    font-weight: 600;
                    font-size: 0.85rem;
                    height: 38px;
                    padding: 0 20px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }

                .sof-btn-cancel:hover {
                    background-color: #f8fafc;
                    border-color: #94a3b8;
                }

                .sof-btn-save {
                    border: none;
                    color: #ffffff;
                    font-weight: 700;
                    font-size: 0.85rem;
                    height: 38px;
                    padding: 0 24px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }

                /* Popup Modal styles */
                .sof-modal-backdrop {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    z-index: 1040;
                    background-color: rgba(15, 23, 42, 0.45);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .sof-modal {
                    background: #ffffff;
                    border-radius: 16px;
                    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
                    max-height: 90vh;
                    display: flex;
                    flex-direction: column;
                    z-index: 1050;
                    overflow: hidden;
                    animation: sof-modal-show 0.15s cubic-bezier(0.16, 1, 0.3, 1);
                }

                @keyframes sof-modal-show {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }

                .sof-modal-close {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    background: #ffffff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #64748b;
                    cursor: pointer;
                    transition: all 0.1s ease;
                }

                .sof-modal-close:hover {
                    background-color: #f1f5f9;
                    color: #1e293b;
                }

                .sof-modal-body {
                    padding: 24px;
                    overflow-y: auto;
                    flex: 1;
                }

                .sof-modal-net {
                    background-color: #f8fafc;
                    border-top: 1.5px solid #e2e8f0;
                    padding: 14px 24px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .sof-modal-net-label {
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: #475569;
                }

                .sof-modal-net-value {
                    font-size: 1.05rem;
                    font-weight: 800;
                    color: #4f46e5;
                }

                /* Popup split action buttons */
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
                    border: 1.5px solid #e0e7ff;
                    color: #4f46e5;
                    background: #f5f3ff;
                }
                .sof-popup-btn-add:hover, .sof-popup-btn-add:focus {
                    background: #4f46e5;
                    color: #fff;
                    border-color: #4f46e5;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
                }
                .sof-popup-btn-end {
                    padding: 0 12px;
                    border: 1.5px solid #bfdbfe;
                    color: #1d4ed8;
                    background: #eff6ff;
                    gap: 4px;
                }
                .sof-popup-btn-end:hover, .sof-popup-btn-end:focus {
                    background: #2563eb;
                    color: #fff;
                    border-color: #2563eb;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
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

                /* ── ADD CUSTOMER BUTTON ── */
                .sof-add-customer-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(135deg, #312e81 0%, #4f46e5 100%);
                    border: none;
                    border-radius: 10px;
                    color: #ffffff;
                    padding: 0 16px;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    outline: none;
                    box-shadow: 0 4px 12px rgba(49, 46, 129, 0.25);
                }
                .sof-add-customer-btn:hover, .sof-add-customer-btn:focus {
                    background: linear-gradient(135deg, #4f46e5 0%, #312e81 100%);
                    color: #ffffff;
                    box-shadow: 0 6px 16px rgba(49, 46, 129, 0.35);
                    transform: translateY(-1px);
                }
                `
            }} />
        </div>
    );
};

export default SalesReturnForm;