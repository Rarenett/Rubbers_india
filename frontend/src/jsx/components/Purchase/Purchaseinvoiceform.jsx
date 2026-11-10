import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import ReactSelectMulti from 'react-select';
import { State } from 'country-state-city';
import PurchaseService from '../../../services/PurchaseService';
import InventoryService from '../../../services/InventoryService';
import { getAccountGroups } from '../../../services/FinanceService';
import LedgerFormModal from '../Finance/LedgerFormModal';
import { useFormConfig } from '../../../hooks/useFormConfig';
import swal from 'sweetalert';
import CompanyDatePicker from '../Common/CompanyDatePicker';

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

/* ── helper: default blank item row ── */
const BLANK_ITEM_ROW = {
    product: '',
    productName: '',
    godown: '',
    godownName: '',
    quantity: '',
    rate: '',
    discount_percent: '',
    discount_amount: '0.00',
    per: '',
    hsn: '',
    gst_percent: '0.00',
    cgst_amount: '0.00',
    sgst_amount: '0.00',
    igst_amount: '0.00',
    amount: '0.00'
};

/* ── helper: check if ledger state is Kerala (KL/32) ── */
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

/* ── helper: create a blank split ── */
const createBlankSplit = (item = {}) => ({
    godown: item.godown !== null && item.godown !== undefined ? String(item.godown) : '',
    godownName: item.godownName || '',
    batch_number: item.batch_number || '',
    manufacture_date: item.manufacture_date || '',
    expiry_date: item.expiry_date || '',
    per: item.per !== null && item.per !== undefined ? String(item.per) : '',
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
            godown: s.godown !== null && s.godown !== undefined ? String(s.godown) : '',
            per: s.per !== null && s.per !== undefined ? String(s.per) : '',
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
        godown: finalSplits[0]?.godown !== undefined && finalSplits[0]?.godown !== null ? String(finalSplits[0].godown) : (item.godown || ''),
        godownName: finalSplits[0]?.godownName || item.godownName || '',
        batch_number: finalSplits[0]?.batch_number || item.batch_number || '',
        manufacture_date: finalSplits[0]?.manufacture_date || item.manufacture_date || '',
        expiry_date: finalSplits[0]?.expiry_date || item.expiry_date || '',
        per: finalSplits[0]?.per !== undefined && finalSplits[0]?.per !== null ? String(finalSplits[0].per) : (item.per || ''),
        perName: finalSplits[0]?.perName || item.perName || '',
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
        // showPicker not supported — browser native click will open it
    }
};

/* ── helper: validate a date field value; returns error string or null ── */
const validateDateValue = (value, label = 'Date') => {
    if (!value) return null; // empty is allowed unless caller checks required
    const parts = value.split('-');
    if (parts.length !== 3) return `${label}: Invalid date format.`;
    const year = parseInt(parts[0], 10);
    if (isNaN(year) || year < 1000 || year > 9999) {
        return `${label}: Please enter a valid 4-digit year (e.g. ${new Date().getFullYear()}).`;
    }
    return null;
};

