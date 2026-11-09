import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import * as FinanceService from '../../../services/FinanceService';
import { getStockItems, getWarehouses, getPriceLists } from '../../../services/InventoryService';
import { getPriceListMappings } from '../../../services/FinanceService';
import InventoryService from '../../../services/InventoryService';
import LogisticsService from '../../../services/LogisticsService';
import { fetchPrefixConfigurations } from '../../../services/PrefixService';
import swal from 'sweetalert';
import LedgerFormModal from './LedgerFormModal';
import { usePageTitle } from '../../../context/TitleContext';

/* ── helper: format default numeric values as empty strings for placeholders ── */
const cleanZeroValue = (val) => {
    if (val === undefined || val === null || val === '') return '';
    const num = parseFloat(val);
    if (isNaN(num) || num === 0) return '';
    return val;
};


/* ── helper: get today's date in YYYY-MM-DD format in local timezone ── */
const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
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
    
    // Filter rates where applicable_date <= entryDate
    const applicableRates = rates
        .filter(r => !entryDate || r.applicable_date <= entryDate)
        .sort((a, b) => new Date(b.applicable_date) - new Date(a.applicable_date));
    
    if (applicableRates.length > 0) {
        return parseFloat(applicableRates[0].igst_percent) || 0;
    }
    
    // If none are applicable before entryDate, fallback to the oldest available rate
    const sortedAll = [...rates].sort((a, b) => new Date(a.applicable_date) - new Date(b.applicable_date));
    return parseFloat(sortedAll[0]?.igst_percent) || parseFloat(itemObj.gst_percentage) || 0;
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
        per: finalSplits[0]?.per || item.per || '',
        perName: finalSplits[0]?.perName || item.perName || '',
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

/* ── helper: check if a sweetalert popup is currently visible ── */
const isAlertOpen = () => !!document.querySelector('.swal-overlay.swal-overlay--show-modal, .swal2-container');

/* ── helper: validate mandatory field before navigating away ── */
const checkMandatoryBeforeNavigate = (active, e) => {
    if (!active) return false;
    const tagName = active.tagName ? active.tagName.toLowerCase() : '';
    const isSelectTrigger = tagName === 'button' && active.hasAttribute('data-ss-trigger');
    const isRequiredField = active.hasAttribute('required') || active.parentElement?.hasAttribute('data-required');

    if (isRequiredField) {
        const isEmptySelectTrigger = isSelectTrigger && active.getAttribute('data-empty') === 'true';
        const isEmptyPlainField = !isSelectTrigger && (!active.value || !String(active.value).trim());
        if (isEmptySelectTrigger || isEmptyPlainField) {
            if (e && typeof e.preventDefault === 'function') {
                e.preventDefault();
                e.stopPropagation();
            }
            const label = active.getAttribute('data-label') || active.parentElement?.getAttribute('data-label') || 'This field';
            swal('Required', `${label} is mandatory. Please fill this column before continuing.`, 'warning').then(() => {
                active.focus();
                if (isSelectTrigger) {
                    setTimeout(() => {
                        active.click();
                    }, 50);
                } else if (tagName === 'select') {
                    setTimeout(() => {
                        trackSelectOpen(active);
                    }, 50);
                }
            });
            return true;
        }
    }
    return false;
};

