import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import Select from 'react-select';
import SalesService from '../../../services/SalesService';
import InventoryService, { getPriceList, getApplicablePriceListForLedger } from '../../../services/InventoryService';
import LogisticsService from '../../../services/LogisticsService';
import * as FinanceService from '../../../services/FinanceService';
import { fetchPrefixConfigurations } from '../../../services/PrefixService';
import swal from 'sweetalert';
import { usePageTitle } from '../../../context/TitleContext';
import { formatDate } from '../../../utils/dateUtils';
import { State, Country } from 'country-state-city';

/* ── helper: format default numeric values as empty strings for placeholders ── */
const cleanZeroValue = (val) => {
    if (val === undefined || val === null || val === '') return '';
    const num = parseFloat(val);
    if (isNaN(num) || num === 0) return '';
    return val;
};

/* ── helper: format date as dd-mm-yyyy ── */
const formatSODate = (dateVal) => {
    if (!dateVal) return '';
    try {
        const clean = String(dateVal).trim().split('T')[0];
        const parts = clean.split('-');
        if (parts.length === 3 && parts[0].length === 4) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}-${month}-${year}`;
        }
    } catch (_) {}
    return String(dateVal);
};


/* ── helpers: state & country resolution (KL -> Kerala, IN -> India) ── */
const formatStateName = (code, countryCode = 'IN') => {
    if (!code) return '';
    const trimmed = String(code).trim();
    const upper = trimmed.toUpperCase();
    if (upper === 'KL' || upper === '32') return 'Kerala';
    if (upper === 'IN') return 'India';
    try {
        const stateObj = State.getStateByCodeAndCountry(upper, countryCode) || State.getStateByCodeAndCountry(trimmed, countryCode);
        if (stateObj?.name) return stateObj.name;
        const countryObj = Country.getCountryByCode(upper);
        if (countryObj?.name) return countryObj.name;
    } catch (e) { }
    return trimmed;
};

const formatCountryName = (code) => {
    if (!code) return '';
    const trimmed = String(code).trim();
    const upper = trimmed.toUpperCase();
    if (upper === 'IN') return 'India';
    if (upper === 'KL' || upper === '32') return 'Kerala';
    try {
        const countryObj = Country.getCountryByCode(upper);
        if (countryObj?.name) return countryObj.name;
    } catch (e) { }
    return trimmed;
};

const replaceStateCountryCodes = (text) => {
    if (!text) return '';
    return String(text)
        .replace(/\bKL\b/gi, 'Kerala')
        .replace(/\bIN\b/g, 'India');
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

/* ── helper: find applicable GST percentage from stock item rates ── */
const getApplicableGst = (itemObj, entryDate) => {
    if (!itemObj) return 0;
    const rates = itemObj.gst_rates || itemObj.item_gst_rates;
    if (!rates || rates.length === 0) {
        return parseFloat(itemObj.gst_percentage) || 0;
    }

    const targetDate = entryDate ? entryDate.split('T')[0] : '';

    // Filter rates where applicable_date <= targetDate
    const applicableRates = rates
        .filter(r => !targetDate || (r.applicable_date && r.applicable_date <= targetDate))
        .sort((a, b) => new Date(b.applicable_date) - new Date(a.applicable_date));

    if (applicableRates.length > 0) {
        return parseFloat(applicableRates[0].igst_percent ?? applicableRates[0].gst_percentage ?? applicableRates[0].rate ?? 0) || 0;
    }

    // If none are applicable before targetDate, fallback to the oldest available rate
    const sortedAll = [...rates].sort((a, b) => new Date(a.applicable_date) - new Date(b.applicable_date));
    return parseFloat(sortedAll[0]?.igst_percent ?? sortedAll[0]?.gst_percentage ?? 0) || parseFloat(itemObj.gst_percentage) || 0;
};

/* ── helper: create a blank split ── */
const createBlankSplit = (item = {}) => ({
    warehouse: item.warehouse || '',
    warehouseName: item.warehouseName || '',
    batch_number: item.batch_number || '',
    expiry_date: item.expiry_date || '',
    manufacture_date: item.manufacture_date || '',
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
    let totalGrossAmt = 0;

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
        totalGrossAmt += base;

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

    const avgRate = totalQty > 0 ? (totalGrossAmt / totalQty) : 0;

    return {
        ...item,
        warehouse: finalSplits[0]?.warehouse || '',
        warehouseName: finalSplits[0]?.warehouseName || '',
        batch_number: finalSplits[0]?.batch_number || '',
        expiry_date: finalSplits[0]?.expiry_date || '',
        manufacture_date: finalSplits[0]?.manufacture_date || '',
        quantity: totalQty.toFixed(2),
        rate: avgRate.toFixed(2),
        discount_percent: finalSplits[0]?.discount_percent || '0.00',
        discount_amount: totalDiscountAmt.toFixed(2),
        cgst_amount: cgst.toFixed(2),
        sgst_amount: sgst.toFixed(2),
        igst_amount: igst.toFixed(2),
        amount: totalAmt.toFixed(2),
        splits: finalSplits
    };
};


/* ── helper: track date picker state ── */
const trackDatePicker = (active) => {
    if (!active || active.dataset.pickerOpen === 'true') return;

    try {
        active.showPicker();
    } catch (err) {
        console.error('showPicker is not supported on this browser:', err);
    }
    active.dataset.pickerOpen = 'true';

    const clearPicker = () => {
        active.removeAttribute('data-picker-open');
        active.dataset.pickerJustClosed = 'true';
        active.removeEventListener('change', clearPicker);
        active.removeEventListener('blur', clearPicker);
        active.removeEventListener('keydown', handleKeysWhileOpen);
    };

    const handleKeysWhileOpen = (evt) => {
        if (evt.key === 'Escape') {
            clearPicker();
        } else if (evt.key === 'Enter') {
            // Let the native enter key select the date and close the picker first,
            // then clear the picker open state.
            setTimeout(clearPicker, 100);
        }
    };

    active.addEventListener('change', clearPicker);
    active.addEventListener('blur', clearPicker);
    active.addEventListener('keydown', handleKeysWhileOpen);
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
            // Let native Enter select and close the option picker,
            // then clear the open state after a short delay.
            setTimeout(clearOpen, 100);
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

        const tagName = active.tagName.toLowerCase();
        // Allow default behavior for buttons or submit inputs
        if (active.type === 'submit' || tagName === 'button') {
            return;
        }



        if (tagName === 'select') {
            if (active.dataset.open === 'true') {
                // Open: let native selection happen, don't navigate
                return;
            }
            // Closed: let Enter navigate to the next element
        }

        e.preventDefault();

        // Find all focusable input/select controls in this container
        const container = e.currentTarget;
        const focusables = Array.from(
            container.querySelectorAll(
                'input:not([readonly]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button[data-ss-trigger]:not([disabled]), .sof-btn-save'
            )
        );

        const index = focusables.indexOf(active);
        if (index > -1 && index < focusables.length - 1) {
            focusables[index + 1].focus();
        }
    }
};

/* ── helper: handle select option change and auto-focus next column ── */
const handleSelectChangeNavigation = (e) => {
    const active = e.target;
    if (active && active.tagName.toLowerCase() === 'select' && !active.classList.contains('sof-item-search-select')) {
        if (active.dataset.open === 'true') return;
        const container = e.currentTarget;
        setTimeout(() => {
            if (document.activeElement !== active) return;
            const focusables = Array.from(
                container.querySelectorAll(
                    'input:not([readonly]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button[data-ss-trigger]:not([disabled]), .sof-btn-save'
                )
            );
            const index = focusables.indexOf(active);
            if (index > -1 && index < focusables.length - 1) {
                focusables[index + 1].focus();
            }
        }, 50);
    }
};

/* ── grid layout mapping of fields in the form ── */
const FORM_GRID = [
    ['invoice_no', 'entry_date', 'order_type', 'customer_ledger'],
    ['dispatch_through', 'document_no', 'document_date', 'delivery_location'],
    ['driver', 'preferred_delivery_date'],
    ['other_reference', 'terms_of_delivery']
];

/* ── helper: handle Arrow key focus navigation ── */
const handleArrowNavigation = (e) => {
    const active = document.activeElement;
    if (!active) return;

    const key = e.key;
    const isArrowUp = key === 'ArrowUp';
    const isArrowDown = key === 'ArrowDown';
    const isArrowLeft = key === 'ArrowLeft';
    const isArrowRight = key === 'ArrowRight';

    if (!isArrowUp && !isArrowDown && !isArrowLeft && !isArrowRight) return;

    const tagName = active.tagName.toLowerCase();
    const type = active.type;

    // If it is a date/time input, DO NOT intercept arrow keys at all so browser native segment editing works!
    if (type === 'date' || type === 'datetime-local' || type === 'time') {
        return;
    }

    // 1. Textarea: don't intercept arrows
    if (tagName === 'textarea') return;

    // 2. Select dropdown handling
    if (tagName === 'select') {
        if (active.dataset.open === 'true') return;
    }

    // 3. Caret boundary checks for inputs
    if (tagName === 'input' && type !== 'button' && type !== 'submit') {
        let isAtStart = true;
        let isAtEnd = true;
        try {
            if (active.readOnly) {
                isAtStart = true;
                isAtEnd = true;
            } else if (active.selectionStart !== null && active.selectionEnd !== null) {
                const valLen = active.value ? active.value.length : 0;
                isAtStart = active.selectionStart === 0;
                isAtEnd = active.selectionEnd === valLen;
            }
        } catch (err) {
            if (type === 'number') {
                if (isArrowLeft || isArrowRight) return;
            } else {
                isAtStart = true;
                isAtEnd = true;
            }
        }

        if (isArrowLeft && !isAtStart) return;
        if (isArrowRight && !isAtEnd) return;
    }

    const activeName = active.getAttribute('name');
    let targetName = null;

    if (activeName) {
        let rIndex = -1;
        let cIndex = -1;

        for (let r = 0; r < FORM_GRID.length; r++) {
            const col = FORM_GRID[r].indexOf(activeName);
            if (col > -1) {
                rIndex = r;
                cIndex = col;
                break;
            }
        }

        if (rIndex > -1 && cIndex > -1) {
            if (isArrowLeft && cIndex > 0) {
                targetName = FORM_GRID[rIndex][cIndex - 1];
            } else if (isArrowRight && cIndex < FORM_GRID[rIndex].length - 1) {
                targetName = FORM_GRID[rIndex][cIndex + 1];
            } else if (isArrowUp && rIndex > 0) {
                const prevRow = FORM_GRID[rIndex - 1];
                targetName = prevRow[Math.min(cIndex, prevRow.length - 1)];
            } else if (isArrowDown && rIndex < FORM_GRID.length - 1) {
                const nextRow = FORM_GRID[rIndex + 1];
                targetName = nextRow[Math.min(cIndex, nextRow.length - 1)];
            }
        }
    }

    const container = e.currentTarget;

    if (targetName) {
        const targetEl = container.querySelector(`[name="${targetName}"]`);
        if (targetEl && !targetEl.disabled) {
            e.preventDefault();
            targetEl.focus();
            return;
        }
    }

    // Fallback: linear navigation through focusables
    e.preventDefault();
    const focusables = Array.from(
        container.querySelectorAll(
            'input:not([readonly]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button[data-ss-trigger]:not([disabled]), .sof-btn-save'
        )
    );

    const index = focusables.indexOf(active);
    let goNext = isArrowDown || isArrowRight;
    let goPrev = isArrowUp || isArrowLeft;

    if (goNext && index > -1 && index < focusables.length - 1) {
        focusables[index + 1].focus();
    } else if (goPrev && index > 0) {
        focusables[index - 1].focus();
    }
};

/* ── helper: handle both Enter and Arrow key focus navigation ── */
const handleKeyDownNavigation = (e) => {
    if (e.key === 'Enter') {
        handleEnterNavigation(e);
    } else if (e.key.startsWith('Arrow')) {
        handleArrowNavigation(e);
    }
};

/* ══════════════════════════════════════════════════════════
   SEARCHABLE SELECT — combobox style
   * Closed: shows selected label (or placeholder) + ▼ arrow, looks like a select
   * Open:   field becomes a text input at top, filtered list drops below
   * Keys:   ArrowDown/Up navigate list, Enter selects, Escape closes
══════════════════════════════════════════════════════════ */
const SearchableSelect = ({
    value, options = [], onChange, placeholder = 'Select...', disabled = false,
    className = '', onKeyDown, style = {}, name, triggerRef, ...dataProps
}) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [highlightIdx, setHighlightIdx] = useState(-1);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const listRef = useRef(null);
    const justSelectedRef = useRef(false);
    const justClosedRef = useRef(false);

    const selectedLabel = options.find(o => String(o.value) === String(value))?.label || '';

    const filtered = query.trim()
        ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
        : options;

    const openDropdown = useCallback(() => {
        if (disabled) return;
        const initIdx = value ? options.findIndex(o => String(o.value) === String(value)) : -1;
        setHighlightIdx(initIdx >= 0 ? initIdx : 0);
        setQuery('');
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
        setOpen(true);
        setTimeout(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
        }, 10);
    }, [disabled, options, value]);

    const closeDropdown = useCallback((restoreFocus = true) => {
        setOpen(false);
        setQuery('');
        setHighlightIdx(-1);
        justClosedRef.current = true;
        if (restoreFocus) {
            setTimeout(() => containerRef.current?.querySelector('[data-ss-trigger]')?.focus(), 10);
        }
    }, []);

    const selectOption = useCallback((opt) => {
        onChange({ target: { value: opt.value } });
        justSelectedRef.current = false;
        closeDropdown(false);
        setTimeout(() => {
            const container = containerRef.current;
            if (container) {
                // Check if inside Popup modal table
                const prow = container.getAttribute('data-prow');
                const pcol = container.getAttribute('data-pcol');
                if (prow !== null && pcol !== null) {
                    const r = parseInt(prow, 10);
                    const c = parseInt(pcol, 10);
                    const getPopupEl = (rowIdx, colIdx) => {
                        const target = document.querySelector(`[data-prow="${rowIdx}"][data-pcol="${colIdx}"]`);
                        if (!target) return null;
                        if (['input', 'select', 'button'].includes(target.tagName.toLowerCase())) {
                            return target;
                        }
                        const trigger = target.querySelector('[data-ss-trigger]');
                        return trigger || target;
                    };
                    const nextEl = getPopupEl(r, c + 1);
                    if (nextEl) {
                        nextEl.focus();
                        return;
                    }
                }

                // Check if inside main table row
                const tr = container.closest('tr');
                if (tr) {
                    const qtyInput = tr.querySelector('input[data-col="1"]');
                    if (qtyInput && !qtyInput.disabled) {
                        qtyInput.focus();
                        return;
                    }
                }
            }

            const popupModal = document.querySelector('.sof-modal');
            if (popupModal) {
                return;
            }

            const form = containerRef.current?.closest('form');
            if (form) {
                const focusables = Array.from(
                    form.querySelectorAll(
                        'input:not([readonly]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button[data-ss-trigger]:not([disabled]), .sof-btn-save'
                    )
                );
                const trigger = containerRef.current?.querySelector('[data-ss-trigger]');
                const index = focusables.indexOf(trigger);
                if (index > -1 && index < focusables.length - 1) {
                    focusables[index + 1].focus();
                }
            }
        }, 60);
    }, [onChange, closeDropdown]);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                closeDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open, closeDropdown]);

    // Position listener
    useEffect(() => {
        if (!open) return;
        const updateCoords = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
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

    // Keydown on the closed trigger button
    const handleTriggerKeyDown = (e) => {
        if (disabled) return;
        if (e.key === 'Enter') {
            if (justSelectedRef.current) {
                justSelectedRef.current = false;
                if (onKeyDown) onKeyDown(e);
                return;
            }
            if (value && !open) {
                const tr = containerRef.current?.closest('tr');
                if (tr) {
                    const qtyInput = tr.querySelector('input[data-col="1"]');
                    if (qtyInput && !qtyInput.disabled) {
                        e.preventDefault();
                        e.stopPropagation();
                        qtyInput.focus();
                        return;
                    }
                }
                const form = containerRef.current?.closest('form');
                if (form) {
                    const focusables = Array.from(
                        form.querySelectorAll(
                            'input:not([readonly]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button[data-ss-trigger]:not([disabled]), .sof-btn-save'
                        )
                    );
                    const trigger = containerRef.current?.querySelector('[data-ss-trigger]');
                    const index = focusables.indexOf(trigger);
                    if (index > -1 && index < focusables.length - 1) {
                        e.preventDefault();
                        e.stopPropagation();
                        focusables[index + 1].focus();
                        return;
                    }
                }
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

    const handleFocus = () => {
        if (disabled) return;
        if (justClosedRef.current) {
            justClosedRef.current = false;
            return;
        }
        openDropdown();
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
                    ref={triggerRef}
                    type="button"
                    data-ss-trigger
                    name={name}
                    className={className}
                    disabled={disabled}
                    onFocus={handleFocus}
                    onKeyDown={handleTriggerKeyDown}
                    onClick={openDropdown}
                    onBlur={() => { justSelectedRef.current = false; justClosedRef.current = false; }}
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
};;

/* ══════════════════════════════════════════════════════════
   ITEM ENTRY POPUP
   * Uses handleEnterNavigation for Enter key form navigation
══════════════════════════════════════════════════════════ */
const ItemEntryPopup = ({ item, isInterState, warehouses, stockItems, units = [], onSave, onClose, isEdit, productConfig }) => {
    const { maintain_batch, maintain_manufacture_date, maintain_expiry_date, maintain_warehouse } = productConfig || {};
    const [availableBatches, setAvailableBatches] = useState([]);
    const [localWarehouses, setLocalWarehouses] = useState([]);

    // Focus the first cell (row 0, col 0) of the popup grid table upon opening
    useEffect(() => {
        const t = setTimeout(() => {
            const firstContainer = document.querySelector('[data-prow="0"][data-pcol="0"]');
            if (firstContainer) {
                const trigger = firstContainer.querySelector('[data-ss-trigger]');
                (trigger || firstContainer).focus();
            }
        }, 120);
        return () => clearTimeout(t);
    }, []);

    // Load available batches and warehouses for the selected stock item
    useEffect(() => {
        // Support both field names: 'product' (SalesInvoiceForm) and 'stock_item' (other forms)
        const itemId = item && (item.product || item.stock_item);
        if (itemId) {
            // Load batches
            InventoryService.getItemBatches(itemId)
                .then(res => {
                    setAvailableBatches(Array.isArray(res.data) ? res.data : []);
                })
                .catch(() => {
                    setAvailableBatches([]);
                });

            // Load warehouses with stock for this item
            InventoryService.getItemWarehouses(itemId)
                .then(res => {
                    setLocalWarehouses(Array.isArray(res.data) ? res.data : []);
                })
                .catch(() => {
                    setLocalWarehouses([]);
                });
        }
    }, [item && (item.product || item.stock_item)]);

    // Calculate modal size based on configured columns to avoid squishing columns
    let dynamicMaxWidth = 670; // Base width for Qty, Rate, Disc %, Amount, Actions, and padding
    dynamicMaxWidth += 140; // Per (units) column — always shown
    if (maintain_warehouse) dynamicMaxWidth += 180;
    if (maintain_batch) dynamicMaxWidth += 170; // Increased width for batch select with quantity info
    if (maintain_expiry_date) dynamicMaxWidth += 150;
    if (maintain_manufacture_date) dynamicMaxWidth += 150;

    const [splits, setSplits] = useState(() => {
        let initialSplits = [];
        if (Array.isArray(item.splits) && item.splits.length > 0) {
            initialSplits = [...item.splits];
        } else {
            // Fallback for items that don't have explicit splits yet (e.g. manually added)
            initialSplits = [{
                ...item,
                warehouse: item.warehouse || '',
                warehouseName: item.warehouseName || '',
                batch_number: item.batch_number || '',
                expiry_date: item.expiry_date || '',
                manufacture_date: item.manufacture_date || '',
                quantity: item.quantity,
                rate: item.rate,
                discount_percent: item.discount_percent,
                discount_amount: item.discount_amount || '0.00',
                amount: item.amount || '0.00'
            }];
        }

        return initialSplits.map(s => ({
            ...s,
            per: s.per || '',
            perName: s.perName || '',
            quantity: cleanZeroValue(s.quantity),
            rate: cleanZeroValue(s.rate),
            discount_percent: cleanZeroValue(s.discount_percent)
        }));
    });

    const addSplitRow = () => {
        const nextIdx = splits.length;
        const currentPer = splits[0]?.per || item.per || '';
        const currentPerName = splits[0]?.perName || item.perName || '';
        const currentRate = splits[0]?.rate || item.rate || '';
        const currentDisc = splits[0]?.discount_percent || item.discount_percent || '';
        setSplits(prev => [
            ...prev,
            {
                warehouse: '',
                warehouseName: '',
                batch_number: '',
                expiry_date: '',
                manufacture_date: '',
                per: currentPer,
                perName: currentPerName,
                quantity: '',
                rate: currentRate,
                discount_percent: currentDisc,
                discount_amount: '0.00',
                amount: '0.00'
            }
        ]);

        const focusFirstField = () => {
            const nextContainer = document.querySelector(`[data-prow="${nextIdx}"][data-pcol="0"]`);
            if (nextContainer) {
                const trigger = nextContainer.querySelector('[data-ss-trigger]');
                const target = trigger || nextContainer;
                target.focus();
                setTimeout(() => {
                    const active = document.activeElement;
                    if (active && (active.closest(`[data-prow="${nextIdx}"][data-pcol="0"]`) || active.getAttribute('data-prow') === String(nextIdx))) {
                        return;
                    }
                    target.focus();
                }, 50);
            }
        };

        setTimeout(focusFirstField, 50);
        setTimeout(focusFirstField, 100);
        setTimeout(focusFirstField, 200);
        setTimeout(focusFirstField, 300);
    };

    const deleteSplitRow = (idx) => {
        if (splits.length === 1) {
            swal('Warning', 'At least one row is required.', 'warning');
            return;
        }
        setSplits(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSplitChange = (idx, field, value) => {
        setSplits(prev => {
            return prev.map((s, i) => {
                if (i !== idx) return s;
                const newSplit = { ...s, [field]: value };
                if (field === 'warehouse') {
                    const found = warehouses.find(w => String(w.id) === String(value));
                    newSplit.warehouseName = found ? found.name : '';
                }
                if (field === 'per') {
                    const found = units.find(u => String(u.id) === String(value));
                    newSplit.perName = found ? found.name : '';
                }
                const qty = parseFloat(newSplit.quantity) || 0;
                const rate = parseFloat(newSplit.rate) || 0;
                const disc = parseFloat(newSplit.discount_percent) || 0;
                const base = qty * rate;
                const disAmt = (base * disc) / 100;
                newSplit.discount_amount = disAmt.toFixed(2);
                newSplit.amount = (base - disAmt).toFixed(2);
                return newSplit;
            });
        });
    };

    const getConsolidatedQty = () => splits.reduce((sum, s) => sum + (parseFloat(s.quantity) || 0), 0);
    const getConsolidatedAmount = () => splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);

    const handleSave = () => {
        const validateDateValue = (val, label) => {
            if (!val) return null;
            const datePart = val.split('T')[0];
            const regex = /^\d{4}-\d{2}-\d{2}$/;
            if (!regex.test(datePart)) {
                return `Please fill the ${label} properly in the format dd/mm/yyyy.`;
            }

            const [yearStr, monthStr, dayStr] = datePart.split('-');
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);
            const day = parseInt(dayStr, 10);

            if (isNaN(year) || isNaN(month) || isNaN(day)) {
                return `Please fill the ${label} properly in the format dd/mm/yyyy.`;
            }

            if (year < 1900 || year > 2100) {
                return `Please fill the ${label} properly in the format dd/mm/yyyy.`;
            }

            const tempDate = new Date(year, month - 1, day);
            if (
                tempDate.getFullYear() !== year ||
                tempDate.getMonth() !== month - 1 ||
                tempDate.getDate() !== day
            ) {
                return `Please fill the ${label} properly in the format dd/mm/yyyy.`;
            }

            return null;
        };

        const checkDOMIncomplete = (row, col, label) => {
            if (col === -1) return null;
            const el = document.querySelector(`input[data-prow="${row}"][data-pcol="${col}"]`);
            if (el && el.validity && el.validity.badInput) {
                return `Please fill the ${label} properly in the format dd/mm/yyyy.`;
            }
            return null;
        };

        // Determine column indexes to target DOM input validity
        let colCounter = 0;
        if (maintain_warehouse) colCounter++;
        if (maintain_batch) colCounter++;
        const expiryCol = maintain_expiry_date ? colCounter++ : -1;
        const mfgCol = maintain_manufacture_date ? colCounter++ : -1;

        for (let i = 0; i < splits.length; i++) {
            const s = splits[i];
            if (maintain_warehouse && !s.warehouse) {
                swal('Required', `Please select a warehouse for row ${i + 1}.`, 'warning');
                return;
            }
            if (!s.quantity || parseFloat(s.quantity) <= 0) {
                swal('Required', `Quantity must be greater than 0 on row ${i + 1}.`, 'warning');
                return;
            }
            if (s.rate === '' || parseFloat(s.rate) < 0) {
                swal('Required', `Rate is required on row ${i + 1}.`, 'warning');
                return;
            }

            // Expiry Date validation
            if (maintain_expiry_date) {
                const err = validateDateValue(s.expiry_date, `Row ${i + 1} Expiry Date`) || checkDOMIncomplete(i, expiryCol, `Row ${i + 1} Expiry Date`);
                if (err) {
                    swal('Validation Error', err, 'warning');
                    return;
                }
            }

            // Mfg Date validation
            if (maintain_manufacture_date) {
                const err = validateDateValue(s.manufacture_date, `Row ${i + 1} Mfg. Date`) || checkDOMIncomplete(i, mfgCol, `Row ${i + 1} Mfg. Date`);
                if (err) {
                    swal('Validation Error', err, 'warning');
                    return;
                }
            }
        }

        // Validate total allocated quantities against available stock for Warehouse and Batch
        if (maintain_warehouse) {
            const warehouseTotals = {};
            splits.forEach(s => {
                if (s.warehouse) {
                    const key = String(s.warehouse);
                    warehouseTotals[key] = (warehouseTotals[key] || 0) + (parseFloat(s.quantity) || 0);
                }
            });
            for (const [wId, allocatedQty] of Object.entries(warehouseTotals)) {
                const whObj = localWarehouses.find(w => String(w.id) === String(wId));
                const availStock = whObj ? (whObj.available_quantity ?? 0) : 0;
                if (whObj && allocatedQty > availStock) {
                    swal('Stock Exceeded', `Entered total quantity (${allocatedQty}) for warehouse "${whObj.name}" exceeds available stock (${availStock}).`, 'warning');
                    return;
                }
            }
        }

        if (maintain_batch) {
            const batchTotals = {};
            splits.forEach(s => {
                if (s.batch_number) {
                    const key = String(s.batch_number);
                    batchTotals[key] = (batchTotals[key] || 0) + (parseFloat(s.quantity) || 0);
                }
            });
            for (const [batchNum, allocatedQty] of Object.entries(batchTotals)) {
                const matchingBatches = availableBatches.filter(b => String(b.batch_number) === String(batchNum));
                const totalBatchAvail = matchingBatches.reduce((sum, b) => sum + (b.available_quantity || 0), 0);
                if (matchingBatches.length > 0 && allocatedQty > totalBatchAvail) {
                    swal('Stock Exceeded', `Entered total quantity (${allocatedQty}) for batch "${batchNum}" exceeds available batch stock (${totalBatchAvail}).`, 'warning');
                    return;
                }
            }
        }

        const consolidatedItem = consolidateSplits({ ...item, splits }, isInterState);
        onSave(consolidatedItem);
    };

    const fmtAmt = n => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const handlePopupKeyDown = (e, rowIdx, colIdx, totalCols) => {
        const swalModal = document.querySelector('.swal-overlay');
        if (swalModal && getComputedStyle(swalModal).opacity !== '0' && getComputedStyle(swalModal).display !== 'none') {
            return;
        }
        const key = e.key;
        const active = e.target;
        const tagName = active.tagName.toLowerCase();
        const splitsLength = splits.length;

        const getPopupInputElement = (r, c) => {
            const container = document.querySelector(`[data-prow="${r}"][data-pcol="${c}"]`);
            if (!container) return null;
            if (['input', 'select', 'button'].includes(container.tagName.toLowerCase())) {
                return container;
            }
            try {
                const trigger = container.querySelector('[data-ss-trigger]');
                return trigger || container;
            } catch (err) {
                return container;
            }
        };

        if (active.type === 'date' || active.type === 'datetime-local' || active.type === 'time') {
            if (key !== 'Enter' && key !== 'Delete') {
                return;
            }
        }

        // Select element handling
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
                // If it is the last row, pressing ArrowDown on the "End of Row" button
                // automatically appends a new split row and focuses its Warehouse select.
                if (colIdx === totalCols - 2) {
                    addSplitRow();
                    setTimeout(() => {
                        const el = getPopupInputElement(rowIdx + 1, 0);
                        if (el) el.focus();
                    }, 80);
                }
            }
        } else if (key === 'ArrowLeft') {
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
                    setTimeout(() => {
                        const el = getPopupInputElement(rowIdx, colIdx + 1);
                        if (el) el.focus();
                    }, 10);
                }
            }
        } else if (key === 'Enter') {
            if (active.type === 'date') {
                if (active.dataset.pickerJustClosed === 'true') {
                    active.removeAttribute('data-picker-just-closed');
                } else if (active.dataset.pickerOpen !== 'true') {
                    e.preventDefault();
                    trackDatePicker(active);
                    return;
                } else {
                    return;
                }
            }

            const split = splits[rowIdx];
            let firstColVal = null;
            if (maintain_warehouse) {
                firstColVal = split ? split.warehouse : null;
            } else if (maintain_batch) {
                firstColVal = split ? split.batch_number : null;
            } else if (maintain_expiry_date) {
                firstColVal = split ? split.expiry_date : null;
            } else if (maintain_manufacture_date) {
                firstColVal = split ? split.manufacture_date : null;
            } else {
                firstColVal = split ? split.quantity : null;
            }
            const isFirstColEmpty = colIdx === 0 && (!firstColVal || String(firstColVal).trim() === '');

            e.preventDefault();

            if (isFirstColEmpty) {
                if (active.hasAttribute('data-ss-trigger') || active.classList.contains('sof-table-input') || active.closest('[data-pcol]')) {
                    active.click();
                    return;
                }
                deleteSplitRow(rowIdx);
                setTimeout(() => {
                    const popupSaveBtn = document.querySelector('.sof-modal-footer .btn-primary');
                    if (popupSaveBtn) {
                        popupSaveBtn.focus();
                    }
                }, 80);
                return;
            }


            if (colIdx === totalCols - 1) {
                // Pressing Enter on the "Delete" button
                deleteSplitRow(rowIdx);
                setTimeout(() => {
                    const nextRowIdx = rowIdx > 0 ? rowIdx - 1 : 0;
                    const el = getPopupInputElement(nextRowIdx, totalCols - 1);
                    if (el) el.focus();
                }, 100);
            } else if (colIdx === totalCols - 3 || colIdx === totalCols - 2) {
                // Disc % or + button: add new split row and focus first cell
                addSplitRow();
                setTimeout(() => {
                    const el = getPopupInputElement(splitsLength, 0);
                    if (el) el.focus();
                }, 80);
            } else {
                setTimeout(() => {
                    const el = getPopupInputElement(rowIdx, colIdx + 1);
                    if (el) el.focus();
                }, 10);
            }
        } else if (key === 'Delete') {
            e.preventDefault();
            deleteSplitRow(rowIdx);
            setTimeout(() => {
                const nextRowIdx = rowIdx < splitsLength - 1 ? rowIdx : (rowIdx > 0 ? rowIdx - 1 : 0);
                const el = getPopupInputElement(nextRowIdx, totalCols - 2);
                if (el) el.focus();
            }, 100);
        }
    };

    return (
        <div className="sof-modal-backdrop" onClick={onClose}>
            <form className="sof-modal" style={{ maxWidth: `${dynamicMaxWidth}px`, width: '95%' }} onClick={e => e.stopPropagation()} onSubmit={e => e.preventDefault()}>
                {/* header */}
                <div className="sof-modal-header d-flex align-items-center justify-content-between gap-3" style={{ background: '#ffffff', borderBottom: 'none', padding: '18px 24px 0 24px' }}>
                    <div className="d-flex align-items-center gap-3">
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '50%',
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                <polyline points="9 22 9 12 15 12 15 22" />
                            </svg>
                        </div>
                        <div>
                            <h5 style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem', color: '#1e293b' }}>
                                Batch & Warehouse Details Entry
                            </h5>
                            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                                {item.productName || 'Select a Product'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: '1.5rem', lineHeight: 1, color: '#94a3b8',
                            padding: '0 4px', flexShrink: 0,
                        }}
                    >
                        &times;
                    </button>
                </div>
                <div style={{ padding: '0 24px' }}>
                    <div style={{ borderBottom: '1px solid #e2e8f0', marginTop: '12px', marginBottom: '0px' }} />
                </div>
                {/* body */}
                <div className="sof-modal-body" style={{ padding: '24px' }}>
                    <div className="sof-table-scroll" style={{ marginBottom: '20px' }}>
                        <table className="sof-table">
                            <thead>
                                <tr>
                                    {maintain_warehouse && <th style={{ minWidth: '150px' }}>Warehouse</th>}
                                    {maintain_batch && <th style={{ minWidth: '120px' }}>Batch</th>}
                                    {maintain_expiry_date && <th style={{ minWidth: '130px' }}>Expiry Date</th>}
                                    {maintain_manufacture_date && <th style={{ minWidth: '130px' }}>Mfg. Date</th>}
                                    <th style={{ minWidth: '120px' }}>Per</th>
                                    <th className="sof-th-right" style={{ minWidth: '90px' }}>Qty</th>
                                    <th className="sof-th-right" style={{ minWidth: '110px' }}>Rate</th>
                                    <th className="sof-th-right" style={{ minWidth: '80px' }}>Disc %</th>
                                    <th className="sof-th-right" style={{ minWidth: '120px' }}>Amount</th>
                                    <th className="sof-th-center" style={{ minWidth: '190px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {splits.map((split, idx) => {
                                    let colCounter = 0;
                                    const warehouseCol = maintain_warehouse ? colCounter++ : -1;
                                    const batchCol = maintain_batch ? colCounter++ : -1;
                                    const expiryCol = maintain_expiry_date ? colCounter++ : -1;
                                    const mfgCol = maintain_manufacture_date ? colCounter++ : -1;
                                    const perCol = colCounter++;
                                    const qtyCol = colCounter++;
                                    const rateCol = colCounter++;
                                    const discCol = colCounter++;
                                    const plusCol = colCounter++;
                                    const deleteCol = colCounter++;
                                    const totalCols = colCounter;

                                    return (
                                        <tr key={idx} className="sof-tr">
                                            {maintain_warehouse && (
                                                <td style={{ verticalAlign: 'middle' }}>
                                                    <SearchableSelect
                                                        className="sof-table-input"
                                                        data-prow={idx}
                                                        data-pcol={warehouseCol}
                                                        value={split.warehouse || ''}
                                                        options={[
                                                            { value: '', label: '— Select —' },
                                                            ...localWarehouses.map(w => {
                                                                const usedByOthers = splits
                                                                    .filter((s, sIdx) => sIdx !== idx && String(s.warehouse) === String(w.id))
                                                                    .reduce((sum, s) => sum + (parseFloat(s.quantity) || 0), 0);
                                                                const remAvail = Math.max(0, (w.available_quantity ?? 0) - usedByOthers);
                                                                return {
                                                                    value: String(w.id),
                                                                    label: `${w.name} [Avail: ${remAvail}]`
                                                                };
                                                            })
                                                        ]}
                                                        onChange={e => {
                                                            if (warehouseCol === 0 && (!e.target.value || String(e.target.value).trim() === '')) {
                                                                deleteSplitRow(idx);
                                                                setTimeout(() => {
                                                                    const popupSaveBtn = document.querySelector('.sof-modal-footer .btn-primary');
                                                                    if (popupSaveBtn) {
                                                                        popupSaveBtn.focus();
                                                                    }
                                                                }, 80);
                                                            } else {
                                                                handleSplitChange(idx, 'warehouse', e.target.value);
                                                            }
                                                        }}
                                                        onKeyDown={e => handlePopupKeyDown(e, idx, warehouseCol, totalCols)}
                                                        placeholder="— Select —"
                                                    />
                                                </td>
                                            )}
                                            {maintain_batch && (
                                                <td style={{ verticalAlign: 'middle' }}>
                                                    {(() => {
                                                        // Filter batches to only show those belonging to the selected warehouse,
                                                        // or batches without a warehouse assigned (null/unassigned)
                                                        const filteredBatches = availableBatches.filter(b => {
                                                            if (!maintain_warehouse || !split.warehouse) return true;
                                                            return b.warehouse_id == null || String(b.warehouse_id) === String(split.warehouse);
                                                        });

                                                        // Deduplicate by batch_number - summing the quantities of any duplicate keys
                                                        const mergedBatches = Object.values(
                                                            filteredBatches.reduce((acc, b) => {
                                                                const key = b.batch_number;
                                                                if (!acc[key]) {
                                                                    acc[key] = { ...b };
                                                                } else {
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
                                                            { value: '', label: '— Select Batch —' },
                                                            ...mergedBatches.map(b => {
                                                                const usedByOthers = splits
                                                                    .filter((s, sIdx) => sIdx !== idx && String(s.batch_number) === String(b.batch_number))
                                                                    .reduce((sum, s) => sum + (parseFloat(s.quantity) || 0), 0);
                                                                const remAvail = Math.max(0, (b.available_quantity ?? 0) - usedByOthers);
                                                                return {
                                                                    value: b.batch_number,
                                                                    label: `${b.batch_number}${b.expiry_date ? ` (Exp: ${b.expiry_date})` : ''} [Avail: ${remAvail}]`,
                                                                    original: b
                                                                };
                                                            })
                                                        ];

                                                        // This split may already carry a known batch (e.g. pulled in
                                                        // from a sales order) that isn't in the live availability
                                                        // list for this specific warehouse — most commonly because
                                                        // that warehouse currently shows 0 stock for it. Don't let
                                                        // that hide already-known, valid data: add it as an option
                                                        // (using the split's own dates) so it still displays and
                                                        // remains selected instead of falling back to the placeholder.
                                                        if (split.batch_number && !batchOptions.some(o => String(o.value) === String(split.batch_number))) {
                                                            batchOptions.push({
                                                                value: split.batch_number,
                                                                label: `${split.batch_number}${split.expiry_date ? ` (Exp: ${split.expiry_date})` : ''} [Avail: 0]`,
                                                                original: {
                                                                    batch_number: split.batch_number,
                                                                    expiry_date: split.expiry_date,
                                                                    manufacture_date: split.manufacture_date,
                                                                    warehouse_id: split.warehouse,
                                                                    available_quantity: 0
                                                                }
                                                            });
                                                        }

                                                        return (
                                                            <SearchableSelect
                                                                className="sof-table-input"
                                                                data-prow={idx}
                                                                data-pcol={batchCol}
                                                                value={split.batch_number || ''}
                                                                options={batchOptions}
                                                                onChange={e => {
                                                                    const val = e.target.value;
                                                                    handleSplitChange(idx, 'batch_number', val);

                                                                    const selectedOpt = batchOptions.find(o => String(o.value) === String(val));
                                                                    const matched = selectedOpt ? selectedOpt.original : null;
                                                                    if (matched) {
                                                                        if (maintain_manufacture_date && matched.manufacture_date) {
                                                                            handleSplitChange(idx, 'manufacture_date', matched.manufacture_date);
                                                                        }
                                                                        if (maintain_expiry_date && matched.expiry_date) {
                                                                            handleSplitChange(idx, 'expiry_date', matched.expiry_date);
                                                                        }
                                                                        if (maintain_warehouse && matched.warehouse_id != null && !split.warehouse) {
                                                                            handleSplitChange(idx, 'warehouse', String(matched.warehouse_id));
                                                                        }
                                                                    }
                                                                }}
                                                                onKeyDown={e => handlePopupKeyDown(e, idx, batchCol, totalCols)}
                                                                placeholder="— Select Batch —"
                                                            />
                                                        );
                                                    })()}
                                                </td>
                                            )}
                                            {maintain_expiry_date && (
                                                <td style={{ verticalAlign: 'middle' }}>
                                                    <input
                                                        type="date"
                                                        className="sof-table-input"
                                                        data-prow={idx}
                                                        data-pcol={expiryCol}
                                                        value={split.expiry_date || ''}
                                                        onChange={e => handleSplitChange(idx, 'expiry_date', e.target.value)}
                                                        onKeyDown={e => handlePopupKeyDown(e, idx, expiryCol, totalCols)}
                                                        onDoubleClick={e => e.target.classList.add('sof-input-edit-segments')}
                                                        onBlur={e => {
                                                            e.target.classList.remove('sof-input-edit-segments');
                                                            e.target.removeAttribute('data-picker-just-closed');
                                                        }}
                                                        onFocus={e => {
                                                            e.target.removeAttribute('data-picker-just-closed');
                                                        }}
                                                    />
                                                </td>
                                            )}
                                            {maintain_manufacture_date && (
                                                <td style={{ verticalAlign: 'middle' }}>
                                                    <input
                                                        type="date"
                                                        className="sof-table-input"
                                                        data-prow={idx}
                                                        data-pcol={mfgCol}
                                                        value={split.manufacture_date || ''}
                                                        onChange={e => handleSplitChange(idx, 'manufacture_date', e.target.value)}
                                                        onKeyDown={e => handlePopupKeyDown(e, idx, mfgCol, totalCols)}
                                                        onDoubleClick={e => e.target.classList.add('sof-input-edit-segments')}
                                                        onBlur={e => {
                                                            e.target.classList.remove('sof-input-edit-segments');
                                                            e.target.removeAttribute('data-picker-just-closed');
                                                        }}
                                                        onFocus={e => {
                                                            e.target.removeAttribute('data-picker-just-closed');
                                                        }}
                                                    />
                                                </td>
                                            )}
                                            <td style={{ verticalAlign: 'middle' }}>
                                                <SearchableSelect
                                                    className="sof-table-input"
                                                    data-prow={idx}
                                                    data-pcol={perCol}
                                                    value={split.per || ''}
                                                    options={[{ value: '', label: '— Select —' }, ...units.map(u => ({ value: String(u.id), label: u.name }))]}
                                                    onChange={e => handleSplitChange(idx, 'per', e.target.value)}
                                                    onKeyDown={e => handlePopupKeyDown(e, idx, perCol, totalCols)}
                                                    placeholder="— Select —"
                                                />
                                            </td>
                                            <td style={{ verticalAlign: 'middle' }}>
                                                <input
                                                    type="number"
                                                    className="sof-table-input"
                                                    style={{ textAlign: 'right' }}
                                                    placeholder="0.00"
                                                    data-prow={idx}
                                                    data-pcol={qtyCol}
                                                    value={split.quantity}
                                                    onChange={e => handleSplitChange(idx, 'quantity', e.target.value)}
                                                    onKeyDown={e => handlePopupKeyDown(e, idx, qtyCol, totalCols)}
                                                />
                                            </td>
                                            <td style={{ verticalAlign: 'middle' }}>
                                                <input
                                                    type="number"
                                                    className="sof-table-input"
                                                    style={{ textAlign: 'right' }}
                                                    placeholder="0.00"
                                                    data-prow={idx}
                                                    data-pcol={rateCol}
                                                    value={split.rate}
                                                    onChange={e => handleSplitChange(idx, 'rate', e.target.value)}
                                                    onKeyDown={e => handlePopupKeyDown(e, idx, rateCol, totalCols)}
                                                />
                                            </td>
                                            <td style={{ verticalAlign: 'middle' }}>
                                                <input
                                                    type="number"
                                                    className="sof-table-input"
                                                    style={{ textAlign: 'right' }}
                                                    placeholder="0.00"
                                                    data-prow={idx}
                                                    data-pcol={discCol}
                                                    value={split.discount_percent}
                                                    onChange={e => handleSplitChange(idx, 'discount_percent', e.target.value)}
                                                    onKeyDown={e => handlePopupKeyDown(e, idx, discCol, totalCols)}
                                                />
                                            </td>
                                            <td style={{ verticalAlign: 'middle', textAlign: 'right', fontWeight: '600', color: '#1e293b' }}>
                                                ₹ {fmtAmt(parseFloat(split.amount) || 0)}
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
                                                        className="sof-popup-btn-action sof-popup-btn-delete"
                                                        title="Delete split row"
                                                        onClick={() => deleteSplitRow(idx)}
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
                                {/* Total Row */}
                                <tr style={{ background: '#f8fafc', fontWeight: '700', borderTop: '2.5px solid #cbd5e1', borderBottom: '1.5px solid #cbd5e1' }}>
                                    <td colSpan={
                                        (maintain_warehouse ? 1 : 0) +
                                        (maintain_batch ? 1 : 0) +
                                        (maintain_expiry_date ? 1 : 0) +
                                        (maintain_manufacture_date ? 1 : 0)
                                    } style={{ padding: '14px 12px', color: '#475569', fontSize: '0.85rem' }}>
                                        Total
                                    </td>
                                    <td style={{ padding: '14px 12px', textAlign: 'right', color: '#1e293b', fontSize: '0.85rem' }}>
                                        {getConsolidatedQty().toFixed(2)}
                                    </td>
                                    <td></td>
                                    <td></td>
                                    <td style={{ padding: '14px 12px', textAlign: 'right', color: '#10b981', fontSize: '0.88rem', fontWeight: '800' }}>
                                        ₹ {fmtAmt(getConsolidatedAmount())}
                                    </td>
                                    <td></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                </div>
                {/* footer */}
                <div className="sof-modal-footer">
                    <div className="d-flex justify-content-end w-100 gap-2">
                        <button type="button" className="btn btn-secondary" style={{ padding: '6px 20px' }} onClick={onClose}>Cancel</button>
                        <button type="button" className="btn btn-primary" style={{ padding: '6px 20px' }} onClick={handleSave}>Save</button>
                    </div>
                </div>
            </form>
        </div>
    );
};

const ItemViewPopup = ({ item, isInterState, onClose, productConfig }) => {
    const { maintain_batch, maintain_manufacture_date, maintain_expiry_date, maintain_warehouse } = productConfig || {};

    // Calculate modal size based on configured columns to avoid squishing columns
    let dynamicMaxWidth = 480; // Base width for Qty, Rate, Disc %, Amount and padding
    if (maintain_warehouse) dynamicMaxWidth += 180;
    if (maintain_batch) dynamicMaxWidth += 140;
    if (maintain_expiry_date) dynamicMaxWidth += 150;
    if (maintain_manufacture_date) dynamicMaxWidth += 150;

    const fmtAmt = n => (parseFloat(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const viewSplits = item.splits && item.splits.length > 0 ? item.splits : [item];

    return (
        <div className="sof-modal-backdrop" onClick={onClose}>
            <div className="sof-modal" style={{ maxWidth: `${dynamicMaxWidth}px`, width: '90%' }} onClick={e => e.stopPropagation()}>
                <div className="sof-modal-header d-flex align-items-center justify-content-between gap-3" style={{ background: '#ffffff', borderBottom: 'none', padding: '18px 24px 0 24px' }}>
                    <div className="d-flex align-items-center gap-3">
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '50%',
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                <polyline points="9 22 9 12 15 12 15 22" />
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
                        onClick={onClose}
                        aria-label="Close"
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: '1.5rem', lineHeight: 1, color: '#94a3b8',
                            padding: '0 4px', flexShrink: 0,
                        }}
                    >
                        &times;
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
                                    {maintain_batch && <th style={{ minWidth: '120px' }}>Batch</th>}
                                    {maintain_expiry_date && <th style={{ minWidth: '130px' }}>Expiry Date</th>}
                                    {maintain_manufacture_date && <th style={{ minWidth: '130px' }}>Mfg. Date</th>}
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
                                        {maintain_expiry_date && <td>{s.expiry_date || '—'}</td>}
                                        {maintain_manufacture_date && <td>{s.manufacture_date || '—'}</td>}
                                        <td className="sof-cell-right">{s.quantity || '0.00'}</td>
                                        <td className="sof-cell-right">₹ {fmtAmt(s.rate)}</td>
                                        <td className="sof-cell-right">{s.discount_percent || '0.00'}%</td>
                                        <td className="sof-cell-right">₹ {fmtAmt(s.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="sof-modal-net sof-view-net-bar">
                    <span className="sof-modal-net-label">Net amount</span>
                    <span className="sof-modal-net-value">₹ {fmtAmt(item.amount)}</span>
                </div>
            </div>
        </div>
    );
};

const getDebtorCreditorGroupIds = (groups) => {
    if (!groups || !Array.isArray(groups)) return new Set();
    const targetNames = ['sundry debtors', 'sundry creditors', 'sundry debtor', 'sundry creditor', 'debtors', 'creditors', 'debtor', 'creditor'];
    const validIds = new Set();
    const rootGroups = groups.filter(g => {
        const name = (g.name || '').toLowerCase().trim();
        return targetNames.some(t => name === t || name.includes(t));
    });
    rootGroups.forEach(rg => {
        validIds.add(rg.id);
        validIds.add(String(rg.id));
        validIds.add(Number(rg.id));
    });
    let added;
    do {
        added = false;
        groups.forEach(g => {
            const parentId = g.parent || g.parent_id;
            if (parentId && (validIds.has(parentId) || validIds.has(String(parentId)) || validIds.has(Number(parentId)))) {
                if (!validIds.has(g.id)) {
                    validIds.add(g.id);
                    validIds.add(String(g.id));
                    validIds.add(Number(g.id));
                    added = true;
                }
            }
        });
    } while (added);
    return validIds;
};

const SalesInvoiceForm = ({ formData, setFormData, onSave, onCancel, isEditing }) => {
    usePageTitle("Sales Invoice form");
    const [ledgers, setLedgers] = useState([]);
    const [accountGroups, setAccountGroups] = useState([]);
    const [stockItems, setStockItems] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [units, setUnits] = useState([]);
    const [voucherTypes, setVoucherTypes] = useState([]);
    const [prefixConfigs, setPrefixConfigs] = useState([]);
    const [productConfigs, setProductConfigs] = useState([]);
    const [productConfig, setProductConfig] = useState({
        maintain_batch: false,
        maintain_manufacture_date: false,
        maintain_expiry_date: false,
        maintain_warehouse: false
    });
    const [loadingOptions, setLoadingOptions] = useState(true);
    /* item popup state */
    const [itemPopup, setItemPopup] = useState(null);   // null | { item }
    const [viewPopup, setViewPopup] = useState(null);   // null | item
    const [applicablePriceList, setApplicablePriceList] = useState(null);

    const validCustomerGroupIds = useMemo(() => getDebtorCreditorGroupIds(accountGroups), [accountGroups]);

    const buyerLedgerOptions = useMemo(() => {
        const filtered = ledgers.filter(l => {
            const groupVal = l.accountGroup ?? l.account_group;
            if (groupVal && (validCustomerGroupIds.has(groupVal) || validCustomerGroupIds.has(String(groupVal)) || validCustomerGroupIds.has(Number(groupVal)))) {
                return true;
            }
            const groupName = (
                l.account_group_name ||
                l.accountGroup?.name ||
                l.account_group?.name ||
                (typeof l.account_group === 'string' ? l.account_group : '') ||
                l.group_name ||
                (typeof l.group === 'string' ? l.group : '') ||
                l.account_group_label ||
                ''
            ).toLowerCase().trim();
            if (groupName.includes('debtor') || groupName.includes('deptor') || groupName.includes('creditor')) return true;
            if (formData.customer_ledger && String(l.id) === String(formData.customer_ledger)) return true;
            return false;
        });
        return [
            { value: '', label: '----------' },
            ...filtered.map(l => ({ value: String(l.id), label: l.name }))
        ];
    }, [ledgers, validCustomerGroupIds, formData.customer_ledger]);

    const extraChargeLedgerOptions = useMemo(() => {
        const usedLedgerIds = new Set(
            (formData.extra_charges || []).map(ec => {
                if (!ec.ledger) return null;
                return typeof ec.ledger === 'object' ? String(ec.ledger.id) : String(ec.ledger);
            }).filter(Boolean)
        );

        const filtered = ledgers.filter(l => {
            if (usedLedgerIds.has(String(l.id))) return true;
            const groupName = (
                l.account_group_name ||
                l.accountGroup?.name ||
                l.account_group?.name ||
                (typeof l.account_group === 'string' ? l.account_group : '') ||
                l.group_name ||
                (typeof l.group === 'string' ? l.group : '') ||
                l.account_group_label ||
                ''
            ).toLowerCase();
            return (
                groupName.includes('direct expense') ||
                groupName.includes('indirect expense') ||
                groupName.includes('direct income') ||
                groupName.includes('indirect income') ||
                groupName.includes('expense') ||
                groupName.includes('income')
            );
        });
        const list = filtered.length > 0 ? filtered : ledgers;
        const optionsList = list.map(l => ({ value: String(l.id), label: l.name }));

        (formData.extra_charges || []).forEach(ec => {
            const lId = ec.ledger ? (typeof ec.ledger === 'object' ? String(ec.ledger.id) : String(ec.ledger)) : '';
            const lName = ec.ledger_name || ec.ledgerName;
            if (lId && !optionsList.some(o => o.value === lId)) {
                optionsList.push({ value: lId, label: lName || `Ledger #${lId}` });
            }
        });

        return [
            { value: '', label: 'Select Ledger' },
            ...optionsList
        ];
    }, [ledgers, formData.extra_charges]);

    // Sales Order Connection
    const [availableSalesOrders, setAvailableSalesOrders] = useState([]);
    const [selectedSalesOrders, setSelectedSalesOrders] = useState([]);
    const [isLoadingSalesOrders, setIsLoadingSalesOrders] = useState(false);

    // Tracks whether the component just mounted — used to suppress
    // data-clearing side effects that run on initial render in edit mode.
    const isInitialLoad = useRef(true);

    const firstInputRef = useRef(null);

    // Update productConfig dynamically based on selected voucher type / prefix config
    useEffect(() => {
        if (productConfigs && productConfigs.length > 0) {
            const vTypeVal = formData.voucher_type || formData.prefix_config_id;
            let matchedConfig = null;

            if (vTypeVal) {
                const prefConf = prefixConfigs.find(p => String(p.id) === String(vTypeVal));
                const targetVtId = prefConf ? prefConf.voucher_type : vTypeVal;
                matchedConfig = productConfigs.find(c => String(c.voucher_type) === String(targetVtId));
            }

            if (!matchedConfig) {
                matchedConfig = productConfigs.find(c => {
                    const name = (c.voucher_type_name || '').toLowerCase();
                    const code = (c.voucher_type_code || '').toLowerCase();
                    return name.includes('sales') || name.includes('invoice') || code === 'sa' || code === 'so' || code === 'si';
                });
            }

            if (matchedConfig) {
                setProductConfig({
                    maintain_batch: !!matchedConfig.maintain_batch,
                    maintain_manufacture_date: !!matchedConfig.maintain_manufacture_date,
                    maintain_expiry_date: !!matchedConfig.maintain_expiry_date,
                    maintain_warehouse: !!matchedConfig.maintain_warehouse,
                    maintain_narration: !!matchedConfig.maintain_narration
                });
            }
        }
    }, [formData.voucher_type, formData.prefix_config_id, productConfigs, prefixConfigs]);

    useEffect(() => {
        const fetchPriceList = async () => {
            if (!formData.customer_ledger || !formData.entry_date) {
                setApplicablePriceList(null);
                return;
            }
            try {
                const res = await getApplicablePriceListForLedger(formData.customer_ledger, formData.entry_date);
                const pl = res && res.price_list ? res.price_list : null;
                setApplicablePriceList(pl);

                // If items already exist in the form, automatically update rates to match the newly resolved Price List
                if (pl && Array.isArray(pl.items) && pl.items.length > 0 && Array.isArray(formData.items) && formData.items.length > 0) {
                    let hasRateChange = false;
                    const updatedItems = formData.items.map(item => {
                        if (!item.product) return item;
                        const matched = pl.items.find(pi => String(pi.stock_item) === String(item.product));
                        if (matched && matched.rate !== undefined && parseFloat(matched.rate) > 0) {
                            const newRateStr = String(matched.rate);
                            if (String(item.rate) !== newRateStr) {
                                hasRateChange = true;
                                const updatedItem = {
                                    ...item,
                                    rate: newRateStr
                                };
                                if (Array.isArray(updatedItem.splits) && updatedItem.splits.length > 0) {
                                    updatedItem.splits = updatedItem.splits.map(s => ({
                                        ...s,
                                        rate: newRateStr
                                    }));
                                }
                                return updatedItem;
                            }
                        }
                        return item;
                    });

                    if (hasRateChange) {
                        recalculateForm({ ...formData, items: updatedItems });
                    }
                }
            } catch (err) {
                console.error('Error fetching applicable price list:', err);
                setApplicablePriceList(null);
            }
        };

        fetchPriceList();
    }, [formData.customer_ledger, formData.entry_date]);

    // Fetch Sales Orders when buyer changes
    useEffect(() => {
        if (!formData.customer_ledger) {
            setAvailableSalesOrders([]);
            // Only reset selected orders if NOT on the very first render
            if (!isInitialLoad.current) setSelectedSalesOrders([]);
            return;
        }

        const fetchSalesOrders = async () => {
            setIsLoadingSalesOrders(true);
            try {
                const params = { 
                    customer_id: formData.customer_ledger,
                    exclude_fully_invoiced: true,
                };
                if (Array.isArray(formData.sales_orders) && formData.sales_orders.length > 0) {
                    params.include_order_ids = formData.sales_orders.join(',');
                }
                const res = await SalesService.getSalesOrders(params);
                const orders = Array.isArray(res.data) ? res.data : (res.data.results || []);
                setAvailableSalesOrders(orders);
                // On the very first load in edit mode, pre-select the orders
                // that were already linked to this invoice.
                if (isInitialLoad.current && Array.isArray(formData.sales_orders) && formData.sales_orders.length > 0) {
                    const preSelected = orders
                        .filter(o => formData.sales_orders.includes(String(o.id)))
                        .map(o => {
                            const dateStr = formatSODate(o.entry_date);
                            return { 
                                value: String(o.id), 
                                label: `${o.so_no || 'NO PREFIX'}${dateStr ? ` (${dateStr})` : ''}${o.invoice_status && o.invoice_status !== 'Pending' ? ` - ${o.invoice_status}` : ''}` 
                            };
                        });
                    if (preSelected.length > 0) setSelectedSalesOrders(preSelected);
                }
            } catch (err) {
                console.error('Error fetching sales orders:', err);
                swal('Error', 'Failed to fetch sales orders for this customer.', 'error');
            } finally {
                setIsLoadingSalesOrders(false);
                // Mark initial load complete after the first fetch resolves
                isInitialLoad.current = false;
            }
        };

        fetchSalesOrders();
    }, [formData.customer_ledger]);

    const handleSalesOrderSelection = async (selectedOptions) => {
        const selected = selectedOptions || [];
        setSelectedSalesOrders(selected);

        if (selected.length === 0) {
            setFormData(prev => ({
                ...prev,
                sales_orders: [],
                items: [createBlankSplit()],
                delivery_location: '',
                preferred_vehicle: ''
            }));
            recalculateForm({ ...formData, sales_orders: [], items: [createBlankSplit()] });
            return;
        }

        const selectedIds = selected.map(o => o.value);

        // The list endpoint (SalesService.getSalesOrders) that feeds
        // `availableSalesOrders` returns a summarized items array, not the
        // individual warehouse/batch split lines. Always re-fetch each
        // selected order by ID so we get the exact line items (e.g. the
        // 10 @ DX + 90 @ gfu split) instead of a single consolidated row.
        let fullOrders = [];
        setIsLoadingSalesOrders(true);
        try {
            const responses = await Promise.all(
                selectedIds.map(id => SalesService.getSalesOrder(id))
            );
            fullOrders = responses.map(res => res.data).filter(Boolean);
        } catch (err) {
            console.error('Error fetching full sales order details:', err);
            swal('Error', 'Failed to fetch full sales order details.', 'error');
            setIsLoadingSalesOrders(false);
            return;
        }
        setIsLoadingSalesOrders(false);

        let groupedItemsMap = new Map();
        let deliveryLoc = formData.delivery_location;
        let prefVehicle = formData.preferred_vehicle;

        fullOrders.forEach(order => {
            if (order.items && order.items.length > 0) {
                order.items.forEach(item => {
                    const totalQty = parseFloat(item.quantity) || 0;
                    const invoicedQty = parseFloat(item.invoiced_quantity) || 0;
                    const remainingQty = Math.max(0, totalQty - invoicedQty);

                    // Skip items that are already fully invoiced
                    if (remainingQty <= 0) return;

                    const prodId = item.product ? String(item.product) : (item.stock_item ? String(item.stock_item) : (item.product_name || `no_prod_${item.id}`));
                    if (!groupedItemsMap.has(prodId)) {
                        // Initialize parent item with the first split's data
                        groupedItemsMap.set(prodId, { 
                            ...item, 
                            id: '', 
                            sales_order: order.id,
                            sales_order_item: item.id,
                            sales_order_item_id: item.id,
                            splits: [] 
                        });
                    }
                    
                    // Add as a split with remaining quantity
                    groupedItemsMap.get(prodId).splits.push({
                        ...item,
                        id: '', // New item for invoice
                        sales_order: order.id,
                        sales_order_item: item.id,
                        sales_order_item_id: item.id,
                        quantity: remainingQty.toFixed(2),
                        original_so_qty: totalQty,
                        remaining_so_qty: remainingQty
                    });
                });
            }
            if (!deliveryLoc && order.delivery_location) deliveryLoc = order.delivery_location;
            if (!prefVehicle && order.preferred_vehicle) prefVehicle = order.preferred_vehicle;
        });

        let newItems = Array.from(groupedItemsMap.values()).filter(item => item.splits && item.splits.length > 0);

        if (newItems.length > 0) {
            const isInterState = formData.order_type === 'INTER_STATE'; // SalesInvoice uses order_type/voucher_type
            const processedItems = newItems.map(item => consolidateSplits(item, isInterState));
            console.log("Processed Items after grouping:", JSON.stringify(processedItems, null, 2));
            processedItems.push(createBlankSplit());

            const nextState = {
                ...formData,
                sales_orders: selectedIds,
                items: processedItems,
                delivery_location: deliveryLoc || formData.delivery_location,
                preferred_vehicle: prefVehicle || formData.preferred_vehicle
            };
            recalculateForm(nextState);
        } else {
            const nextState = {
                ...formData,
                sales_orders: selectedIds,
                items: [createBlankSplit()],
                delivery_location: deliveryLoc || formData.delivery_location,
                preferred_vehicle: prefVehicle || formData.preferred_vehicle
            };
            recalculateForm(nextState);
            swal('Notice', 'All items in the selected Sales Order(s) are already fully invoiced.', 'info');
        }
    };

    useEffect(() => {
        if (!loadingOptions) {
            const timer = setTimeout(() => {
                if (firstInputRef.current) {
                    firstInputRef.current.focus();
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [loadingOptions]);


    useEffect(() => {
        const fetchOptions = async () => {
            try {
                const [ledgersRes, itemsRes, warehousesRes, configsRes, driversRes, unitsRes, vtRes, pConfigsRes, groupsRes] = await Promise.all([
                    SalesService.getLedgers(),
                    SalesService.getStockItems(),
                    SalesService.getWarehouses(),
                    InventoryService.getProductConfigurations(),
                    LogisticsService.getDrivers(),
                    InventoryService.getUnits(),
                    FinanceService.getVoucherTypes(),
                    fetchPrefixConfigurations(),
                    FinanceService.getAccountGroups()
                ]);
                const fetchedLedgers = Array.isArray(ledgersRes.data) ? ledgersRes.data : [];
                setLedgers(fetchedLedgers);
                setAccountGroups(Array.isArray(groupsRes) ? groupsRes : (groupsRes?.data || []));
                setStockItems(Array.isArray(itemsRes.data) ? itemsRes.data : []);
                setWarehouses(Array.isArray(warehousesRes.data) ? warehousesRes.data : []);
                setDrivers(Array.isArray(driversRes.data) ? driversRes.data : []);
                setUnits(Array.isArray(unitsRes.data) ? unitsRes.data : []);
                setVoucherTypes(Array.isArray(vtRes) ? vtRes : []);
                const fetchedPrefixConfigs = Array.isArray(pConfigsRes.data) ? pConfigsRes.data : (Array.isArray(pConfigsRes) ? pConfigsRes : []);
                setPrefixConfigs(fetchedPrefixConfigs);

                if (formData.extra_charges && formData.extra_charges.length > 0) {
                    recalculateForm(formData, fetchedLedgers);
                }

                const configs = Array.isArray(configsRes.data) ? configsRes.data : [];
                setProductConfigs(configs);

                // Fetch next Sales Invoice No & pre-fill default prefix config if creating a new one
                if (!isEditing) {
                    const salesPrefixConfigs = fetchedPrefixConfigs.filter(c => {
                        if (!c.voucher_type_name) return false;
                        const name = c.voucher_type_name.toLowerCase().trim();
                        return name === 'sales' || name === 'sales invoice' || (name.includes('sales') && !name.includes('order') && !name.includes('return'));
                    });
                    if (salesPrefixConfigs.length > 0 && !formData.prefix_config_id) {
                        const defaultConfig = salesPrefixConfigs[0];
                        try {
                            const nextNoRes = await SalesService.getSalesInvoiceNextNo({ config_id: defaultConfig.id });
                            const gstLedgerIds = defaultConfig.gst_ledger || [];
                            const fetchedLedgers = Array.isArray(ledgersRes.data) ? ledgersRes.data : [];
                            let gst1 = '', gst2 = '';
                            if (gstLedgerIds.length > 0) {
                                gst1 = String(gstLedgerIds[0]);
                                gst2 = gstLedgerIds.length > 1 ? String(gstLedgerIds[1]) : '';
                            } else {
                                const cgst = fetchedLedgers.find(l => l.name.toLowerCase().includes('output cgst')) || fetchedLedgers.find(l => l.name.toLowerCase().includes('cgst'));
                                const sgst = fetchedLedgers.find(l => l.name.toLowerCase().includes('output sgst')) || fetchedLedgers.find(l => l.name.toLowerCase().includes('sgst'));
                                gst1 = cgst ? String(cgst.id) : '';
                                gst2 = sgst ? String(sgst.id) : '';
                            }
                            const subName = (defaultConfig.subvoucher_type_name || defaultConfig.sub_type || defaultConfig.ledger_name || '').toLowerCase();
                            const orderType = (subName.includes('igst') || subName.includes('inter')) ? 'INTER_STATE' : 'STATE';

                            setFormData(prev => ({
                                ...prev,
                                prefix_config_id: String(defaultConfig.id),
                                voucher_type: defaultConfig.voucher_type ? String(defaultConfig.voucher_type) : String(defaultConfig.id),
                                invoice_no: nextNoRes.data.next_invoice_no,
                                sales_ledger: defaultConfig.ledger ? String(defaultConfig.ledger) : (prev.sales_ledger || ''),
                                gst_ledger_1: gst1 || prev.gst_ledger_1 || '',
                                gst_ledger_2: gst2 || prev.gst_ledger_2 || '',
                                order_type: orderType
                            }));
                        } catch (err) {
                            console.error('Failed to fetch next Sales Invoice number for default config:', err);
                        }
                    } else if (!formData.invoice_no) {
                        try {
                            const nextNoRes = await SalesService.getSalesInvoiceNextNo();
                            setFormData(prev => ({
                                ...prev,
                                invoice_no: nextNoRes.data.next_invoice_no
                            }));
                        } catch (err) {
                            console.error('Failed to fetch next Sales Invoice number:', err);
                        }
                    }
                } else if (isEditing && formData.invoice_no && !formData.prefix_config_id) {
                    // Pre-fill prefix_config_id from invoice_no when editing an invoice so voucher type dropdown matches
                    const sortedConfigs = [...fetchedPrefixConfigs].sort((a, b) => (b.prefix?.length || 0) - (a.prefix?.length || 0));
                    const matchedConfig = sortedConfigs.find(c => c.prefix && formData.invoice_no.toLowerCase().startsWith(c.prefix.toLowerCase()));
                    if (matchedConfig) {
                        setFormData(prev => ({
                            ...prev,
                            prefix_config_id: String(matchedConfig.id),
                            voucher_type: matchedConfig.voucher_type ? String(matchedConfig.voucher_type) : prev.voucher_type
                        }));
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

    useEffect(() => {
        if (!isEditing && ledgers.length > 0 && (!formData.items || formData.items.length === 0)) {
            const cgstLedger = ledgers.find(l => l.name.toLowerCase().includes('cgst'));
            const sgstLedger = ledgers.find(l => l.name.toLowerCase().includes('sgst'));
            setFormData(prev => ({
                order_type: 'STATE',
                entry_date: new Date().toISOString().split('T')[0],
                gst_ledger_1: cgstLedger ? cgstLedger.id : '',
                gst_ledger_2: sgstLedger ? sgstLedger.id : '',
                gst_amount_1: '0.00',
                gst_amount_2: '0.00',
                total_amount: '0.00',
                is_posted: false,
                priority: 'Standard',
                status: 'Pending',
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
                    batch_number: '',
                    manufacture_date: '',
                    expiry_date: ''
                }],
                ...prev
            }));
        }
    }, [isEditing, ledgers, setFormData, formData.items]);

    const handleInputChange = (field, value) => {
        const updated = { ...formData, [field]: value };

        if (field === 'entry_date') {
            const newDate = value ? value.split('T')[0] : '';
            updated.items = (updated.items || []).map(item => {
                if (!item.product) return item;
                const found = stockItems.find(p => String(p.id) === String(item.product));
                if (found) {
                    const newGst = getApplicableGst(found, newDate);
                    if (newGst > 0) {
                        const updatedItem = {
                            ...item,
                            gst_percent: cleanZeroValue(newGst)
                        };
                        return consolidateSplits(updatedItem, updated.order_type === 'INTER_STATE');
                    }
                }
                return item;
            });
        }

        if (field === 'place_of_supply') {
            const trimmed = String(value || '').trim();
            const upper = trimmed.toUpperCase();
            if (upper === 'KL' || upper === '32') {
                value = 'Kerala';
                updated.place_of_supply = 'Kerala';
            } else if (upper === 'IN') {
                value = 'India';
                updated.place_of_supply = 'India';
            }
        }

        if (field === 'customer_ledger') {
            const selectedLedger = ledgers.find(l => String(l.id) === value);
            if (selectedLedger) {
                updated.buyer_gst_no = selectedLedger.gst_number || '';

                // Construct address
                let addressParts = [];
                if (selectedLedger.address1) addressParts.push(selectedLedger.address1.trim());
                if (selectedLedger.address2) addressParts.push(selectedLedger.address2.trim());
                if (selectedLedger.address3) addressParts.push(selectedLedger.address3.trim());

                let fullAddress = addressParts.filter(Boolean).join(', ');
                if (!fullAddress && selectedLedger.address) {
                    fullAddress = selectedLedger.address.trim();
                }

                // Format state and country names (KL -> Kerala, IN -> India)
                const rawState = selectedLedger.state || '';
                const rawCountry = selectedLedger.country || '';
                const stateName = formatStateName(rawState);
                const countryName = formatCountryName(rawCountry);

                if (fullAddress) {
                    fullAddress = replaceStateCountryCodes(fullAddress);
                    if (stateName && !fullAddress.toLowerCase().includes(stateName.toLowerCase())) {
                        fullAddress += (fullAddress ? ', ' : '') + stateName;
                    }
                    if (countryName && !fullAddress.toLowerCase().includes(countryName.toLowerCase())) {
                        fullAddress += (fullAddress ? ', ' : '') + countryName;
                    }
                    if (selectedLedger.pincode && !fullAddress.includes(String(selectedLedger.pincode))) {
                        fullAddress += ' - ' + selectedLedger.pincode;
                    }
                } else {
                    const parts = [];
                    if (stateName) parts.push(stateName);
                    if (countryName) parts.push(countryName);
                    fullAddress = parts.join(', ');
                    if (selectedLedger.pincode && fullAddress) {
                        fullAddress += ' - ' + selectedLedger.pincode;
                    }
                }

                updated.buyer_address = fullAddress || '';
                updated.shipping_address = fullAddress || '';

                // Place of Supply: KL -> Kerala, IN -> India
                const rawPos = selectedLedger.placeofsupply || selectedLedger.state || '';
                updated.place_of_supply = formatStateName(rawPos) || formatCountryName(rawPos) || rawPos;
            }
            // Only clear items when the USER actively changes the buyer — not
            // on the very first render when formData is populated from props.
            if (!isInitialLoad.current) {
                updated.sales_orders = [];
                updated.items = [createBlankSplit()];
                setSelectedSalesOrders([]);
            }
        }

        if (field === 'voucher_type') {
            const selectedConfig = prefixConfigs.find(c => String(c.id) === String(value));
            if (selectedConfig) {
                updated.prefix_config_id = String(selectedConfig.id);
                updated.voucher_type = selectedConfig.voucher_type ? String(selectedConfig.voucher_type) : value;

                if (selectedConfig.ledger) {
                    updated.sales_ledger = String(selectedConfig.ledger);
                }

                const gstLedgerIds = selectedConfig.gst_ledger || [];
                if (gstLedgerIds.length > 0) {
                    updated.gst_ledger_1 = String(gstLedgerIds[0]);
                    updated.gst_ledger_2 = gstLedgerIds.length > 1 ? String(gstLedgerIds[1]) : '';
                } else {
                    const cgstLedger = ledgers.find(l => l.name.toLowerCase().includes('output cgst')) || ledgers.find(l => l.name.toLowerCase().includes('cgst'));
                    const sgstLedger = ledgers.find(l => l.name.toLowerCase().includes('output sgst')) || ledgers.find(l => l.name.toLowerCase().includes('sgst'));
                    updated.gst_ledger_1 = cgstLedger ? String(cgstLedger.id) : '';
                    updated.gst_ledger_2 = sgstLedger ? String(sgstLedger.id) : '';
                }

                const subName = (selectedConfig.subvoucher_type_name || selectedConfig.sub_type || selectedConfig.ledger_name || '').toLowerCase();
                const hasIgstLedger = (selectedConfig.gst_ledger || []).some(gId => {
                    const l = ledgers.find(led => String(led.id) === String(gId));
                    return l && l.name.toLowerCase().includes('igst');
                });

                if (subName.includes('igst') || subName.includes('inter') || hasIgstLedger) {
                    updated.order_type = 'INTER_STATE';
                } else {
                    updated.order_type = 'STATE';
                }

                if (!isEditing) {
                    SalesService.getSalesInvoiceNextNo({ config_id: selectedConfig.id })
                        .then(nextNoRes => {
                            setFormData(prev => {
                                const nextState = {
                                    ...prev,
                                    ...updated,
                                    invoice_no: nextNoRes.data.next_invoice_no
                                };
                                recalculateForm(nextState);
                                return nextState;
                            });
                        })
                        .catch(err => {
                            console.error('Failed to fetch next invoice number:', err);
                        });
                    recalculateForm(updated);
                    return;
                } else {
                    // When editing, strictly preserve the existing invoice_no!
                    setFormData(prev => {
                        const nextState = {
                            ...prev,
                            ...updated,
                            invoice_no: prev.invoice_no || formData.invoice_no
                        };
                        recalculateForm(nextState);
                        return nextState;
                    });
                    return;
                }
            } else {
                const vt = voucherTypes.find(v => String(v.id) === value);
                if (vt) {
                    const vtName = vt.name || '';
                    const matchingLedger = ledgers.find(l => l.name.toLowerCase() === vtName.toLowerCase());
                    if (matchingLedger) {
                        updated.sales_ledger = String(matchingLedger.id);
                    } else {
                        if (vtName.toLowerCase().includes('b2b sales') || vtName.toLowerCase().includes('b2c unregistered')) {
                            const localLedger = ledgers.find(l => l.name.toLowerCase().includes('sales local'));
                            if (localLedger) updated.sales_ledger = String(localLedger.id);
                        } else if (vtName.toLowerCase().includes('igst sales')) {
                            const igstLedger = ledgers.find(l => l.name.toLowerCase().includes('igst sales') || l.name.toLowerCase().includes('igst'));
                            if (igstLedger) updated.sales_ledger = String(igstLedger.id);
                        }
                    }

                    if (vtName.toLowerCase().includes('b2b sales') || vtName.toLowerCase().includes('b2c unregistered')) {
                        updated.order_type = 'STATE';
                    } else if (vtName.toLowerCase().includes('igst sales')) {
                        updated.order_type = 'INTER_STATE';
                    }
                }
                field = 'order_type';
                value = updated.order_type;
            }
        }

        if (field === 'sales_ledger') {
            const selectedLedger = ledgers.find(l => String(l.id) === value);
            if (selectedLedger) {
                const name = selectedLedger.name.toLowerCase();
                if (name.includes('igst') || name.includes('inter')) {
                    updated.order_type = 'INTER_STATE';
                } else {
                    updated.order_type = 'STATE';
                }
                // Trigger GST ledger assignments below
                field = 'order_type';
                value = updated.order_type;
            }
        }

        if (field === 'order_type') {
            if (value === 'INTER_STATE') {
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
        recalculateForm(updated);
    };

    const recalculateForm = (state, customLedgers = ledgers) => {
        const activeLedgers = Array.isArray(customLedgers) && customLedgers.length > 0 ? customLedgers : ledgers;
        const isInterState = state.order_type === 'INTER_STATE';
        let totalBase = 0, totalCGST = 0, totalSGST = 0, totalIGST = 0;
        const recalculatedItems = (state.items || []).map(item => {
            if (item.splits && item.splits.length > 0) {
                const consolidated = consolidateSplits(item, isInterState);
                const net = parseFloat(consolidated.amount) || 0;
                const cgst = parseFloat(consolidated.cgst_amount) || 0;
                const sgst = parseFloat(consolidated.sgst_amount) || 0;
                const igst = parseFloat(consolidated.igst_amount) || 0;

                totalBase += net;
                totalCGST += cgst;
                totalSGST += sgst;
                totalIGST += igst;

                return consolidated;
            } else {
                const qty = parseFloat(item.quantity) || 0;
                const rate = parseFloat(item.rate) || 0;
                const disPct = parseFloat(item.discount_percent) || 0;
                const gstPct = parseFloat(item.gst_percent) || 0;
                const baseAmount = qty * rate;
                const disAmt = (baseAmount * disPct) / 100;
                const net = baseAmount - disAmt;
                const totalGst = (net * gstPct) / 100;
                let cgst = 0, sgst = 0, igst = 0;
                if (isInterState) { igst = totalGst; } else { cgst = totalGst / 2; sgst = totalGst / 2; }
                totalBase += net; totalCGST += cgst; totalSGST += sgst; totalIGST += igst;
                return {
                    ...item,
                    discount_amount: disAmt.toFixed(2),
                    cgst_amount: cgst.toFixed(2),
                    sgst_amount: sgst.toFixed(2),
                    igst_amount: igst.toFixed(2),
                    amount: net.toFixed(2)
                };
            }
        });
        const updatedState = { ...state, items: recalculatedItems };
        const invoiceDate = state.entry_date || new Date().toISOString().split('T')[0];
        let extraChargesTotal = 0;
        let extraCGST = 0;
        let extraSGST = 0;
        let extraIGST = 0;

        (state.extra_charges || []).forEach(ec => {
            const ecAmt = parseFloat(ec.amount) || 0;
            extraChargesTotal += ecAmt;
            
            if (ec.ledger) {
                const ledger = activeLedgers.find(l => String(l.id) === String(ec.ledger));
                if (ledger) {
                    let gstRate = 0;
                    if (Array.isArray(ledger.gst_details) && ledger.gst_details.length > 0) {
                        const validGsts = ledger.gst_details
                            .filter(g => !g.applicable_date || g.applicable_date <= invoiceDate)
                            .sort((a, b) => {
                                if (!a.applicable_date) return 1;
                                if (!b.applicable_date) return -1;
                                return new Date(b.applicable_date) - new Date(a.applicable_date);
                            });
                        
                        if (validGsts.length > 0) {
                            const targetGst = validGsts[0];
                            gstRate = parseFloat(
                                targetGst.gst_percentage ??
                                targetGst.gst_percent ??
                                targetGst.rate ??
                                targetGst.percentage ??
                                0
                            ) || 0;
                        }
                    }
                    if (gstRate === 0) {
                        gstRate = parseFloat(
                            ledger.gst_percentage ??
                            ledger.gst_percent ??
                            ledger.gst_rate ??
                            ledger.tax_rate ??
                            0
                        ) || 0;
                    }

                    if (gstRate > 0) {
                        const chargeGst = (ecAmt * gstRate) / 100;
                        if (isInterState) {
                            extraIGST += chargeGst;
                        } else {
                            extraCGST += chargeGst / 2;
                            extraSGST += chargeGst / 2;
                        }
                    }
                }
            }
        });

        if (isInterState) {
            updatedState.gst_amount_1 = totalIGST.toFixed(2);
            updatedState.gst_amount_2 = '0.00';
            updatedState.total_amount = (totalBase + totalIGST + extraChargesTotal + extraIGST).toFixed(2);
        } else {
            updatedState.gst_amount_1 = totalCGST.toFixed(2);
            updatedState.gst_amount_2 = totalSGST.toFixed(2);
            updatedState.total_amount = (totalBase + totalCGST + totalSGST + extraChargesTotal + extraCGST + extraSGST).toFixed(2);
        }
        setFormData(updatedState);
    };

    const addExtraCharge = () => {
        const currentCharges = formData.extra_charges || [];
        const currentWithoutNew = currentCharges.map(c => ({ ...c, isNew: false }));
        const newCharges = [...currentWithoutNew, { id: Date.now(), ledger: '', amount: '', isNew: true }];
        const nextState = { ...formData, extra_charges: newCharges };
        recalculateForm(nextState);
    };

    const handleExtraChargeChange = (index, field, value) => {
        const currentCharges = [...(formData.extra_charges || [])];
        currentCharges[index] = { ...currentCharges[index], [field]: value };
        if (field === 'ledger') {
            const selectedLedger = ledgers.find(l => String(l.id) === String(value));
            if (selectedLedger) {
                currentCharges[index].ledger_name = selectedLedger.name;
                currentCharges[index].ledgerName = selectedLedger.name;
            }
        }
        const nextState = { ...formData, extra_charges: currentCharges };
        recalculateForm(nextState);
    };

    const removeExtraCharge = (index) => {
        const currentCharges = (formData.extra_charges || []).filter((_, i) => i !== index);
        const nextState = { ...formData, extra_charges: currentCharges };
        recalculateForm(nextState);
    };

    const removeRow = (index) => {
        const items = (formData.items || []).filter((_, i) => i !== index);
        recalculateForm({ ...formData, items });
    };



    const savePopupItem = (item) => {
        const items = [...(formData.items || [])];
        const editIdx = itemPopup ? itemPopup.editIndex : undefined;
        if (editIdx !== undefined) {
            items[editIdx] = item;   // update existing
        } else {
            items.push(item);                    // add new
        }
        recalculateForm({ ...formData, items });
        setItemPopup(null);

        if (editIdx !== undefined) {
            setTimeout(() => {
                const gstInput = document.querySelector(`[data-row="${editIdx}"][data-col="4"]`);
                if (gstInput) {
                    gstInput.focus();
                }
            }, 100);
        }
    };

    const openEditItemPopup = (item, idx) => {
        console.log("Opening popup for item:", JSON.stringify(item, null, 2));
        const cleanItem = {
            ...item,
            quantity: cleanZeroValue(item.quantity),
            rate: cleanZeroValue(item.rate),
            discount_percent: cleanZeroValue(item.discount_percent),
            gst_percent: cleanZeroValue(item.gst_percent),
        };
        setItemPopup({ item: cleanItem, editIndex: idx });
    };

    const addNewBlankRow = () => {
        const items = [...(formData.items || [])];
        items.push({
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
            batch_number: '',
            manufacture_date: '',
            expiry_date: ''
        });
        setFormData(prev => ({ ...prev, items }));
    };

    const handleTableProductChange = (rowIdx, productId) => {
        const items = [...(formData.items || [])];
        const currentItem = items[rowIdx] || {};

        // Guard: if this row already has this exact product selected, don't
        // touch the item's data. This can legitimately re-fire (e.g. the
        // native <select>'s onChange re-syncing once the stockItems options
        // list finishes loading) even though the user didn't actually change
        // anything — without this guard it would blow away real data such as
        // the per-warehouse/batch splits pulled in from a sales order,
        // replacing them with a single blank split.
        // We still open the Batch & Warehouse popup in this case though,
        // since the user clicking the product in the dropdown (even to
        // re-pick the same one) is a request to review/edit its batch
        // details, not just a no-op.
        if (productId && currentItem.product && String(productId) === String(currentItem.product)) {
            const cleanItem = {
                ...currentItem,
                quantity: cleanZeroValue(currentItem.quantity),
                rate: cleanZeroValue(currentItem.rate),
                discount_percent: cleanZeroValue(currentItem.discount_percent),
                gst_percent: cleanZeroValue(currentItem.gst_percent),
            };
            setItemPopup({ item: cleanItem, editIndex: rowIdx });
            return;
        }

        if (!productId) {
            if (items.length > 1) {
                removeRow(rowIdx);
                setTimeout(() => {
                    const gstLedger1 = document.querySelector('[data-gst-ledger-1]');
                    const trigger = gstLedger1?.querySelector('[data-ss-trigger]');
                    if (trigger) trigger.focus();
                }, 80);
            } else {
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
                    batch_number: '',
                    manufacture_date: '',
                    expiry_date: '',
                    splits: []
                };
                recalculateForm({ ...formData, items });
            }
            return;
        }

        const found = stockItems.find(p => String(p.id) === String(productId));
        const productName = found ? found.name : '';
        let rate = cleanZeroValue(found ? found.ss_rate : '');
        if (applicablePriceList && applicablePriceList.items && found) {
            const priceItem = applicablePriceList.items.find(pi => String(pi.stock_item) === String(found.id));
            if (priceItem && priceItem.rate) {
                rate = cleanZeroValue(priceItem.rate);
            }
        }
        const applicableGst = getApplicableGst(found, formData.entry_date);
        const gstPercent = cleanZeroValue(applicableGst > 0 ? applicableGst : (found ? found.gst_percentage : ''));
        const baseUnit = found ? found.base_unit : '';
        const baseUnitName = found ? found.base_unit_name : '';

        const baseItem = {
            ...currentItem,
            product: productId,
            productName: productName,
            rate: rate,
            gst_percent: gstPercent,
            per: baseUnit ? String(baseUnit) : '',
            perName: baseUnitName || '',
            quantity: currentItem.quantity || '',
            discount_percent: currentItem.discount_percent || '',
            warehouse: currentItem.warehouse || '',
            warehouseName: currentItem.warehouseName || ''
        };
        baseItem.splits = [createBlankSplit(baseItem)];

        items[rowIdx] = baseItem;
        setFormData(prev => ({ ...prev, items }));
        setItemPopup({ item: baseItem, editIndex: rowIdx });
    };

    const handleTableFieldChange = (rowIdx, field, value) => {
        const items = [...(formData.items || [])];
        let item = { ...items[rowIdx] };

        const isInterState = formData.order_type === 'INTER_STATE';

        if (field === 'gst_percent') {
            item.gst_percent = value;
            item = consolidateSplits(item, isInterState);
        } else {
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
        }

        items[rowIdx] = item;
        recalculateForm({ ...formData, items });
    };

    const handleTableKeyDown = (e, rowIdx, colIdx) => {
        const key = e.key;
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Delete'].includes(key)) return;

        const active = e.target;
        const tagName = active.tagName.toLowerCase();
        const itemsLength = (formData.items || []).length;
        const isInterState = formData.order_type === 'INTER_STATE';
        const amountColIdx = isInterState ? 6 : 7;
        // eslint-disable-next-line no-unused-vars
        const editCol = amountColIdx + 1;
        const plusCol = amountColIdx + 2;
        const deleteCol = amountColIdx + 3;

        const getEl = (r, c) => {
            const container = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
            if (!container) return null;
            // For SearchableSelect: the container is a div; focus the trigger button inside
            const trigger = container.querySelector('[data-ss-trigger]');
            return trigger || container;
        };

        // Stop form-level handler from also firing
        e.stopPropagation();

        // ── Select dropdown handling ──────────────────────────────────────
        if (tagName === 'select') {
            if (active.dataset.open === 'true') {
                if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter') return;
            } else {
                if (key === 'ArrowDown') {
                    e.preventDefault();
                    trackSelectOpen(active);
                    return;
                }
            }
        }

        // ── Date picker handling ──────────────────────────────────────────
        if (active.type === 'date' || active.type === 'datetime-local' || active.type === 'time') {
            if (active.dataset.pickerOpen === 'true') return;
            if (key === 'Enter') {
                e.preventDefault();
                trackDatePicker(active);
                return;
            }
            if (key.startsWith('Arrow')) {
                return;
            }
        }

        // ── Caret boundary check (text-like inputs only) ──────────────────
        // For ArrowLeft/Right on text inputs: only move column when at boundary
        const isTextLike = tagName === 'input' && active.type !== 'button' && active.type !== 'number' && active.type !== 'date';
        if (isTextLike && (key === 'ArrowLeft' || key === 'ArrowRight')) {
            try {
                const valLen = active.value ? active.value.length : 0;
                if (key === 'ArrowLeft' && active.selectionStart !== 0) return;
                if (key === 'ArrowRight' && active.selectionEnd !== valLen) return;
            } catch (_) { /* number / date inputs — always allow */ }
        }

        e.preventDefault();

        // ── Arrow Up ──────────────────────────────────────────────────────
        if (key === 'ArrowUp') {
            if (rowIdx > 0) {
                const el = getEl(rowIdx - 1, colIdx);
                if (el) el.focus();
            }

            // ── Arrow Down ────────────────────────────────────────────────────
        } else if (key === 'ArrowDown') {
            if (rowIdx < itemsLength - 1) {
                const el = getEl(rowIdx + 1, colIdx);
                if (el) el.focus();
            }

            // ── Arrow Left ────────────────────────────────────────────────────
        } else if (key === 'ArrowLeft') {
            if (colIdx > 0) {
                const el = getEl(rowIdx, colIdx - 1);
                if (el) el.focus();
            }

            // ── Arrow Right ───────────────────────────────────────────────────
        } else if (key === 'ArrowRight') {
            if (colIdx < deleteCol) {
                const el = getEl(rowIdx, colIdx + 1);
                if (el) el.focus();
            }

            // ── Enter ─────────────────────────────────────────────────────────
        } else if (key === 'Enter') {
            const item = (formData.items || [])[rowIdx];
            const isFirstColEmpty = colIdx === 0 && (!item || !item.product);

            if (colIdx === 0) {
                if (isFirstColEmpty) {
                    if (itemsLength > 1 && rowIdx === itemsLength - 1) {
                        removeRow(rowIdx);
                        setTimeout(() => {
                            const gstLedger1 = document.querySelector('[data-gst-ledger-1]');
                            const trigger = gstLedger1?.querySelector('[data-ss-trigger]');
                            if (trigger) trigger.focus();
                        }, 80);
                        return;
                    } else {
                        // Open SearchableSelect dropdown list for item selection
                        active.click();
                        return;
                    }
                } else {
                    // Item is already selected in Column 0, move focus to Column 1 (Quantity)
                    const el = getEl(rowIdx, 1);
                    if (el) el.focus();
                    return;
                }
            }
            if (colIdx === 4) {
                // GST % — move to next row's product select, or add new row if last
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
            } else if (colIdx === deleteCol) {
                removeRow(rowIdx);
                setTimeout(() => {
                    const nextRowIdx = rowIdx > 0 ? rowIdx - 1 : 0;
                    const el = getEl(nextRowIdx, deleteCol);
                    if (el) el.focus();
                }, 100);
            } else {
                // Default: move to next column
                const el = getEl(rowIdx, colIdx + 1);
                if (el) el.focus();
            }
        } else if (key === 'Delete') {
            e.preventDefault();
            removeRow(rowIdx);
            setTimeout(() => {
                const nextRowIdx = rowIdx < itemsLength - 1 ? rowIdx : (rowIdx > 0 ? rowIdx - 1 : 0);
                const el = getEl(nextRowIdx, plusCol);
                if (el) el.focus();
            }, 100);
        }
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
                <div style={{ width: '48px', height: '48px', border: '4px solid #e8eaf6', borderTopColor: '#5c6bc0', borderRadius: '50%', animation: 'sof-spin 0.8s linear infinite' }}></div>
                <p style={{ color: '#7986cb', fontWeight: '600', fontSize: '0.9rem', margin: 0 }}>Loading form data...</p>
                <style>{`@keyframes sof-spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    return (
        <div className="sof-wrap">
            <form onSubmit={onSave} onKeyDown={handleKeyDownNavigation} onChange={handleSelectChangeNavigation}>

                {/* ── SECTION 1: ORDER INFO & LOGISTICS ───────────────────────────────────── */}
                <div className="sof-section">
                    <div className="sof-section-head">
                        <div className="sof-section-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                        </div>
                        <span>Order Information</span>
                        <div className="sof-section-line"></div>
                    </div>

                    <div className="row g-2">
                        {/* ── ROW 1 (4 Columns) ── */}
                        <div className="col-12 col-sm-6 col-lg-3 sof-field-group">
                            <label className="sof-label">Voucher Type <span className="sof-req">*</span></label>
                            <div className="sof-input-box">
                                <SearchableSelect
                                    triggerRef={firstInputRef}
                                    autoFocus
                                    name="voucher_type"
                                    className="sof-input"
                                    value={formData.prefix_config_id || formData.voucher_type || ''}
                                    options={(() => {
                                        const salesPrefixConfigs = prefixConfigs.filter(c => {
                                            if (!c.voucher_type_name) return false;
                                            const name = c.voucher_type_name.toLowerCase().trim();
                                            return name === 'sales' || name === 'sales invoice' || (name.includes('sales') && !name.includes('order') && !name.includes('return'));
                                        });
                                        if (salesPrefixConfigs.length > 0) {
                                            return salesPrefixConfigs.map(c => ({
                                                value: String(c.id),
                                                label: c.subvoucher_type_name || c.sub_type || c.prefix || c.voucher_type_name
                                            }));
                                        }
                                        return voucherTypes
                                            .filter(v => {
                                                const name = (v.name || '').toLowerCase();
                                                return (name.includes('sales') || name.includes('b2b') || name.includes('b2c') || name.includes('igst')) && !name.includes('order') && !name.includes('return');
                                            })
                                            .map(v => ({ value: String(v.id), label: v.name }));
                                    })()}
                                    onChange={e => handleInputChange('voucher_type', e.target.value)}
                                    placeholder="----------"
                                />
                            </div>
                        </div>

                        <div className="col-12 col-sm-6 col-lg-3 sof-field-group">
                            <label className="sof-label">
                                Invoice No <span className="sof-req">*</span>
                            </label>
                            <div className="sof-input-box sof-input-locked">
                                <input type="text" name="invoice_no" className="sof-input" placeholder="(auto-generated)" readOnly value={formData.invoice_no || ''} />
                            </div>
                        </div>

                        <div className="col-12 col-sm-6 col-lg-3 sof-field-group">
                            <label className="sof-label">Date <span className="sof-req">*</span></label>
                            <div className="sof-input-box">
                                <input
                                    type="date"
                                    name="entry_date"
                                    className="sof-input"
                                    required
                                    value={formData.entry_date || ''}
                                    onChange={e => handleInputChange('entry_date', e.target.value)}
                                    onClick={e => { try { e.target.showPicker(); } catch (err) { } }}
                                />
                            </div>
                        </div>

                        <div className="col-12 col-sm-6 col-lg-3 sof-field-group">
                            <label className="sof-label">Sales Category</label>
                            <div className="sof-input-box">
                                <SearchableSelect
                                    name="sales_ledger"
                                    className="sof-input"
                                    value={formData.sales_ledger || ''}
                                    options={[
                                        { value: '', label: '----------' },
                                        ...ledgers
                                            .filter(l => l.account_group_name && l.account_group_name.toLowerCase().includes('sales'))
                                            .map(l => ({ value: String(l.id), label: l.name }))
                                    ]}
                                    onChange={e => handleInputChange('sales_ledger', e.target.value)}
                                    placeholder="----------"
                                />
                            </div>
                        </div>

                        {/* ── ROW 2 (6 Columns) ── */}
                        <div className="col-12 col-sm-6 col-md-4 col-lg-2 sof-field-group mt-3">
                            <label className="sof-label">Buyer Name</label>
                            <div className="sof-input-box">
                                <SearchableSelect
                                    name="customer_ledger"
                                    className="sof-input"
                                    value={formData.customer_ledger || ''}
                                    options={buyerLedgerOptions}
                                    onChange={e => handleInputChange('customer_ledger', e.target.value)}
                                    placeholder="----------"
                                />
                            </div>
                        </div>

                        <div className="col-12 col-sm-6 col-md-4 col-lg-2 sof-field-group mt-3">
                            <label className="sof-label">Buyer GST No</label>
                            <div className="sof-input-box">
                                <input type="text" name="buyer_gst_no" className="sof-input" placeholder="" value={formData.buyer_gst_no || ''} onChange={e => handleInputChange('buyer_gst_no', e.target.value)} />
                            </div>
                        </div>

                        <div className="col-12 col-sm-6 col-md-4 col-lg-2 sof-field-group mt-3">
                            <label className="sof-label">Buyer Address</label>
                            <div className="sof-input-box">
                                <input type="text" name="buyer_address" className="sof-input" placeholder="" value={formData.buyer_address || ''} onChange={e => handleInputChange('buyer_address', e.target.value)} />
                            </div>
                        </div>

                        <div className="col-12 col-sm-6 col-md-4 col-lg-2 sof-field-group mt-3">
                            <label className="sof-label">Shipping Address</label>
                            <div className="sof-input-box">
                                <input type="text" name="shipping_address" className="sof-input" placeholder="" value={formData.shipping_address || ''} onChange={e => handleInputChange('shipping_address', e.target.value)} />
                            </div>
                        </div>

                        <div className="col-12 col-sm-6 col-md-4 col-lg-2 sof-field-group mt-3">
                            <label className="sof-label">Place of Supply</label>
                            <div className="sof-input-box">
                                <input
                                    type="text"
                                    name="place_of_supply"
                                    className="sof-input"
                                    placeholder="----------"
                                    value={
                                        (formData.place_of_supply === 'KL' || formData.place_of_supply === 'kl' || formData.place_of_supply === '32')
                                            ? 'Kerala'
                                            : (formData.place_of_supply === 'IN' || formData.place_of_supply === 'in')
                                                ? 'India'
                                                : (formData.place_of_supply || '')
                                    }
                                    onChange={e => handleInputChange('place_of_supply', e.target.value)}
                                    onBlur={e => {
                                        const trimmed = String(e.target.value || '').trim();
                                        const upper = trimmed.toUpperCase();
                                        if (upper === 'KL' || upper === '32') {
                                            handleInputChange('place_of_supply', 'Kerala');
                                        } else if (upper === 'IN') {
                                            handleInputChange('place_of_supply', 'India');
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        <div className="col-12 col-sm-6 col-md-4 col-lg-2 sof-field-group mt-3">
                            <label className="sof-label">Price List</label>
                            <div className="sof-input-box sof-input-locked">
                                <input
                                    type="text"
                                    name="price_list"
                                    className="sof-input"
                                    readOnly
                                    value={applicablePriceList ? `${applicablePriceList.name}${applicablePriceList.applicable_date ? ` (${formatDate(applicablePriceList.applicable_date)})` : ''}` : "Normal"}
                                    title={applicablePriceList ? `${applicablePriceList.name} (Applicable From: ${formatDate(applicablePriceList.applicable_date)})` : "Normal"}
                                />
                            </div>
                        </div>
                    </div>

                </div>

                {/* ── SELECT SALES ORDERS FOR CUSTOMER ── */}
                {(availableSalesOrders.length > 0 || isLoadingSalesOrders) && (
                    <div className="sof-section sof-table-section mt-4 mb-4" style={{ padding: '15px 20px 25px 20px' }}>
                        <div className="sof-section-head" style={{ marginBottom: '20px' }}>
                            <span>Select Sales Orders for this Customer</span>
                            <div className="sof-section-line"></div>
                        </div>
                        <div style={{ padding: '0 5px' }}>
                            <Select
                                    isMulti
                                    name="sales_orders"
                                    options={availableSalesOrders.map(order => {
                                        const dateStr = formatSODate(order.entry_date);
                                        return { 
                                            value: String(order.id), 
                                            label: `${order.so_no || 'NO PREFIX'}${dateStr ? ` (${dateStr})` : ''}${order.invoice_status && order.invoice_status !== 'Pending' ? ` - ${order.invoice_status}` : ''}` 
                                        };
                                    })}
                                    onChange={handleSalesOrderSelection}
                                    value={selectedSalesOrders}
                                    placeholder="Select Sales Orders..."
                                    isLoading={isLoadingSalesOrders}
                                    isDisabled={!formData.customer_ledger}
                                    menuPortalTarget={document.body}
                                    styles={{
                                        control: (base, state) => ({
                                            ...base,
                                            background: state.isFocused ? '#fff' : '#f8fafc',
                                            border: state.isFocused ? '1.5px solid #6366f1' : '1.5px solid #e2e8f0',
                                            borderRadius: '10px',
                                            boxShadow: state.isFocused ? '0 0 0 3px rgba(99, 102, 241, 0.12)' : 'none',
                                            '&:hover': {
                                                borderColor: state.isFocused ? '#6366f1' : '#c7d2fe',
                                                background: state.isFocused ? '#fff' : '#fefeff',
                                            },
                                            minHeight: '38px',
                                            fontSize: '0.82rem',
                                            fontWeight: '500'
                                        }),
                                        menuPortal: base => ({ ...base, zIndex: 9999 }),
                                        option: (base, state) => ({
                                            ...base,
                                            fontSize: '0.82rem',
                                            fontWeight: '500',
                                            backgroundColor: state.isSelected ? '#6366f1' : state.isFocused ? '#f1f5f9' : 'white',
                                            color: state.isSelected ? 'white' : '#1e293b',
                                            cursor: 'pointer'
                                        }),
                                        placeholder: base => ({
                                            ...base,
                                            color: '#a5b4c8',
                                            fontSize: '0.82rem',
                                            fontWeight: '500'
                                        }),
                                        multiValue: base => ({
                                            ...base,
                                            backgroundColor: '#e0e7ff',
                                            borderRadius: '6px'
                                        }),
                                        multiValueLabel: base => ({
                                            ...base,
                                            color: '#3730a3',
                                            fontSize: '0.78rem',
                                            fontWeight: '600'
                                        }),
                                        multiValueRemove: base => ({
                                            ...base,
                                            color: '#3730a3',
                                            ':hover': {
                                                backgroundColor: '#c7d2fe',
                                                color: '#312e81',
                                            }
                                        })
                                    }}
                                />
                        </div>
                    </div>
                )}
                {/* ── SECTION 3: ORDER ITEMS (grid table layout) ──────────────────── */}
                <div className="sof-section sof-table-section">
                    {/* section header */}
                    <div className="sof-section-head">
                        <div className="sof-section-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                <line x1="12" y1="22.08" x2="12" y2="12" />
                            </svg>
                        </div>
                        <span>Order Items</span>
                        {(formData.items || []).filter(item => item.product).length > 0 && (
                            <span className="sof-items-count">
                                {(formData.items || []).filter(item => item.product).length} {(formData.items || []).filter(item => item.product).length === 1 ? 'item' : 'items'}
                            </span>
                        )}
                        <div className="sof-section-line"></div>
                    </div>

                    <div className="sof-table-scroll" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 15px 15px 15px' }}>
                        <table className="sof-table" style={{ minWidth: '950px' }}>
                            <thead>
                                <tr>
                                    <th className="sof-th-center text-nowrap" style={{ width: '50px' }}>#</th>
                                    <th className="text-nowrap" style={{ minWidth: '220px' }}>Name of Item</th>
                                    <th className="sof-th-right text-nowrap" style={{ width: '100px' }}>Quantity</th>
                                    <th className="sof-th-right text-nowrap" style={{ width: '110px' }}>Rate</th>
                                    <th className="sof-th-right text-nowrap" style={{ width: '80px' }}>Dis %</th>
                                    <th className="sof-th-right text-nowrap" style={{ width: '90px' }}>GST %</th>
                                    {formData.order_type === 'INTER_STATE' ? (
                                        <th className="sof-th-right text-nowrap" style={{ width: '110px' }}>IGST</th>
                                    ) : (
                                        <>
                                            <th className="sof-th-right text-nowrap" style={{ width: '100px' }}>CGST</th>
                                            <th className="sof-th-right text-nowrap" style={{ width: '100px' }}>SGST</th>
                                        </>
                                    )}
                                    <th className="sof-th-right text-nowrap" style={{ width: '120px' }}>Amount</th>
                                    <th className="sof-th-center text-nowrap" style={{ width: '110px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(formData.items || []).map((item, idx) => {
                                    const isInterState = formData.order_type === 'INTER_STATE';
                                    const amountColIdx = isInterState ? 6 : 7;
                                    const editCol = amountColIdx + 1;
                                    const plusCol = amountColIdx + 2;
                                    const deleteCol = amountColIdx + 3;
                                    return (
                                        <tr key={idx} className="sof-tr">
                                            <td className="sof-th-center" style={{ verticalAlign: 'middle', fontWeight: '600', color: '#64748b' }}>{idx + 1}</td>
                                            <td
                                                style={{ verticalAlign: 'middle' }}
                                                onClickCapture={(e) => {
                                                    // If this row already has a product selected,
                                                    // clicking its Name of Item field should open
                                                    // the Batch & Warehouse Details popup for review/
                                                    // editing (e.g. the per-warehouse splits pulled
                                                    // in from a sales order), rather than re-opening
                                                    // the item-picker dropdown to change the product.
                                                    if (item.product) {
                                                        e.stopPropagation();
                                                        e.preventDefault();
                                                        const cleanItem = {
                                                            ...item,
                                                            quantity: cleanZeroValue(item.quantity),
                                                            rate: cleanZeroValue(item.rate),
                                                            discount_percent: cleanZeroValue(item.discount_percent),
                                                            gst_percent: cleanZeroValue(item.gst_percent),
                                                        };
                                                        setItemPopup({ item: cleanItem, editIndex: idx });
                                                    }
                                                }}
                                            >
                                                <SearchableSelect
                                                    className="sof-table-input"
                                                    data-row={idx}
                                                    data-col={0}
                                                    value={item.product || ''}
                                                    options={[{ value: '', label: 'Search and select item...' }, ...stockItems.map(p => ({ value: String(p.id), label: p.name }))]}
                                                    onChange={e => handleTableProductChange(idx, e.target.value)}
                                                    onKeyDown={e => handleTableKeyDown(e, idx, 0)}
                                                    placeholder="Search and select item..."
                                                />
                                            </td>
                                            <td style={{ verticalAlign: 'middle' }}>
                                                <input
                                                    type="number"
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
                                                    type="number"
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
                                                    type="number"
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
                                                    type="number"
                                                    className="sof-table-input"
                                                    style={{ textAlign: 'right' }}
                                                    data-row={idx}
                                                    data-col={4}
                                                    placeholder="0.00"
                                                    value={item.gst_percent}
                                                    onChange={e => handleTableFieldChange(idx, 'gst_percent', e.target.value)}
                                                    onKeyDown={e => handleTableKeyDown(e, idx, 4)}
                                                    disabled={!item.product}
                                                />
                                            </td>
                                            {formData.order_type === 'INTER_STATE' ? (
                                                <td style={{ verticalAlign: 'middle' }}>
                                                    <input
                                                        type="text"
                                                        className="sof-table-input sof-table-input-ro"
                                                        style={{ textAlign: 'right' }}
                                                        readOnly
                                                        value={item.igst_amount || '0.00'}
                                                        data-row={idx}
                                                        data-col={5}
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
                                                            value={item.cgst_amount || '0.00'}
                                                            data-row={idx}
                                                            data-col={5}
                                                            onKeyDown={e => handleTableKeyDown(e, idx, 5)}
                                                        />
                                                    </td>
                                                    <td style={{ verticalAlign: 'middle' }}>
                                                        <input
                                                            type="text"
                                                            className="sof-table-input sof-table-input-ro"
                                                            style={{ textAlign: 'right' }}
                                                            readOnly
                                                            value={item.sgst_amount || '0.00'}
                                                            data-row={idx}
                                                            data-col={6}
                                                            onKeyDown={e => handleTableKeyDown(e, idx, 6)}
                                                        />
                                                    </td>
                                                </>
                                            )}
                                            <td style={{ verticalAlign: 'middle' }}>
                                                <input
                                                    type="text"
                                                    className="sof-table-input sof-table-input-ro"
                                                    style={{ textAlign: 'right' }}
                                                    readOnly
                                                    value={item.amount || '0.00'}
                                                    data-row={idx}
                                                    data-col={formData.order_type === 'INTER_STATE' ? 6 : 7}
                                                    onKeyDown={e => handleTableKeyDown(e, idx, formData.order_type === 'INTER_STATE' ? 6 : 7)}
                                                />
                                            </td>
                                            <td style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                                                <div className="d-flex justify-content-center align-items-center gap-1">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center"
                                                        style={{ width: '28px', height: '28px', padding: '0', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                                        title="Edit details (dates, batch, etc.)"
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
                                                        style={{ width: '28px', height: '28px', padding: '0', borderRadius: '4px', border: '1.5px solid #3b82f6', color: '#3b82f6', background: 'none' }}
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

                {/* ── SECTION 4: NOTES + INVOICE SUMMARY ─────────────────────── */}
                <div className="row">
                    {/* Narration */}
                    <div className="col-12 col-lg-7 mb-4">
                        <div className="sof-section h-100 mb-0" style={{ display: 'flex', flexDirection: 'column' }}>
                            <div className="sof-section-head">
                                <div className="sof-section-icon sof-icon-amber">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                    </svg>
                                </div>
                                <span>Narration & Notes</span>
                                <div className="sof-section-line"></div>
                            </div>
                            <textarea
                                className="sof-input sof-textarea"
                                rows="2"
                                style={{ flex: 1 }}
                                placeholder="Enter order notes, payment terms, or special instructions..."
                                value={formData.narration || ''}
                                onChange={e => handleInputChange('narration', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Invoice Summary */}
                    <div className="col-12 col-lg-5 mb-4">
                        <div className="sof-receipt">
                            <div className="sof-receipt-header">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                                    <line x1="6" y1="5" x2="18" y2="5"></line>
                                    <line x1="6" y1="9" x2="16" y2="9"></line>
                                    <path d="M9 5C15 5 15 13 9 13"></path>
                                    <line x1="9" y1="13" x2="17" y2="20"></line>
                                </svg>
                                Invoice Summary
                            </div>

                            <div className="sof-receipt-body">
                                {/* Subtotal */}
                                <div className="sof-receipt-row">
                                    <span className="sof-receipt-key">Subtotal (excl. tax)</span>
                                    <span className="sof-receipt-val">₹ {getSubtotal()}</span>
                                </div>

                                {/* GST Ledger 1 */}
                                <div className="sof-gst-row">
                                    <div className="sof-gst-label">
                                        {formData.order_type === 'INTER_STATE' ? 'IGST' : 'CGST'} Ledger
                                    </div>
                                    <div className="sof-gst-fields">
                                        <SearchableSelect
                                            className="sof-gst-select"
                                            value={formData.gst_ledger_1 || ''}
                                            options={[{ value: '', label: 'Select Ledger' }, ...ledgers.map(l => ({ value: String(l.id), label: l.name }))]}
                                            onChange={e => handleInputChange('gst_ledger_1', e.target.value)}
                                            placeholder="Select Ledger"
                                        />
                                        <span className="sof-gst-amount">₹ {formData.gst_amount_1 || '0.00'}</span>
                                    </div>
                                </div>

                                {/* GST Ledger 2 */}
                                {formData.order_type !== 'INTER_STATE' && (
                                    <div className="sof-gst-row">
                                        <div className="sof-gst-label">SGST Ledger</div>
                                        <div className="sof-gst-fields">
                                            <SearchableSelect
                                                className="sof-gst-select"
                                                value={formData.gst_ledger_2 || ''}
                                                options={[{ value: '', label: 'Select Ledger' }, ...ledgers.map(l => ({ value: String(l.id), label: l.name }))]}
                                                onChange={e => handleInputChange('gst_ledger_2', e.target.value)}
                                                placeholder="Select Ledger"
                                            />
                                            <span className="sof-gst-amount">₹ {formData.gst_amount_2 || '0.00'}</span>
                                        </div>
                                    </div>
                                )}

                                <div className="sof-receipt-row sof-receipt-row-tax">
                                    <span className="sof-receipt-key">Total Tax</span>
                                    <span className="sof-receipt-val">₹ {getTotalTax()}</span>
                                </div>

                                {/* ── Extra Charge Rows ── */}
                                {(formData.extra_charges || []).map((ec, idx) => {
                                    const ecLedger = ledgers.find(l => String(l.id) === String(ec.ledger));
                                    let ecTaxRate = 0;
                                    if (ecLedger && Array.isArray(ecLedger.gst_details) && ecLedger.gst_details.length > 0) {
                                        const invoiceDate = formData.entry_date || new Date().toISOString().split('T')[0];
                                        const validGsts = ecLedger.gst_details
                                            .filter(g => !g.applicable_date || g.applicable_date <= invoiceDate)
                                            .sort((a, b) => {
                                                if (!a.applicable_date) return 1;
                                                if (!b.applicable_date) return -1;
                                                return new Date(b.applicable_date) - new Date(a.applicable_date);
                                            });
                                        if (validGsts.length > 0) {
                                            ecTaxRate = parseFloat(validGsts[0].gst_percentage ?? validGsts[0].gst_percent ?? validGsts[0].rate ?? 0) || 0;
                                        }
                                    }
                                    if (ecTaxRate === 0 && ecLedger) {
                                        ecTaxRate = parseFloat(ecLedger.gst_percentage ?? ecLedger.gst_percent ?? ecLedger.tax_rate ?? 0) || 0;
                                    }
                                    const ecTaxAmt = ecTaxRate > 0 ? ((parseFloat(ec.amount) || 0) * ecTaxRate) / 100 : 0;

                                    return (
                                        <div key={idx} className="sof-gst-row">
                                            <div className="sof-gst-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
                                                <span>
                                                    EXTRA CHARGE {idx + 1}
                                                    {ecTaxRate > 0 && (
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#059669', marginLeft: '6px' }}>
                                                            (+ {ecTaxRate}% GST: ₹ {ecTaxAmt.toFixed(2)})
                                                        </span>
                                                    )}
                                                </span>
                                                <button
                                                    type="button"
                                                    className={`sof-ec-del-${idx}`}
                                                    title="Remove this charge"
                                                    onClick={() => removeExtraCharge(idx)}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        color: '#ef4444',
                                                        cursor: 'pointer',
                                                        fontWeight: '700',
                                                        fontSize: '0.8rem',
                                                        lineHeight: 1,
                                                        padding: '0 2px'
                                                    }}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        <div className="sof-gst-fields">
                                            <SearchableSelect
                                                className="sof-gst-select"
                                                autoFocus={ec.isNew}
                                                data-ec-ledger="true"
                                                data-ec-idx={idx}
                                                value={ec.ledger ? (typeof ec.ledger === 'object' ? String(ec.ledger.id) : String(ec.ledger)) : ''}
                                                options={extraChargeLedgerOptions}
                                                onChange={e => handleExtraChargeChange(idx, 'ledger', e.target.value)}
                                                placeholder="Select Ledger"
                                            />
                                            <div
                                                className="sof-gst-amount"
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'flex-end',
                                                    gap: '3px',
                                                    minWidth: '85px',
                                                    cursor: 'text',
                                                    padding: '5px 10px'
                                                }}
                                                onClick={(e) => {
                                                    const inp = e.currentTarget.querySelector('input');
                                                    if (inp) inp.focus();
                                                }}
                                            >
                                                <span>₹</span>
                                                <input
                                                    type="number"
                                                    className="sof-ec-amount"
                                                    placeholder="0.00"
                                                    value={ec.amount !== undefined && ec.amount !== null ? ec.amount : ''}
                                                    step="0.01"
                                                    onChange={e => handleExtraChargeChange(idx, 'amount', e.target.value)}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        outline: 'none',
                                                        color: 'inherit',
                                                        fontWeight: 700,
                                                        fontSize: 'inherit',
                                                        textAlign: 'right',
                                                        width: '56px',
                                                        padding: 0,
                                                        fontFamily: 'inherit',
                                                        fontFeatureSettings: '"tnum"'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                                {/* Add Extra Charge button */}
                                <div style={{ padding: '10px 0 4px 0', display: 'flex', justifyContent: 'flex-start' }}>
                                    <button
                                        type="button"
                                        className="sof-btn-add-extra-charge"
                                        onClick={addExtraCharge}
                                    >
                                        + Add Extra Charge
                                    </button>
                                </div>
                            </div>

                            <div className="sof-receipt-total">
                                <span className="sof-total-label">Grand Total</span>
                                <span className="sof-total-value">₹ {formData.total_amount || '0.00'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── ACTION BAR ─────────────────────────────────────────────── */}
                <div className="sof-action-bar flex-wrap justify-content-end gap-2">
                    <button type="button" className="sof-btn-cancel" onClick={onCancel}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        Cancel
                    </button>
                    <button type="submit" className="sof-btn-save">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                            <polyline points="17 21 17 13 7 13 7 21"></polyline>
                            <polyline points="7 3 7 8 15 8"></polyline>
                        </svg>
                        {isEditing ? 'Update Sales Invoice' : 'Save Sales Invoice'}
                    </button>
                </div>
            </form>

            {/* ── ITEM ENTRY POPUP ────────────────────────────────────────── */}
            {itemPopup && (
                <ItemEntryPopup
                    item={itemPopup.item}
                    isInterState={formData.order_type === 'INTER_STATE'}
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
                    isInterState={formData.order_type === 'INTER_STATE'}
                    onClose={() => setViewPopup(null)}
                    productConfig={productConfig}
                />
            )}

            {/* ── ALL STYLES ─────────────────────────────────────────────────── */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

                /* Add Extra Charge Button Styles */
                .sof-btn-add-extra-charge {
                    font-size: 0.78rem;
                    padding: 5px 14px;
                    border-radius: 6px;
                    border: 1.5px solid #bfdbfe;
                    color: #1d4ed8;
                    background: #eff6ff;
                    font-weight: 600;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    transition: all 0.2s ease;
                    outline: none;
                }
                .sof-btn-add-extra-charge:hover, .sof-btn-add-extra-charge:focus {
                    background: #2563eb;
                    color: #fff;
                    border-color: #2563eb;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
                }

                /* Hide native calendar picker indicator */
                .sof-input[type="date"]::-webkit-calendar-picker-indicator,
                .sof-input[type="datetime-local"]::-webkit-calendar-picker-indicator {
                    display: none !important;
                    -webkit-appearance: none !important;
                }

                /* Hide chromium date segments focus selection highlight by default */
                .sof-input[type="date"]:not(.sof-input-edit-segments)::-webkit-datetime-edit-month-field:focus,
                .sof-input[type="date"]:not(.sof-input-edit-segments)::-webkit-datetime-edit-day-field:focus,
                .sof-input[type="date"]:not(.sof-input-edit-segments)::-webkit-datetime-edit-year-field:focus,
                .sof-input[type="datetime-local"]:not(.sof-input-edit-segments)::-webkit-datetime-edit-month-field:focus,
                .sof-input[type="datetime-local"]:not(.sof-input-edit-segments)::-webkit-datetime-edit-day-field:focus,
                .sof-input[type="datetime-local"]:not(.sof-input-edit-segments)::-webkit-datetime-edit-year-field:focus,
                .sof-input[type="datetime-local"]:not(.sof-input-edit-segments)::-webkit-datetime-edit-hour-field:focus,
                .sof-input[type="datetime-local"]:not(.sof-input-edit-segments)::-webkit-datetime-edit-minute-field:focus,
                .sof-input[type="datetime-local"]:not(.sof-input-edit-segments)::-webkit-datetime-edit-ampm-field:focus,
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

                /* ── BANNER ── */
                .sof-banner {
                    background: linear-gradient(135deg, #1e1b4b 0%, #3730a3 35%, #4f46e5 65%, #6366f1 100%);
                    border-radius: 14px;
                    padding: 14px 24px;
                    margin-bottom: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                    box-shadow: 0 10px 40px rgba(79, 70, 229, 0.4), 0 2px 8px rgba(0,0,0,0.15);
                    position: relative;
                    overflow: hidden;
                    border: 1px solid rgba(255,255,255,0.1);
                }
                .sof-banner::before {
                    content: '';
                    position: absolute;
                    top: -30px; right: -30px;
                    width: 140px; height: 140px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.07);
                }
                .sof-banner::after {
                    content: '';
                    position: absolute;
                    bottom: -50px; right: 120px;
                    width: 180px; height: 180px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.05);
                }
                .sof-banner-inner { display: flex; align-items: center; gap: 16px; }
                .sof-banner-icon {
                    width: 52px; height: 52px;
                    background: rgba(255,255,255,0.15);
                    border-radius: 14px;
                    display: flex; align-items: center; justify-content: center;
                    color: #fff;
                    flex-shrink: 0;
                    backdrop-filter: blur(8px);
                }
                .sof-banner-icon svg { width: 26px; height: 26px; }
                .sof-banner-title { color: #fff; font-size: 1.4rem; font-weight: 800; margin: 0 0 4px 0; letter-spacing: -0.3px; }
                .sof-banner-sub { color: rgba(255,255,255,0.75); font-size: 0.82rem; margin: 0; font-weight: 500; }
                .sof-type-pill {
                    padding: 8px 18px;
                    border-radius: 50px;
                    font-size: 0.78rem;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                    white-space: nowrap;
                }
                .sof-pill-state { background: rgba(255,255,255,0.2); color: #fff; border: 1.5px solid rgba(255,255,255,0.3); }
                .sof-pill-inter { background: #fbbf24; color: #78350f; border: none; }

                /* ── SECTIONS ── */
                .sof-section {
                    background: #ffffff;
                    border: 1px solid #e8edf4;
                    border-radius: 14px;
                    padding: 10px 14px;
                    margin-bottom: 10px;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03);
                    transition: box-shadow 0.25s ease, border-color 0.25s ease;
                }
                .sof-section:hover {
                    box-shadow: 0 4px 20px rgba(99,102,241,0.08), 0 1px 6px rgba(0,0,0,0.06);
                    border-color: #ddd6fe;
                }
                .sof-section-inner { border-top-left-radius: 0; border-top-right-radius: 0; border-top: none; margin-top: 0; }
                .sof-table-section { padding: 0; overflow: hidden; }
                .sof-section-head {
                    display: flex; align-items: center; gap: 10px;
                    margin-bottom: 10px;
                    padding: 0;
                }
                .sof-table-section .sof-section-head {
                    padding: 10px 16px;
                    margin-bottom: 0;
                    border-bottom: 1px solid #f1f5f9;
                    background: linear-gradient(to right, #fafbff, #f8fafc);
                }
                .sof-section-icon {
                    width: 34px; height: 34px;
                    background: linear-gradient(135deg, #6366f1, #4338ca);
                    border-radius: 9px;
                    display: flex; align-items: center; justify-content: center;
                    color: #fff; flex-shrink: 0;
                    box-shadow: 0 3px 8px rgba(99,102,241,0.3);
                }
                .sof-section-icon svg { width: 16px; height: 16px; }
                .sof-icon-teal { background: linear-gradient(135deg, #0d9488, #0f766e); box-shadow: 0 3px 8px rgba(13,148,136,0.3); }
                .sof-icon-amber { background: linear-gradient(135deg, #f59e0b, #d97706); box-shadow: 0 3px 8px rgba(245,158,11,0.3); }
                .sof-icon-blue { background: linear-gradient(135deg, #3b82f6, #1d4ed8); box-shadow: 0 3px 8px rgba(59,130,246,0.3); }
                .sof-section-head > span {
                    font-size: 0.9rem; font-weight: 700;
                    color: #1e293b; white-space: nowrap;
                    letter-spacing: -0.01em;
                }
                .sof-section-line {
                    flex: 1; height: 1px;
                    background: linear-gradient(to right, #e2e8f0 30%, transparent 100%);
                }
                .sof-add-row-btn {
                    display: flex; align-items: center; gap: 6px;
                    background: linear-gradient(135deg, #ecfdf5, #d1fae5);
                    color: #065f46;
                    border: 1.5px solid #a7f3d0;
                    border-radius: 8px;
                    padding: 6px 14px;
                    font-size: 0.78rem; font-weight: 700;
                    cursor: pointer; white-space: nowrap;
                    transition: all 0.2s ease;
                }
                .sof-add-row-btn:hover {
                    background: linear-gradient(135deg, #059669, #047857);
                    color: #fff; border-color: transparent;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
                }

                /* ── FORM FIELDS ── */
                .sof-field-group { margin-bottom: 6px; }
                .sof-label {
                    display: flex; align-items: center; gap: 6px;
                    font-size: 0.62rem; font-weight: 700;
                    color: #64748b;
                    text-transform: uppercase; letter-spacing: 0.07em;
                    margin-bottom: 5px;
                }
                .sof-req { color: #ef4444; font-weight: 900; }
                .sof-badge-auto {
                    font-size: 0.58rem; font-weight: 700;
                    background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
                    color: #4338ca;
                    padding: 2px 7px; border-radius: 20px;
                    letter-spacing: 0.04em;
                    border: 1px solid #c7d2fe;
                }
                .sof-input-box {
                    display: flex; align-items: center;
                    background: #f8fafc;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 10px;
                    transition: all 0.2s ease;
                    position: relative;
                    overflow: hidden;
                }
                .sof-input-box:hover {
                    border-color: #c7d2fe;
                    background: #fefeff;
                }
                .sof-input-box:focus-within {
                    background: #fff;
                    border-color: #6366f1;
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
                }
                .sof-input-locked { background: #f1f5f9 !important; }
                .sof-input-locked:hover { border-color: #e2e8f0 !important; background: #f1f5f9 !important; }
                .sof-input-locked:focus-within { border-color: #e2e8f0; box-shadow: none; }
                .sof-field-icon {
                    padding: 0 10px;
                    color: #a5b4c8; flex-shrink: 0;
                }
                .sof-field-icon svg { width: 15px; height: 15px; display: block; }
                .sof-input {
                    flex: 1;
                    border: none; background: transparent;
                    padding: 7px 10px;
                    font-size: 0.82rem; font-weight: 500;
                    color: #1e293b; outline: none;
                    width: 100%;
                    font-family: inherit;
                }
                .sof-field-icon + .sof-input { padding-left: 0; }
                .sof-input-locked .sof-input { color: #64748b; cursor: not-allowed; }
                .sof-textarea {
                    resize: vertical; min-height: 60px; border-radius: 10px;
                    border: 1.5px solid #e2e8f0; padding: 8px 12px;
                    font-family: inherit; transition: all 0.2s ease;
                    font-size: 0.83rem; color: #374151; width: 100%;
                    background: #f8fafc;
                }
                .sof-textarea:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12); outline: none; background: #fff; }
                .sof-textarea:hover { border-color: #c7d2fe; background: #fefeff; }
                select.sof-input { cursor: pointer; }
                button.sof-input { cursor: pointer; }
                button.sof-table-input { cursor: pointer; text-align: left; }
                button.sof-gst-select { cursor: pointer; text-align: left; }
                /* SearchableSelect focus-within for the input-box container */
                .sof-input-box:focus-within { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12); }

                /* ── COLLAPSIBLE SECTION ── */
                /* ── SUBHEAD DIVIDER ── */
                .sof-subhead {
                    display: flex; align-items: center; gap: 8px;
                }
                .sof-subhead-icon {
                    color: #3b82f6;
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

                /* ── TABLE ── */
                .sof-table-scroll { overflow-x: auto; }
                .sof-table { width: 100%; border-collapse: collapse; }
                .sof-table thead tr {
                    background: linear-gradient(to right, #1e1b4b, #3730a3, #4f46e5);
                }
                .sof-table th {
                    color: rgba(255,255,255,0.92);
                    font-size: 0.62rem; font-weight: 700;
                    text-transform: uppercase; letter-spacing: 0.08em;
                    padding: 10px 8px;
                    border: none; white-space: nowrap;
                }
                .sof-th-center { text-align: center; }
                .sof-th-right { text-align: right; }
                .sof-th-calc { color: rgba(255,255,255,0.5); }
                .sof-th-amount { color: #fcd34d; font-weight: 800; }
                .sof-tr { transition: background-color 0.15s ease; }
                .sof-tr:nth-child(even) { background-color: #fafaff; }
                .sof-tr:hover { background-color: #eef2ff; }
                .sof-table td { padding: 3px 4px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
                .sof-td-center { text-align: center; }
                .sof-row-num {
                    display: inline-flex; align-items: center; justify-content: center;
                    width: 22px; height: 22px;
                    background: #e0e7ff; color: #4338ca;
                    border-radius: 50%;
                    font-size: 0.72rem; font-weight: 700;
                }
                .sof-cell-input, .sof-cell-select {
                    width: 100%; border: 1.5px solid transparent;
                    background: transparent;
                    padding: 3px 6px; border-radius: 7px;
                    font-size: 0.78rem; font-weight: 500;
                    color: #1e293b; outline: none;
                    transition: all 0.18s ease;
                    font-family: inherit;
                }
                .sof-cell-input:hover, .sof-cell-select:hover {
                    background: #fff;
                    border-color: #c7d2fe;
                }
                .sof-cell-input:focus, .sof-cell-select:focus {
                    background: #fff;
                    border-color: #6366f1;
                    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
                }
                .sof-cell-right { text-align: right; }
                .sof-cell-center { text-align: center; }
                .sof-cell-calc {
                    background: #f8fafc; color: #94a3b8;
                    cursor: not-allowed; border-color: transparent !important;
                    box-shadow: none !important;
                }
                .sof-cell-amount {
                    background: #f0fdf4; color: #166534;
                    font-weight: 700; cursor: not-allowed;
                    border-color: transparent !important;
                    box-shadow: none !important;
                }
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
                    border-color: #6366f1;
                    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
                    background-color: #ffffff;
                }
                .sof-table-input-ro {
                    background-color: #f8fafc;
                    color: #64748b;
                    cursor: not-allowed;
                    border-color: #cbd5e1;
                }
                .sof-del-btn {
                    display: inline-flex; align-items: center; justify-content: center;
                    width: 28px; height: 28px;
                    border-radius: 7px; border: 1.5px solid #fecaca;
                    background: #fef2f2; color: #dc2626;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .sof-del-btn:hover:not(:disabled) {
                    background: #dc2626; color: #fff;
                    border-color: #dc2626;
                    transform: scale(1.1);
                    box-shadow: 0 3px 10px rgba(220, 38, 38, 0.3);
                }
                .sof-del-btn:disabled { opacity: 0.3; cursor: not-allowed; }

                /* ── RECEIPT CARD ── */
                .sof-receipt {
                    background: #fff;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 16px;
                    overflow: hidden;
                    height: 100%;
                    display: flex; flex-direction: column;
                    box-shadow: 0 4px 20px rgba(99,102,241,0.08), 0 1px 4px rgba(0,0,0,0.06);
                    transition: box-shadow 0.25s ease;
                }
                .sof-receipt:hover {
                    box-shadow: 0 8px 32px rgba(99,102,241,0.14), 0 2px 8px rgba(0,0,0,0.08);
                }
                .sof-receipt-header {
                    background: linear-gradient(135deg, #1e1b4b 0%, #3730a3 40%, #4f46e5 100%);
                    color: #fff;
                    padding: 16px 22px;
                    font-size: 0.85rem; font-weight: 800;
                    letter-spacing: 0.06em;
                    display: flex; align-items: center; gap: 10px;
                    text-transform: uppercase;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }
                .sof-receipt-header svg { opacity: 0.85; }
                .sof-receipt-body { padding: 16px 20px; flex: 1; }
                .sof-receipt-row {
                    display: flex; justify-content: space-between; align-items: center;
                    padding: 9px 0; border-bottom: 1px dashed #f1f5f9;
                    font-size: 0.84rem;
                }
                .sof-receipt-row:last-child { border-bottom: none; }
                .sof-receipt-row-tax {
                    margin-top: 6px;
                    padding-top: 10px;
                    border-top: 1.5px solid #e2e8f0;
                    border-bottom: none;
                }
                .sof-receipt-key { color: #64748b; font-weight: 500; }
                .sof-receipt-val { font-weight: 700; color: #1e293b; font-feature-settings: "tnum"; }
                .sof-gst-row {
                    margin-bottom: 10px;
                    background: linear-gradient(135deg, #f8fafc, #f0f4ff);
                    border-radius: 10px; padding: 10px 12px;
                    border: 1px solid #e8edf4;
                }
                .sof-gst-label { font-size: 0.62rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 8px; }
                .sof-gst-fields { display: flex; align-items: center; gap: 10px; }
                .sof-gst-select {
                    flex: 1; border: 1.5px solid #e2e8f0;
                    border-radius: 8px; padding: 7px 10px;
                    font-size: 0.8rem; font-weight: 500;
                    color: #374151; background: #fff;
                    outline: none; font-family: inherit;
                    transition: all 0.2s ease;
                }
                .sof-gst-select:hover { border-color: #c7d2fe; }
                .sof-gst-select:focus { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.12); }
                .sof-gst-amount {
                    font-size: 0.82rem; font-weight: 700;
                    color: #0f766e; white-space: nowrap;
                    background: linear-gradient(135deg, #ccfbf1, #99f6e4);
                    padding: 6px 12px;
                    border-radius: 8px; min-width: 72px; text-align: right;
                    font-feature-settings: "tnum";
                    border: 1px solid #5eead4;
                }
                .sof-receipt-total {
                    background: linear-gradient(135deg, #1e1b4b 0%, #3730a3 40%, #4f46e5 100%);
                    padding: 20px 22px;
                    display: flex; align-items: center; justify-content: space-between;
                    border-top: 1px solid rgba(255,255,255,0.1);
                }
                .sof-total-label {
                    color: rgba(255,255,255,0.75);
                    font-size: 0.75rem; font-weight: 700;
                    text-transform: uppercase; letter-spacing: 0.1em;
                }
                .sof-total-value {
                    color: #fff; font-size: 1.7rem; font-weight: 800;
                    letter-spacing: -0.5px;
                    font-feature-settings: "tnum";
                    text-shadow: 0 2px 8px rgba(0,0,0,0.2);
                }

                /* ── ACTION BAR ── */
                .sof-action-bar {
                    display: flex; justify-content: flex-end; align-items: center;
                    gap: 14px;
                    padding: 14px 0 6px 0;
                    border-top: 1.5px solid #f1f5f9;
                    margin-top: 6px;
                }
                .sof-btn-cancel {
                    display: inline-flex; align-items: center; gap: 8px;
                    background: #fff; color: #64748b;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 10px; padding: 10px 20px;
                    font-size: 0.82rem; font-weight: 700;
                    cursor: pointer; transition: all 0.2s ease;
                    font-family: inherit;
                }
                .sof-btn-cancel:hover {
                    background: #f8fafc; color: #334155;
                    border-color: #94a3b8;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.06);
                }
                .sof-btn-save {
                    display: inline-flex; align-items: center; gap: 8px;
                    background: linear-gradient(135deg, #4f46e5, #3730a3);
                    color: #fff; border: none;
                    border-radius: 10px; padding: 10px 24px;
                    font-size: 0.84rem; font-weight: 700;
                    cursor: pointer;
                    box-shadow: 0 4px 16px rgba(79, 70, 229, 0.4);
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    font-family: inherit;
                    letter-spacing: 0.01em;
                }
                .sof-btn-save:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 28px rgba(79, 70, 229, 0.5);
                    background: linear-gradient(135deg, #4338ca, #3730a3);
                }
                .sof-btn-save:active { transform: translateY(0); box-shadow: 0 4px 12px rgba(79,70,229,0.3); }

                /* ── ITEMS COUNT BADGE ── */
                .sof-items-count {
                    font-size: 0.72rem; font-weight: 700;
                    background: #e0e7ff; color: #4338ca;
                    padding: 2px 9px; border-radius: 20px;
                    letter-spacing: 0.03em;
                }

                /* ── EMPTY STATE ── */
                .sof-items-empty {
                    display: flex; flex-direction: column;
                    align-items: center; justify-content: center;
                    gap: 10px; padding: 36px 24px;
                    margin: 18px 20px;
                    border: 1.5px dashed #e2e8f0;
                    border-radius: 12px;
                    background: #f8fafc;
                }
                .sof-items-empty-icon { color: #94a3b8; width: 44px; height: 44px; }
                .sof-items-empty-icon svg { width: 44px; height: 44px; }
                .sof-items-empty-title { font-size: 0.9rem; font-weight: 700; color: #64748b; margin: 0; }
                .sof-items-empty-sub { font-size: 0.78rem; color: #94a3b8; margin: 0; text-align: center; }

                /* ── ITEM CARDS ── */
                .sof-item-cards {
                    padding: 14px 20px 4px;
                    display: flex; flex-direction: column; gap: 10px;
                }
                .sof-item-card {
                    display: flex; align-items: center; gap: 14px;
                    padding: 13px 16px;
                    background: #ffffff;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 10px;
                    transition: border-color 0.2s ease, box-shadow 0.2s ease;
                }
                .sof-item-card:hover {
                    border-color: #c7d2fe;
                    box-shadow: 0 2px 10px rgba(99, 102, 241, 0.08);
                }
                .sof-item-card-icon {
                    width: 34px; height: 34px; flex-shrink: 0;
                    background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
                    border-radius: 8px;
                    display: flex; align-items: center; justify-content: center;
                    color: #4338ca;
                }
                .sof-item-card-icon svg { width: 17px; height: 17px; }
                .sof-item-card-info {
                    flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0;
                }
                .sof-item-card-name {
                    font-size: 0.88rem; font-weight: 700; color: #1e293b;
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                }
                .sof-item-card-sub { font-size: 0.76rem; color: #64748b; }
                .sof-item-card-right {
                    display: flex; align-items: center; gap: 14px; flex-shrink: 0;
                }
                .sof-item-card-amt {
                    font-size: 0.95rem; font-weight: 800; color: #1e293b;
                    font-feature-settings: "tnum"; white-space: nowrap;
                }
                .sof-view-details-btn {
                    background: none; border: none;
                    color: #6366f1; font-size: 0.78rem; font-weight: 600;
                    cursor: pointer; padding: 0; font-family: inherit;
                    text-decoration: underline; text-underline-offset: 2px;
                    transition: color 0.15s;
                }
                .sof-view-details-btn:hover { color: #4338ca; }
                .sof-edit-item-btn {
                    background: none; border: none;
                    color: #64748b; cursor: pointer; padding: 4px;
                    border-radius: 6px; display: flex; align-items: center;
                    transition: color 0.15s, background 0.15s;
                }
                .sof-edit-item-btn:hover { color: #4338ca; background: #e0e7ff; }

                /* ── ITEM SEARCH BAR ── */
                .sof-item-search-wrap { padding: 16px 20px 18px; }
                .sof-item-search-label {
                    font-size: 0.7rem; font-weight: 700; color: #64748b;
                    text-transform: uppercase; letter-spacing: 0.06em;
                    margin-bottom: 8px;
                }
                .sof-item-search-row { display: flex; gap: 8px; align-items: stretch; }
                .sof-item-search-box {
                    flex: 1;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 10px;
                    background: #f8fafc;
                    overflow: hidden;
                    transition: all 0.2s ease;
                }
                .sof-item-search-box:focus-within {
                    background: #fff;
                    border-color: #6366f1;
                    box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
                }
                .sof-item-search-select {
                    width: 100%; border: none; background: transparent;
                    padding: 11px 14px;
                    font-size: 0.875rem; font-weight: 500;
                    color: #1e293b; outline: none;
                    font-family: inherit; cursor: pointer;
                }
                .sof-enter-btn {
                    display: inline-flex; align-items: center; gap: 7px;
                    background: linear-gradient(135deg, #ecfdf5, #d1fae5);
                    color: #065f46;
                    border: 1.5px solid #a7f3d0;
                    border-radius: 10px;
                    padding: 0 18px;
                    font-size: 0.8rem; font-weight: 700;
                    cursor: pointer; white-space: nowrap;
                    font-family: inherit;
                    transition: all 0.2s ease;
                }
                .sof-enter-btn:hover {
                    background: linear-gradient(135deg, #059669, #047857);
                    color: #fff; border-color: transparent;
                    box-shadow: 0 4px 12px rgba(5,150,105,0.3);
                }
                .sof-item-search-hint {
                    font-size: 0.74rem; color: #94a3b8; margin: 7px 0 0 2px;
                }

                /* ══ MODAL BACKDROP + POPUP ══ */
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
                    width: 100%; max-width: 520px;
                    display: flex; flex-direction: column;
                    max-height: 90vh; overflow: hidden;
                    border: 1.5px solid #e2e8f0;
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
                .sof-modal-sub {
                    font-size: 0.65rem; font-weight: 700;
                    color: #94a3b8; text-transform: uppercase;
                    letter-spacing: 0.07em; margin-bottom: 4px;
                }
                .sof-modal-title {
                    font-size: 1.05rem; font-weight: 800; color: #1e293b;
                    line-height: 1.25;
                }
                .sof-modal-close {
                    background: #f8fafc; border: 1.5px solid #e2e8f0;
                    border-radius: 8px; padding: 7px; cursor: pointer;
                    color: #64748b; display: flex; align-items: center;
                    flex-shrink: 0; transition: all 0.15s ease;
                }
                .sof-modal-close svg { width: 15px; height: 15px; display: block; }
                .sof-modal-close:hover { background: #fff; color: #1e293b; border-color: #94a3b8; }

                .sof-modal-body { padding: 20px 22px; overflow-y: auto; }
                .sof-modal-grid {
                    display: grid; grid-template-columns: 1fr 1fr;
                    gap: 14px 20px; margin-bottom: 18px;
                }
                .sof-modal-fg { display: flex; flex-direction: column; gap: 5px; }
                .sof-modal-lbl {
                    font-size: 0.7rem; font-weight: 700; color: #64748b;
                    text-transform: uppercase; letter-spacing: 0.05em;
                    display: flex; align-items: center; gap: 4px;
                }
                .sof-modal-ctrl {
                    border: 1.5px solid #e2e8f0;
                    border-radius: 8px; padding: 9px 12px;
                    font-size: 0.875rem; font-weight: 500;
                    color: #1e293b; background: #f8fafc;
                    outline: none; font-family: inherit;
                    transition: all 0.2s ease; width: 100%;
                    box-sizing: border-box;
                }
                .sof-modal-ctrl:focus {
                    background: #fff; border-color: #6366f1;
                    box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
                }
                .sof-modal-ctrl-ro {
                    background: #f1f5f9; color: #64748b; cursor: default;
                }
                .sof-modal-ctrl-ro:focus { border-color: #e2e8f0; box-shadow: none; }
                .sof-modal-net {
                    display: flex; align-items: center;
                    justify-content: space-between;
                    background: linear-gradient(135deg, #e0e7ff, #ede9fe);
                    border: 1.5px solid #c7d2fe;
                    border-radius: 10px; padding: 14px 18px;
                    margin-top: 4px;
                }
                .sof-modal-net-label { font-size: 0.85rem; font-weight: 700; color: #4338ca; }
                .sof-modal-net-value {
                    font-size: 1.1rem; font-weight: 800; color: #312e81;
                    font-feature-settings: "tnum";
                }
                .sof-modal-footer {
                    display: flex; justify-content: flex-end; gap: 12px;
                    padding: 16px 22px;
                    border-top: 1.5px solid #f1f5f9;
                    background: #fafbff;
                }

                /* ── VIEW POPUP SPECIFICS ── */
                .sof-modal-body-view { padding: 20px 22px 16px; }
                .sof-view-grid {
                    display: grid; grid-template-columns: 1fr 1fr;
                    gap: 10px;
                }
                .sof-view-tile {
                    background: #f8fafc; border: 1px solid #e2e8f0;
                    border-radius: 10px; padding: 12px 14px;
                    display: flex; flex-direction: column; gap: 5px;
                }
                .sof-view-tile-label {
                    font-size: 0.65rem; font-weight: 700; color: #94a3b8;
                    text-transform: uppercase; letter-spacing: 0.06em;
                }
                .sof-view-tile-value {
                    font-size: 0.9rem; font-weight: 700; color: #1e293b;
                }
                .sof-view-net-bar {
                    background: linear-gradient(135deg, #312e81, #4338ca);
                    border-radius: 0 0 14px 14px;
                    border: none; margin: 0;
                }
                .sof-view-net-bar .sof-modal-net-label { color: rgba(255,255,255,0.8); }
                .sof-view-net-bar .sof-modal-net-value { color: #fff; }

                @media (max-width: 640px) {
                    .sof-modal-grid { grid-template-columns: 1fr; }
                    .sof-view-grid { grid-template-columns: 1fr; }
                }

                /* ── PREMIUM MODAL OVERRIDES ── */
                .sof-modal {
                    border: none;
                    box-shadow: 0 20px 50px rgba(15, 23, 42, 0.3);
                }
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
                    background: linear-gradient(135deg, #312e81 0%, #4f46e5 100%) !important;
                }
                .sof-modal .sof-table th {
                    color: #ffffff;
                    font-size: 0.72rem;
                    font-weight: 700;
                    padding: 13px 12px;
                    border-bottom: 2px solid #312e81;
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
                
                /* ── MODAL CLOSE BUTTON ── */
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
                    color: #cbd5e1;
                    flex-shrink: 0;
                    transition: all 0.2s ease;
                }
                .sof-modal-close svg { width: 16px; height: 16px; display: block; }
                .sof-modal-close:hover {
                    background: rgba(255, 255, 255, 0.18);
                    color: #ffffff;
                    transform: rotate(90deg);
                }

                /* ── ROW ACTION BUTTONS ── */
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
                    border: 1.5px solid #dbeafe;
                    color: #2563eb;
                    background: #eff6ff;
                }
                .sof-popup-btn-add:hover, .sof-popup-btn-add:focus {
                    background: #2563eb;
                    color: #fff;
                    border-color: #2563eb;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
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

                /* ── FOOTER BUTTONS ── */
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
                    background: linear-gradient(135deg, #10b981, #059669);
                    color: #ffffff;
                    border: none;
                    border-radius: 8px;
                    padding: 9px 24px;
                    font-size: 0.84rem;
                    font-weight: 700;
                    cursor: pointer;
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    font-family: inherit;
                }
                .sof-popup-btn-save:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 6px 16px rgba(16, 185, 129, 0.35);
                    background: linear-gradient(135deg, #059669, #047857);
                }
                .sof-popup-btn-save:active {
                    transform: translateY(0);
                }
                
                /* ── FOCUS HIGHLIGHT ENHANCEMENTS ── */
                .sof-table-input:focus, .sof-cell-input:focus, .sof-cell-select:focus, select.sof-table-input:focus {
                    border: 2px solid #3b82f6 !important;
                    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2) !important;
                    background-color: #eff6ff !important;
                    outline: none !important;
                }
                /* Focus state for action buttons */
                .d-flex button:focus, .gap-2 button:focus, .sof-modal button:focus {
                    outline: none !important;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3) !important;
                    border-color: #3b82f6 !important;
                    transform: translateY(-1px);
                }
            ` }} />
        </div>
    );
};

export default SalesInvoiceForm;