/* ── helper: validate a date field on Enter, then let focus move to the next field ──
   Arrow keys already move between the day/month/year segments inside the date
   input natively (browser behaviour) — Enter no longer needs to "consume" presses
   to cycle through them. One Enter press either blocks (invalid date) or moves on
   (valid or empty), regardless of how many rows are in the table.
   Returns true if navigation should be blocked (invalid date),
   false if the caller should move to the next focusable field.            ── */
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
            return true; // block navigation until fixed
        }
    }
    return false; // valid or empty — caller should move to next field
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

        e.preventDefault();

        const container = e.currentTarget;
        const focusables = Array.from(
            container.querySelectorAll(
                'input[name="invoice_no"], input:not([readonly]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button[data-ss-trigger]:not([disabled]), .sof-btn-save'
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
                    'input[name="invoice_no"], input:not([readonly]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button[data-ss-trigger]:not([disabled]), .sof-btn-save'
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
    ['voucher_type', 'invoice_no', 'entry_date', 'purchase_ledger'],
    ['supplier_ledger', 'supplier_invoice_no', 'supplier_invoice_date']
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

    if (type === 'date' || type === 'datetime-local') {
        active.removeAttribute('data-picker-just-closed');
        if (active.dataset.pickerOpen === 'true') {
            return;
        }
        // ArrowLeft / ArrowRight: cycle through dd -> mm -> yyyy segments natively.
        // Only leave the field when arrowing past the first or last segment.
        if (isArrowLeft || isArrowRight) {
            const MAX_SEG = 2; // 0=dd, 1=mm, 2=yyyy
            const segIdx = parseInt(active.dataset.arrowSegIdx || '0', 10);

            if (isArrowRight) {
                if (segIdx < MAX_SEG) {
                    // Still inside — let browser move to next segment naturally
                    active.dataset.arrowSegIdx = String(segIdx + 1);
                    return;
                } else {
                    // Past last segment — exit to next field
                    active.removeAttribute('data-arrow-seg-idx');
                    // fall through to field navigation
                }
            } else if (isArrowLeft) {
                if (segIdx > 0) {
                    // Still inside — let browser move to previous segment naturally
                    active.dataset.arrowSegIdx = String(segIdx - 1);
                    return;
                } else {
                    // Past first segment — exit to previous field
                    active.removeAttribute('data-arrow-seg-idx');
                    // fall through to field navigation
                }
            }
        }
        // ArrowUp / ArrowDown: reset segment tracking, fall through to field navigation
        active.removeAttribute('data-arrow-seg-idx');
        active.removeAttribute('data-seg-idx');
    }

    if (tagName === 'textarea') return;

    if (tagName === 'select') {
        if (active.dataset.open === 'true') return;
    }

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

    e.preventDefault();
    const focusables = Array.from(
        container.querySelectorAll(
            'input[name="invoice_no"], input:not([readonly]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button[data-ss-trigger]:not([disabled]), .sof-btn-save'
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

const handleKeyDownNavigation = (e) => {
    if (e.key === 'Enter') {
        handleEnterNavigation(e);
    } else if (e.key.startsWith('Arrow')) {
        handleArrowNavigation(e);
    }
};

/* ══════════════════════════════════════════════════════════
   SEARCHABLE SELECT — combobox style
   ══════════════════════════════════════════════════════════ */
const SearchableSelect = ({
    value, options = [], onChange, placeholder = 'Select...', disabled = false,
    className = '', onKeyDown, onCloseEmpty, autoOpen = true, style = {}, name,
    allowCustom = false, ...dataProps
}) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [highlightIdx, setHighlightIdx] = useState(-1);
    // Suppresses onMouseEnter-driven highlight changes right after the dropdown
    // opens, since the list renders directly under the cursor and the browser
    // fires a "phantom" hover on whatever item lands there — even though the
    // user didn't actually move the mouse. Lifted on the first real mousemove.
    const suppressHoverRef = useRef(false);
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
                const parent = containerRef.current.closest('.sof-input-box') || containerRef.current;
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
        suppressHoverRef.current = true;
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
                            boxShadow: 'none', border: 'none', background: 'transparent',
                            paddingRight: '30px'
                        }}
                    />
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.5, flexShrink: 0 }}>
                        <polyline points="18 15 12 9 6 15"></polyline>
                    </svg>
                    {ReactDOM.createPortal(
                        <div
                            ref={listRef}
                            onMouseMove={() => { suppressHoverRef.current = false; }}
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
                                        onMouseEnter={() => {
                                            // Ignore the "phantom" hover that fires the instant the list
                                            // appears under an already-stationary cursor; only respond
                                            // once the user has actually moved the mouse.
                                            if (suppressHoverRef.current) return;
                                            setHighlightIdx(i);
                                        }}
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

const resolveProductConfig = (prefixId, prefixes, configs) => {
    if (!configs || configs.length === 0) {
        return {
            maintain_batch: false,
            maintain_manufacture_date: false,
            maintain_expiry_date: false,
            maintain_warehouse: false,
            maintain_narration: false
        };
    }
    const currentPrefix = prefixes?.find(p => String(p.id) === String(prefixId));
    let matchedConfig = null;

    if (currentPrefix) {
        if (currentPrefix.voucher_type) {
            matchedConfig = configs.find(c => String(c.voucher_type) === String(currentPrefix.voucher_type));
        }
        if (!matchedConfig && (currentPrefix.voucher_type_name || currentPrefix.subvoucher_type_name)) {
            const nameToMatch = (currentPrefix.voucher_type_name || currentPrefix.subvoucher_type_name || '').toLowerCase().trim();
            matchedConfig = configs.find(c => (c.voucher_type_name || '').toLowerCase().trim() === nameToMatch);
        }
        if (!matchedConfig && (currentPrefix.voucher_type_code || currentPrefix.prefix)) {
            const codeToMatch = (currentPrefix.voucher_type_code || currentPrefix.prefix || '').toLowerCase().trim();
            matchedConfig = configs.find(c => (c.voucher_type_code || '').toLowerCase().trim() === codeToMatch);
        }
    }

    if (!matchedConfig) {
        matchedConfig = configs.find(c =>
            (c.voucher_type_name && (c.voucher_type_name.toLowerCase() === 'purchase' || c.voucher_type_name.toLowerCase().includes('purchase'))) ||
            (c.voucher_type_code && (c.voucher_type_code.toLowerCase() === 'pu' || c.voucher_type_code.toLowerCase() === 'pi'))
        );
    }

    if (matchedConfig) {
        return {
            maintain_batch: !!matchedConfig.maintain_batch,
            maintain_manufacture_date: !!matchedConfig.maintain_manufacture_date,
            maintain_expiry_date: !!matchedConfig.maintain_expiry_date,
            maintain_warehouse: !!matchedConfig.maintain_warehouse,
            maintain_narration: !!matchedConfig.maintain_narration
        };
    }

    return {
        maintain_batch: false,
        maintain_manufacture_date: false,
        maintain_expiry_date: false,
        maintain_warehouse: false,
        maintain_narration: false
    };
};

const getRowFieldVisibility = (selectedStockItem, productConfig) => {
    const {
        maintain_warehouse: configWarehouse,
        maintain_batch: configBatch,
        maintain_manufacture_date: configMfg,
        maintain_expiry_date: configExp,
        maintain_row_narration: configRowNarration,
        maintain_narration: configNarration,
    } = productConfig || {};

    const configNarrationFinal = configRowNarration ?? configNarration ?? false;

    const itemBatchAllowed = !!selectedStockItem?.maintain_batch;
    const itemMfgAllowed = !!selectedStockItem?.maintain_manufacture_date;
    const itemExpAllowed = !!selectedStockItem?.maintain_expiry_date;

    return {
        maintain_warehouse: !!configWarehouse,
        maintain_batch: !!(configBatch && itemBatchAllowed),
        maintain_manufacture_date: !!(configMfg && itemMfgAllowed),
        maintain_expiry_date: !!(configExp && itemExpAllowed),
        maintain_row_narration: !!configNarrationFinal,
    };
};

/* ══════════════════════════════════════════════════════════
   ITEM ENTRY POPUP
   ══════════════════════════════════════════════════════════ */
const ItemEntryPopup = ({ item, isInterState, godowns, stockItems, units, onSave, onClose, isEdit, productConfig }) => {
    const selectedStockItem = stockItems?.find(p => String(p.id) === String(item.product));
    const {
        maintain_warehouse,
        maintain_batch,
        maintain_manufacture_date,
        maintain_expiry_date,
        maintain_row_narration,
    } = getRowFieldVisibility(selectedStockItem, productConfig);
    const saveBtnRef = useRef(null);
    const [batches, setBatches] = useState([]);

    useEffect(() => {
        if (item && item.product && maintain_batch) {
            PurchaseService.getProductBatches(item.product)
                .then(res => {
                    if (res.data) {
                        setBatches(res.data);
                    }
                })
                .catch(err => {
                    console.error("Error fetching batches:", err);
                });
        }
    }, [item, maintain_batch]);

    const [godownStock, setGodownStock] = useState([]);
    useEffect(() => {
        if (item && item.product && maintain_warehouse) {
            InventoryService.getItemAllWarehouses(item.product)
                .then(res => {
                    if (res.data) {
                        setGodownStock(res.data);
                    }
                })
                .catch(err => {
                    console.error("Error fetching godown stock:", err);
                });
        }
    }, [item, maintain_warehouse]);

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
        }, 120);
        return () => clearTimeout(t);
    }, []);

    let dynamicMaxWidth = 670;
    dynamicMaxWidth += 140; // Per (units) column — always shown
    if (maintain_warehouse) dynamicMaxWidth += 280;
    if (maintain_batch) dynamicMaxWidth += 140;
    if (maintain_manufacture_date) dynamicMaxWidth += 150;
    if (maintain_expiry_date) dynamicMaxWidth += 150;

    const [splits, setSplits] = useState(() => {
        if (item.splits && item.splits.length > 0) {
            return item.splits.map(s => ({
                ...s,
                godown: s.godown !== null && s.godown !== undefined ? String(s.godown) : '',
                per: s.per !== null && s.per !== undefined ? String(s.per) : '',
                quantity: cleanZeroValue(s.quantity),
                rate: cleanZeroValue(s.rate),
                discount_percent: cleanZeroValue(s.discount_percent)
            }));
        }
        return [{
            godown: item.godown !== null && item.godown !== undefined ? String(item.godown) : '',
            godownName: item.godownName || '',
            batch_number: item.batch_number || '',
            manufacture_date: item.manufacture_date || '',
            expiry_date: item.expiry_date || '',
            per: item.per !== null && item.per !== undefined ? String(item.per) : '',
            perName: item.perName || '',
            quantity: cleanZeroValue(item.quantity),
            rate: cleanZeroValue(item.rate),
            discount_percent: cleanZeroValue(item.discount_percent),
            discount_amount: item.discount_amount || '0.00',
            amount: item.amount || '0.00'
        }];
    });

    const addSplitRow = () => {
        setSplits(prev => {
            const firstRow = prev[0] || {};
            const currentRate = firstRow.rate || item.rate || '';
            const currentDisc = firstRow.discount_percent || item.discount_percent || '';
            return [
                ...prev,
                {
                    godown: '',
                    godownName: '',
                    batch_number: '',
                    manufacture_date: '',
                    expiry_date: '',
                    per: firstRow.per || '',
                    perName: firstRow.perName || '',
                    quantity: '',
                    rate: currentRate,
                    discount_percent: currentDisc,
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
        } else {
            setSplits(prev => prev.filter((_, i) => i !== idx));
        }
    };

    const getFirstFieldName = () => {
        if (maintain_warehouse) return 'godown';
        if (maintain_batch) return 'batch_number';
        if (maintain_manufacture_date) return 'manufacture_date';
        if (maintain_expiry_date) return 'expiry_date';
        return 'quantity';
    };

    const isFirstCellEmpty = (row) => {
        if (!row) return true;
        if (maintain_warehouse) return !row.godown || String(row.godown).trim() === '';
        if (maintain_batch) return !row.batch_number || String(row.batch_number).trim() === '';
        if (maintain_manufacture_date) return !row.manufacture_date || String(row.manufacture_date).trim() === '';
        if (maintain_expiry_date) return !row.expiry_date || String(row.expiry_date).trim() === '';
        return !row.quantity || parseFloat(row.quantity) === 0 || String(row.quantity).trim() === '';
    };

    const handleCellFocus = (idx, colIdx) => {
        if (colIdx > 0 && isFirstCellEmpty(splits[idx])) {
            if (splits.length > 1) {
                deleteSplitRow(idx);
            }
        }
    };

    const handleSplitChange = (idx, field, value, perColIdx) => {
        if (field !== getFirstFieldName() && isFirstCellEmpty(splits[idx])) {
            if (splits.length > 1) {
                deleteSplitRow(idx);
                return;
            }
        }

        // ── Unit mismatch: block if other rows have a different unit ──
        if (field === 'per' && splits.length > 1) {
            const otherRow = splits.find((s, i) => i !== idx && s.per);
            if (otherRow && value && String(otherRow.per) !== String(value)) {
                const newUnitName = units.find(u => String(u.id) === String(value))?.name || value;
                const existingUnitName = units.find(u => String(u.id) === String(otherRow.per))?.name || otherRow.per;
                // Revert this row's per back to the existing valid unit immediately
                setSplits(prev => prev.map((s, i) => {
                    if (i !== idx) return s;
                    const revertedPer = otherRow.per;
                    const found = units.find(u => String(u.id) === String(revertedPer));
                    return { ...s, per: revertedPer, perName: found ? found.name : '' };
                }));
                // Delay swal so the SearchableSelect dropdown finishes closing first
                setTimeout(() => {
                    swal({ title: 'Unit Mismatch', text: `All rows must use the same unit. Other rows use "${existingUnitName}". You selected "${newUnitName}".`, icon: 'warning', button: { text: 'OK', closeModal: true }, closeOnClickOutside: false, closeOnEsc: false }).then(() => {
                        setTimeout(() => {
                            const container = document.querySelector(`[data-prow="${idx}"][data-pcol="${perColIdx}"]`);
                            const trigger = container?.querySelector('[data-ss-trigger]');
                            if (trigger) {
                                trigger.focus();
                                trigger.dataset.swalRestored = 'true';
                                setTimeout(() => { delete trigger.dataset.swalRestored; }, 300);
                            }
                        }, 150);
                    });
                }, 50);
                return; // Stop — do not apply the mismatched value to state
            }
        }

        setSplits(prev => {
            return prev.map((s, i) => {
                if (i !== idx) return s;
                const newSplit = { ...s, [field]: value };
                if (field === 'per') {
                    const found = units.find(u => String(u.id) === String(value));
                    newSplit.perName = found ? found.name : '';
                }
                if (field === 'godown') {
                    const found = godowns.find(w => String(w.id) === String(value));
                    newSplit.godownName = found ? found.name : '';
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
        if (item.gstResolving) {
            swal('Please wait', 'Still resolving the GST rate for this item — try again in a moment.', 'info');
            return;
        }

        // ── Unit consistency check: all rows must have the same unit (Per) ──
        const splitUnits = splits.map(s => s.per || '');
        const firstUnit = splitUnits[0];
        const allSameUnit = splitUnits.every(u => u === firstUnit);
        if (!allSameUnit) {
            const unitNames = splits.map((s, i) => `Row ${i + 1}: ${s.perName || 'Not selected'}`).join(', ');
            swal('Unit Mismatch', `All rows must have the same unit. ${unitNames}`, 'warning');
            return;
        }

        for (let i = 0; i < splits.length; i++) {
            const s = splits[i];
            if (maintain_warehouse && !s.godown) {
                swal('Required', `Please select a godown for row ${i + 1}.`, 'warning');
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
            if (s.manufacture_date) {
                const err = validateDateValue(s.manufacture_date, `Manufacture Date (row ${i + 1})`);
                if (err) { swal('Invalid Date', err, 'warning'); return; }
            }
            if (s.expiry_date) {
                const err = validateDateValue(s.expiry_date, `Expiry Date (row ${i + 1})`);
                if (err) { swal('Invalid Date', err, 'warning'); return; }
            }
            if (s.manufacture_date && s.expiry_date && s.expiry_date < s.manufacture_date) {
                swal('Invalid Date', `Expiry Date must be after Manufacture Date on row ${i + 1}.`, 'warning');
                return;
            }
        }

        const consolidatedItem = consolidateSplits({ ...item, splits }, isInterState);
        onSave(consolidatedItem);
    };

    const fmtAmt = n => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
            // For SearchableSelect: the container is a <td> wrapping a div;
            // focus its trigger button (closed) or search input (open).
            const ssTrigger = container.querySelector('[data-ss-trigger]');
            if (ssTrigger) return ssTrigger;
            // For plain inputs/selects/buttons, the container itself may be
            // the focusable element (action buttons), or it wraps one.
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
                // automatically appends a new split row and focuses its Godown select.
                if (colIdx === totalCols - 2) {
                    addSplitRow();
                    setTimeout(() => {
                        const el = getPopupInputElement(rowIdx + 1, 0);
                        if (el) el.focus();
                    }, 80);
                }
            }
        } else if (key === 'ArrowLeft') {
            // type="date" inputs return null for selectionStart/End — browser handles
            // Left/Right natively to move between dd/mm/yyyy segments; never column-navigate.
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
            // type="date" inputs return null for selectionStart/End — browser handles
            // Left/Right natively to move between dd/mm/yyyy segments; never column-navigate.
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
                // Validate the date once; if invalid, block navigation and warn.
                // If valid (or empty), fall through immediately to move to the next field.
                e.preventDefault();
                const blocked = advanceDateSegment(active, e);
                if (blocked) return;
                // Fall through to column navigation below
            }

            // ── First column vacant check on navigation (Enter / Tab / ArrowRight) ─
            if (colIdx === 0 && isFirstCellEmpty(splits[rowIdx])) {
                e.preventDefault();
                if (splits.length === 1) {
                    swal('Required', 'At least one row with valid first column data is required.', 'warning').then(() => {
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
                // Pressing Enter on the "End of Row" button stops adding rows, validates and saves
                handleSave();
            } else if (colIdx === totalCols - 1) {
                // Pressing Enter on the Delete button
                deleteSplitRow(rowIdx);

                setTimeout(() => {
                    if (saveBtnRef.current) {
                        saveBtnRef.current.focus();
                    }
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
        }
    };

    return (
        <div className="sof-modal-backdrop">
            <div className="sof-modal" style={{ maxWidth: `${dynamicMaxWidth}px`, width: '95%' }}>

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
                                Item Allocation details
                            </h5>
                            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', fontWeight: '500' }}>
                                Product: {item.productName || '—'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="sof-modal-close"
                        onClick={onClose}
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
                        <table className="sof-table">
                            <thead>
                                <tr>
                                    {maintain_warehouse && <th style={{ minWidth: '250px' }}>Godown</th>}
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
                                                        value={s.godown || ''}
                                                        options={[{ value: '', label: 'Select Godown...' }, ...godowns.map(w => {
                                                            const stockData = godownStock.find(g => String(g.id) === String(w.id));
                                                            const qty = stockData ? stockData.available_quantity : 0;
                                                            return { value: String(w.id), label: `${w.name} - Qty: ${qty}` };
                                                        })]}
                                                        onChange={e => handleSplitChange(idx, 'godown', e.target.value)}
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
                                                        placeholder="Select Godown..."
                                                    />
                                                </td>
                                            )}

                                            {maintain_batch && (
                                                <td style={{ verticalAlign: 'middle' }} data-prow={idx} data-pcol={batchCol}>
                                                    <input
                                                        type="text"
                                                        className="sof-table-input"
                                                        value={s.batch_number || ''}
                                                        onChange={e => handleSplitChange(idx, 'batch_number', e.target.value)}
                                                        onKeyDown={e => handlePopupKeyDown(e, idx, batchCol, totalCols)}
                                                    // placeholder="Enter Batch No."
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
                                                        onChange={e => {
                                                            e.target.removeAttribute('data-seg-idx');
                                                            handleSplitChange(idx, 'manufacture_date', e.target.value);
                                                        }}
                                                        onBlur={e => e.target.removeAttribute('data-seg-idx')}
                                                        onFocus={e => e.target.removeAttribute('data-seg-idx')}
                                                        onClick={openDatePickerOnClick}
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
                                                        onChange={e => {
                                                            e.target.removeAttribute('data-seg-idx');
                                                            handleSplitChange(idx, 'expiry_date', e.target.value);
                                                        }}
                                                        onBlur={e => e.target.removeAttribute('data-seg-idx')}
                                                        onFocus={e => e.target.removeAttribute('data-seg-idx')}
                                                        onClick={openDatePickerOnClick}
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
                                                    onFocus={() => handleCellFocus(idx, qtyCol)}
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
                                                    onFocus={() => handleCellFocus(idx, rateCol)}
                                                    onKeyDown={e => handlePopupKeyDown(e, idx, rateCol, totalCols)}
                                                />
                                            </td>

                                            <td style={{ verticalAlign: 'middle' }} data-prow={idx} data-pcol={perCol}>
                                                <input
                                                    type="text"
                                                    className="sof-table-input sof-table-input-ro"
                                                    readOnly
                                                    value={units.find(u => String(u.id) === String(s.per))?.name || s.per || ''}
                                                    onKeyDown={e => handlePopupKeyDown(e, idx, perCol, totalCols)}
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

                                            <td style={{ verticalAlign: 'middle', textAlign: 'right', fontWeight: '600', color: '#1e293b' }}>
                                                {fmtAmt(parseFloat(s.amount) || 0)}
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
                                                        disabled={item.gstResolving}
                                                        title={item.gstResolving ? 'Resolving GST rate…' : undefined}
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

                <div className="sof-modal-net" style={{ borderRadius: 0, borderLeft: 'none', borderRight: 'none', margin: 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Consolidated Qty</span>
                        <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#312e81' }}>{getConsolidatedQty().toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }}>
                        <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Consolidated Net Amt</span>
                        <span style={{ fontSize: '0.98rem', fontWeight: 800, color: '#312e81' }}>{fmtAmt(getConsolidatedAmount())}</span>
                    </div>
                </div>

                <div className="sof-modal-footer">
                    <div className="d-flex justify-content-between align-items-center w-100">
                        {item.gstResolving ? (
                            <span style={{ fontSize: '0.78rem', color: '#0d9488', fontWeight: 600 }}>
                                Resolving GST rate…
                            </span>
                        ) : <span />}
                        <div className="d-flex gap-2">
                            <button type="button" className="btn btn-secondary" style={{ padding: '6px 20px' }} onClick={onClose}>Cancel</button>
                            <button
                                ref={saveBtnRef}
                                type="button"
                                className="btn btn-primary"
                                style={{ padding: '6px 20px' }}
                                onClick={handleSave}
                                disabled={item.gstResolving}
                                title={item.gstResolving ? 'Resolving GST rate…' : undefined}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════
   ITEM VIEW POPUP
   ══════════════════════════════════════════════════════════ */
const ItemViewPopup = ({ item, isInterState, onClose, productConfig, stockItems }) => {
    const selectedStockItem = stockItems?.find(p => String(p.id) === String(item.product));
    const {
        maintain_warehouse,
        maintain_batch,
        maintain_manufacture_date,
        maintain_expiry_date,
        maintain_row_narration,
    } = getRowFieldVisibility(selectedStockItem, productConfig);

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
                            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
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
                                    {maintain_warehouse && <th style={{ minWidth: '150px' }}>Godown</th>}
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
                                        {maintain_warehouse && <td>{s.godownName || '—'}</td>}
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
   MAIN PURCHASE ORDER FORM COMPONENT
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

const PurchaseInvoiceForm = ({ formData = {}, setFormData, onSave, onCancel, isEditing, isSubmitting = false }) => {
    const [ledgers, setLedgers] = useState([]);
    const [accountGroups, setAccountGroups] = useState([]);
    const { isFieldVisible } = useFormConfig('purchase_app_purchaseinvoice', 'PurchaseInvoiceForm');
    const validSupplierGroupIds = React.useMemo(() => getDebtorCreditorGroupIds(accountGroups), [accountGroups]);
    const [showLedgerModal, setShowLedgerModal] = useState(false);
    const [stockItems, setStockItems] = useState([]);
    const [godowns, setGodowns] = useState([]);
    const [units, setUnits] = useState([]);
    const [allProductConfigs, setAllProductConfigs] = useState([]);
    const [productConfig, setProductConfig] = useState({
        maintain_batch: false,
        maintain_manufacture_date: false,
        maintain_expiry_date: false,
        maintain_warehouse: false,
        maintain_narration: false
    });
    const [loadingOptions, setLoadingOptions] = useState(true);
    const [prefixConfigs, setPrefixConfigs] = useState([]);
    // Tracks which Invoice Category the in-flight "next voucher number" fetch
    // was requested for, so a stale response can't overwrite a number that
    // belongs to whatever category is now selected (see handlePrefixChange).
    const voucherFetchTokenRef = useRef(null);
    const [itemPopup, setItemPopup] = useState(null);
    const [viewPopup, setViewPopup] = useState(null);
    const [supplierPurchaseOrders, setSupplierPurchaseOrders] = useState([]);
    const [selectedPOs, setSelectedPOs] = useState([]);

    useEffect(() => {
        setSelectedPOs([]);
        if (formData.supplier_ledger) {
            PurchaseService.getPurchaseOrdersBySupplier(formData.supplier_ledger)
                .then(res => {
                    const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
                    setSupplierPurchaseOrders(data);
                })
                .catch(err => {
                    console.error('Failed to fetch supplier purchase orders:', err);
                    setSupplierPurchaseOrders([]);
                });
        } else {
            setSupplierPurchaseOrders([]);
        }
    }, [formData.supplier_ledger]);

    const handlePOSelect = (selectedOptions) => {
        const opts = selectedOptions || [];
        setSelectedPOs(opts);

        // When all POs are removed → clear the items table to a single blank row
        if (opts.length === 0) {
            recalculateForm({
                ...formData,
                items: [BLANK_ITEM_ROW],
                purchase_order: null
            });
            return;
        }

        const isInterState = formData.gst_type === 'INTER_STATE';

        const rawItems = opts.flatMap(opt => {
            const po = supplierPurchaseOrders.find(p => String(p.id) === String(opt.value));
            if (!po || !Array.isArray(po.items) || po.items.length === 0) return [];
            return po.items;
        });

        if (rawItems.length === 0) return;

        // Group PO items by product ID so multi-warehouse allocations consolidate into 1 item row with splits
        const groupedMap = new Map();

        rawItems.forEach(item => {
            const productId = String(item.product || '');
            if (!productId) return;

            const effectiveQty = (item.remaining_quantity !== undefined && item.remaining_quantity !== null)
                ? parseFloat(item.remaining_quantity)
                : parseFloat(item.quantity || 0);

            if (isNaN(effectiveQty) || effectiveQty <= 0) return;

            const godownId = item.warehouse || item.godown || '';
            const godownName = item.warehouse_name || item.godownName || (godowns.find(g => String(g.id) === String(godownId))?.name || '');
            const perId = item.per || '';
            const perName = item.per_name || item.perName || (units.find(u => String(u.id) === String(perId))?.name || '');

            const splitObj = {
                godown: godownId,
                godownName: godownName,
                batch_number: item.batch_number || '',
                manufacture_date: item.manufacture_date || '',
                expiry_date: item.expiry_date || '',
                per: perId,
                perName: perName,
                quantity: String(effectiveQty),
                rate: String(item.rate || '0.00'),
                discount_percent: String(item.discount_percent || '0.00'),
                discount_amount: String(item.discount_amount || '0.00'),
                amount: String(item.net_amount || item.amount || '0.00'),
                po_item: item.id || null,
                purchase_order: item.purchase_order || null
            };

            if (groupedMap.has(productId)) {
                const existing = groupedMap.get(productId);
                existing.splits.push(splitObj);
            } else {
                const productName = item.product_name || (stockItems.find(s => String(s.id) === productId)?.name || '');
                const newItem = {
                    product: item.product,
                    productName: productName,
                    godown: godownId,
                    godownName: godownName,
                    quantity: String(effectiveQty),
                    rate: String(item.rate || '0.00'),
                    discount_percent: String(item.discount_percent || '0.00'),
                    discount_amount: String(item.discount_amount || '0.00'),
                    per: perId,
                    hsn: item.hsn || '',
                    gst_percent: String(item.gst_percent || '0.00'),
                    cgst_amount: String(item.cgst_amount || '0.00'),
                    sgst_amount: String(item.sgst_amount || '0.00'),
                    igst_amount: String(item.igst_amount || '0.00'),
                    amount: String(item.net_amount || item.amount || '0.00'),
                    po_item: item.id || null,
                    purchase_order: item.purchase_order || null,
                    splits: [splitObj]
                };
                groupedMap.set(productId, newItem);
            }
        });

        const allItems = [];
        groupedMap.forEach(item => {
            allItems.push(consolidateSplits(item, isInterState));
        });

        if (allItems.length === 0) return;

        const firstPoId = opts.length > 0 ? opts[0].value : null;
        recalculateForm({ ...formData, items: allItems, purchase_order: firstPoId });
    };

    const supplierOptions = React.useMemo(() => {
        const prefix = prefixConfigs.find(p => String(p.id) === String(formData.voucher_type));
        const categoryName = (
            prefix
                ? (prefix.subvoucher_type_name || prefix.sub_type || prefix.prefix || '')
                : (formData.category || formData.invoice_category || '')
        ).toString().trim().toLowerCase();

        const matchesInvoiceCategory = (ledger) => {
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
            const isGroupValid = validSupplierGroupIds.size === 0 || validSupplierGroupIds.has(ledger.accountGroup);
            return isGroupValid && matchesInvoiceCategory(ledger);
        });

        const finalLedgers = filteredLedgers.length > 0 ? filteredLedgers : ledgers.filter(ledger =>
            validSupplierGroupIds.size === 0 || validSupplierGroupIds.has(ledger.accountGroup)
        );

        const displayLedgers = finalLedgers.length > 0 ? finalLedgers : ledgers;

        return [
            { value: '', label: 'Select Supplier...' },
            ...displayLedgers.map((ledger) => ({ value: String(ledger.id), label: ledger.name }))
        ];
    }, [ledgers, validSupplierGroupIds, formData.supplier_ledger, formData.voucher_type, formData.category, formData.invoice_category, prefixConfigs]);

    useEffect(() => {
        const fetchOptions = async () => {
            try {
                const [ledgersRes, itemsRes, godownsRes, unitsRes, configsRes, prefixRes, accountGroupsRes] = await Promise.all([
                    PurchaseService.getLedgers(),
                    PurchaseService.getStockItems(),
                    PurchaseService.getGodowns(),
                    PurchaseService.getUnits(),
                    InventoryService.getProductConfigurations(),
                    import('../../../services/PrefixService').then(m => m.fetchPrefixConfigurations()),
                    getAccountGroups()
                ]);
                setLedgers(Array.isArray(ledgersRes.data) ? ledgersRes.data : []);
                setAccountGroups(Array.isArray(accountGroupsRes) ? accountGroupsRes : (Array.isArray(accountGroupsRes?.results) ? accountGroupsRes.results : []));
                setStockItems(Array.isArray(itemsRes.data) ? itemsRes.data : []);
                setGodowns(Array.isArray(godownsRes.data) ? godownsRes.data : []);
                setUnits(Array.isArray(unitsRes.data) ? unitsRes.data : []);

                const prefixes = Array.isArray(prefixRes.data) ? prefixRes.data : (Array.isArray(prefixRes.data?.results) ? prefixRes.data.results : []);
                const piPrefixes = prefixes.filter(p => p.voucher_type_name?.toLowerCase() === 'purchase');
                setPrefixConfigs(piPrefixes);

                const configs = Array.isArray(configsRes.data) ? configsRes.data : [];
                setAllProductConfigs(configs);

                const initialPrefixId = formData.voucher_type || (piPrefixes.length > 0 ? piPrefixes[0].id : null);
                const resolvedConfig = resolveProductConfig(initialPrefixId, piPrefixes, configs);
                setProductConfig(resolvedConfig);

                // If new invoice, apply default prefix logic
                if (!isEditing && !formData.voucher_type && piPrefixes.length > 0) {
                    const defaultPrefix = piPrefixes[0];
                    let gstType = 'STATE';
                    let subName = '';
                    if (defaultPrefix.sub_type) {
                        subName = defaultPrefix.sub_type.toLowerCase();
                    } else if (defaultPrefix.subvoucher_type_name) {
                        subName = defaultPrefix.subvoucher_type_name.toLowerCase();
                    }
                    if (subName.includes('inter') || subName.includes('igst')) {
                        gstType = 'INTER_STATE';
                    }

                    let gst1 = '';
                    let gst2 = '';
                    let amt2 = formData.gst_amount_2 || '0.00';
                    const ledgersList = Array.isArray(ledgersRes.data) ? ledgersRes.data : [];

                    if (defaultPrefix.gst_ledger && defaultPrefix.gst_ledger.length > 0) {
                        gst1 = defaultPrefix.gst_ledger[0] || '';
                        gst2 = defaultPrefix.gst_ledger[1] || '';
                        if (!gst2) amt2 = '0.00';
                    } else {
                        // No GST ledger configured for this voucher type in Voucher Configuration —
                        // leave blank instead of guessing a ledger by name. The user must select
                        // one manually, and save-time validation will enforce it.
                        gst1 = '';
                        gst2 = '';
                        amt2 = '0.00';
                    }

                    setFormData(prev => ({
                        ...prev,
                        voucher_type: defaultPrefix.id,
                        gst_type: gstType,
                        purchase_ledger: defaultPrefix.ledger || '',
                        gst_ledger_1: gst1,
                        gst_ledger_2: gst2,
                        gst_amount_2: amt2,
                        has_two_gst_ledgers: !!gst2
                    }));
                }

                if (!isEditing && !formData.invoice_no) {
                    if (piPrefixes.length > 0) {
                        try {
                            const defaultPrefixId = piPrefixes[0].id;
                            const nextRes = await PurchaseService.getPurchaseInvoiceNextNo(defaultPrefixId);
                            setFormData(prev => ({
                                ...prev,
                                invoice_no: nextRes.data.next_invoice_no
                            }));
                        } catch (err) {
                            console.error('Failed to fetch next Purchase Invoice number:', err);
                        }
                    } else {
                        try {
                            const invoicesRes = await PurchaseService.getPurchaseInvoiceNextNo();
                            setFormData(prev => ({
                                ...prev,
                                invoice_no: invoicesRes.data.next_invoice_no
                            }));
                        } catch (err) {
                            console.error('Failed to fetch next Purchase Invoice number:', err);
                        }
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
        if (allProductConfigs.length > 0) {
            const resolved = resolveProductConfig(formData.voucher_type, prefixConfigs, allProductConfigs);
            setProductConfig(resolved);
        }
    }, [formData.voucher_type, prefixConfigs, allProductConfigs]);

    useEffect(() => {
        if (!isEditing && ledgers.length > 0 && (!formData.items || formData.items.length === 0)) {
            setFormData(prev => ({
                gst_type: 'STATE',
                entry_date: new Date().toISOString().split('T')[0],
                gst_ledger_1: '',
                gst_ledger_2: '',
                gst_amount_1: '0.00',
                gst_amount_2: '0.00',
                total_amount: '0.00',
                is_posted: false,
                items: [{
                    product: '',
                    productName: '',
                    godown: '',
                    godownName: '',
                    quantity: '',
                    rate: '',
                    discount_percent: '',
                    discount_amount: '0.00',
                    gst_percent: '0.00',
                    cgst_amount: '0.00',
                    sgst_amount: '0.00',
                    igst_amount: '0.00',
                    amount: '0.00'
                }],
                ...prev
            }));
        }
    }, [isEditing, ledgers, setFormData, formData.items]);

    // ── Auto-focus first field when form finishes loading ────────────────
    useEffect(() => {
        if (!loadingOptions) {
            // Small delay so React has finished rendering the field
            setTimeout(() => {
                const invoiceCategoryInput = document.querySelector('button[name="voucher_type"]');
                if (invoiceCategoryInput) invoiceCategoryInput.focus();
            }, 100);
        }
    }, [loadingOptions]);

    const getRecalculatedFormState = (state) => {
        const isInterState = state.gst_type === 'INTER_STATE';
        const activePrefix = prefixConfigs.find(p => String(p.id) === String(state.voucher_type));
        const hasGstLedgerConfigured = !!(activePrefix && activePrefix.gst_ledger && activePrefix.gst_ledger.filter(Boolean).length > 0);
        let totalBase = 0, totalCGST = 0, totalSGST = 0, totalIGST = 0;
        const recalculatedItems = (state.items || []).map(item => {
            if (item.splits && item.splits.length > 0) {
                const consolidated = consolidateSplits(item, isInterState);
                const net = parseFloat(consolidated.amount) || 0;
                const cgst = hasGstLedgerConfigured ? (parseFloat(consolidated.cgst_amount) || 0) : 0;
                const sgst = hasGstLedgerConfigured ? (parseFloat(consolidated.sgst_amount) || 0) : 0;
                const igst = hasGstLedgerConfigured ? (parseFloat(consolidated.igst_amount) || 0) : 0;

                totalBase += net;
                totalCGST += cgst;
                totalSGST += sgst;
                totalIGST += igst;

                return consolidated;
            } else {
                const qty = parseFloat(item.quantity) || 0;
                const rate = parseFloat(item.rate) || 0;
                const disPct = parseFloat(item.discount_percent) || 0;
                const gstPct = hasGstLedgerConfigured ? (parseFloat(item.gst_percent) || 0) : 0;
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
        const extraChargesTotal = (state.extra_charges || [])
            .reduce((sum, ec) => sum + (parseFloat(ec.amount) || 0), 0);
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
        setFormData(getRecalculatedFormState(state));
    };

    const handleGstAmountChange = (field, value) => {
        setFormData(prev => {
            const updated = { ...prev, [field]: value };
            const subtotal = (prev.items || []).reduce(
                (sum, item) => sum + (parseFloat(item.amount) || 0), 0
            );
            const t1 = parseFloat(field === 'gst_amount_1' ? value : prev.gst_amount_1) || 0;
            const t2 = parseFloat(field === 'gst_amount_2' ? value : prev.gst_amount_2) || 0;
            const extraChargesTotal = (prev.extra_charges || []).reduce(
                (sum, ec) => sum + (parseFloat(ec.amount) || 0), 0
            );
            updated.total_amount = (subtotal + t1 + t2 + extraChargesTotal).toFixed(2);
            return updated;
        });
    };

    // ── Extra Charge handlers ──────────────────────────────────────────
    const addExtraCharge = () => {
        const updated = {
            ...formData,
            extra_charges: [
                ...(formData.extra_charges || []),
                { ledger: '', ledgerName: '', amount: '' }
            ]
        };
        recalculateForm(updated);
    };

    const handleExtraChargeChange = (idx, field, value) => {
        const charges = [...(formData.extra_charges || [])];
        charges[idx] = { ...charges[idx], [field]: value };
        recalculateForm({ ...formData, extra_charges: charges });
    };

    const removeExtraCharge = (idx) => {
        const charges = (formData.extra_charges || []).filter((_, i) => i !== idx);
        recalculateForm({ ...formData, extra_charges: charges });
    };
    // ─────────────────────────────────────────────────────────────────

    const handlePrefixChange = async (value) => {
        let updated = { ...formData, voucher_type: value };

        // Reset PO selections when Invoice Category changes
        setSelectedPOs([]);
        setSupplierPurchaseOrders([]);
        if (selectedPOs.length > 0) {
            updated.items = [BLANK_ITEM_ROW];
        }

        const prefix = prefixConfigs.find(p => p.id === parseInt(value) || p.id === value);
        let gstType = 'STATE';
        let subName = '';
        if (prefix) {
            if (prefix.sub_type) {
                subName = prefix.sub_type.toLowerCase();
            } else if (prefix.subvoucher_type_name) {
                subName = prefix.subvoucher_type_name.toLowerCase();
            }
        }
        if (subName.includes('inter') || subName.includes('igst')) {
            gstType = 'INTER_STATE';
        }

        // Validate current supplier ledger against the new category
        if (updated.supplier_ledger) {
            const currentLedger = ledgers.find(l => String(l.id) === String(updated.supplier_ledger));
            if (currentLedger) {
                const categoryName = subName.trim().toLowerCase();
                const isKerala = isKeralaLedger(currentLedger);
                const hasGst = String(currentLedger.gst_number || '').trim() !== '';

                let validForCategory = true;
                if (categoryName.includes('b2b') && (!isKerala || !hasGst)) {
                    validForCategory = false;
                } else if (categoryName.includes('b2c') && (!isKerala || hasGst)) {
                    validForCategory = false;
                } else if ((categoryName.includes('igst') || categoryName.includes('inter')) && isKerala) {
                    validForCategory = false;
                }

                if (!validForCategory) {
                    updated.supplier_ledger = '';
                }
            }
        }

        updated.gst_type = gstType;
        if (prefix && prefix.ledger) {
            updated.purchase_ledger = prefix.ledger;
        }

        let gst1 = '';
        let gst2 = '';
        let amt2 = formData.gst_amount_2 || '0.00';

        if (prefix && prefix.gst_ledger && prefix.gst_ledger.length > 0) {
            gst1 = prefix.gst_ledger[0] || '';
            gst2 = prefix.gst_ledger[1] || '';
            if (!gst2) amt2 = '0.00';
        } else {
            // No GST ledger configured for this voucher type in Voucher Configuration —
            // leave blank instead of guessing a ledger by name. The user must select
            // one manually, and save-time validation will enforce it.
            gst1 = '';
            gst2 = '';
            amt2 = '0.00';
        }

        updated.gst_ledger_1 = gst1;
        updated.gst_ledger_2 = gst2;
        updated.gst_amount_2 = amt2;
        // Flag used by management's SGST validation to skip popup for single-ledger configs
        updated.has_two_gst_ledgers = !!gst2;

        if (value && !isEditing) {
            // Clear the old category's number immediately so the field never
            // shows a stale/wrong number while the new one is being fetched
            // (and never keeps showing it forever if the fetch fails below).
            updated.invoice_no = '';
            // Track which category this fetch is for, so a slow response for
            // a category the user has since clicked away from can't clobber
            // whatever they're now looking at.
            const requestedFor = value;
            voucherFetchTokenRef.current = requestedFor;

            recalculateForm(updated);

            try {
                const nextRes = await PurchaseService.getPurchaseInvoiceNextNo(value);
                if (voucherFetchTokenRef.current === requestedFor) {
                    setFormData(prev => ({ ...prev, invoice_no: nextRes.data.next_invoice_no }));
                }
            } catch (err) {
                console.error('Failed to fetch next invoice no:', err);
                if (voucherFetchTokenRef.current === requestedFor) {
                    import('sweetalert2').then(({ default: Swal }) => {
                        Swal.fire({
                            icon: 'error',
                            title: 'Voucher number unavailable',
                            text: 'Could not generate the next voucher number for this Invoice Category. Please try selecting it again.',
                        });
                    });
                }
            }
            return;
        }

        recalculateForm(updated);
    };

    const handleInputChange = (field, value) => {
        let updated = { ...formData, [field]: value };
        if (field === 'supplier_ledger' && value !== formData.supplier_ledger) {
            setSelectedPOs([]);
            if (selectedPOs.length > 0) {
                updated.items = [BLANK_ITEM_ROW];
            }
        }
        if (field === 'gst_type') {
            const currentPrefix = prefixConfigs.find(p => p.id === parseInt(formData.voucher_type) || p.id === formData.voucher_type);
            const configuredLedgers = (currentPrefix && currentPrefix.gst_ledger) ? currentPrefix.gst_ledger.filter(Boolean) : [];

            if (value === 'INTER_STATE') {
                updated.gst_ledger_1 = configuredLedgers[0] || '';
                updated.gst_ledger_2 = '';
                updated.gst_amount_2 = '0.00';
            } else {
                // No GST ledger configured for this voucher type in Voucher Configuration —
                // leave blank instead of guessing a ledger by name. The user must select
                // one manually, and save-time validation will enforce it.
                updated.gst_ledger_1 = configuredLedgers[0] || '';
                updated.gst_ledger_2 = configuredLedgers[1] || '';
            }
            recalculateForm(updated);
        } else if (field === 'supplier_invoice_date' && value !== formData.supplier_invoice_date) {
            // Synchronously update entry_date in state
            recalculateForm(updated);

            // Asynchronously resolve GST/HSN for all items
            const itemsToResolve = [...(formData.items || [])];
            const promises = itemsToResolve.map((item, idx) => {
                if (item.product) {
                    return PurchaseService.resolveInvoiceGstHsn(item.product, value)
                        .then(res => ({
                            index: idx,
                            productId: item.product,
                            gst_percent: res.data ? (parseFloat(res.data.gst_percent) || 0).toFixed(2) : '0.00'
                        }))
                        .catch(err => {
                            console.error(`Failed to resolve GST/HSN for row ${idx}:`, err);
                            return {
                                index: idx,
                                productId: item.product,
                                gst_percent: item.gst_percent || '0.00'
                            };
                        });
                }
                return Promise.resolve(null);
            });

            Promise.all(promises).then(results => {
                setFormData(prev => {
                    if (prev.supplier_invoice_date !== value) return prev;
                    const newItems = [...(prev.items || [])];
                    let changed = false;
                    results.forEach(res => {
                        if (res) {
                            const { index, productId, gst_percent } = res;
                            if (newItems[index] && newItems[index].product === productId) {
                                if (newItems[index].gst_percent !== gst_percent) {
                                    const updatedItem = {
                                        ...newItems[index],
                                        gst_percent: gst_percent
                                    };
                                    const isInterState = prev.gst_type === 'INTER_STATE';
                                    newItems[index] = consolidateSplits(updatedItem, isInterState);
                                    changed = true;
                                }
                            }
                        }
                    });
                    if (changed) {
                        return getRecalculatedFormState({ ...prev, items: newItems });
                    }
                    return prev;
                });
            });
        } else {
            recalculateForm(updated);
        }
    };

    const removeRow = (index) => {
        const items = (formData.items || []).filter((_, i) => i !== index);
        recalculateForm({ ...formData, items });
    };

    const savePopupItem = (item) => {
        const items = [...(formData.items || [])];
        const editIdx = itemPopup ? itemPopup.editIndex : undefined;
        if (editIdx !== undefined) {
            items[editIdx] = item;
        } else {
            items.push(item);
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
        const cleanItem = {
            ...item,
            godown: item.godown !== null && item.godown !== undefined ? String(item.godown) : '',
            per: item.per !== null && item.per !== undefined ? String(item.per) : '',
            quantity: cleanZeroValue(item.quantity),
            rate: cleanZeroValue(item.rate),
            discount_percent: cleanZeroValue(item.discount_percent),
            splits: (item.splits && item.splits.length > 0) ? item.splits.map(s => ({
                ...s,
                godown: s.godown !== null && s.godown !== undefined ? String(s.godown) : '',
                per: s.per !== null && s.per !== undefined ? String(s.per) : '',
            })) : undefined
        };
        setItemPopup({ item: cleanItem, editIndex: idx });
    };

    const addNewBlankRow = () => {
        const items = [...(formData.items || [])];
        items.push({
            product: '',
            productName: '',
            godown: '',
            godownName: '',
            quantity: '',
            rate: '',
            discount_percent: '',
            discount_amount: '0.00',
            gst_percent: '0.00',
            cgst_amount: '0.00',
            sgst_amount: '0.00',
            igst_amount: '0.00',
            amount: '0.00'
        });
        setFormData(prev => ({ ...prev, items }));
    };

    // ── Date validation on form submit ──────────────────────────────────────
    const handleFormSubmit = (e) => {
        // Block re-entry while a save is already in flight (e.g. user holding
        // down Enter, or pressing it several times before the request resolves).
        if (isSubmitting) {
            e.preventDefault();
            return;
        }

        console.log('[PI Form] Save clicked. entry_date =', formData.entry_date, '| supplier_invoice_date =', formData.supplier_invoice_date, '| items =', formData.items);

        // Required: entry_date
        if (!formData.entry_date) {
            console.warn('[PI Form] BLOCKED: entry_date is empty.');
            e.preventDefault();
            swal('Required', 'Entry Date is required.', 'warning').then(() => {
                document.querySelector('[name="entry_date"]')?.focus();
            });
            return;
        }
        const entryDateErr = validateDateValue(formData.entry_date, 'Entry Date');
        if (entryDateErr) {
            console.warn('[PI Form] BLOCKED: entry_date invalid ->', entryDateErr);
            e.preventDefault();
            swal('Invalid Date', entryDateErr, 'warning').then(() => {
                document.querySelector('[name="entry_date"]')?.focus();
            });
            return;
        }
        // Required: supplier_invoice_no
        if (!formData.supplier_invoice_no || !formData.supplier_invoice_no.trim()) {
            console.warn('[PI Form] BLOCKED: supplier_invoice_no is empty.');
            e.preventDefault();
            swal('Required', 'Supplier Invoice No is required.', 'warning').then(() => {
                document.querySelector('[name="supplier_invoice_no"]')?.focus();
            });
            return;
        }

        // Required: supplier_invoice_date
        if (!formData.supplier_invoice_date) {
            console.warn('[PI Form] BLOCKED: supplier_invoice_date is empty.');
            e.preventDefault();
            swal('Required', 'Supplier Invoice Date is required.', 'warning').then(() => {
                document.querySelector('[name="supplier_invoice_date"]')?.focus();
            });
            return;
        }
        const docDateErr = validateDateValue(formData.supplier_invoice_date, 'Supplier Invoice Date');
        if (docDateErr) {
            console.warn('[PI Form] BLOCKED: supplier_invoice_date invalid ->', docDateErr);
            e.preventDefault();
            swal('Invalid Date', docDateErr, 'warning').then(() => {
                document.querySelector('[name="supplier_invoice_date"]')?.focus();
            });
            return;
        }

        // Required: purchase_ledger
        if (!formData.purchase_ledger) {
            console.warn('[PI Form] BLOCKED: purchase_ledger is empty.');
            e.preventDefault();
            swal('Required', 'Purchase Ledger is required.', 'warning').then(() => {
                document.querySelector('[data-field="purchase_ledger"] [data-ss-trigger]')?.focus();
            });
            return;
        }

        // Required: GST ledger(s) — IGST for inter-state, CGST + SGST otherwise.
        // Skipped entirely for voucher types with no GST ledger configured at all
        // (e.g. b2c where no GST is booked on a separate ledger).
        const currentPrefixConfig = prefixConfigs.find(p => p.id === parseInt(formData.voucher_type) || p.id === formData.voucher_type);
        const configuredGstLedgersForValidation = (currentPrefixConfig && currentPrefixConfig.gst_ledger) ? currentPrefixConfig.gst_ledger.filter(Boolean) : [];

        if (configuredGstLedgersForValidation.length > 0) {
            const isInterState = formData.gst_type === 'INTER_STATE';
            const missingLedger1 = !formData.gst_ledger_1;

            let requiresSgst = !isInterState;
            if (configuredGstLedgersForValidation.length === 1) {
                requiresSgst = false;
            }

            const missingLedger2 = requiresSgst && !formData.gst_ledger_2;

            if (missingLedger1 || missingLedger2) {
                e.preventDefault();
                const label1 = isInterState ? 'IGST' : 'CGST';
                const missingNames = [
                    missingLedger1 ? label1 : null,
                    missingLedger2 ? 'SGST' : null
                ].filter(Boolean).join(' and ');
                console.warn('[PI Form] BLOCKED: missing required ledger(s) ->', missingNames);

                // Open the missing ledger's dropdown only AFTER the popup is dismissed
                // (OK click or Enter key), so the two don't fight over keyboard focus.
                const fieldToOpen = missingLedger1 ? 'gst_ledger_1' : 'gst_ledger_2';
                swal('Required', `${missingNames} Ledger must be selected before saving.`, 'warning').then(() => {
                    setTimeout(() => {
                        const trigger = document.querySelector(`[data-field="${fieldToOpen}"] [data-ss-trigger]`);
                        trigger?.click();
                    }, 50);
                });
                return;
            }
        // }else {
        //     // No GST ledger configured at all for this voucher type (e.g. B2C).
        //     const gstAmt1 = parseFloat(formData.gst_amount_1) || 0;
        //     const gstAmt2 = parseFloat(formData.gst_amount_2) || 0;
        //     if (gstAmt1 > 0 || gstAmt2 > 0) {
        //         e.preventDefault();
        //         swal(
        //             'GST Ledger Not Configured',
        //             'One or more items on this invoice have GST applied, but this voucher type has no GST ledger configured. Please set a CGST/SGST (or IGST) ledger for this voucher type in Voucher Configuration, or remove the GST% from the line items.',
        //             'warning'
        //         );
        //         return;
        //     }
        }
        

        // Call the original onSave
        console.log('[PI Form] Validation passed. Calling onSave...');
        if (typeof onSave === 'function') {
            onSave(e);
        } else {
            console.error('[PI Form] onSave prop is not a function! Save will silently do nothing.', onSave);
        }
    };

    const handleTableProductChange = (rowIdx, productId) => {
        const items = [...(formData.items || [])];
        if (!productId) {
            items[rowIdx] = {
                product: '',
                productName: '',
                godown: '',
                godownName: '',
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

        const visibility = getRowFieldVisibility(found, productConfig);

        const currentItem = items[rowIdx] || {};
        const baseItem = {
            ...currentItem,
            product: productId,
            productName: productName,
            rate: currentItem.rate || '', // Rate is entered manually by the user, not auto-filled
            gst_percent: '0.00',
            gstResolving: true,
            per: baseUnit ? String(baseUnit) : '',
            perName: baseUnitName || '',
            quantity: currentItem.quantity || '',
            discount_percent: currentItem.discount_percent || '',
            godown: visibility.maintain_warehouse ? (currentItem.godown || '') : '',
            godownName: visibility.maintain_warehouse ? (currentItem.godownName || '') : '',
            row_narration: visibility.maintain_row_narration ? (currentItem.row_narration || currentItem.narration || '') : ''
        };
        const initialSplit = createBlankSplit(baseItem);
        baseItem.splits = [{
            ...initialSplit,
            godown: visibility.maintain_warehouse ? (initialSplit.godown || '') : '',
            godownName: visibility.maintain_warehouse ? (initialSplit.godownName || '') : '',
            batch_number: visibility.maintain_batch ? (initialSplit.batch_number || '') : '',
            manufacture_date: visibility.maintain_manufacture_date ? (initialSplit.manufacture_date || '') : '',
            expiry_date: visibility.maintain_expiry_date ? (initialSplit.expiry_date || '') : '',
            row_narration: visibility.maintain_row_narration ? (initialSplit.row_narration || initialSplit.narration || '') : ''
        }];

        items[rowIdx] = baseItem;

        // Synchronously update formData and open item allocation popup immediately
        recalculateForm({ ...formData, items });
        setItemPopup({ item: baseItem, editIndex: rowIdx });

        // Asynchronously resolve GST/HSN from backend in the background
        PurchaseService.resolveInvoiceGstHsn(productId, formData.supplier_invoice_date)
            .then(res => {
                // A resolved tax rate is display data, not a placeholder-driven
                // input — format it directly so a legitimate 0% rate still
                // shows "0.00" instead of being blanked out by cleanZeroValue.
                const gstPercent = res.data ? (parseFloat(res.data.gst_percent) || 0).toFixed(2) : '0.00';
                setFormData(prev => {
                    const newItems = [...(prev.items || [])];
                    if (newItems[rowIdx] && newItems[rowIdx].product === productId) {
                        const updatedItem = {
                            ...newItems[rowIdx],
                            gst_percent: gstPercent,
                            gstResolving: false
                        };
                        const isInterState = prev.gst_type === 'INTER_STATE';
                        const consolidated = consolidateSplits(updatedItem, isInterState);
                        newItems[rowIdx] = consolidated;

                        // Update open popup item if it corresponds to the same product and row
                        setItemPopup(curr => {
                            if (curr && curr.editIndex === rowIdx && curr.item.product === productId) {
                                return {
                                    ...curr,
                                    item: consolidated
                                };
                            }
                            return curr;
                        });

                        return getRecalculatedFormState({ ...prev, items: newItems });
                    }
                    return prev;
                });
            })
            .catch(err => {
                console.error('Failed to resolve GST/HSN in background:', err);
                // Clear the resolving flag even on failure so the row/popup
                // doesn't stay permanently locked — gst_percent stays at
                // whatever it was (0.00), and the user can retry by
                // re-selecting the item or changing the entry date.
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
                        return { ...prev, items: newItems };
                    }
                    return prev;
                });
            });
    };

    const handleTableFieldChange = (rowIdx, field, value) => {
        const items = [...(formData.items || [])];
        let item = { ...items[rowIdx] };

        const isInterState = formData.gst_type === 'INTER_STATE';

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

    const handleTableKeyDown = (e, rowIdx, colIdx) => {
        const key = e.key;
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(key)) return;

        // If a sweetalert dialog is currently open, do not intercept — let swal handle Enter.
        if (document.querySelector('.swal-overlay.swal-overlay--show-modal, .swal2-container')) {
            return;
        }

        if (key === 'Enter' && colIdx === 0 && !formData.items?.[rowIdx]?.product) {
            e.preventDefault();
            e.stopPropagation();
            if ((formData.items || []).length > 1) {
                removeRow(rowIdx);
                setTimeout(() => {
                    const ledgerEl = document.querySelector('[data-field="gst_ledger_1"] [data-ss-trigger]');
                    if (ledgerEl) ledgerEl.focus();
                }, 100);
            } else {
                // Only one row and it's empty — show warning and refocus item search field
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
        const isInterState = formData.gst_type === 'INTER_STATE';
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
                    trackSelectOpen(active);
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
            if (colIdx === 4) {
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
                document.querySelector('.sof-btn-save')?.click();
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

    const getSubtotal = () => (formData.items || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0).toFixed(2);
    const getTotalTax = () => {
        const t1 = parseFloat(formData.gst_amount_1) || 0;
        const t2 = parseFloat(formData.gst_amount_2) || 0;
        return (t1 + t2).toFixed(2);
    };

    const currentPrefix = prefixConfigs.find(p => p.id === parseInt(formData.voucher_type) || p.id === formData.voucher_type);
    const configuredGstLedgers = (currentPrefix && currentPrefix.gst_ledger) ? currentPrefix.gst_ledger.filter(Boolean) : [];
    // If the voucher type's Voucher Configuration has no GST ledger set at all (e.g. a
    // b2c-style category where GST isn't booked separately), don't show the GST Ledger
    // section on the invoice at all — just Subtotal -> Extra Charges -> Total.
    const hasGstLedgerConfigured = configuredGstLedgers.length > 0;
    let showGst2 = formData.gst_type !== 'INTER_STATE';
    if (currentPrefix && currentPrefix.gst_ledger) {
        const validLedgers = currentPrefix.gst_ledger.filter(Boolean);
        if (validLedgers.length === 1) {
            showGst2 = false;
        }
    }

    if (loadingOptions) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', border: '4px solid #e8eaf6', borderTopColor: '#0d9488', borderRadius: '50%', animation: 'sof-spin 0.8s linear infinite' }}></div>
                <p style={{ color: '#0d9488', fontWeight: '600', fontSize: '0.9rem', margin: 0 }}>Loading form data...</p>
                <style>{`@keyframes sof-spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    return (
        <React.Fragment>
            <div className="sof-wrap">
                <form onSubmit={handleFormSubmit} onKeyDown={handleKeyDownNavigation} onChange={handleSelectChangeNavigation}>

                    {/* ── SECTION 1: INVOICE INFO ──────────────────────────────────────────────── */}
                    <div className="sof-section">
                        <div className="sof-section-head">
                            <div className="sof-section-icon" style={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)' }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                </svg>
                            </div>
                            <span>Purchase Invoice Information</span>
                            <div className="sof-section-line"></div>
                        </div>

                        <div className="row">
                            {isFieldVisible('voucher_type') && (
                                <div className="col-lg-3 col-md-6 sof-field-group">
                                    <label className="sof-label">Invoice Category <span className="sof-req">*</span></label>
                                    <div className="sof-input-box">
                                        <span className="sof-field-icon">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                                            </svg>
                                        </span>
                                        <SearchableSelect
                                            name="voucher_type"
                                            className="sof-input"
                                            value={String(formData.voucher_type || '')}
                                            options={[
                                                { value: '', label: 'Select Invoice Category...' },
                                                ...prefixConfigs.map(p => ({
                                                    value: String(p.id),
                                                    label: p.subvoucher_type_name || p.sub_type || p.prefix || 'Purchase Invoice'
                                                }))
                                            ]}
                                            onChange={e => handlePrefixChange(e.target.value)}
                                            placeholder="Select Invoice Category..."
                                        />
                                    </div>
                                </div>
                            )}

                            {isFieldVisible('invoice_no') && (
                                <div className="col-lg-3 col-md-6 sof-field-group">
                                    <label className="sof-label">
                                        Voucher No.
                                        <span className="sof-badge-auto">AUTO</span>
                                    </label>
                                    <div className="sof-input-box sof-input-locked">
                                        <span className="sof-field-icon">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                            </svg>
                                        </span>
                                        <input type="text" name="invoice_no" className="sof-input" placeholder="(auto-generated)" readOnly value={formData.invoice_no || ''} />
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

                            {isFieldVisible('purchase_ledger') && (
                                <div className="col-lg-3 col-md-6 sof-field-group">
                                    <label className="sof-label">Purchase Ledger <span className="sof-req">*</span></label>
                                    <div className="sof-input-box" data-field="purchase_ledger">
                                        <span className="sof-field-icon">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 7v6h-6"></path>
                                                <path d="M3 17a9 9 0 0 1 15-6.7L21 13"></path>
                                            </svg>
                                        </span>
                                        <SearchableSelect
                                            name="purchase_ledger"
                                            className="sof-input"
                                            value={formData.purchase_ledger || ''}
                                            options={[{ value: '', label: 'Select Purchase Ledger...' }, ...ledgers.filter(l => l.account_group_name === 'Purchase Accounts' || String(l.id) === String(formData.purchase_ledger)).map(l => ({ value: String(l.id), label: l.name }))]}
                                            onChange={e => handleInputChange('purchase_ledger', e.target.value)}
                                            placeholder="Select Purchase Ledger..."
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="row" style={{ marginTop: '16px' }}>
                            {isFieldVisible('supplier_ledger') && (
                                <div className="col-lg-6 col-md-6 sof-field-group">
                                    <label className="sof-label mb-1">Supplier Name <span className="sof-req">*</span></label>
                                    <div className="d-flex align-items-center gap-2">
                                        <div className="sof-input-box mb-0" style={{ flex: 1 }}>
                                            <span className="sof-field-icon">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                                    <circle cx="12" cy="7" r="4"></circle>
                                                </svg>
                                            </span>
                                            <SearchableSelect
                                                name="supplier_ledger"
                                                className="sof-input"
                                                value={formData.supplier_ledger || ''}
                                                options={supplierOptions}
                                                onChange={e => handleInputChange('supplier_ledger', e.target.value)}
                                                placeholder="Select Supplier..."
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-primary btn-sm p-0 d-flex align-items-center justify-content-center"
                                            style={{ width: '38px', height: '38px', borderRadius: '4px', flexShrink: 0 }}
                                            onClick={() => setShowLedgerModal(true)}
                                            title="Create Supplier"
                                        >
                                            <i className="fa fa-plus" style={{ fontSize: '14px' }}></i>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {isFieldVisible('supplier_invoice_no') && (
                                <div className="col-lg-3 col-md-3 sof-field-group">
                                    <label className="sof-label">
                                        Supplier Invoice No
                                        <span style={{ color: 'red', marginLeft: '3px', fontWeight: 'bold' }}>*</span>
                                    </label>
                                    <div className="sof-input-box">
                                        <input type="text" name="supplier_invoice_no" className="sof-input" placeholder="Enter Invoice no." value={formData.supplier_invoice_no || ''} onChange={e => handleInputChange('supplier_invoice_no', e.target.value)} />
                                    </div>
                                </div>
                            )}

                            {isFieldVisible('supplier_invoice_date') && (
                                <div className="col-lg-3 col-md-3 sof-field-group">
                                    <label className="sof-label">
                                        Supplier Invoice Date
                                        <span style={{ color: 'red', marginLeft: '3px', fontWeight: 'bold' }}>*</span>
                                    </label>
                                    <div className="sof-input-box">
                                        <CompanyDatePicker
                                            name="supplier_invoice_date"
                                            className="sof-input"
                                            value={formData.supplier_invoice_date || ''}
                                            onChange={(e, val) => handleInputChange('supplier_invoice_date', val || e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {supplierPurchaseOrders.length > 0 && (
                            <div className="row" style={{ marginTop: '16px' }}>
                                <div className="col-12 sof-field-group">
                                    <div style={{
                                        backgroundColor: '#f8fafc',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '8px',
                                        padding: '12px 16px'
                                    }}>
                                        <label className="sof-label mb-2" style={{ fontWeight: '600', color: '#1e293b', fontSize: '13px' }}>
                                            Select Purchase Orders for this Supplier
                                        </label>
                                        <div style={{ maxWidth: '100%' }}>
                                            <ReactSelectMulti
                                                isMulti
                                                closeMenuOnSelect={false}
                                                options={supplierPurchaseOrders.map(po => ({
                                                    value: String(po.id),
                                                    label: `${po.po_no || ('PO-' + po.id)}${po.entry_date ? ` (${po.entry_date})` : ''}`
                                                }))}
                                                value={selectedPOs}
                                                onChange={handlePOSelect}
                                                placeholder="Select one or more Purchase Orders..."
                                                classNamePrefix="sof-po-select"
                                                styles={{
                                                    control: (base, state) => ({
                                                        ...base,
                                                        minHeight: '38px',
                                                        borderColor: state.isFocused ? '#0a500f' : '#cbd5e1',
                                                        boxShadow: state.isFocused ? '0 0 0 2px rgba(10, 80, 15,0.18)' : 'none',
                                                        '&:hover': { borderColor: '#0a500f' },
                                                        borderRadius: '6px',
                                                        fontSize: '13px'
                                                    }),
                                                    multiValue: (base) => ({
                                                        ...base,
                                                        backgroundColor: '#e0fdf4',
                                                        borderRadius: '4px'
                                                    }),
                                                    multiValueLabel: (base) => ({
                                                        ...base,
                                                        color: '#047857',
                                                        fontWeight: '500',
                                                        fontSize: '12px'
                                                    }),
                                                    multiValueRemove: (base) => ({
                                                        ...base,
                                                        color: '#047857',
                                                        '&:hover': { backgroundColor: '#6ee7b7', color: '#065f46' }
                                                    }),
                                                    option: (base, state) => ({
                                                        ...base,
                                                        backgroundColor: state.isSelected ? '#0a500f' : state.isFocused ? '#f0fdf4' : 'white',
                                                        color: state.isSelected ? 'white' : '#334155',
                                                        fontSize: '13px'
                                                    }),
                                                    menuPortal: base => ({ ...base, zIndex: 9999 })
                                                }}
                                                menuPortalTarget={document.body}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>

                    {/* ── SECTION 2: INVOICE ITEMS (grid table layout) ──────────────────── */}
                    <div className="sof-section sof-table-section">
                        <div className="sof-section-head">
                            <div className="sof-section-icon sof-icon-teal">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                    <line x1="12" y1="22.08" x2="12" y2="12" />
                                </svg>
                            </div>
                            <span>Invoice Items</span>
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
                                        <th className="sof-th-center" style={{ width: '50px' }}>Sl.No</th>
                                        <th style={{ minWidth: '220px' }}>Name of Item</th>
                                        <th className="sof-th-right" style={{ width: '100px' }}>Quantity</th>
                                        <th className="sof-th-right" style={{ width: '110px' }}>Rate</th>
                                        <th className="sof-th-right" style={{ width: '80px' }}>Dis %</th>
                                        <th className="sof-th-right" style={{ width: '90px' }}>GST %</th>
                                        {formData.gst_type === 'INTER_STATE' ? (
                                            <th className="sof-th-right" style={{ width: '110px' }}>IGST</th>
                                        ) : (
                                            <>
                                                <th className="sof-th-right" style={{ width: '100px' }}>{showGst2 ? 'CGST' : 'GST'}</th>
                                                {showGst2 && <th className="sof-th-right" style={{ width: '100px' }}>SGST</th>}
                                            </>
                                        )}
                                        <th className="sof-th-right" style={{ width: '120px' }}>Amount</th>
                                        <th className="sof-th-center" style={{ width: '240px' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(formData.items || []).map((item, idx) => {
                                        const isInterState = formData.gst_type === 'INTER_STATE';
                                        const amountColIdx = (isInterState || !showGst2) ? 6 : 7;
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
                                                        title="GST % is resolved automatically from the item's tax rate as of the Entry Date and can't be edited directly"
                                                        onKeyDown={e => handleTableKeyDown(e, idx, 4)}
                                                    />
                                                </td>
                                                {formData.gst_type === 'INTER_STATE' ? (
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
                                                        {showGst2 && (
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
                                                        )}
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
                                                        data-col={formData.gst_type === 'INTER_STATE' ? 6 : 7}
                                                        onKeyDown={e => handleTableKeyDown(e, idx, formData.gst_type === 'INTER_STATE' ? 6 : 7)}
                                                    />
                                                </td>
                                                <td style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                                                    <div className="d-flex justify-content-center align-items-center gap-1">
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center"
                                                            style={{ width: '28px', height: '28px', padding: '0', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                                            title="Edit details (godown, etc.)"
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
                                                            className="btn btn-sm btn-success d-inline-flex align-items-center gap-1 text-white"
                                                            style={{ padding: '5px 9px', fontSize: '0.72rem', borderRadius: '4px', border: 'none', background: '#22c55e', cursor: 'pointer', height: '28px' }}
                                                            title="Save order (End of Row)"
                                                            data-row={idx}
                                                            data-col={endOfRowCol}
                                                            onKeyDown={e => handleTableKeyDown(e, idx, endOfRowCol)}
                                                            onClick={() => {
                                                                document.querySelector('.sof-btn-save')?.click();
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

                    {/* ── SECTION 3: NOTES + INVOICE SUMMARY ─────────────────────── */}
                    <div className="row">
                        {/* Narration */}
                        {isFieldVisible('narration') ? (
                            <div className="col-lg-7 mb-4">
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
                                        placeholder="Enter invoice notes, payment terms, or special instructions..."
                                        value={formData.narration || ''}
                                        onChange={e => handleInputChange('narration', e.target.value)}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="col-lg-7 mb-4"></div>
                        )}

                        {/* Invoice Summary */}
                        <div className="col-lg-5 mb-4">
                            {formData.voucher_type === 'B2C Purchase' && (
                                <div className="alert alert-warning mb-3 d-flex align-items-start gap-2" style={{ fontSize: '0.78rem', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #ffeeba', backgroundColor: '#fff3cd', color: '#856404', fontWeight: '500' }}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" style={{ flexShrink: 0, marginTop: '2px' }}>
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <line x1="12" y1="8" x2="12" y2="12"></line>
                                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                    </svg>
                                    <span><strong>B2C (Unregistered)</strong> GST paid but no input tax credit applicable. GST is included in item cost.</span>
                                </div>
                            )}

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

                                    {/* GST Ledger 1 & 2 — only shown when this voucher type actually has
                                        a GST ledger configured in Voucher Configuration. For voucher types
                                        with none configured (e.g. b2c with no GST applicable), skip straight
                                        to Extra Charges / Total. */}
                                    {hasGstLedgerConfigured && (
                                    <>
                                    <div className="sof-gst-row">
                                        <div className="sof-gst-label">
                                            {formData.gst_type === 'INTER_STATE' ? 'IGST' : (showGst2 ? 'CGST' : 'GST')} Ledger
                                        </div>
                                        <div className="sof-gst-fields" data-field="gst_ledger_1">
                                            <SearchableSelect
                                                className="sof-gst-select"
                                                name="gst_ledger_1"
                                                value={formData.gst_ledger_1 || ''}
                                                options={[{ value: '', label: 'Select Ledger' }, ...ledgers.map(l => ({ value: String(l.id), label: l.name }))]}
                                                onChange={e => handleInputChange('gst_ledger_1', e.target.value)}
                                                placeholder="Select Ledger"
                                                onKeyDown={e => {
                                                    if (e.key !== 'Enter') return;
                                                    if (showGst2) {
                                                        e.preventDefault();
                                                        document.querySelector('[data-field="gst_ledger_2"] [data-ss-trigger]')?.focus();
                                                    } else {
                                                        e.preventDefault();
                                                        document.querySelector('.sof-btn-save')?.focus();
                                                    }
                                                }}
                                            />
                                            <div style={{ display: 'flex', alignItems: 'center', background: '#ccfbf1', color: '#0f766e', borderRadius: '8px', padding: '0 8px', fontWeight: '600' }}>
                                                <input
                                                    type="number"
                                                    value={formData.gst_amount_1 || ''}
                                                    step="0.01"
                                                    onChange={e => handleGstAmountChange('gst_amount_1', e.target.value)}
                                                    style={{ background: 'none', border: 'none', color: '#0f766e', width: '70px', textAlign: 'right', outline: 'none', fontWeight: '600' }}
                                                />
                                            </div>
                                            
                                        </div>
                                    </div>

                                    {/* GST Ledger 2 */}
                                    {showGst2 && (
                                        <div className="sof-gst-row">
                                            <div className="sof-gst-label">SGST Ledger</div>
                                            <div className="sof-gst-fields" data-field="gst_ledger_2">
                                                <SearchableSelect
                                                    className="sof-gst-select"
                                                    name="gst_ledger_2"
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
                                                <div style={{ display: 'flex', alignItems: 'center', background: '#ccfbf1', color: '#0f766e', borderRadius: '8px', padding: '0 8px', fontWeight: '600' }}>
                                                    <input
                                                        type="number"
                                                        value={formData.gst_amount_2 || ''}
                                                        step="0.01"
                                                        onChange={e => handleGstAmountChange('gst_amount_2', e.target.value)}
                                                        style={{ background: 'none', border: 'none', color: '#0f766e', width: '70px', textAlign: 'right', outline: 'none', fontWeight: '600' }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    </>
                                    )}

                                    {/* ── Extra Charge Rows ── */}
                                    {(formData.extra_charges || []).map((ec, idx) => (
                                        <div className="sof-gst-row" key={idx}>
                                            <div className="sof-gst-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                Extra Charge {idx + 1}
                                                <button
                                                    type="button"
                                                    onClick={() => removeExtraCharge(idx)}
                                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1, padding: '0 4px' }}
                                                    title="Remove this charge"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                            <div className="sof-gst-fields">
                                                <SearchableSelect
                                                    className="sof-gst-select"
                                                    value={ec.ledger || ''}
                                                    options={[{ value: '', label: 'Select Ledger' }, ...ledgers.map(l => ({ value: String(l.id), label: l.name }))]}
                                                    onChange={e => handleExtraChargeChange(idx, 'ledger', e.target.value)}
                                                    placeholder="Select Ledger"
                                                />
                                                <div style={{ display: 'flex', alignItems: 'center', background: '#ccfbf1', color: '#0f766e', borderRadius: '8px', padding: '0 8px', fontWeight: '600' }}>
                                                    <input
                                                        type="number"
                                                        value={ec.amount || ''}
                                                        step="0.01"
                                                        onChange={e => handleExtraChargeChange(idx, 'amount', e.target.value)}
                                                        style={{ background: 'none', border: 'none', color: '#0f766e', width: '60px', textAlign: 'right', outline: 'none', fontWeight: '600' }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    <div className="sof-receipt-row" style={{ borderBottom: 'none', paddingBottom: '0', paddingTop: '10px' }}>
                                        <button
                                            type="button"
                                            onClick={addExtraCharge}
                                            style={{ fontSize: '0.78rem', padding: '5px 14px', borderRadius: '6px', border: '1.5px dashed #0d9488', color: '#0d9488', background: 'none', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}
                                        >
                                            + Add Extra Charge
                                        </button>
                                    </div>

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
                    <div className="sof-action-bar">
                        <button type="button" className="sof-btn-cancel" onClick={onCancel}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="sof-btn-save"
                            disabled={isSubmitting}
                            style={{
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)',
                                opacity: isSubmitting ? 0.7 : 1,
                                cursor: isSubmitting ? 'not-allowed' : 'pointer'
                            }}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" style={{ marginRight: '6px' }}>
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            {isSubmitting ? 'Saving...' : (isEditing ? 'Update Purchase Invoice' : 'Save Purchase Invoice')}
                        </button>
                    </div>
                </form>

                {/* ── ITEM ENTRY POPUP ────────────────────────────────────────── */}
                {itemPopup && (
                    <ItemEntryPopup
                        key={itemPopup.editIndex !== undefined ? `edit-${itemPopup.editIndex}-${itemPopup.item.product}` : `add-${itemPopup.item.product}`}
                        item={itemPopup.item}
                        isInterState={formData.gst_type === 'INTER_STATE'}
                        godowns={godowns}
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
                        isInterState={formData.gst_type === 'INTER_STATE'}
                        onClose={() => setViewPopup(null)}
                        productConfig={productConfig}
                        stockItems={stockItems}
                    />
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
                .sof-input:focus {
                    outline: none !important;
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

                /* ── Flat Invoice Summary styles ── */
                .sof-flat-label {
                    font-size: 0.68rem; font-weight: 700;
                    color: #64748b;
                    text-transform: uppercase; letter-spacing: 0.06em;
                    margin-bottom: 5px;
                }
                .sof-flat-input {
                    width: 100%;
                    padding: 8px 12px;
                    font-size: 0.88rem; font-weight: 500;
                    color: #1e293b;
                    background: #fff;
                    border: 1.5px solid #cbd5e1;
                    border-radius: 8px;
                    outline: none;
                    font-family: inherit;
                    box-sizing: border-box;
                    transition: border-color 0.2s ease;
                    display: block;
                }
                .sof-flat-input:focus {
                    border-color: #0d9488;
                    box-shadow: 0 0 0 2px rgba(13, 148, 136, 0.12);
                }
                .sof-flat-input-ro {
                    background: #f1f5f9;
                    color: #475569;
                    cursor: default;
                    border-color: #e2e8f0;
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
                .d-flex button:not(.sof-input):focus, .gap-2 button:not(.sof-input):focus, .sof-modal button:not(.sof-input):focus {
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

                /* ── RECEIPT / INVOICE SUMMARY ── */
                .sof-receipt {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.03);
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    transition: all 0.3s ease;
                }
                .sof-receipt:hover {
                    box-shadow: 0 8px 30px rgba(0,0,0,0.06);
                }
                .sof-receipt-header {
                    background: #0f766e;
                    color: #ffffff;
                    padding: 16px 20px;
                    font-size: 1.05rem;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    letter-spacing: 0.02em;
                }
                .sof-receipt-header svg { opacity: 0.85; }
                .sof-receipt-body { padding: 16px 20px; flex: 1; }
                .sof-receipt-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 0;
                    border-bottom: 1px dashed #e2e8f0;
                }
                .sof-receipt-row:last-child { border-bottom: none; }
                .sof-receipt-row-tax {
                    margin-top: 10px;
                    padding-top: 16px;
                    border-top: 2px solid #f1f5f9;
                    border-bottom: none;
                }
                .sof-receipt-key { color: #64748b; font-weight: 500; font-size: 0.9rem; }
                .sof-receipt-val { font-weight: 700; color: #1e293b; font-size: 0.95rem; font-feature-settings: "tnum"; }

                .sof-gst-row {
                    background: #f8fafc;
                    border-radius: 10px;
                    padding: 12px;
                    margin-bottom: 12px;
                    border: 1px solid #f1f5f9;
                }
                .sof-gst-label {
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: #94a3b8;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: 8px;
                }
                .sof-gst-fields {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }
                .sof-gst-select {
                    flex: 1;
                    /* Using SearchableSelect, it overrides some styles, so we keep it flexible */
                }
                .sof-gst-amount {
                    background: #ccfbf1;
                    color: #0f766e;
                    padding: 8px 12px;
                    border-radius: 8px;
                    font-weight: 700;
                    font-size: 0.9rem;
                    white-space: nowrap;
                    min-width: 80px;
                    text-align: right;
                    box-shadow: inset 0 1px 2px rgba(0,0,0,0.02);
                }

                .sof-receipt-total {
                    background: #0f766e;
                    color: #ffffff;
                    padding: 18px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .sof-total-label { font-size: 1rem; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; opacity: 0.9; }
                .sof-total-value { font-size: 1.4rem; font-weight: 800; font-feature-settings: "tnum"; }

            ` }} />
            </div>

            {showLedgerModal && (
                <LedgerFormModal
                    show={showLedgerModal}
                    onHide={() => setShowLedgerModal(false)}
                    accountGroups={accountGroups}
                    onSave={(newLedger) => {
                        setLedgers(prev => [...prev, newLedger]);
                        setShowLedgerModal(false);
                        if (validSupplierGroupIds.has(newLedger.accountGroup)) {
                            handleInputChange('supplier_ledger', String(newLedger.id));
                        } else {
                            setTimeout(() => {
                                swal("Notice", "You have created a ledger under an Account Group other than Sundry Debtors/Creditors. It will not be selected here.", "info");
                            }, 300);
                        }
                    }}
                />
            )}
        </React.Fragment>
    );
};

export default PurchaseInvoiceForm;