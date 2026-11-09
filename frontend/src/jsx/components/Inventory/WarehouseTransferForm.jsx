import React, { useState, useEffect, useRef, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import ReactDOM from 'react-dom';
import './WarehouseTransferForm.css';
import { Row, Col, Card, Form, Button, Modal, Table } from 'react-bootstrap';
import Select from 'react-select';
import { useEnterTraversal } from '../../../hooks/useEnterTraversal';
import Swal from 'sweetalert2';
import InventoryService, { getWarehouseTransferNextNo, getWarehouses } from '../../../services/InventoryService';
import swal from 'sweetalert';
import CompanyDatePicker from '../Common/CompanyDatePicker';

const customSelectStyles = {
    control: (provided) => ({
        ...provided,
        borderRadius: '8px',
        borderColor: '#dee2e6',
        minHeight: '42px',
        boxShadow: 'none',
        '&:hover': {
            borderColor: '#b4b4b4'
        }
    }),
    option: (provided, state) => ({
        ...provided,
        backgroundColor: state.isSelected ? '#0d6efd' : state.isFocused ? '#f8f9fa' : 'white',
        color: state.isSelected ? 'white' : '#212529',
    }),
};

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
        e.stopPropagation();

        // Find all focusable input/select controls in this container
        const container = active.closest('.sof-modal-body') || active.closest('.swal-modal') || active.closest('form') || e.currentTarget;
        const focusables = Array.from(
            container.querySelectorAll(
                'input[name="wt_no"], input:not([readonly]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button[data-ss-trigger]:not([disabled]), .sof-btn-save'
            )
        );

        const index = focusables.indexOf(active);
        if (index > -1 && index < focusables.length - 1) {
            focusables[index + 1].focus();
        } else if (index === focusables.length - 1 && active.tagName.toLowerCase() === 'button') {
            active.click();
        } else if (index === focusables.length - 1 && active.tagName.toLowerCase() === 'button') {
            active.click();
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
                    'input[name="wt_no"], input:not([readonly]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button[data-ss-trigger]:not([disabled]), .sof-btn-save'
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
    ['wt_no', 'entry_date', 'destination_warehouse']
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
            'input[name="wt_no"], input:not([readonly]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button[data-ss-trigger]:not([disabled]), .sof-btn-save'
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
    if (document.querySelector('.swal-overlay--show-modal')) {
        return;
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
const SearchableSelect = forwardRef(({
    value, options = [], onChange, placeholder = 'Select...', disabled = false, autoOpen = false, autoFocus = false,
    className = '', onKeyDown, style = {}, name, allowCustom = false, ...dataProps
}, ref) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [highlightIdx, setHighlightIdx] = useState(-1);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const listRef = useRef(null);
    const justSelectedRef = useRef(false);
    const justClosedRef = useRef(false);

    useImperativeHandle(ref, () => ({
        focus: () => {
            if (open) {
                inputRef.current?.focus();
            } else {
                containerRef.current?.focus();
                // If they want it to auto-open when focused this way:
                setTimeout(() => openDropdown(), 50);
            }
        }
    }));

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
        if (restoreFocus) {
            justClosedRef.current = true;
            setTimeout(() => containerRef.current?.querySelector('[data-ss-trigger]')?.focus(), 10);
        }
    }, []);

    const selectOption = useCallback((opt) => {
        onChange({ target: { value: opt.value } });
        justSelectedRef.current = false;
        closeDropdown(false);
        setTimeout(() => {
            if (!containerRef.current) return;
            if (document.querySelector('.swal-overlay--show-modal')) {
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

            // 4b. Check if we are at the delivery_location dropdown → focus date input
            if (containerRef.current.hasAttribute('data-delivery-location')) {
                const dateInput = document.querySelector('[name="preferred_delivery_date_date"]');
                if (dateInput) {
                    dateInput.focus();
                    // No showPicker() here — calendar only opens on mouse click
                    return;
                }
            }

            // 5. Fallback to standard form fields sequential DOM focus
            const form = containerRef.current.closest('form') || containerRef.current.closest('.sof-modal-body') || document.body;
            if (form) {
                const focusables = Array.from(
                    form.querySelectorAll(
                        'input[name="wt_no"], input:not([readonly]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button[data-ss-trigger]:not([disabled]), .sof-btn-save'
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
        if (document.querySelector('.swal-overlay--show-modal')) {
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
        if (document.querySelector('.swal-overlay--show-modal')) {
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
});

/* ══════════════════════════════════════════════════════════
   ITEM ENTRY POPUP
   * Uses handleEnterNavigation for Enter key form navigation
══════════════════════════════════════════════════════════ */
const ItemEntryPopup = ({ item, isInterState, warehouses, stockItems, units = [], onSave, onClose, isEdit, productConfig }) => {
    const { maintain_batch, maintain_manufacture_date, maintain_expiry_date, maintain_warehouse } = productConfig || {};
    
    const [availableBatches, setAvailableBatches] = useState([]);
    const [localWarehouses, setLocalWarehouses] = useState([]);
    const [validationErrors, setValidationErrors] = useState({});

    // Load available batches and warehouses for the selected stock item
    useEffect(() => {
        // Support both field names: 'product' (SalesOrderForm) and 'stock_item' (other forms)
        const itemId = item && (item.product || item.stock_item);
        if (itemId) {
            // Load batches
            InventoryService.getItemBatches(itemId)
                .then(res => {
                    setAvailableBatches(Array.isArray(res.data) ? res.data : []);
                })
                .catch(err => {
                    console.error('Failed to load batches:', err);
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
    if (maintain_batch) dynamicMaxWidth += 170; // Increased width for batch select with quantity info
    if (maintain_expiry_date) dynamicMaxWidth += 150;
    if (maintain_manufacture_date) dynamicMaxWidth += 150;

    const [splits, setSplits] = useState(() => {
        if (item.splits && item.splits.length > 0) {
            return item.splits.map(s => ({
                ...s,
                per: s.per || '',
                perName: s.perName || '',
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
            per: item.per || '',
            perName: item.perName || '',
            quantity: cleanZeroValue(item.quantity),
            rate: cleanZeroValue(item.rate),
            discount_percent: cleanZeroValue(item.discount_percent),
            discount_amount: item.discount_amount || '0.00',
            amount: item.amount || '0.00'
        }];
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
                        const trigger = container.querySelector('[data-ss-trigger]') || container;
                        trigger.focus();
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
        if (document.querySelector('.swal-modal') || document.querySelector('.swal-overlay')) {
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
            } else if (colIdx === totalCols - 3) {
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
                                    {maintain_manufacture_date && <th style={{ minWidth: '130px' }}>Mfg. Date</th>}
                                    {maintain_expiry_date && <th style={{ minWidth: '130px' }}>Expiry Date</th>}
                                    <th className="sof-th-right" style={{ minWidth: '90px' }}>Qty</th>
                                    <th className="sof-th-right" style={{ minWidth: '110px' }}>Rate</th>
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
                                                        options={[
                                                            { value: '', label: '— Select —' },
                                                            ...localWarehouses.map(w => ({
                                                                value: String(w.id),
                                                                label: `${w.name} [Avail: ${Math.max(0, w.available_quantity ?? 0)}]`
                                                            }))
                                                        ]}
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
                                                    type="number"
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
                                                    type="number"
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



const formatDateMask = (value) => {
    if (!value) return '';
    const cleaned = ('' + value).replace(/\D/g, '');
    let res = '';
    if (cleaned.length > 0) res += cleaned.substring(0, 2);
    if (cleaned.length > 2) res += '/' + cleaned.substring(2, 4);
    if (cleaned.length > 4) res += '/' + cleaned.substring(4, 8);
    return res;
};

const formatDateForDisplay = (dateStr) => {
    if (!dateStr || !dateStr.includes('-')) return dateStr;
    const parts = dateStr.split('-');
    if (parts[0].length === 4) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
};

const WarehouseTransferForm = ({ formData, setFormData, onSave, onCancel, isEditing }) => {
    const [stockItems, setStockItems] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [productConfig, setProductConfig] = useState({ maintain_warehouse: true, maintain_batch: true, maintain_manufacture_date: true, maintain_expiry_date: true });

    const wtNoRef = useRef(null);
    useEffect(() => {
        if (!isEditing && wtNoRef.current) {
            wtNoRef.current.focus();
        }
    }, [isEditing]);

    
    // Popup state
    const [showPopup, setShowPopup] = useState(false);
    const [currentRowIndex, setCurrentRowIndex] = useState(null);
    const [popupData, setPopupData] = useState([]);
    const [availableBatches, setAvailableBatches] = useState([]);
    const [availableWarehouses, setAvailableWarehouses] = useState([]);
    const popupContainerRef = useRef(null);
    useEnterTraversal(popupContainerRef);
    const popupQtyRef = useRef(null);
    const warehouseDropdownRef = useRef(null);
    const popupWarehouseRefs = useRef([]);
    const popupBatchRefs = useRef([]);
    const modalSaveBtnRef = useRef(null);
    const rowActionRefs = useRef([]);

    // Modal Close Focus Rescue
    useEffect(() => {
        if (!showPopup && currentRowIndex !== null) {
            const timeoutId = setTimeout(() => {
                if (rowActionRefs.current[currentRowIndex]) {
                    rowActionRefs.current[currentRowIndex].focus();
                } else {
                    // Fallback to id-based lookup if ref isn't available
                    const btn = document.getElementById(`edit-btn-${currentRowIndex}`);
                    if (btn) btn.focus();
                }
            }, 50);
            return () => clearTimeout(timeoutId);
        }
    }, [showPopup]);

    useEffect(() => {
        if (showPopup && warehouseDropdownRef.current) {
            const timeoutId = setTimeout(() => {
                if (warehouseDropdownRef.current) {
                    warehouseDropdownRef.current.focus();
                }
            }, 50);
            return () => clearTimeout(timeoutId);
        }
    }, [showPopup]);

    const handleWarehouseKeyDown = (e, index, nextRef) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            
            const currentValue = popupData[index]?.source_warehouse;
            
            // Check if the select value is unselected, empty, or undefined
            if (!currentValue || currentValue === "" || currentValue === "-- Select --") {
                // 1. Immediately delete the current empty row from state
                setPopupData(prev => prev.filter((_, i) => i !== index));
                
                // 2. Shift focus straight to the save button
                setTimeout(() => {
                    modalSaveBtnRef.current?.focus();
                }, 30);
            } else {
                // Regular navigation: move focus to the next field if a warehouse IS selected
                if (nextRef && nextRef.current && nextRef.current[index]) {
                    nextRef.current[index].focus();
                } else {
                    handleKeyDownNavigation(e);
                }
            }
        } else {
            handleKeyDownNavigation(e);
        }
    };

    useEffect(() => {
        if (showPopup && popupContainerRef.current) {
            const t = setTimeout(() => {
                const firstInput = popupContainerRef.current.querySelector('[data-ss-trigger], input:not([type="hidden"])');
                if (firstInput && !warehouseDropdownRef.current) {
                    firstInput.focus();
                    if (firstInput.tagName.toLowerCase() === 'input' && typeof firstInput.select === 'function') {
                        firstInput.select();
                    }
                }
            }, 100);
            return () => clearTimeout(t);
        }
    }, [showPopup]);


    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                if (!isEditing) {
                    const noRes = await getWarehouseTransferNextNo();
                    setFormData(prev => ({ ...prev, wt_no: noRes.next_no }));
                }
                const itemsRes = await InventoryService.getStockItems();
                setStockItems(itemsRes.data || itemsRes);
                
                const wRes = await getWarehouses();
                setWarehouses(wRes);

                const configsRes = await InventoryService.getProductConfigurations();
                const configs = Array.isArray(configsRes.data) ? configsRes.data : [];
                const wtConfig = configs.find(c => c.voucher_type_name && (c.voucher_type_name.toLowerCase().includes('warehouse transfer') || c.voucher_type_name.toLowerCase().includes('godown transfer')));
                if (wtConfig) {
                    setProductConfig(wtConfig);
                }
            } catch (err) {
                console.error('Error fetching data:', err);
            }
        };
        fetchInitialData();
    }, [isEditing, setFormData]);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleDestWarehouseChange = (selected) => {
        setFormData(prev => ({ ...prev, destination_warehouse: selected ? selected.value : '' }));
    };

    const handleItemChange = async (index, selectedItem) => {
        const newItems = [...formData.items];
        newItems[index].item = selectedItem ? selectedItem.value : '';
        newItems[index].item_name = selectedItem ? selectedItem.label : '';
        setFormData(prev => ({ ...prev, items: newItems }));
        
        if (selectedItem) {
            openPopup(index, selectedItem.value);
        }
    };

    const handleAddItemRow = useCallback(() => {
        setFormData(prev => ({
            ...prev,
            items: [...(prev.items || []), {
                item: '',
                item_name: '',
                splits: [{
                    source_warehouse: '',
                    batch_number: '',
                    manufacture_date: '',
                    expiry_date: '',
                    quantity: '',
                    rate: '',
                    amount: '0.00'
                }]
            }]
        }));
    }, [setFormData]);

    useEffect(() => {
        if (!formData.items || formData.items.length === 0) {
            handleAddItemRow();
        }
    }, [formData.items, handleAddItemRow]);

    const handleRemoveItemRow = (index) => {
        if (formData.items.length <= 1) return;
        const newItems = [...formData.items];
        newItems.splice(index, 1);
        setFormData(prev => ({ ...prev, items: newItems }));
    };

    const openPopup = async (index, itemId) => {
        setCurrentRowIndex(index);
        
        // Fetch batches/warehouses for this item
        try {
            const bRes = await InventoryService.getItemBatches(itemId);
            setAvailableBatches(bRes.data || bRes || []);
            const wRes = await InventoryService.getItemWarehouses(itemId);
            const wData = wRes.data || wRes || [];
            setAvailableWarehouses(wData);
            const totalStock = wData.reduce((sum, w) => sum + parseFloat(w.available_quantity || 0), 0);
            if (totalStock <= 0) {
                swal({
                    title: "Out of Stock",
                    text: "The selected item has no available stock to transfer.",
                    icon: "warning",
                    button: "OK"
                });
            }
        } catch (e) {
            console.error(e);
        }

        const itemSplits = formData.items[index].splits || [];
        if (itemSplits.length === 0) {
            setPopupData([{
                source_warehouse: '',
                batch_number: '',
                manufacture_date: '',
                expiry_date: '',
                quantity: '',
                rate: '',
                amount: '0.00'
            }]);
        } else {
            setPopupData([...itemSplits]);
        }
        setShowPopup(true);
    };

    const handlePopupChange = (idx, field, value) => {
        const newData = [...popupData];
        newData[idx][field] = value;
        
        let limit = null;
        let isBatch = false;
        
        if (field === 'batch_number' || field === 'source_warehouse' || field === 'quantity') {
            const wId = parseInt(newData[idx].source_warehouse);
            const bNum = newData[idx].batch_number;
            
            if (bNum && wId) {
                const batch = availableBatches.find(b => b.batch_number === bNum && b.warehouse_id === wId);
                if (batch) {
                    limit = parseFloat(batch.available_quantity) || 0;
                    isBatch = true;
                }
            } else if (wId) {
                const w = availableWarehouses.find(aw => aw.id === wId);
                if (w) {
                    limit = parseFloat(w.available_quantity) || 0;
                }
            }
            
            const q = parseFloat(newData[idx].quantity);
            if (!isNaN(q) && limit !== null) {
                // Calculate total quantity for this specific batch/warehouse combination across all rows
                let totalUsed = 0;
                let otherUsed = 0;
                newData.forEach((row, i) => {
                    if (parseInt(row.source_warehouse) === wId && row.batch_number === bNum) {
                        const rowQ = parseFloat(row.quantity) || 0;
                        totalUsed += rowQ;
                        if (i !== idx) otherUsed += rowQ;
                    }
                });

                if (totalUsed > limit) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Stock Limit Exceeded',
                        text: `Available ${isBatch ? 'batch' : 'warehouse'} stock is ${limit}. You have already allocated ${otherUsed} in other rows.`,
                        timer: 3000,
                        showConfirmButton: false
                    });
                    const remaining = Math.max(0, limit - otherUsed);
                    newData[idx].quantity = remaining > 0 ? remaining.toString() : '';
                }
            }
        }
        
        if (field === 'quantity' || field === 'rate' || field === 'batch_number' || field === 'source_warehouse') {
            const q = parseFloat(newData[idx].quantity) || 0;
            const r = parseFloat(newData[idx].rate) || 0;
            newData[idx].amount = (q * r).toFixed(2);
        }
        
        if (field === 'batch_number') {
            const batch = availableBatches.find(b => b.batch_number === value && b.warehouse_id === parseInt(newData[idx].source_warehouse));
            if (batch) {
                newData[idx].manufacture_date = batch.manufacture_date || '';
                newData[idx].expiry_date = batch.expiry_date || '';
                newData[idx].rate = batch.rate || '';
                
                const q = parseFloat(newData[idx].quantity) || 0;
                const r = parseFloat(batch.rate) || 0;
                newData[idx].amount = (q * r).toFixed(2);
            }
        }
        
        setPopupData(newData);
    };

    const addPopupRow = () => {
        setPopupData(prev => {
            const nextIdx = prev.length;
            setTimeout(() => {
                if (popupWarehouseRefs.current[nextIdx]) {
                    popupWarehouseRefs.current[nextIdx].focus();
                }
            }, 50);
            return [...prev, {
                source_warehouse: '',
                batch_number: '',
                manufacture_date: '',
                expiry_date: '',
                quantity: '',
                rate: '',
                amount: '0.00'
            }];
        });
    };
    
    const removePopupRow = (idx) => {
        if (popupData.length <= 1) return;
        setPopupData(prev => prev.filter((_, i) => i !== idx));
    };

    const savePopup = () => {
        // Filter out completely empty rows
        const validRows = popupData.filter(row => row.source_warehouse && row.source_warehouse !== "" && row.source_warehouse !== "-- Select --");

        if (validRows.length === 0) {
            swal('Warning', 'Please enter at least one valid allocation.', 'warning');
            return;
        }

        // Validate valid rows
        for (let i = 0; i < popupData.length; i++) {
            const row = popupData[i];
            if (row.source_warehouse && row.source_warehouse !== "" && row.source_warehouse !== "-- Select --") {
                if (!row.quantity || parseFloat(row.quantity) <= 0) {
                    swal('Warning', 'Quantity is required and must be greater than 0.', 'warning').then(() => {
                        setTimeout(() => {
                            const qtyInput = document.getElementById(`popup-qty-${i}`);
                            if (qtyInput) qtyInput.focus();
                        }, 400);
                    });
                    return;
                }
                if (!row.rate || parseFloat(row.rate) <= 0) {
                    swal('Warning', 'Rate is required and must be greater than 0.', 'warning').then(() => {
                        setTimeout(() => {
                            const rateInput = document.getElementById(`popup-rate-${i}`);
                            if (rateInput) rateInput.focus();
                        }, 400);
                    });
                    return;
                }
            }
        }
        const newItems = [...formData.items];
        newItems[currentRowIndex].splits = validRows;
        setFormData(prev => ({ ...prev, items: newItems }));
        setShowPopup(false);
        setTimeout(() => {
            const btn = document.getElementById(`main-add-btn-${currentRowIndex}`);
            if (btn) btn.focus();
        }, 100);
    };

    const getTotalQty = (splits) => {
        return splits.reduce((sum, s) => sum + (parseFloat(s.quantity) || 0), 0);
    };

    const getTotalAmount = (splits) => {
        return splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
    };


    const handleFormSubmit = (e) => {
        e.preventDefault();
        if (!formData.destination_warehouse) {
            swal('Error', 'Please select Destination Warehouse', 'error');
            return;
        }
        // Filter out empty items
        const cleanedItems = formData.items.filter(it => it.item);
        if (cleanedItems.length === 0) {
            swal('Error', 'Please add at least one item', 'error').then(() => {
                setTimeout(() => {
                    if (document.activeElement) document.activeElement.blur();
                    
                    const container = document.getElementById("initial-tally-item-dropdown");
                    const targetInput = container?.querySelector('input[type="text"]') || 
                                        container?.querySelector('input') || 
                                        container?.querySelector('select') || 
                                        container?.querySelector('button') || 
                                        container;
                    if (targetInput) {
                        // Reset native selection baseline for clean key handling if it's a native select
                        if (typeof targetInput.selectedIndex !== 'undefined' || targetInput.tagName.toLowerCase() === 'select') {
                            targetInput.selectedIndex = 0;
                        }
                        
                        // Force direct focus only
                        targetInput.focus();
                    }
                }, 400); // Increased to 400ms to safely outlast SweetAlert's focus restoration animation
            });
            return;
        }
        
        const formatBackendDate = (dateStr) => {
            if (!dateStr) return dateStr;
            const parts = dateStr.split(/[-/]/);
            return parts.length === 3 && parts[0].length === 2 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateStr;
        };
        
        const submissionData = {
            ...formData,
            entry_date: formatBackendDate(formData.entry_date),
            items: cleanedItems.map(item => ({
                ...item,
                splits: item.splits ? item.splits.map(split => ({
                    ...split,
                    manufacture_date: formatBackendDate(split.manufacture_date) || null,
                    expiry_date: formatBackendDate(split.expiry_date) || null
                })) : []
            }))
        };
        
        onSave(submissionData);
    };

    return (
        <div className="sof-wrap">
            <form onSubmit={handleFormSubmit} onKeyDown={handleKeyDownNavigation}>
                
                {/* ── SECTION 1: TRANSFER INFO ───────────────────────────────────── */}
                <div className="sof-section">
                    <div className="sof-section-head">
                        <div className="sof-section-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                        </div>
                        <span>Transfer Information</span>
                        <div className="sof-section-line"></div>
                    </div>

                    <div className="row">
                        <div className="col-lg-3 col-md-6 sof-field-group">
                            <label className="sof-label">
                                Transfer No.
                                <span className="sof-badge-auto">AUTO</span>
                            </label>
                            <div className="sof-input-box sof-input-locked">
                                <span className="sof-field-icon">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                    </svg>
                                </span>
                                <input type="text" name="wt_no" className="sof-input" readOnly value={formData.wt_no || ''} ref={wtNoRef} />
                            </div>
                        </div>

                        <div className="col-lg-3 col-md-6 sof-field-group">
                            <label className="sof-label">Entry Date <span className="sof-req">*</span></label>
                            <div className="sof-input-box">
                                <span className="sof-field-icon">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                                    onChange={(e) => handleFormChange(e)}
                                    onDoubleClick={e => e.target.classList.add('sof-input-edit-segments')}
                                    onBlur={e => {
                                        e.target.classList.remove('sof-input-edit-segments');
                                        e.target.removeAttribute('data-picker-just-closed');
                                    }}
                                    onFocus={e => {
                                        e.target.removeAttribute('data-picker-just-closed');
                                    }}
                                    onClick={e => {
                                        try { e.target.showPicker(); } catch (err) {}
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            // Focus the next logical field (Destination Warehouse SearchableSelect)
                                            const destField = document.querySelector('input[name="destination_warehouse"]') || document.querySelector('[data-ss-trigger]');
                                            if (destField) destField.focus();
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        <div className="col-lg-6 sof-field-group">
                            <label className="sof-label">Destination Warehouse <span className="sof-req">*</span></label>
                            <div className="sof-input-box">
                                <span className="sof-field-icon">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                                        <line x1="12" y1="22.08" x2="12" y2="12"></line>
                                    </svg>
                                </span>
                                <SearchableSelect
                                    name="destination_warehouse"
                                    options={[
                                        { value: '', label: '-- Select --' },
                                        ...warehouses.map(w => ({ value: w.id, label: w.name }))
                                    ]}
                                    value={formData.destination_warehouse || ''}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (!val || val === "") {
                                            swal('Warning', 'Please select Destination Warehouse', 'warning').then(() => {
                                                setTimeout(() => {
                                                    const destInput = document.querySelector('input[name="destination_warehouse"]') || document.querySelector('button[name="destination_warehouse"]');
                                                    if (destInput) destInput.focus();
                                                }, 400);
                                            });
                                            handleDestWarehouseChange(null);
                                        } else {
                                            handleDestWarehouseChange({ value: val });
                                        }
                                    }}
                                    placeholder="Select Destination Warehouse..."
                                    className="sof-input"
                                    data-ss-trigger
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── SECTION 2: ORDER ITEMS ───────────────────────────────────── */}
                <div className="sof-section sof-table-section">
                    <div className="sof-section-head">
                        <div className="sof-section-icon sof-icon-blue">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                                <line x1="12" y1="22.08" x2="12" y2="12"/>
                            </svg>
                        </div>
                        <span>Item Allocations</span>
                        {(formData.items || []).filter(item => item.item).length > 0 && (
                            <span className="sof-items-count">
                                {(formData.items || []).filter(item => item.item).length} {(formData.items || []).filter(item => item.item).length === 1 ? 'item' : 'items'}
                            </span>
                        )}
                        <div className="sof-section-line"></div>
                    </div>

                    <div className="sof-table-wrap">
                        <table className="sof-table">
                            <thead>
                                <tr>
                                    <th className="sof-th-center" style={{ width: '50px' }}>#</th>
                                    <th style={{ minWidth: '220px' }}>Name of Item</th>
                                    <th className="sof-th-right" style={{ width: '100px' }}>Quantity</th>
                                    <th className="sof-th-right" style={{ width: '110px' }}>Rate</th>
                                    <th className="sof-th-right" style={{ width: '120px' }}>Amount</th>
                                    <th className="sof-th-center" style={{ width: '240px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(formData.items || []).map((item, idx) => {
                                    const totalQty = getTotalQty(item.splits || []);
                                    const totalAmount = getTotalAmount(item.splits || []);
                                    const avgRate = totalQty > 0 ? (totalAmount / totalQty) : 0;
                                    return (
                                        <tr key={idx} className="sof-tr">
                                            <td className="sof-th-center" style={{ verticalAlign: 'middle', fontWeight: '600', color: '#64748b' }}>{idx + 1}</td>
                                            <td style={{ verticalAlign: 'middle' }}>
                                                <SearchableSelect
                                                    id={idx === 0 ? "initial-tally-item-dropdown" : `item-dropdown-${idx}`}
                                                    options={[
                                                        { value: '', label: '-- Select Item --' },
                                                        ...stockItems.map(si => ({ value: si.id, label: si.name }))
                                                    ]}
                                                    value={item.item || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (!val || val === "" || val === "-- Select Item --") {
                                                            if (idx === 0) {
                                                                swal('Warning', 'Please select a valid Item', 'warning').then(() => {
                                                                    setTimeout(() => {
                                                                        const dropdown = document.getElementById(idx === 0 ? "initial-tally-item-dropdown" : `item-dropdown-${idx}`);
                                                                        const trigger = dropdown?.querySelector('input[type="text"]') || dropdown?.querySelector('button');
                                                                        if (trigger) trigger.focus();
                                                                    }, 400);
                                                                });
                                                                handleItemChange(idx, null);
                                                            } else {
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    items: prev.items.filter((_, i) => i !== idx)
                                                                }));
                                                                setTimeout(() => {
                                                                    const narration = document.querySelector('textarea[name="narration"]');
                                                                    if (narration) narration.focus();
                                                                }, 20);
                                                            }
                                                        } else {
                                                            const found = stockItems.find(si => si.id === parseInt(val));
                                                            handleItemChange(idx, found ? { value: found.id, label: found.name } : null);
                                                        }
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && (!item.item || item.item === "")) {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                items: prev.items.filter((_, i) => i !== idx)
                                                            }));
                                                            setTimeout(() => {
                                                                const narration = document.querySelector('textarea[name="narration"]');
                                                                if (narration) narration.focus();
                                                            }, 20);
                                                        }
                                                    }}
                                                    placeholder="Search and select item..."
                                                    className="sof-table-input"
                                                    data-ss-trigger
                                                    data-row={idx}
                                                    data-col="0"
                                                />
                                            </td>
                                            <td style={{ verticalAlign: 'middle' }}>
                                                <input
                                                    type="text"
                                                    className="sof-table-input sof-table-input-ro"
                                                    style={{ textAlign: 'right', fontWeight: 'bold' }}
                                                    readOnly
                                                    value={totalQty > 0 ? totalQty : ''}
                                                    placeholder="0.00"
                                                    onClick={() => {
                                                        if(item.item) openPopup(idx, item.item);
                                                    }}
                                                />
                                            </td>
                                            <td style={{ verticalAlign: 'middle' }}>
                                                <input
                                                    type="text"
                                                    className="sof-table-input sof-table-input-ro"
                                                    style={{ textAlign: 'right', fontWeight: 'bold' }}
                                                    readOnly
                                                    value={avgRate > 0 ? avgRate.toFixed(2) : ''}
                                                    placeholder="0.00"
                                                    disabled
                                                />
                                            </td>
                                            <td style={{ verticalAlign: 'middle' }}>
                                                <input
                                                    type="text"
                                                    className="sof-table-input sof-table-input-ro"
                                                    style={{ textAlign: 'right', fontWeight: 'bold' }}
                                                    readOnly
                                                    value={totalAmount > 0 ? totalAmount.toFixed(2) : ''}
                                                    placeholder="0.00"
                                                    disabled
                                                />
                                            </td>
                                            <td style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                                                <div className="d-flex justify-content-center align-items-center gap-1">
                                                    {/* Edit Button */}
                                                    <button
                                                        id={`edit-btn-${idx}`}
                                                        ref={el => rowActionRefs.current[idx] = el}
                                                        type="button"
                                                        className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center"
                                                        style={{ width: '28px', height: '28px', padding: '0', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                                        title="Edit details (dates, batch, etc.)"
                                                        onClick={() => { if(item.item) openPopup(idx, item.item); }}
                                                        disabled={!item.item}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'ArrowRight') {
                                                                e.preventDefault();
                                                                document.getElementById(`main-add-btn-${idx}`)?.focus();
                                                            } else if (e.key === 'ArrowLeft') {
                                                                e.preventDefault();
                                                                document.getElementById(`main-del-btn-${idx}`)?.focus();
                                                            } else if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                if(item.item) openPopup(idx, item.item);
                                                            }
                                                        }}
                                                    >
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                        </svg>
                                                    </button>
                                                    
                                                    {/* Add Row Button */}
                                                    <button
                                                        id={`main-add-btn-${idx}`}
                                                        type="button"
                                                        className="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center"
                                                        style={{ width: '28px', height: '28px', padding: '0', borderRadius: '4px', border: '1.5px solid #3b82f6', color: '#3b82f6', background: 'none' }}
                                                        title="Add new row"
                                                        onClick={() => {
                                                            handleAddItemRow();
                                                            setTimeout(() => {
                                                                const nextIdx = formData.items.length;
                                                                const dropdown = document.getElementById(`item-dropdown-${nextIdx}`);
                                                                if (dropdown) {
                                                                    const trigger = dropdown.querySelector('[data-ss-trigger]');
                                                                    if (trigger) {
                                                                        trigger.focus();
                                                                        trigger.click();
                                                                    }
                                                                }
                                                            }, 100);
                                                        }}
                                                        disabled={!item.item}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'ArrowRight') {
                                                                e.preventDefault();
                                                                document.getElementById(`main-end-btn-${idx}`)?.focus();
                                                            } else if (e.key === 'ArrowLeft') {
                                                                e.preventDefault();
                                                                document.getElementById(`edit-btn-${idx}`)?.focus();
                                                            } else if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleAddItemRow();
                                                                setTimeout(() => {
                                                                    const nextIdx = formData.items.length;
                                                                    const dropdown = document.getElementById(`item-dropdown-${nextIdx}`);
                                                                    if (dropdown) {
                                                                        const trigger = dropdown.querySelector('[data-ss-trigger]');
                                                                        if (trigger) {
                                                                            trigger.focus();
                                                                            trigger.click();
                                                                        }
                                                                    }
                                                                }, 100);
                                                            }
                                                        }}
                                                    >
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                                                            <line x1="12" y1="5" x2="12" y2="19"></line>
                                                            <line x1="5" y1="12" x2="19" y2="12"></line>
                                                        </svg>
                                                    </button>
                                                    
                                                    {/* End of Row Button */}
                                                    <button
                                                        id={`main-end-btn-${idx}`}
                                                        type="button"
                                                        className="sof-popup-btn-action sof-popup-btn-end"
                                                        title="Go to Narration (End of Row)"
                                                        onClick={() => {
                                                            const trigger = document.querySelector('textarea[name="narration"]');
                                                            if (trigger) trigger.focus();
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'ArrowRight') {
                                                                e.preventDefault();
                                                                document.getElementById(`main-del-btn-${idx}`)?.focus();
                                                            } else if (e.key === 'ArrowLeft') {
                                                                e.preventDefault();
                                                                document.getElementById(`main-add-btn-${idx}`)?.focus();
                                                            } else if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                const trigger = document.querySelector('textarea[name="narration"]');
                                                                if (trigger) trigger.focus();
                                                            }
                                                        }}
                                                    >
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                                                            <polyline points="20 6 9 17 4 12"></polyline>
                                                        </svg>
                                                        End of Row
                                                    </button>
                                                    
                                                    {/* Remove Row Button */}
                                                    <button
                                                        id={`main-del-btn-${idx}`}
                                                        type="button"
                                                        className="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center"
                                                        style={{ width: '28px', height: '28px', padding: '0', borderRadius: '4px' }}
                                                        title="Remove row"
                                                        onClick={() => handleRemoveItemRow(idx)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'ArrowRight') {
                                                                e.preventDefault();
                                                                document.getElementById(`edit-btn-${idx}`)?.focus();
                                                            } else if (e.key === 'ArrowLeft') {
                                                                e.preventDefault();
                                                                document.getElementById(`main-end-btn-${idx}`)?.focus();
                                                            } else if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleRemoveItemRow(idx);
                                                            }
                                                        }}
                                                    >
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                                                            <polyline points="3 6 5 6 21 6"></polyline>
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                            <line x1="10" y1="11" x2="10" y2="17"></line>
                                                            <line x1="14" y1="11" x2="14" y2="17"></line>
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

                <div className="row">
                    <div className="col-lg-7 mb-4">
                        <div className="sof-section h-100 mb-0" style={{ display: 'flex', flexDirection: 'column' }}>
                            <div className="sof-section-head">
                                <div className="sof-section-icon sof-icon-amber">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                    </svg>
                                </div>
                                <span>Narration & Notes</span>
                                <div className="sof-section-line"></div>
                            </div>
                            <textarea
                                className="sof-input sof-textarea"
                                name="narration"
                                rows="6"
                                style={{ flex: 1 }}
                                placeholder="Enter any notes or remarks here..."
                                value={formData.narration || ''}
                                onChange={handleFormChange}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        if (!e.shiftKey) {
                                            e.preventDefault();
                                            document.getElementById('main-save-btn')?.focus();
                                        }
                                    }
                                }}
                            />
                        </div>
                    </div>

                    <div className="col-lg-5 mb-4">
                        <div className="sof-receipt">
                            <div className="sof-receipt-header">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                                    <line x1="6" y1="5" x2="18" y2="5"></line>
                                    <line x1="6" y1="9" x2="16" y2="9"></line>
                                    <path d="M9 5C15 5 15 13 9 13"></path>
                                    <line x1="9" y1="13" x2="17" y2="20"></line>
                                </svg>
                                Transfer Summary
                            </div>

                            <div className="sof-receipt-body">
                                <div className="sof-receipt-row">
                                    <span className="sof-receipt-key">Subtotal</span>
                                    <span className="sof-receipt-val">{((formData.items || []).reduce((sum, item) => sum + getTotalAmount(item.splits || []), 0)).toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="sof-receipt-total">
                                <span className="sof-total-label">Grand Total</span>
                                <span className="sof-total-value">{((formData.items || []).reduce((sum, item) => sum + getTotalAmount(item.splits || []), 0)).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── FOOTER ACTIONS ─────────────────────────────────────────── */}
                <div className="sof-footer d-flex justify-content-end gap-3 mt-4 mb-5">
                    <button id="main-cancel-btn" type="button" className="btn btn-light px-4 py-2 fw-bold" onClick={onCancel} style={{ borderRadius: '8px' }} onKeyDown={(e) => {
                        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                            e.preventDefault();
                            document.getElementById('main-save-btn')?.focus();
                        }
                    }}>
                        Cancel
                    </button>
                    <button id="main-save-btn" type="submit" className="btn btn-primary px-4 py-2 fw-bold shadow-sm" style={{ borderRadius: '8px', background: 'var(--fd-accent)' }} onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            // Default submit action fires automatically for type="submit", but we ensure it clicks
                            e.currentTarget.click();
                        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                            e.preventDefault();
                            document.getElementById('main-cancel-btn')?.focus();
                        }
                    }}>
                        {isEditing ? 'Update Transfer' : 'Save Transfer'}
                    </button>
                </div>
            </form>

            {/* Popup Modal for Item Splits */}
            {showPopup && currentRowIndex !== null && formData.items[currentRowIndex] && (() => {
                const activeItem = formData.items[currentRowIndex];
                const activeStockItem = activeItem ? stockItems.find(si => si.id === parseInt(activeItem.item)) : null;
                const showBatchCol = productConfig.maintain_batch && activeStockItem?.maintain_batch;
                const showMfgDateCol = productConfig.maintain_manufacture_date && activeStockItem?.maintain_manufacture_date;
                const showExpDateCol = productConfig.maintain_expiry_date && activeStockItem?.maintain_expiry_date;
                return (
                <div className="sof-modal-backdrop" style={{ zIndex: 1060 }} onClick={() => {
                                        setShowPopup(false);
                                        setTimeout(() => {
                                            const btn = document.getElementById(`edit-btn-${currentRowIndex}`);
                                            if (btn) btn.focus();
                                        }, 100);
                                    }}>
                    <div className="sof-modal" style={{ width: '95%', maxWidth: '1200px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="sof-modal-header" style={{ padding: '24px 24px 0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                <div style={{ 
                                    width: '40px', height: '40px', borderRadius: '12px',
                                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
                                }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                                        <polyline points="9 22 9 12 15 12 15 22"/>
                                    </svg>
                                </div>
                                <div>
                                    <h5 style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem', color: '#1e293b' }}>
                                        Batch & Warehouse Details Entry
                                    </h5>
                                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                                        {formData.items[currentRowIndex].item_name || 'Select a Product'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                        setShowPopup(false);
                                        setTimeout(() => {
                                            const btn = document.getElementById(`edit-btn-${currentRowIndex}`);
                                            if (btn) btn.focus();
                                        }, 100);
                                    }}
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
                        
                        <div className="sof-modal-body" style={{ padding: '24px' }} ref={popupContainerRef} onKeyDown={handleKeyDownNavigation}>
                            <style>{`
                                .sof-modal-body .sof-input {
                                    background-color: #ffffff !important;
                                    border: 1px solid #d1d5db !important;
                                    color: #1f2937 !important;
                                    opacity: 1 !important;
                                    border-radius: 4px;
                                    transition: all 0.2s ease-in-out;
                                }
                                .sof-modal-body .sof-input:focus, .sof-modal-body .sof-ss-trigger:focus, .sof-modal-body .sof-input:focus-within {
                                    outline: none !important;
                                    border-color: #3b82f6 !important;
                                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.4) !important;
                                    background-color: #ffffff !important;
                                }
                                .sof-modal-body .sof-input:disabled {
                                    background-color: #f3f4f6 !important;
                                    color: #9ca3af !important;
                                }
                            `}</style>
                            <div className="sof-table-scroll" style={{ marginBottom: '20px' }}>
                                <table className="sof-table">
                                    <thead>
                                        <tr>
                                            {productConfig.maintain_warehouse && <th style={{ minWidth: '150px' }}>Warehouse</th>}
                                            {showBatchCol && <th style={{ minWidth: '120px' }}>Batch</th>}
                                            {showMfgDateCol && <th style={{ minWidth: '130px' }}>Mfg. Date</th>}
                                            {showExpDateCol && <th style={{ minWidth: '130px' }}>Expiry Date</th>}
                                            <th className="sof-th-right" style={{ minWidth: '90px' }}>Qty</th>
                                            <th className="sof-th-right" style={{ minWidth: '110px' }}>Rate</th>
                                            <th className="sof-th-right" style={{ minWidth: '120px' }}>Amount</th>
                                            <th className="sof-th-center" style={{ minWidth: '100px' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {popupData.map((row, idx) => (
                                            <tr key={idx}>
                                                {productConfig.maintain_warehouse && (
                                                    <td>
                                                        <SearchableSelect
                                                            ref={el => {
                                                                if (idx === 0) warehouseDropdownRef.current = el;
                                                                popupWarehouseRefs.current[idx] = el;
                                                            }}
                                                            className="sof-input"
                                                            value={row.source_warehouse}
                                                            autoOpen={!row.source_warehouse}
                                                            autoFocus={true}
                                                            onKeyDown={(e) => handleWarehouseKeyDown(e, idx, popupBatchRefs)}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                if (!val || val === "" || val === "-- Select --") {
                                                                    if (idx === 0) {
                                                                        swal('Warning', 'Please select a Warehouse', 'warning').then(() => {
                                                                            setTimeout(() => {
                                                                                popupWarehouseRefs.current[idx]?.focus();
                                                                            }, 400);
                                                                        });
                                                                        handlePopupChange(idx, 'source_warehouse', '');
                                                                    } else {
                                                                        setPopupData(prev => prev.filter((_, i) => i !== idx));
                                                                        setTimeout(() => {
                                                                            modalSaveBtnRef.current?.focus();
                                                                        }, 20);
                                                                    }
                                                                } else {
                                                                    handlePopupChange(idx, 'source_warehouse', val);
                                                                }
                                                            }}
                                                            options={[
                                                                { value: '', label: '-- Select --' },
                                                                ...warehouses.filter(w => {
                                                                    if (w.id === parseInt(formData.destination_warehouse)) return false;
                                                                    const avail = availableWarehouses.find(aw => aw.id === w.id);
                                                                    return avail && parseFloat(avail.available_quantity) > 0;
                                                                }).map(w => {
                                                                    const avail = availableWarehouses.find(aw => aw.id === w.id);
                                                                    return { value: w.id, label: `${w.name} (${avail.available_quantity})` };
                                                                })
                                                            ]}
                                                            placeholder="— Select —"
                                                            data-ss-trigger
                                                        />
                                                    </td>
                                                )}
                                                {showBatchCol && (
                                                    <td>
                                                        <SearchableSelect
                                                            ref={el => popupBatchRefs.current[idx] = el}
                                                            className="sof-input"
                                                            value={row.batch_number}
                                                            onChange={(e) => handlePopupChange(idx, 'batch_number', e.target.value)}
                                                            disabled={productConfig.maintain_warehouse && !row.source_warehouse}
                                                            options={[
                                                                { value: '', label: '-- Select --' },
                                                                ...availableBatches
                                                                    .filter(b => !productConfig.maintain_warehouse || b.warehouse_id === parseInt(row.source_warehouse))
                                                                    .map(b => ({ value: b.batch_number, label: `${b.batch_number} (${b.available_quantity || 0})` }))
                                                            ]}
                                                            placeholder="— Select —"
                                                            data-ss-trigger
                                                        />
                                                    </td>
                                                )}
                                                {showMfgDateCol && (
                                                    <td>
                                                        <input
                                                            type="text"
                                                            className="sof-input"
                                                            placeholder="DD/MM/YYYY"
                                                            value={formatDateForDisplay(row.manufacture_date) || ''}
                                                            onChange={(e) => handlePopupChange(idx, 'manufacture_date', formatDateMask(e.target.value))}
                                                            onKeyDown={handleKeyDownNavigation}
                                                        />
                                                    </td>
                                                )}
                                                {showExpDateCol && (
                                                    <td>
                                                        <input
                                                            type="text"
                                                            className="sof-input"
                                                            placeholder="DD/MM/YYYY"
                                                            value={formatDateForDisplay(row.expiry_date) || ''}
                                                            onChange={(e) => handlePopupChange(idx, 'expiry_date', formatDateMask(e.target.value))}
                                                            onKeyDown={handleKeyDownNavigation}
                                                        />
                                                    </td>
                                                )}
                                                <td className="sof-td-right">
                                                    <input
                                                        id={`popup-qty-${idx}`}
                                                        type="number"
                                                        className="sof-input sof-input-right"
                                                        value={row.quantity}
                                                        onChange={(e) => handlePopupChange(idx, 'quantity', e.target.value)}
                                                        disabled={(productConfig.maintain_warehouse && !row.source_warehouse) || (showBatchCol && !row.batch_number)}
                                                        placeholder="0.00"
                                                        onKeyDown={handleKeyDownNavigation}
                                                    />
                                                </td>
                                                <td className="sof-td-right">
                                                    <input
                                                        id={`popup-rate-${idx}`}
                                                        type="number"
                                                        className="sof-input sof-input-right"
                                                        value={row.rate}
                                                        onChange={(e) => handlePopupChange(idx, 'rate', e.target.value)}
                                                        placeholder="0.00"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                if (!row.source_warehouse || row.source_warehouse === '' || row.source_warehouse === '-- Select --') {
                                                                    modalSaveBtnRef.current?.focus();
                                                                } else {
                                                                    const plusBtn = document.getElementById(`popup-add-btn-${idx}`);
                                                                    if (plusBtn) plusBtn.focus();
                                                                }
                                                            } else {
                                                                handleKeyDownNavigation(e);
                                                            }
                                                        }}
                                                    />
                                                </td>
                                                <td className="sof-td-right">
                                                    <span style={{ fontWeight: 600, color: '#334155' }}>
                                                        &#8377; {parseFloat(row.amount || 0).toFixed(2)}
                                                    </span>
                                                </td>
                                                <td style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                                                    <div className="d-flex justify-content-center align-items-center gap-2">
                                                        <button
                                                            id={`popup-add-btn-${idx}`}
                                                            type="button"
                                                            className={`sof-popup-btn-action sof-popup-btn-add ${(!row.source_warehouse || row.source_warehouse === "" || row.source_warehouse === "-- Select --") ? 'opacity-50 pointer-events-none' : ''}`}
                                                            title="Add split row"
                                                            disabled={!row.source_warehouse || row.source_warehouse === "" || row.source_warehouse === "-- Select --"}
                                                            onClick={addPopupRow}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'ArrowRight') {
                                                                    e.preventDefault();
                                                                    document.getElementById(`popup-end-btn-${idx}`)?.focus();
                                                                } else if (e.key === 'ArrowLeft') {
                                                                    e.preventDefault();
                                                                    document.getElementById(`popup-del-btn-${idx}`)?.focus();
                                                                } else if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    addPopupRow();
                                                                }
                                                            }}
                                                        >
                                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                                                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                                                <line x1="5" y1="12" x2="19" y2="12"></line>
                                                            </svg>
                                                        </button>
                                                        <button
                                                            id={`popup-end-btn-${idx}`}
                                                            type="button"
                                                            className="sof-popup-btn-action sof-popup-btn-end"
                                                            onClick={() => modalSaveBtnRef.current?.focus()}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'ArrowRight') {
                                                                    e.preventDefault();
                                                                    document.getElementById(`popup-del-btn-${idx}`)?.focus();
                                                                } else if (e.key === 'ArrowLeft') {
                                                                    e.preventDefault();
                                                                    document.getElementById(`popup-add-btn-${idx}`)?.focus();
                                                                } else if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    modalSaveBtnRef.current?.focus();
                                                                }
                                                            }}
                                                        >
                                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                                                                <polyline points="20 6 9 17 4 12"></polyline>
                                                            </svg>
                                                            End of Row
                                                        </button>
                                                        <button
                                                            id={`popup-del-btn-${idx}`}
                                                            type="button"
                                                            className="sof-popup-btn-action sof-popup-btn-delete"
                                                            title="Delete split row"
                                                            onClick={() => removePopupRow(idx)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'ArrowRight') {
                                                                    e.preventDefault();
                                                                    document.getElementById(`popup-add-btn-${idx}`)?.focus();
                                                                } else if (e.key === 'ArrowLeft') {
                                                                    e.preventDefault();
                                                                    document.getElementById(`popup-end-btn-${idx}`)?.focus();
                                                                } else if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    removePopupRow(idx);
                                                                }
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
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                                <span style={{ fontWeight: 600, color: '#64748b' }}>Total Quantity</span>
                                <span style={{ fontWeight: 700, color: '#334155', fontSize: '1.1rem' }}>{getTotalQty(popupData).toFixed(2)}</span>
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button
                                    id="popup-cancel-btn"
                                    type="button"
                                    onClick={() => {
                                        setShowPopup(false);
                                        setTimeout(() => {
                                            const btn = document.getElementById(`edit-btn-${currentRowIndex}`);
                                            if (btn) btn.focus();
                                        }, 100);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'ArrowRight') {
                                            e.preventDefault();
                                            document.getElementById('popup-save-btn')?.focus();
                                        }
                                    }}
                                    style={{
                                        padding: '8px 24px', borderRadius: '8px',
                                        background: '#a855f7', color: 'white',
                                        border: 'none', fontWeight: 600,
                                        cursor: 'pointer', transition: 'all 0.2s',
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    id="popup-save-btn"
                                    ref={modalSaveBtnRef}
                                    type="button"
                                    onClick={savePopup}
                                    onKeyDown={(e) => {
                                        if (e.key === 'ArrowLeft') {
                                            e.preventDefault();
                                            document.getElementById('popup-cancel-btn')?.focus();
                                        }
                                    }}
                                    style={{
                                        padding: '8px 24px', borderRadius: '8px',
                                        background: '#22c55e', color: 'white',
                                        border: 'none', fontWeight: 600,
                                        cursor: 'pointer', transition: 'all 0.2s',
                                    }}
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                );
            })()}
            <style>{`@keyframes sof-spin { to { transform: rotate(360deg); } }`}</style>
            <style>{`@keyframes sof-spin { to { transform: rotate(360deg); } }`}</style>

        </div>
    );
};

export default WarehouseTransferForm;