/* ── helper: handle Enter key focus navigation ── */
const handleEnterNavigation = (e) => {
    if (e.key === 'Enter') {
        const active = document.activeElement;
        if (!active) return;
        
        const tagName = active.tagName.toLowerCase();
        const isSelectTrigger = tagName === 'button' && active.hasAttribute('data-ss-trigger');
        // Allow default behavior for buttons or submit inputs (except SearchableSelect triggers)
        if (active.type === 'submit' || (tagName === 'button' && !isSelectTrigger)) {
            return;
        }

        if (checkMandatoryBeforeNavigate(active, e)) {
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
        
        // Intercept Enter on Extra Charge Amount to add a new charge immediately
        if (active.classList.contains('sof-ec-amount')) {
            const btn = document.querySelector('.sof-btn-add-extra-charge');
            if (btn) btn.click();
            return;
        }

        // Find all focusable input/select controls in this container
        const container = e.currentTarget;
        const focusables = Array.from(
            container.querySelectorAll(
                'input[name="quotation_no"], input:not([readonly]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button[data-ss-trigger]:not([disabled]), .sof-btn-save'
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
                    'input[name="quotation_no"], input:not([readonly]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button[data-ss-trigger]:not([disabled]), .sof-btn-save'
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
    ['quotation_no', 'entry_date', 'order_type', 'customer_ledger'],
    ['document_no', 'document_date', 'dispatch_through'],
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

    if (checkMandatoryBeforeNavigate(active, e)) {
        return;
    }

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
            'input[name="quotation_no"], input:not([readonly]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button[data-ss-trigger]:not([disabled]), .sof-btn-save'
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
    if (isAlertOpen()) {
        return;
    }
    if (e.key === 'Tab') {
        const active = document.activeElement;
        if (checkMandatoryBeforeNavigate(active, e)) {
            return;
        }
    }
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
    className = '', onKeyDown, style = {}, name, allowCustom = false,
    required = false, 'data-label': dataLabel, autoFocus = false, ...dataProps
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

    const selectedLabel = options.find(o => String(o.value) === String(value))?.label || (allowCustom && value ? value : '');

    let filtered = query.trim()
        ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
        : options;

    const queryTrimmed = query.trim();
    const exactMatchExists = queryTrimmed
        ? options.some(o => o.label.toLowerCase() === queryTrimmed.toLowerCase())
        : false;

    if (allowCustom && queryTrimmed && !exactMatchExists) {
        filtered = [...filtered, { value: queryTrimmed, label: `Add "${queryTrimmed}"`, isCustom: true }];
    }

    const openDropdown = useCallback(() => {
        if (disabled) return;
        const initIdx = value ? options.findIndex(o => String(o.value) === String(value)) : -1;
        setHighlightIdx(initIdx >= 0 ? initIdx : 0);
        setQuery('');
        if (containerRef.current) {
            const targetEl = containerRef.current.closest('.sof-input-box') || containerRef.current;
            
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            const rect = targetEl.getBoundingClientRect();
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
        if (restoreFocus) {
            justClosedRef.current = true;
            setTimeout(() => containerRef.current?.querySelector('[data-ss-trigger]')?.focus(), 10);
        }
    }, []);

    const selectOption = useCallback((opt) => {
        if (required && String(opt.value) === '' && !value) {
            closeDropdown(false);
            const label = dataLabel || placeholder || 'This field';
            swal('Required', `${label} is mandatory. Please fill this column before continuing.`, 'warning').then(() => {
                setTimeout(() => {
                    const trigger = containerRef.current?.querySelector('[data-ss-trigger]');
                    if (trigger) {
                        trigger.focus();
                        trigger.click();
                    }
                }, 50);
            });
            return;
        }

        const cRef = containerRef.current;
        const isMainGrid = cRef?.hasAttribute('data-row');
        const row = cRef?.getAttribute('data-row');
        const col = cRef?.getAttribute('data-col');
        const isFirstCol = parseInt(col, 10) === 0;
        const isEmptyRowRemove = isMainGrid && isFirstCol && !opt.value && row !== "0";

        onChange({ target: { value: opt.value } });
        justSelectedRef.current = false;
        closeDropdown(false);

        setTimeout(() => {
            if ((document.querySelector('.swal-overlay--show-modal') || document.body.classList.contains('swal2-shown'))) {
                return;
            }

            if (cRef?.hasAttribute('data-ec-ledger')) {
                if (!opt.value) {
                    const idx = cRef.getAttribute('data-ec-idx');
                    const delBtn = document.querySelector(`.sof-ec-del-${idx}`);
                    if (delBtn) delBtn.click();
                    
                    const saveBtn = document.querySelector('.sof-btn-save');
                    if (saveBtn) {
                        saveBtn.focus();
                        setTimeout(() => saveBtn.focus(), 50);
                    }
                    return;
                }
            }

            if (isEmptyRowRemove) {
                const target = document.querySelector('.sof-btn-add-extra-charge');
                if (target) {
                    target.focus();
                }
                return;
            }

            if (!containerRef.current) return;
            if (isAlertOpen()) {
                return;
            }

            // 1. Check if we are in the popup splits entry grid
            const prow = containerRef.current.getAttribute('data-prow');
            const pcol = containerRef.current.getAttribute('data-pcol');
            if (prow !== null && pcol !== null) {
                const isFirstCol = parseInt(pcol, 10) === 0;
                if (isFirstCol && !opt.value) {
                    const trigger = containerRef.current.querySelector('[data-ss-trigger]');
                    if (trigger) {
                        justClosedRef.current = true;
                        trigger.focus();
                        setTimeout(() => {
                            const event = new KeyboardEvent('keydown', {
                                key: 'Enter',
                                bubbles: true,
                                cancelable: true
                            });
                            trigger.dispatchEvent(event);
                        }, 100);
                    }
                    return;
                }
                const nextCol = parseInt(pcol, 10) + 1;
                const nextContainer = document.querySelector(`[data-prow="${prow}"][data-pcol="${nextCol}"]`);
                if (nextContainer) {
                    const trigger = nextContainer.querySelector('[data-ss-trigger]');
                    const targetEl = trigger || nextContainer;
                    targetEl.focus();
                    if (targetEl.tagName.toLowerCase() === 'input' && typeof targetEl.select === 'function') {
                        targetEl.select();
                    }
                    return;
                }
            }

            // 2. Check if we are in the main grid
            const row = containerRef.current.getAttribute('data-row');
            const col = containerRef.current.getAttribute('data-col');
            if (row !== null && col !== null) {
                const isFirstCol = parseInt(col, 10) === 0;
                if (isFirstCol && !opt.value) {
                    const trigger = containerRef.current.querySelector('[data-ss-trigger]');
                    if (trigger) {
                        justClosedRef.current = true;
                        trigger.focus();
                        setTimeout(() => {
                            const event = new KeyboardEvent('keydown', {
                                key: 'Enter',
                                bubbles: true,
                                cancelable: true
                            });
                            trigger.dispatchEvent(event);
                        }, 100);
                    }
                    return;
                }
                const nextCol = parseInt(col, 10) + 1;
                const nextContainer = document.querySelector(`[data-row="${row}"][data-col="${nextCol}"]`);
                if (nextContainer) {
                    const trigger = nextContainer.querySelector('[data-ss-trigger]');
                    const targetEl = trigger || nextContainer;
                    targetEl.focus();
                    if (targetEl.tagName.toLowerCase() === 'input' && typeof targetEl.select === 'function') {
                        targetEl.select();
                    }
                    return;
                }
            }

            // 3. Check if we are at the gst_ledger_1 dropdown
            if (containerRef.current.hasAttribute('data-gst-ledger-1')) {
                const nextContainer = document.querySelector('[data-gst-ledger-2]');
                if (nextContainer) {
                    const trigger = nextContainer.querySelector('[data-ss-trigger]');
                    const targetEl = trigger || nextContainer;
                    targetEl.focus();
                    setTimeout(() => targetEl.focus(), 50);
                    return;
                } else {
                    const saveBtn = document.querySelector('.sof-btn-save');
                    if (saveBtn) {
                        saveBtn.focus();
                        setTimeout(() => saveBtn.focus(), 50);
                        return;
                    }
                }
            }

            // 4. Check if we are at the gst_ledger_2 dropdown
            if (containerRef.current.hasAttribute('data-gst-ledger-2')) {
                const saveBtn = document.querySelector('.sof-btn-save');
                if (saveBtn) {
                    saveBtn.focus();
                    setTimeout(() => saveBtn.focus(), 50);
                    return;
                }
            }

            // 5. Fallback to standard form fields sequential DOM focus
            const form = containerRef.current.closest('form');
            if (form) {
                const focusables = Array.from(
                    form.querySelectorAll(
                        'input[name="quotation_no"], input:not([readonly]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button[data-ss-trigger]:not([disabled]), .sof-btn-save'
                    )
                );
                const trigger = containerRef.current.querySelector('[data-ss-trigger]');
                const index = focusables.indexOf(trigger);
                if (index > -1 && index < focusables.length - 1) {
                    const nextEl = focusables[index + 1];
                    nextEl.focus();
                    if (nextEl.tagName.toLowerCase() === 'input' && typeof nextEl.select === 'function') {
                        nextEl.select();
                    }
                }
            }
        }, 50);
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
                const targetEl = containerRef.current.closest('.sof-input-box') || containerRef.current;
                const rect = targetEl.getBoundingClientRect();
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

    // Handle initial autoFocus
    const autoFocusTriggered = useRef(false);
    useEffect(() => {
        if (autoFocus && !disabled && !autoFocusTriggered.current) {
            autoFocusTriggered.current = true;
            setTimeout(() => {
                openDropdown();
            }, 150);
        }
    }, [autoFocus, disabled, openDropdown]);

    // Keydown on the closed trigger button
    const handleTriggerKeyDown = (e) => {
        if (disabled) return;
        if (isAlertOpen()) {
            return;
        }
        if (e.key === 'Enter') {
            const isFirstCol = Number(dataProps['data-pcol']) === 0 || Number(dataProps['data-col']) === 0;
            const isEmpty = !value;
            if (isFirstCol && isEmpty) {
                e.preventDefault();
                // Do not prevent default or stop propagation, let it bubble to the popup's or table's keydown handler
                if (onKeyDown) {
                    onKeyDown(e);
                }
                return;
            }
            if (justSelectedRef.current) {
                justSelectedRef.current = false;
                // Pass Enter up to grid navigation to move focus forward
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
        if (isAlertOpen()) {
            return;
        }
        if (e.key === 'Delete' && onKeyDown) {
            e.preventDefault();
            closeDropdown(false);
            onKeyDown(e);
            return;
        }
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
            if ((!target || String(target.value) === '') && required && !value) {
                closeDropdown(false);
                const label = dataLabel || placeholder || 'This field';
                swal('Required', `${label} is mandatory. Please fill this column before continuing.`, 'warning').then(() => {
                    setTimeout(() => {
                        const trigger = containerRef.current?.querySelector('[data-ss-trigger]');
                        if (trigger) {
                            trigger.focus();
                            trigger.click();
                        }
                    }, 50);
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
            data-required={required ? 'true' : undefined}
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
                        data-empty={selectedLabel ? 'false' : 'true'}
                        data-label={dataLabel || placeholder || 'This field'}
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
                    data-label={dataLabel || placeholder || 'This field'}
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
    const [validationErrors, setValidationErrors] = useState({});

    useEffect(() => {
        if (item && item.product) {
            InventoryService.getItemBatches(item.product)
                .then(res => {
                    setAvailableBatches(Array.isArray(res.data) ? res.data : []);
                })
                .catch(err => {
                    console.error('Failed to load batches:', err);
                });
        }
    }, [item]);
    
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

    // Calculate modal size based on configured columns to avoid squishing columns
    let dynamicMaxWidth = 670; // Base width for Qty, Rate, Disc %, Amount, Actions, and padding
    dynamicMaxWidth += 140; // Per (units) column — always shown
    if (maintain_warehouse) dynamicMaxWidth += 180;
    if (maintain_batch) dynamicMaxWidth += 140;
    if (maintain_expiry_date) dynamicMaxWidth += 150;
    if (maintain_manufacture_date) dynamicMaxWidth += 150;

    const [splits, setSplits] = useState(() => {
        const foundProduct = (stockItems || []).find(p => String(p.id) === String(item.product));
        const defaultPer = item.per || (foundProduct ? (foundProduct.base_unit || foundProduct.unit || '') : '');
        const defaultPerName = item.perName || (foundProduct ? (foundProduct.base_unit_name || foundProduct.unit_name || (units || []).find(u => String(u.id) === String(defaultPer))?.name || '') : '');
        if (item.splits && item.splits.length > 0) {
            return item.splits.map(s => ({
                ...s,
                per: s.per || defaultPer,
                perName: s.perName || defaultPerName || (units || []).find(u => String(u.id) === String(s.per || defaultPer))?.name || '',
                quantity: cleanZeroValue(s.quantity),
                rate: cleanZeroValue(s.rate),
                discount_percent: cleanZeroValue(s.discount_percent)
            }));
        }
        return [{
            warehouse: item.warehouse || '',
            warehouseName: item.warehouseName || '',
            batch_number: item.batch_number || '',
            expiry_date: item.expiry_date || '',
            manufacture_date: item.manufacture_date || '',
            per: defaultPer,
            perName: defaultPerName,
            quantity: cleanZeroValue(item.quantity),
            rate: cleanZeroValue(item.rate),
            discount_percent: cleanZeroValue(item.discount_percent),
            discount_amount: item.discount_amount || '0.00',
            amount: item.amount || '0.00'
        }];
    });

    const addSplitRow = () => {
        const nextIdx = splits.length;
        const foundProduct = (stockItems || []).find(p => String(p.id) === String(item.product));
        const defaultPer = item.per || (foundProduct ? (foundProduct.base_unit || foundProduct.unit || '') : '');
        const defaultPerName = item.perName || (foundProduct ? (foundProduct.base_unit_name || foundProduct.unit_name || (units || []).find(u => String(u.id) === String(defaultPer))?.name || '') : '');
        const currentPer = splits[0]?.per || defaultPer;
        const currentPerName = splits[0]?.perName || defaultPerName || (units || []).find(u => String(u.id) === String(currentPer))?.name || '';
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
        setValidationErrors(prev => {
            const next = { ...prev };
            let errField = field;
            if (field === 'expiry_date') errField = 'expiry';
            else if (field === 'manufacture_date') errField = 'mfg';
            delete next[`${idx}-${errField}`];
            return next;
        });
        setSplits(prev => {
            // Check for mismatch on 'per' (unit of measure) change
            if (field === 'per') {
                const otherUnits = prev
                    .filter((_, sIdx) => sIdx !== idx)
                    .map(s => s.per)
                    .filter(Boolean);
                if (otherUnits.length > 0 && !otherUnits.every(u => String(u) === String(value))) {
                    swal('Mismatch Error', 'All rows for a single item must have the same unit of measure.', 'error').then(() => {
                        const firstContainer = document.querySelector(`[data-prow="${idx}"][data-pcol="0"]`);
                        if (firstContainer) {
                            const trigger = firstContainer.querySelector('[data-ss-trigger]') || firstContainer;
                            trigger.focus();
                        }
                    });
                    return prev; // Reject change entirely, keep original splits state
                }
            }

            return prev.map((s, i) => {
                if (i !== idx) return s;
                const newSplit = { ...s, [field]: value };
                if (field === 'batch_number') {
                    const selectedBatch = availableBatches.find(b => b.batch_number === value);
                    newSplit.expiry_date = selectedBatch ? (selectedBatch.expiry_date || '') : '';
                }
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
        const activeUnits = splits.map(s => s.per).filter(Boolean);
        if (activeUnits.length > 0 && !activeUnits.every(u => String(u) === String(activeUnits[0]))) {
            swal('Mismatch Error', 'All rows for a single item must have the same unit of measure.', 'error').then(() => {
                const firstContainer = document.querySelector('[data-prow="0"][data-pcol="0"]');
                if (firstContainer) {
                    const trigger = firstContainer.querySelector('[data-ss-trigger]') || firstContainer;
                    trigger.focus();
                }
            });
            return;
        }

        const validateDateValue = (val) => {
            if (!val) return false;
            const datePart = val.split('T')[0];
            const regex = /^\d{4}-\d{2}-\d{2}$/;
            if (!regex.test(datePart)) return false;

            const [yearStr, monthStr, dayStr] = datePart.split('-');
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);
            const day = parseInt(dayStr, 10);

            if (isNaN(year) || isNaN(month) || isNaN(day)) return false;
            if (year < 1900 || year > 2100) return false;

            const tempDate = new Date(year, month - 1, day);
            if (
                tempDate.getFullYear() !== year ||
                tempDate.getMonth() !== month - 1 ||
                tempDate.getDate() !== day
            ) {
                return false;
            }

            return true;
        };

        const checkDOMIncomplete = (row, col) => {
            if (col === -1) return false;
            const el = document.querySelector(`input[data-prow="${row}"][data-pcol="${col}"]`);
            if (el && el.validity && el.validity.badInput) {
                return true;
            }
            return false;
        };

        // Determine column indexes to target DOM input validity
        let colCounter = 0;
        const warehouseCol = maintain_warehouse ? colCounter++ : -1;
        if (maintain_batch) colCounter++;
        const mfgCol = maintain_manufacture_date ? colCounter++ : -1;
        const expiryCol = maintain_expiry_date ? colCounter++ : -1;
        const qtyCol = colCounter++;
        const rateCol = colCounter++;

        const newErrors = {};
        let hasError = false;

        for (let i = 0; i < splits.length; i++) {
            const s = splits[i];
            if (maintain_warehouse && !s.warehouse) {
                newErrors[`${i}-warehouse`] = true;
                hasError = true;
            }
            if (!s.quantity || parseFloat(s.quantity) <= 0) {
                newErrors[`${i}-quantity`] = true;
                hasError = true;
            }
            if (s.rate === '' || parseFloat(s.rate) < 0) {
                newErrors[`${i}-rate`] = true;
                hasError = true;
            }

            // Expiry Date validation
            if (maintain_expiry_date) {
                const isDateValid = validateDateValue(s.expiry_date) && !checkDOMIncomplete(i, expiryCol);
                if (!isDateValid) {
                    newErrors[`${i}-expiry`] = true;
                    hasError = true;
                }
            }

            // Mfg Date validation
            if (maintain_manufacture_date) {
                const isDateValid = validateDateValue(s.manufacture_date) && !checkDOMIncomplete(i, mfgCol);
                if (!isDateValid) {
                    newErrors[`${i}-mfg`] = true;
                    hasError = true;
                }
            }
        }

        setValidationErrors(newErrors);

        if (hasError) {
            const firstErrKey = Object.keys(newErrors)[0];
            const [rowStr, field] = firstErrKey.split('-');
            const r = parseInt(rowStr, 10);
            let c = -1;
            let errMsg = '';
            if (field === 'warehouse') {
                c = warehouseCol;
                errMsg = `Please select a warehouse for row ${r + 1}.`;
            } else if (field === 'expiry') {
                c = expiryCol;
                errMsg = `Please fill the Row ${r + 1} Expiry Date properly in the format dd/mm/yyyy.`;
            } else if (field === 'mfg') {
                c = mfgCol;
                errMsg = `Please fill the Row ${r + 1} Mfg. Date properly in the format dd/mm/yyyy.`;
            } else if (field === 'quantity') {
                c = qtyCol;
                errMsg = `Quantity must be greater than 0 on row ${r + 1}.`;
            } else if (field === 'rate') {
                c = rateCol;
                errMsg = `Rate is required on row ${r + 1}.`;
            }

            swal('Warning', errMsg, 'warning').then(() => {
                if (c !== -1) {
                    const container = document.querySelector(`[data-prow="${r}"][data-pcol="${c}"]`);
                    if (container) {
                        const trigger = container.querySelector('[data-ss-trigger]') || container.querySelector('input, select') || container;
                        trigger.focus();
                        if (trigger && trigger.hasAttribute('data-ss-trigger')) {
                            setTimeout(() => trigger.click(), 50);
                        } else if (trigger && trigger.tagName && trigger.tagName.toLowerCase() === 'select') {
                            setTimeout(() => trackSelectOpen(trigger), 50);
                        }
                    }
                }
            });
            return;
        }

        const consolidatedItem = consolidateSplits({ ...item, splits }, isInterState);
        onSave(consolidatedItem);
    };

    const fmtAmt = n => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const handlePopupKeyDown = (e, rowIdx, colIdx, totalCols) => {
        if (isAlertOpen()) {
            return;
        }
        const key = e.key;
        const active = e.target;
        const tagName = active.tagName.toLowerCase();
        const splitsLength = splits.length;

        const getPopupInputElement = (r, c) => {
            const container = document.querySelector(`[data-prow="${r}"][data-pcol="${c}"]`);
            if (!container) return null;
            // For SearchableSelect: the container is a div; focus its trigger button
            const trigger = container.querySelector('[data-ss-trigger]');
            return trigger || container;
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
                    const el = getPopupInputElement(rowIdx, colIdx + 1);
                    if (el) el.focus();
                }
            }
        } else if (key === 'Enter') {
            const split = splits[rowIdx];
            let firstColVal = null;
            if (maintain_warehouse) {
                firstColVal = split ? split.warehouse : null;
            } else if (maintain_batch) {
                firstColVal = split ? split.batch_number : null;
            } else if (maintain_manufacture_date) {
                firstColVal = split ? split.manufacture_date : null;
            } else if (maintain_expiry_date) {
                firstColVal = split ? split.expiry_date : null;
            } else {
                firstColVal = split ? split.quantity : null;
            }
            const isFirstColEmpty = colIdx === 0 && (!firstColVal || String(firstColVal).trim() === '');
            
            e.preventDefault();
            
            if (isFirstColEmpty) {
                deleteSplitRow(rowIdx);
                setTimeout(() => {
                    const popupSaveBtn = document.querySelector('.sof-modal-footer .btn-primary');
                    if (popupSaveBtn) {
                        popupSaveBtn.focus();
                    }
                }, 80);
                return;
            }

            if (colIdx === totalCols - 2) {
                // Pressing Enter on the "End of Row" button stops adding rows, validates and saves
                handleSave();
            } else if (colIdx === totalCols - 1) {
                // Pressing Enter on the "Delete" button
                deleteSplitRow(rowIdx);
                setTimeout(() => {
                    const nextRowIdx = rowIdx > 0 ? rowIdx - 1 : 0;
                    const el = getPopupInputElement(nextRowIdx, totalCols - 1);
                    if (el) el.focus();
                }, 100);
            } else if (colIdx === totalCols - 4 || colIdx === totalCols - 3) {
                // Disc % or + button: add new split row and focus first cell
                addSplitRow();
                setTimeout(() => {
                    const el = getPopupInputElement(splitsLength, 0);
                    if (el) el.focus();
                }, 80);
            } else {
                const el = getPopupInputElement(rowIdx, colIdx + 1);
                if (el) el.focus();
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
            <div className="sof-modal" style={{ maxWidth: `${dynamicMaxWidth}px`, width: '95%' }} onClick={e => e.stopPropagation()}>
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
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                                <polyline points="9 22 9 12 15 12 15 22"/>
                            </svg>
                        </div>
                        <div>
                            <h5 style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem', color: '#1e293b' }}>
                                Item Details Entry
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
                                    {maintain_manufacture_date && <th style={{ minWidth: '130px' }}>Mfg. Date</th>}
                                    {maintain_expiry_date && <th style={{ minWidth: '130px' }}>Expiry Date</th>}
                                    <th className="sof-th-right" style={{ minWidth: '90px' }}>Qty</th>
                                    <th className="sof-th-right" style={{ minWidth: '110px' }}>Rate</th>
                                    <th style={{ minWidth: '120px' }}>Per</th>
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
                                    const mfgCol = maintain_manufacture_date ? colCounter++ : -1;
                                    const expiryCol = maintain_expiry_date ? colCounter++ : -1;
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
                                                <td style={{ verticalAlign: 'middle' }}>
                                                    <SearchableSelect
                                                        className={`sof-table-input ${validationErrors[`${idx}-warehouse`] ? 'sof-input-error' : ''}`}
                                                        data-prow={idx}
                                                        data-pcol={warehouseCol}
                                                        value={split.warehouse || ''}
                                                        options={[{ value: '', label: '— Select —' }, ...warehouses.map(w => ({ value: String(w.id), label: w.name }))]}
                                                        onChange={e => handleSplitChange(idx, 'warehouse', e.target.value)}
                                                        onKeyDown={e => handlePopupKeyDown(e, idx, warehouseCol, totalCols)}
                                                        placeholder="— Select —"
                                                    />
                                                </td>
                                            )}
                                            {maintain_batch && (
                                                <td style={{ verticalAlign: 'middle' }}>
                                                    <SearchableSelect
                                                        className="sof-table-input"
                                                        data-prow={idx}
                                                        data-pcol={batchCol}
                                                        value={split.batch_number || ''}
                                                        options={[
                                                            { value: '', label: 'Select Batch...' },
                                                            ...availableBatches.map(b => ({
                                                                value: b.batch_number,
                                                                label: b.expiry_date ? `${b.batch_number} (Exp: ${b.expiry_date})` : b.batch_number
                                                            }))
                                                        ]}
                                                        onChange={e => handleSplitChange(idx, 'batch_number', e.target.value)}
                                                        onKeyDown={e => handlePopupKeyDown(e, idx, batchCol, totalCols)}
                                                        placeholder="Select Batch..."
                                                    />
                                                </td>
                                            )}
                                            {maintain_manufacture_date && (
                                                <td style={{ verticalAlign: 'middle' }}>
                                                    <input
                                                        type="date"
                                                        className={`sof-table-input ${validationErrors[`${idx}-mfg`] ? 'sof-input-error' : ''}`}
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
                                                        onClick={e => {
                                                            try {
                                                                e.target.showPicker();
                                                            } catch (err) {}
                                                        }}
                                                    />
                                                </td>
                                            )}
                                            {maintain_expiry_date && (
                                                <td style={{ verticalAlign: 'middle' }}>
                                                    <input
                                                        type="date"
                                                        className={`sof-table-input ${validationErrors[`${idx}-expiry`] ? 'sof-input-error' : ''}`}
                                                        data-prow={idx}
                                                        data-pcol={expiryCol}
                                                        min={getTodayDateString()}
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
                                                        onClick={e => {
                                                            try {
                                                                e.target.showPicker();
                                                            } catch (err) {}
                                                        }}
                                                    />
                                                </td>
                                            )}
                                            <td style={{ verticalAlign: 'middle' }}>
                                                <input
                                                    type="text"
                                                    className={`sof-table-input ${validationErrors[`${idx}-quantity`] ? 'sof-input-error' : ''}`}
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
                                                    type="text"
                                                    className={`sof-table-input ${validationErrors[`${idx}-rate`] ? 'sof-input-error' : ''}`}
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
                                                    type="text"
                                                    className="sof-table-input"
                                                    data-prow={idx}
                                                    data-pcol={perCol}
                                                    value={split.perName || (units || []).find(u => String(u.id) === String(split.per))?.name || ((stockItems || []).find(p => String(p.id) === String(item.product))?.base_unit_name) || ''}
                                                    readOnly
                                                    onKeyDown={e => handlePopupKeyDown(e, idx, perCol, totalCols)}
                                                    style={{ backgroundColor: '#f8fafc', color: '#64748b', cursor: 'not-allowed', textAlign: 'center' }}
                                                />
                                            </td>
                                            <td style={{ verticalAlign: 'middle' }}>
                                                <input
                                                    type="text"
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
                                                {fmtAmt(parseFloat(split.amount) || 0)}
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
                                        (maintain_manufacture_date ? 1 : 0) +
                                        (maintain_expiry_date ? 1 : 0)
                                    } style={{ padding: '14px 12px', color: '#475569', fontSize: '0.85rem' }}>
                                        Total
                                    </td>
                                    <td style={{ padding: '14px 12px', textAlign: 'right', color: '#1e293b', fontSize: '0.85rem' }}>
                                        {getConsolidatedQty().toFixed(2)}
                                    </td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td style={{ padding: '14px 12px', textAlign: 'right', color: '#3b82f6', fontSize: '0.88rem', fontWeight: '800' }}>
                                        {fmtAmt(getConsolidatedAmount())}
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
            </div>
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
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                                <polyline points="9 22 9 12 15 12 15 22"/>
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
                                    {maintain_manufacture_date && <th style={{ minWidth: '130px' }}>Mfg. Date</th>}
                                    {maintain_expiry_date && <th style={{ minWidth: '130px' }}>Expiry Date</th>}
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

const getGstLedgersFromConfig = (config, ledgersList) => {
    let gst1 = '';
    let gst2 = '';
    if (config && Array.isArray(config.gst_ledger) && config.gst_ledger.length > 0) {
        const gList = config.gst_ledger.map(id => String(id));
        if (gList.length >= 2) {
            const cgst = gList.find(id => {
                const l = ledgersList.find(x => String(x.id) === id);
                return l && l.name.toLowerCase().includes('cgst');
            });
            const sgst = gList.find(id => {
                const l = ledgersList.find(x => String(x.id) === id);
                return l && l.name.toLowerCase().includes('sgst');
            });
            if (cgst && sgst) {
                gst1 = cgst;
                gst2 = sgst;
            } else {
                gst1 = gList[0];
                gst2 = gList[1];
            }
        } else if (gList.length === 1) {
            gst1 = gList[0];
            gst2 = '';
        }
    }
    return { gst1, gst2 };
};

const QuotationForm = ({ formData, setFormData, onSave, onCancel, isEditing }) => {
    usePageTitle("Quote");
    const [ledgers, setLedgers] = useState([]);
    const [accountGroups, setAccountGroups] = useState([]);
    const [showLedgerModal, setShowLedgerModal] = useState(false);
    const [qtPrefixConfigs, setQtPrefixConfigs] = useState([]);
    const [stockItems, setStockItems] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [deliveryLocations, setDeliveryLocations] = useState([]);
    const [units, setUnits] = useState([]);
    const [productConfig, setProductConfig] = useState({
        maintain_batch: false,
        maintain_manufacture_date: false,
        maintain_expiry_date: false,
        maintain_warehouse: false
    });
    const [priceListMappings, setPriceListMappings] = useState([]);
    const [priceLists, setPriceLists] = useState([]);
    const [loadingOptions, setLoadingOptions] = useState(true);
    /* item popup state */
    const [itemPopup, setItemPopup] = useState(null);   // null | { item }
    const [viewPopup, setViewPopup] = useState(null);   // null | item
    /* add-location mini modal */
    const [addLocationModal, setAddLocationModal] = useState(false);
    const [newLocationName, setNewLocationName] = useState('');
    const [savingLocation, setSavingLocation] = useState(false);

    const firstInputRef = useRef(null);

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
                const [ledgersRes, itemsRes, warehousesRes, configsRes, driversRes, unitsRes, vehiclesRes, mappingsData, priceListsData, prefixRes, accGroupRes] = await Promise.all([
                    FinanceService.getLedgers(),
                    getStockItems(),
                    getWarehouses(),
                    InventoryService.getProductConfigurations(),
                    LogisticsService.getDrivers(),
                    InventoryService.getUnits(),
                    LogisticsService.getVehicles(),
                    getPriceListMappings(),
                    getPriceLists(),
                    fetchPrefixConfigurations(),
                    FinanceService.getAccountGroups()
                ]);
                const getArray = (res) => Array.isArray(res?.data) ? res.data : Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];
                
                setLedgers(getArray(ledgersRes));
                setAccountGroups(getArray(accGroupRes));
                setStockItems(getArray(itemsRes));
                setWarehouses(getArray(warehousesRes));
                setDrivers(getArray(driversRes));
                setUnits(getArray(unitsRes));
                setVehicles(getArray(vehiclesRes));
                setPriceListMappings(getArray(mappingsData));
                setPriceLists(getArray(priceListsData));

                const allPrefixes = Array.isArray(prefixRes?.data) ? prefixRes.data : [];
                const qtConfigs = allPrefixes.filter(c => 
                    (c.voucher_type_name && c.voucher_type_name.toLowerCase() === 'quotation') ||
                    (c.subvoucher_type_name && c.subvoucher_type_name.toLowerCase() === 'quotation') ||
                    (c.sub_type && c.sub_type.toLowerCase() === 'quotation')
                );
                setQtPrefixConfigs(qtConfigs);

                const configs = Array.isArray(configsRes.data) ? configsRes.data : [];
                const salesOrderConfig = configs.find(c => 
                    (c.voucher_type_name && c.voucher_type_name.toLowerCase() === 'quotation') ||
                    (c.voucher_type_code && c.voucher_type_code.toLowerCase() === 'qt') ||
                    (c.voucher_type_name && c.voucher_type_name.toLowerCase() === 'sales order') ||
                    (c.voucher_type_code && c.voucher_type_code.toLowerCase() === 'so')
                );
                if (salesOrderConfig) {
                    setProductConfig({
                        maintain_batch: !!salesOrderConfig.maintain_batch,
                        maintain_manufacture_date: !!salesOrderConfig.maintain_manufacture_date,
                        maintain_expiry_date: !!salesOrderConfig.maintain_expiry_date,
                        maintain_warehouse: !!salesOrderConfig.maintain_warehouse
                    });
                }

                // Removed redundant fetch here because it is handled by the default configuration effect.
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



    const activePriceListId = React.useMemo(() => {
        const customerLedger = formData.customer_ledger;
        const entryDate = formData.entry_date || new Date().toISOString().split('T')[0];
        if (!customerLedger || !priceListMappings.length) return null;
        const ledgerMappings = priceListMappings.filter(m => String(m.ledger) === String(customerLedger) && m.applicable_date <= entryDate);
        const pool = ledgerMappings.length ? ledgerMappings : priceListMappings.filter(m => String(m.ledger) === String(customerLedger));
        if (!pool.length) return null;
        pool.sort((a, b) => new Date(b.applicable_date) - new Date(a.applicable_date));
        return pool[0].price_list;
    }, [formData.customer_ledger, formData.entry_date, priceListMappings]);

    const activePriceList = React.useMemo(() =>
        activePriceListId ? priceLists.find(pl => String(pl.id) === String(activePriceListId)) : null,
    [activePriceListId, priceLists]);

    const priceListRates = React.useMemo(() => {
        const m = {};
        if (activePriceList?.items) {
            activePriceList.items.forEach(it => { m[it.stock_item] = parseFloat(it.rate) || 0; });
        }
        return m;
    }, [activePriceList]);

    const supplierOptions = React.useMemo(() => {
        const filtered = ledgers.filter(l => {
            const groupName = (
                l.account_group_name ||
                l.accountGroup?.name ||
                l.account_group?.name ||
                l.group_name ||
                l.group ||
                ''
            ).toLowerCase();
            return groupName.includes('debtor') || groupName.includes('deptor') || groupName.includes('creditor');
        });
        return [
            { value: '', label: 'Select Supplier Name...' },
            ...filtered.map(l => ({ value: String(l.id), label: l.name }))
        ];
    }, [ledgers]);

    const extraChargeLedgerOptions = React.useMemo(() => {
        const filtered = ledgers.filter(l => {
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
                groupName.includes('indirect income')
            );
        });
        return [
            { value: '', label: 'Select Ledger' },
            ...filtered.map(l => ({ value: String(l.id), label: l.name }))
        ];
    }, [ledgers]);

    useEffect(() => {
        if (ledgers.length > 0 && (!formData.items || formData.items.length === 0)) {
            const defaultCfg = qtPrefixConfigs.length > 0 ? qtPrefixConfigs[0] : null;
            const defaultType = defaultCfg ? String(defaultCfg.id) : 'STATE';
            const defaultSalesLedger = defaultCfg && defaultCfg.ledger ? String(defaultCfg.ledger) : '';
            let defaultGst1 = '';
            let defaultGst2 = '';
            if (defaultCfg) {
                const { gst1, gst2 } = getGstLedgersFromConfig(defaultCfg, ledgers);
                defaultGst1 = gst1;
                defaultGst2 = gst2;
            } else {
                const cgstLedger = ledgers.find(l => l.name.toLowerCase().includes('cgst'));
                const sgstLedger = ledgers.find(l => l.name.toLowerCase().includes('sgst'));
                defaultGst1 = cgstLedger ? cgstLedger.id : '';
                defaultGst2 = sgstLedger ? sgstLedger.id : '';
            }

            if (!isEditing && !formData.quotation_no && defaultCfg) {
                FinanceService.getNextQuotationNumber(defaultCfg.id).then(res => {
                    if (res?.next_no) {
                        setFormData(prev => ({ ...prev, quotation_no: res.next_no }));
                    }
                }).catch(err => console.error('Failed to fetch Quotation number:', err));
            }

            setFormData(prev => ({
                order_type: defaultType,
                sales_ledger: defaultSalesLedger,
                entry_date: new Date().toISOString().split('T')[0],
                gst_ledger_1: defaultGst1,
                gst_ledger_2: defaultGst2,
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

    const getRecalculatedState = (state) => {
        const isInterState = state.order_type === 'INTER_STATE' || String(state.order_type).toLowerCase().includes('inter') || (state.gst_ledger_1 && !state.gst_ledger_2);
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
        const orderDate = state.entry_date || new Date().toISOString().split('T')[0];
        let extraChargesTotal = 0;
        let extraCGST = 0;
        let extraSGST = 0;
        let extraIGST = 0;

        (state.extra_charges || []).forEach(ec => {
            const ecAmt = parseFloat(ec.amount) || 0;
            extraChargesTotal += ecAmt;
            
            if (ec.ledger) {
                const ledger = ledgers.find(l => String(l.id) === String(ec.ledger));
                if (ledger && Array.isArray(ledger.gst_details)) {
                    const validGsts = ledger.gst_details
                        .filter(g => !g.applicable_date || g.applicable_date <= orderDate)
                        .sort((a, b) => {
                            if (!a.applicable_date) return 1;
                            if (!b.applicable_date) return -1;
                            return new Date(b.applicable_date) - new Date(a.applicable_date);
                        });
                    
                    if (validGsts.length > 0) {
                        const gstPct = parseFloat(validGsts[0].gst_percentage) || 0;
                        const totalEcGst = (ecAmt * gstPct) / 100;
                        if (isInterState) {
                            extraIGST += totalEcGst;
                        } else {
                            extraCGST += totalEcGst / 2;
                            extraSGST += totalEcGst / 2;
                        }
                    }
                }
            }
        });

        totalCGST += extraCGST;
        totalSGST += extraSGST;
        totalIGST += extraIGST;

        if (isInterState) {
            updatedState.gst_amount_1 = totalIGST.toFixed(2);
            updatedState.gst_amount_2 = '0.00';
            updatedState.total_amount = (totalBase + totalIGST + extraChargesTotal).toFixed(2);
        } else {
            updatedState.gst_amount_1 = totalCGST.toFixed(2);
            updatedState.gst_amount_2 = totalSGST.toFixed(2);
            updatedState.total_amount = (totalBase + totalCGST + totalSGST + extraChargesTotal).toFixed(2);
        }
        return updatedState;
    };

    const recalculateForm = (state) => {
        setFormData(prev => getRecalculatedState({ ...prev, ...state }));
    };

    const addExtraCharge = () => {
        setFormData(prev => {
            const currentCharges = prev.extra_charges || [];
            const currentWithoutNew = currentCharges.map(c => ({ ...c, isNew: false }));
            const newCharges = [...currentWithoutNew, { id: Date.now(), ledger: '', amount: '', isNew: true }];
            return getRecalculatedState({ ...prev, extra_charges: newCharges });
        });
    };

    const handleExtraChargeChange = (index, field, value) => {
        setFormData(prev => {
            const currentCharges = [...(prev.extra_charges || [])];
            currentCharges[index] = { ...currentCharges[index], [field]: value };
            return getRecalculatedState({ ...prev, extra_charges: currentCharges });
        });
    };

    const removeExtraCharge = (index) => {
        setFormData(prev => {
            const currentCharges = (prev.extra_charges || []).filter((_, i) => i !== index);
            return getRecalculatedState({ ...prev, extra_charges: currentCharges });
        });
    };

    

    const handleSaveLedger = async (savedLedger) => {
        try {
            const res = await FinanceService.getLedgers();
            const ledgersList = Array.isArray(res?.data) ? res.data : [];
            setLedgers(ledgersList);
            
            const group = accountGroups.find(g => String(g.id) === String(savedLedger.accountGroup || savedLedger.account_group));
            const groupName = group ? group.account_group_name : '';
            const isDebtorCreditor = groupName.toLowerCase().includes('debtor') || 
                                     groupName.toLowerCase().includes('creditor') ||
                                     groupName.toLowerCase().includes('deptor');
            
            if (isDebtorCreditor) {
                setFormData(prev => ({ ...prev, customer_ledger: savedLedger.id }));
            } else {
                swal('Warning', `Ledger created, but it belongs to "${groupName}". For quotations, please select a Sundry Debtor or Creditor.`, 'warning');
            }
        } catch (error) {
            console.error('Error refreshing ledgers:', error);
        }
        setShowLedgerModal(false);
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => {
            const updated = { ...prev, [field]: value };
            if (field === 'entry_date' || field === 'customer_ledger') {
                const newDate = field === 'entry_date' ? value : (prev.entry_date || new Date().toISOString().split('T')[0]);
                const newCustomer = field === 'customer_ledger' ? value : prev.customer_ledger;
                
                let activePLId = null;
                if (newCustomer && priceListMappings.length) {
                    const ledgerMappings = priceListMappings.filter(m => String(m.ledger) === String(newCustomer) && m.applicable_date <= newDate);
                    const pool = ledgerMappings.length ? ledgerMappings : priceListMappings.filter(m => String(m.ledger) === String(newCustomer));
                    if (pool.length) {
                        pool.sort((a, b) => new Date(b.applicable_date) - new Date(a.applicable_date));
                        activePLId = pool[0].price_list;
                    }
                }
                const activePL = activePLId ? priceLists.find(pl => String(pl.id) === String(activePLId)) : null;
                const plRates = {};
                if (activePL?.items) {
                    activePL.items.forEach(it => { plRates[it.stock_item] = parseFloat(it.rate) || 0; });
                }

                updated.items = (prev.items || []).map(item => {
                    let newItem = { ...item };
                    if (item.product) {
                        const found = stockItems.find(p => String(p.id) === String(item.product));
                        if (found) {
                            if (field === 'entry_date') {
                                newItem.gst_percent = cleanZeroValue(getApplicableGst(found, newDate));
                            }
                            
                            let defaultRate = '';
                            if (plRates[item.product] !== undefined) {
                                defaultRate = plRates[item.product];
                            } else if (found) {
                                defaultRate = parseFloat(found.ss_rate) || '';
                            }
                            const newRate = defaultRate !== '' ? String(defaultRate) : '';
                            newItem.rate = newRate;
                            
                            if (newItem.splits && newItem.splits.length > 0) {
                                newItem.splits = newItem.splits.map(s => ({
                                    ...s,
                                    rate: newRate
                                }));
                            }
                            
                            const isInterState = updated.order_type === 'INTER_STATE' || String(updated.order_type).toLowerCase().includes('inter') || (updated.gst_ledger_1 && !updated.gst_ledger_2);
                            newItem = consolidateSplits(newItem, isInterState);
                        }
                    }
                    return newItem;
                });
            } else if (field === 'order_type') {
                const selectedConfig = qtPrefixConfigs.find(c => String(c.id) === String(value));
                if (selectedConfig) {
                    if (selectedConfig.ledger) {
                        updated.sales_ledger = String(selectedConfig.ledger);
                    }
                    const { gst1, gst2 } = getGstLedgersFromConfig(selectedConfig, ledgers);
                    updated.gst_ledger_1 = gst1;
                    updated.gst_ledger_2 = gst2;
                    if (!gst2) updated.gst_amount_2 = '0.00';
                    
                    if (!isEditing) {
                        FinanceService.getNextQuotationNumber(selectedConfig.id).then(res => {
                            if (res?.next_no) {
                                setFormData(prev => ({ ...prev, quotation_no: res.next_no }));
                            }
                        }).catch(err => console.error('Failed to fetch Quotation number:', err));
                    }
                }
            }
            return getRecalculatedState(updated);
        });
    };

    const getDateTimeParts = () => {
        let val = formData.preferred_delivery_date || '';
        if (val.includes(' ')) {
            val = val.replace(' ', 'T');
        }
        const parts = val.split('T');
        return {
            datePart: parts[0] || '',
            timePart: parts[1] ? parts[1].slice(0, 5) : ''
        };
    };

    const handleDatePartChange = (e) => {
        const dateVal = e.target.value; // YYYY-MM-DD
        setFormData(prev => {
            let val = prev.preferred_delivery_date || '';
            if (val.includes(' ')) {
                val = val.replace(' ', 'T');
            }
            const parts = val.split('T');
            const timeVal = parts[1] ? parts[1].slice(0, 5) : '00:00';
            const combined = dateVal ? `${dateVal}T${timeVal}` : '';
            return getRecalculatedState({ ...prev, preferred_delivery_date: combined });
        });
    };

    const handleTimePartChange = (e) => {
        const timeVal = e.target.value; // hh:mm (empty if incomplete/cleared)
        setFormData(prev => {
            let val = prev.preferred_delivery_date || '';
            if (val.includes(' ')) {
                val = val.replace(' ', 'T');
            }
            const parts = val.split('T');
            let dateVal = parts[0] || '';
            if (!dateVal) {
                dateVal = new Date().toISOString().split('T')[0];
            }
            const finalTime = timeVal || '00:00';
            const combined = `${dateVal}T${finalTime}`;
            return getRecalculatedState({ ...prev, preferred_delivery_date: combined });
        });
    };

    const removeRow = (index) => {
        const currentItems = formData.items || [];
        if (currentItems.length <= 1) {
            // Last row — clear values instead of removing the row structure
            const cleared = [{
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
            }];
            recalculateForm({ ...formData, items: cleared });
            return;
        }
        const items = currentItems.filter((_, i) => i !== index);
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
        const found = stockItems.find(p => String(p.id) === String(item.product));
        const baseUnit = item.per || (found ? (found.base_unit || found.unit || '') : '');
        const baseUnitName = item.perName || (found ? (found.base_unit_name || found.unit_name || units.find(u => String(u.id) === String(baseUnit))?.name || '') : '');
        const cleanItem = {
            ...item,
            per: baseUnit ? String(baseUnit) : '',
            perName: baseUnitName,
            quantity: cleanZeroValue(item.quantity),
            rate: cleanZeroValue(item.rate),
            discount_percent: cleanZeroValue(item.discount_percent),
            gst_percent: cleanZeroValue(item.gst_percent),
        };
        setItemPopup({ item: cleanItem, editIndex: idx });
    };

    const addNewBlankRow = () => {
        const items = [...(formData.items || [])];
        const nextIdx = items.length;
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

        const focusFirstField = () => {
            const nextContainer = document.querySelector(`[data-row="${nextIdx}"][data-col="0"]`);
            if (nextContainer) {
                const trigger = nextContainer.querySelector('[data-ss-trigger]');
                const target = trigger || nextContainer;
                target.focus();
                setTimeout(() => {
                    const active = document.activeElement;
                    if (active && (active.closest(`[data-row="${nextIdx}"][data-col="0"]`) || active.getAttribute('data-row') === String(nextIdx))) {
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

    const handleTableProductChange = (rowIdx, productId) => {
        if (!productId) {
            removeRow(rowIdx);
            setTimeout(() => {
                const gstLedger1 = document.querySelector('[data-gst-ledger-1]');
                const trigger = gstLedger1?.querySelector('[data-ss-trigger]');
                if (trigger) {
                    trigger.focus();
                } else {
                    const saveBtn = document.querySelector('.sof-btn-save');
                    if (saveBtn) saveBtn.focus();
                }
            }, 100);
            return;
        }
        
        const items = [...(formData.items || [])];

        const currentItem = items[rowIdx] || {};
        if (currentItem && String(currentItem.product) === String(productId)) {
            // Re-selected the same product — just open the popup with the current item
            setItemPopup({ item: currentItem, editIndex: rowIdx });
            return;
        }

        const found = stockItems.find(p => String(p.id) === String(productId));
        const productName = found ? found.name : '';
        let defaultRate = '';
        if (priceListRates[productId] !== undefined) {
            defaultRate = priceListRates[productId];
        } else if (found) {
            defaultRate = parseFloat(found.ss_rate) || '';
        }
        const rate = defaultRate !== '' ? String(defaultRate) : '';
        const gstPercent = cleanZeroValue(found ? getApplicableGst(found, formData.entry_date) : '');
        const baseUnit = found ? (found.base_unit || found.unit || '') : '';
        const baseUnitName = found ? (found.base_unit_name || found.unit_name || units.find(u => String(u.id) === String(baseUnit))?.name || '') : '';
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
        
        const isInterState = formData.order_type === 'INTER_STATE' || String(formData.order_type).toLowerCase().includes('inter') || (formData.gst_ledger_1 && !formData.gst_ledger_2);
        
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
        if (isAlertOpen()) return;
        const key = e.key;
        if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter','Delete'].includes(key)) return;

        const active = e.target;
        const tagName = active.tagName.toLowerCase();
        const itemsLength = (formData.items || []).length;
        const isInterState = formData.order_type === 'INTER_STATE' || String(formData.order_type).toLowerCase().includes('inter') || (formData.gst_ledger_1 && !formData.gst_ledger_2);
        const amountColIdx = isInterState ? 6 : 7;
        // eslint-disable-next-line no-unused-vars
        const editCol     = amountColIdx + 1;
        const plusCol     = amountColIdx + 2;
        const endOfRowCol = amountColIdx + 3;
        const deleteCol   = amountColIdx + 4;

        const getEl = (r, c) => {
            const container = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
            if (!container) return null;
            // For SearchableSelect: the container is a div; focus the trigger button inside
            const trigger = container.querySelector('[data-ss-trigger]');
            return trigger || container;
        };

        // Stop form-level handler from also firing
        e.stopPropagation();

        if (['Enter', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
            if (checkMandatoryBeforeNavigate(active, e)) {
                return;
            }
        }

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
            } else if (colIdx === endOfRowCol) {
                // ArrowDown on End of Row in last row → add a new blank row
                addNewBlankRow();
                setTimeout(() => { const el = getEl(rowIdx + 1, 0); if (el) el.focus(); }, 80);
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

            if (tagName === 'button' && !isFirstColEmpty) {
                // Let the button's native click fire (already called via onClick)
                active.click();
                return;
            }

            if (isFirstColEmpty) {
                removeRow(rowIdx);
                setTimeout(() => {
                    const target = document.querySelector('.sof-btn-add-extra-charge');
                    if (target) {
                        target.focus();
                    } else {
                        const gstLedger1 = document.querySelector('[data-gst-ledger-1]');
                        const trigger = gstLedger1?.querySelector('[data-ss-trigger]');
                        if (trigger) trigger.focus();
                    }
                }, 80);
                return;
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
            } else if (colIdx === endOfRowCol) {
                const target = document.querySelector('.sof-btn-add-extra-charge');
                if (target) {
                    target.focus();
                } else {
                    const container = document.querySelector('[data-gst-ledger-1]');
                    const trigger = container?.querySelector('[data-ss-trigger]');
                    if (trigger) trigger.focus();
                }
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
                const el = getEl(nextRowIdx, endOfRowCol);
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
                <div style={{ width: '48px', height: '48px', border: '4px solid #e8eaf6', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'sof-spin 0.8s linear infinite' }}></div>
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

                    <div className="row">
                        <div className="col-xl-3 col-lg-4 col-md-6 col-12 sof-field-group">
                            <label className="sof-label">
                                Quotation No.
                                <span className="sof-badge-auto">AUTO</span>
                            </label>
                            <div className="sof-input-box sof-input-locked">
                                <span className="sof-field-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                    </svg>
                                </span>
                                <input type="text" name="quotation_no" className="sof-input" placeholder="(auto-generated)" readOnly value={formData.quotation_no || ''} />
                            </div>
                        </div>

                        <div className="col-xl-3 col-lg-4 col-md-6 col-12 sof-field-group">
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
                                <input
                                    ref={firstInputRef}
                                    type="date"
                                    name="entry_date"
                                    className="sof-input"
                                    required
                                    data-label="Entry Date"
                                    autoFocus
                                    min={getTodayDateString()}
                                    value={formData.entry_date || ''}
                                    onChange={e => handleInputChange('entry_date', e.target.value)}
                                    onDoubleClick={e => e.target.classList.add('sof-input-edit-segments')}
                                    onBlur={e => {
                                        e.target.classList.remove('sof-input-edit-segments');
                                        e.target.removeAttribute('data-picker-just-closed');
                                    }}
                                    onFocus={e => {
                                        e.target.removeAttribute('data-picker-just-closed');
                                    }}
                                    onClick={e => {
                                        try {
                                            e.target.showPicker();
                                        } catch (err) {}
                                    }}
                                />
                            </div>
                        </div>

                        <div className="col-xl-3 col-lg-4 col-md-6 col-12 sof-field-group">
                            <label className="sof-label">Order Type <span className="sof-req">*</span></label>
                            <div className="sof-input-box">
                                <span className="sof-field-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                                    </svg>
                                </span>
                                <SearchableSelect
                                    name="order_type"
                                    className="sof-input"
                                    required={true}
                                    data-label="Order Type"
                                    value={formData.order_type || 'STATE'}
                                    options={qtPrefixConfigs.length > 0 ? qtPrefixConfigs.map(c => ({
                                        value: String(c.id),
                                        label: c.sub_type || c.subvoucher_type_name || c.voucher_type_name || 'Quotation'
                                    })) : [
                                        { value: 'STATE', label: 'STATE (CGST + SGST)' },
                                        { value: 'INTER_STATE', label: 'INTER STATE (IGST)' },
                                    ]}
                                    onChange={e => handleInputChange('order_type', e.target.value)}
                                    placeholder="Select GST Type..."
                                />
                            </div>
                        </div>

                        <div className="col-xl-3 col-lg-4 col-md-6 col-12 sof-field-group">
                            <label className="sof-label">Supplier Name <span className="sof-req">*</span></label>
                            <div className="d-flex align-items-stretch" style={{ gap: '8px' }}>
                                <div className="sof-input-box" style={{ flex: 1, margin: 0, minWidth: 0, width: 0 }}>
                                    <span className="sof-field-icon">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                            <circle cx="12" cy="7" r="4"></circle>
                                        </svg>
                                    </span>
                                    <SearchableSelect
                                        name="customer_ledger"
                                        className="sof-input"
                                        required={true}
                                        data-label="Supplier Name"
                                        value={formData.customer_ledger || ''}
                                        options={supplierOptions}
                                        onChange={e => handleInputChange('customer_ledger', e.target.value)}
                                        placeholder="Select Supplier Name..."
                                    />
                                </div>
                                <button 
                                    type="button" 
                                    className="sof-add-customer-btn" style={{ height: '42px' }}
                                    onClick={() => setShowLedgerModal(true)} 
                                    title="Spot Add Supplier"
                                >
                                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Sub-Header / Divider for Logistics */}
                    <div className="sof-subhead" style={{ marginTop: '24px', marginBottom: '20px' }}>
                        <div className="sof-subhead-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="1" y="3" width="15" height="13"></rect>
                                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                                <circle cx="18.5" cy="18.5" r="2.5"></circle>
                            </svg>
                        </div>
                        <span className="sof-subhead-title">Dispatch & Logistics Details</span>
                        <div className="sof-subhead-line"></div>
                    </div>

                    <div className="row">
                        <div className="col-xl-3 col-lg-4 col-md-6 col-12 sof-field-group">
                            <label className="sof-label">Document No.</label>
                            <div className="sof-input-box">
                                <input type="text" name="document_no" className="sof-input" placeholder="L.R. / Invoice No." value={formData.document_no || ''} onChange={e => handleInputChange('document_no', e.target.value)} />
                            </div>
                        </div>
                        <div className="col-xl-3 col-lg-4 col-md-6 col-12 sof-field-group">
                            <label className="sof-label">Document Date</label>
                            <div className="sof-input-box">
                                <input
                                    type="date"
                                    name="document_date"
                                    className="sof-input"
                                    min={getTodayDateString()}
                                    value={formData.document_date || ''}
                                    onChange={e => handleInputChange('document_date', e.target.value)}
                                    onDoubleClick={e => e.target.classList.add('sof-input-edit-segments')}
                                    onBlur={e => {
                                        e.target.classList.remove('sof-input-edit-segments');
                                        e.target.removeAttribute('data-picker-just-closed');
                                    }}
                                    onFocus={e => {
                                        e.target.removeAttribute('data-picker-just-closed');
                                    }}
                                    onClick={e => {
                                        try {
                                            e.target.showPicker();
                                        } catch (err) {}
                                    }}
                                />
                            </div>
                        </div>
                        <div className="col-xl-3 col-lg-4 col-md-6 col-12 sof-field-group">
                            <label className="sof-label">Vehicle No./ Dispatch Through <span className="sof-req">*</span></label>
                            <div className="sof-input-box">
                                <SearchableSelect
                                    name="dispatch_through"
                                    className="sof-input"
                                    required={true}
                                    data-label="Vehicle No./ Dispatch Through"
                                    value={formData.dispatch_through || ''}
                                    options={[
                                        { value: '', label: 'Select Vehicle...' },
                                        ...vehicles
                                            .filter(v => v.vehicle_number)
                                            .map(v => ({
                                                value: v.vehicle_number,
                                                label: v.vehicle_name
                                                    ? `${v.vehicle_number} — ${v.vehicle_name}`
                                                    : v.vehicle_number
                                            }))
                                    ]}
                                    onChange={e => {
                                        const vehicleNumber = e.target.value;
                                        /* Auto-select the driver associated with this vehicle.
                                           We must do a single combined update — two separate
                                           handleInputChange calls both spread from the same stale
                                           formData snapshot, so the second would overwrite the first. */
                                        const selectedVehicle = vehicles.find(v => v.vehicle_number === vehicleNumber);
                                        const driverId = selectedVehicle?.driver ? String(selectedVehicle.driver) : '';
                                        const updated = { ...formData, dispatch_through: vehicleNumber, driver: driverId };
                                        recalculateForm(updated);
                                    }}
                                    placeholder="Select Vehicle..."
                                />
                            </div>
                        </div>
                    </div>
                    <div className="row">
                        <div className="col-md-6 col-12 sof-field-group">
                            <label className="sof-label">Other Reference</label>
                            <textarea className="sof-input sof-textarea" name="other_reference" rows="2" placeholder="Add any other reference details..." value={formData.other_reference || ''} onChange={e => handleInputChange('other_reference', e.target.value)} />
                        </div>
                        <div className="col-md-6 col-12 sof-field-group">
                            <label className="sof-label">Terms of Delivery</label>
                            <textarea className="sof-input sof-textarea" name="terms_of_delivery" rows="2" placeholder="Specify transport and delivery conditions..." value={formData.terms_of_delivery || ''} onChange={e => handleInputChange('terms_of_delivery', e.target.value)} />
                        </div>
                    </div>
                </div>


                {/* ── SECTION 3: ORDER ITEMS (grid table layout) ──────────────────── */}
                <div className="sof-section sof-table-section">
                    {/* section header */}
                    <div className="sof-section-head">
                        <div className="sof-section-icon sof-icon-blue">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                                <line x1="12" y1="22.08" x2="12" y2="12"/>
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

                    <div className="sof-table-scroll" style={{ padding: '0 20px 20px 20px' }}>
                        <table className="sof-table">
                            <thead>
                                <tr>
                                    <th className="sof-th-center" style={{ width: '50px' }}>#</th>
                                    <th style={{ minWidth: '220px' }}>Name of Item</th>
                                    <th className="sof-th-right" style={{ width: '100px' }}>Quantity</th>
                                    <th className="sof-th-right" style={{ width: '110px' }}>Rate</th>
                                    <th className="sof-th-right" style={{ width: '80px' }}>Dis %</th>
                                    <th className="sof-th-right" style={{ width: '90px' }}>GST %</th>
                                    {(formData.order_type === 'INTER_STATE' || String(formData.order_type).toLowerCase().includes('inter') || (formData.gst_ledger_1 && !formData.gst_ledger_2)) ? (
                                        <th className="sof-th-right" style={{ width: '110px' }}>IGST</th>
                                    ) : (
                                        <>
                                            <th className="sof-th-right" style={{ width: '100px' }}>CGST</th>
                                            <th className="sof-th-right" style={{ width: '100px' }}>SGST</th>
                                        </>
                                    )}
                                    <th className="sof-th-right" style={{ width: '120px' }}>Amount</th>
                                    <th className="sof-th-center" style={{ width: '240px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(formData.items || []).map((item, idx) => {
                                    const isInterState = formData.order_type === 'INTER_STATE' || String(formData.order_type).toLowerCase().includes('inter') || (formData.gst_ledger_1 && !formData.gst_ledger_2);
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
                                                    required={idx === 0}
                                                    data-label="Name of Item"
                                                    value={item.product || ''}
                                                    options={[{ value: '', label: 'Search and select item...' }, ...stockItems.map(p => ({ value: String(p.id), label: p.name }))]}
                                                    onChange={e => handleTableProductChange(idx, e.target.value)}
                                                    onKeyDown={e => handleTableKeyDown(e, idx, 0)}
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
                                            {(formData.order_type === 'INTER_STATE' || String(formData.order_type).toLowerCase().includes('inter') || (formData.gst_ledger_1 && !formData.gst_ledger_2)) ? (
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
                                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
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
                                                        className="sof-popup-btn-action sof-popup-btn-end"
                                                        title="Go to Invoice Summary (End of Row)"
                                                        data-row={idx}
                                                        data-col={endOfRowCol}
                                                        onKeyDown={e => handleTableKeyDown(e, idx, endOfRowCol)}
                                                        onClick={() => {
                                                            const container = document.querySelector('[data-gst-ledger-1]');
                                                            const trigger = container?.querySelector('[data-ss-trigger]');
                                                            if (trigger) trigger.focus();
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

                {/* ── SECTION 4: NOTES + INVOICE SUMMARY ─────────────────────── */}
                <div className="row">
                    {/* Narration */}
                    <div className="col-xl-7 col-lg-6 col-md-12 col-12 mb-4">
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
                                rows="6"
                                style={{ flex: 1 }}
                                placeholder="Enter order notes, payment terms, or special instructions..."
                                value={formData.narration || ''}
                                onChange={e => handleInputChange('narration', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Invoice Summary */}
                    <div className="col-xl-5 col-lg-6 col-md-12 col-12 mb-4">
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
                                    <span className="sof-receipt-val">{getSubtotal()}</span>
                                </div>

                                {/* GST Ledger 1 */}
                                <div className="sof-gst-row">
                                    <div className="sof-gst-label">
                                        {(() => {
                                            const l = ledgers.find(x => String(x.id) === String(formData.gst_ledger_1));
                                            if (l && l.name) return `${l.name} Ledger`;
                                            return (formData.order_type === 'INTER_STATE' || String(formData.order_type).toLowerCase().includes('inter') || (formData.gst_ledger_1 && !formData.gst_ledger_2)) ? 'IGST Ledger' : 'CGST Ledger';
                                        })()}
                                    </div>
                                    <div className="sof-gst-fields">
                                        <SearchableSelect
                                            data-gst-ledger-1
                                            disabled={true}
                                            className="sof-gst-select sof-disabled"
                                            value={formData.gst_ledger_1 || ''}
                                            options={[{ value: '', label: 'Select Ledger' }, ...ledgers.map(l => ({ value: String(l.id), label: l.name }))]}
                                            onChange={() => {}}
                                            placeholder="Select Ledger"
                                        />
                                        <span className="sof-gst-amount">{formData.gst_amount_1 || '0.00'}</span>
                                    </div>
                                </div>

                                {/* GST Ledger 2 */}
                                {(formData.order_type !== 'INTER_STATE' && formData.gst_ledger_2 !== '') && (
                                    <div className="sof-gst-row">
                                        <div className="sof-gst-label">
                                            {(() => {
                                                const l = ledgers.find(x => String(x.id) === String(formData.gst_ledger_2));
                                                if (l && l.name) return `${l.name} Ledger`;
                                                return 'SGST Ledger';
                                            })()}
                                        </div>
                                        <div className="sof-gst-fields">
                                            <SearchableSelect
                                                data-gst-ledger-2
                                                disabled={true}
                                                className="sof-gst-select sof-disabled"
                                                value={formData.gst_ledger_2 || ''}
                                                options={[{ value: '', label: 'Select Ledger' }, ...ledgers.map(l => ({ value: String(l.id), label: l.name }))]}
                                                onChange={() => {}}
                                                placeholder="Select Ledger"
                                            />
                                            <span className="sof-gst-amount">{formData.gst_amount_2 || '0.00'}</span>
                                        </div>
                                    </div>
                                )}

                                <div className="sof-receipt-row sof-receipt-row-tax">
                                    <span className="sof-receipt-key">Total Tax</span>
                                    <span className="sof-receipt-val">{getTotalTax()}</span>
                                </div>

                                {(formData.extra_charges || []).map((ec, idx) => (
                                    <div key={idx} className="sof-gst-row">
                                        <div className="sof-gst-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
                                            <span>EXTRA CHARGE {idx + 1}</span>
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
                                                value={ec.ledger || ''}
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
                                                <span></span>
                                                <input
                                                    type="text"
                                                    className="sof-ec-amount"
                                                    placeholder="0.00"
                                                    value={ec.amount || ''}
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
                                ))}

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
                                <span className="sof-total-value">{formData.total_amount || '0.00'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── ACTION BAR ─────────────────────────────────────────────── */}
                <div className="sof-action-bar">
                    <button type="button" className="sof-btn-cancel" onClick={onCancel}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        Cancel
                    </button>
                    <button type="button" className="sof-btn-save" onClick={onSave}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                            <polyline points="17 21 17 13 7 13 7 21"></polyline>
                            <polyline points="7 3 7 8 15 8"></polyline>
                        </svg>
                        {isEditing ? 'Update Quotation' : 'Save Quotation'}
                    </button>
                </div>
            </form>

            {/* ── ITEM ENTRY POPUP ────────────────────────────────────────── */}
            {itemPopup && (
                <ItemEntryPopup
                    item={itemPopup.item}
                    isInterState={(formData.order_type === 'INTER_STATE' || String(formData.order_type).toLowerCase().includes('inter') || (formData.gst_ledger_1 && !formData.gst_ledger_2))}
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
                    isInterState={(formData.order_type === 'INTER_STATE' || String(formData.order_type).toLowerCase().includes('inter') || (formData.gst_ledger_1 && !formData.gst_ledger_2))}
                    onClose={() => setViewPopup(null)}
                    productConfig={productConfig}
                />
            )}

            {/* ── ALL STYLES ─────────────────────────────────────────────────── */}
            <style dangerouslySetInnerHTML={{ __html: `
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
                    background: linear-gradient(135deg, #312e81 0%, #4338ca 40%, #6366f1 100%);
                    border-radius: 16px;
                    padding: 24px 28px;
                    margin-bottom: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                    box-shadow: 0 8px 32px rgba(99, 102, 241, 0.35);
                    position: relative;
                    overflow: hidden;
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
                    border: 1px solid #e2e8f0;
                    border-radius: 14px;
                    padding: 22px 24px;
                    margin-bottom: 24px;
                    box-shadow: 0 2px 12px rgba(0,0,0,0.04);
                    transition: box-shadow 0.25s ease;
                }
                .sof-section:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.07); }
                .sof-section-inner { border-top-left-radius: 0; border-top-right-radius: 0; border-top: none; margin-top: 0; }
                .sof-table-section { padding: 0; overflow: hidden; }
                .sof-section-head {
                    display: flex; align-items: center; gap: 10px;
                    margin-bottom: 20px;
                    padding: 22px 24px 0 24px;
                }
                .sof-table-section .sof-section-head { padding: 18px 20px 14px 20px; margin-bottom: 0; border-bottom: 1px solid #f1f5f9; }
                .sof-section-icon {
                    width: 32px; height: 32px;
                    background: linear-gradient(135deg, #6366f1, #4338ca);
                    border-radius: 8px;
                    display: flex; align-items: center; justify-content: center;
                    color: #fff; flex-shrink: 0;
                }
                .sof-section-icon svg { width: 16px; height: 16px; }
                .sof-icon-teal { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }
                .sof-icon-amber { background: linear-gradient(135deg, #f59e0b, #d97706); }
                .sof-icon-blue { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }
                .sof-section-head > span {
                    font-size: 0.95rem; font-weight: 700;
                    color: #1e293b; white-space: nowrap;
                }
                .sof-section-line {
                    flex: 1; height: 1px;
                    background: linear-gradient(to right, #e2e8f0, transparent);
                }
                .sof-add-row-btn {
                    display: flex; align-items: center; gap: 6px;
                    background: linear-gradient(135deg, #eff6ff, #dbeafe);
                    color: #1d4ed8;
                    border: 1.5px solid #bfdbfe;
                    border-radius: 8px;
                    padding: 6px 14px;
                    font-size: 0.78rem; font-weight: 700;
                    cursor: pointer; white-space: nowrap;
                    transition: all 0.2s ease;
                }
                .sof-add-row-btn:hover {
                    background: linear-gradient(135deg, #2563eb, #1d4ed8);
                    color: #fff; border-color: transparent;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
                }

                /* ── FORM FIELDS ── */
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
                    background: #e0e7ff; color: #4338ca;
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
                    border-color: #6366f1;
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
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
                .sof-textarea:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12); outline: none; background: #fff; }
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
                    background: linear-gradient(to right, #312e81, #4f46e5);
                }
                .sof-table th {
                    color: rgba(255,255,255,0.9);
                    font-size: 0.66rem; font-weight: 700;
                    text-transform: uppercase; letter-spacing: 0.07em;
                    padding: 13px 10px;
                    border: none; white-space: nowrap;
                    text-align: center !important;
                }
                .sof-th-center { text-align: center; }
                .sof-th-right { text-align: right; }
                .sof-th-calc { color: rgba(255,255,255,0.55); }
                .sof-th-amount { color: #fbbf24; }
                .sof-tr { transition: background-color 0.12s ease; }
                .sof-tr:nth-child(even) { background-color: #fafbff; }
                .sof-tr:hover { background-color: #f0f4ff; }
                .sof-table td { padding: 5px 6px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
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
                    padding: 7px 9px; border-radius: 7px;
                    font-size: 0.83rem; font-weight: 500;
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
                    background: #eff6ff; color: #1d4ed8;
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
                .sof-input-error {
                    border-color: #ef4444 !important;
                    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2) !important;
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

                /* ── ACTION BAR ── */
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
                .sof-btn-cancel:focus, .sof-btn-cancel:focus-visible {
                    outline: 4px solid #3b82f6 !important;
                    outline-offset: 3px !important;
                    background: #f8fafc !important;
                    border-color: #3b82f6 !important;
                    box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.25) !important;
                }
                .sof-btn-save {
                    display: inline-flex; align-items: center; gap: 8px;
                    background: linear-gradient(135deg, #4f46e5, #4338ca);
                    color: #fff; border: none;
                    border-radius: 10px; padding: 12px 30px;
                    font-size: 0.9rem; font-weight: 700;
                    cursor: pointer;
                    box-shadow: 0 4px 16px rgba(79, 70, 229, 0.35);
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    font-family: inherit;
                }
                .sof-btn-save:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 24px rgba(79, 70, 229, 0.45);
                    background: linear-gradient(135deg, #4338ca, #3730a3);
                }
                .sof-btn-save:focus, .sof-btn-save:focus-visible {
                    outline: 4px solid #3b82f6 !important;
                    outline-offset: 3px !important;
                    transform: translateY(-2px) !important;
                    box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.45), 0 8px 24px rgba(79, 70, 229, 0.5) !important;
                    background: linear-gradient(135deg, #4338ca, #3730a3) !important;
                }
                .sof-btn-save:active { transform: translateY(0); }

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
                    background: linear-gradient(135deg, #eff6ff, #dbeafe);
                    color: #1d4ed8;
                    border: 1.5px solid #bfdbfe;
                    border-radius: 10px;
                    padding: 0 18px;
                    font-size: 0.8rem; font-weight: 700;
                    cursor: pointer; white-space: nowrap;
                    font-family: inherit;
                    transition: all 0.2s ease;
                }
                .sof-enter-btn:hover {
                    background: linear-gradient(135deg, #2563eb, #1d4ed8);
                    color: #fff; border-color: transparent;
                    box-shadow: 0 4px 12px rgba(37,99,235,0.3);
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
                    text-align: center !important;
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
                    background: linear-gradient(135deg, #3b82f6, #2563eb);
                    color: #ffffff;
                    border: none;
                    border-radius: 8px;
                    padding: 9px 24px;
                    font-size: 0.84rem;
                    font-weight: 700;
                    cursor: pointer;
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    font-family: inherit;
                }
                .sof-popup-btn-save:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 6px 16px rgba(37, 99, 235, 0.35);
                    background: linear-gradient(135deg, #2563eb, #1d4ed8);
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
        
            {/* Add Ledger Modal */}
            {showLedgerModal && (
                <LedgerFormModal
                    show={showLedgerModal}
                    onHide={() => setShowLedgerModal(false)}
                    accountGroups={accountGroups}
                    onSave={handleSaveLedger}
                />
            )}
        </div>
    );
};

export default QuotationForm;
