import React, { useMemo, useRef } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { getDatePickerFormat } from '../../../utils/dateUtils';
import { parseISO, format, isValid } from 'date-fns';

/**
 * A company-settings-aware DatePicker component for form inputs.
 * Displays dates matching the active company date format (e.g. DD/MM/YYYY).
 */
const CompanyDatePicker = ({
    value,
    onChange,
    name = 'entry_date',
    className = 'sof-input',
    placeholder,
    required = false,
    disabled = false,
    readOnly = false,
    minDate,
    maxDate,
    onBlur,
    id,
    style,
    autoFocus = false,
    ...rest
}) => {
    const datePickerRef = useRef(null);

    // Parse value string (YYYY-MM-DD or ISO) into Date object for react-datepicker
    const selectedDate = useMemo(() => {
        if (!value) return null;
        if (value instanceof Date) return isValid(value) ? value : null;
        if (typeof value === 'string') {
            const clean = value.trim();
            if (!clean) return null;
            const parsed = parseISO(clean);
            if (isValid(parsed)) return parsed;
            const fallback = new Date(clean);
            return isValid(fallback) ? fallback : null;
        }
        return null;
    }, [value]);

    const activeFormat = getDatePickerFormat();

    const handleChange = (date) => {
        if (datePickerRef.current && typeof datePickerRef.current.setOpen === 'function') {
            datePickerRef.current.setOpen(false);
        }

        let formattedValue = '';
        if (date && isValid(date)) {
            formattedValue = format(date, 'yyyy-MM-dd');

            // When a valid date is selected or fully typed, automatically move control to the next form field
            setTimeout(() => {
                const inputEl = datePickerRef.current && (datePickerRef.current.input || datePickerRef.current.inputElement || (datePickerRef.current.el && datePickerRef.current.el.querySelector('input')));
                const container = (inputEl && inputEl.closest ? inputEl.closest('form, .modal-content, .card') : null) || document;
                const focusable = Array.from(
                    container.querySelectorAll(
                        'input:not([disabled]):not([readonly]):not([type="hidden"]), textarea:not([disabled]):not([readonly]), select:not([disabled]), .react-select__control, button[type="submit"]:not([disabled])'
                    )
                ).filter(el => el.offsetParent !== null && !el.disabled);

                const currentEl = inputEl || document.activeElement;
                const idx = focusable.indexOf(currentEl);
                if (idx > -1 && idx < focusable.length - 1) {
                    const next = focusable[idx + 1];
                    if (next.classList && next.classList.contains('react-select__control')) {
                        const selInput = next.querySelector('input');
                        if (selInput) selInput.focus();
                    } else {
                        next.focus();
                    }
                }
            }, 60);
        }

        if (typeof onChange === 'function') {
            // Support both standard synthetic event style (e.target.value) and direct value handler
            onChange({
                target: {
                    name,
                    value: formattedValue
                }
            }, formattedValue);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'Escape') {
            if (datePickerRef.current && typeof datePickerRef.current.setOpen === 'function') {
                datePickerRef.current.setOpen(false);
            }
        }
        if (typeof rest.onKeyDown === 'function') {
            rest.onKeyDown(e);
        }
    };

    const handleBlur = (e) => {
        setTimeout(() => {
            if (datePickerRef.current && typeof datePickerRef.current.setOpen === 'function') {
                datePickerRef.current.setOpen(false);
            }
        }, 120);
        if (typeof onBlur === 'function') {
            onBlur(e);
        }
    };

    const parsedMinDate = useMemo(() => {
        if (!minDate) return undefined;
        if (minDate instanceof Date) return minDate;
        const p = parseISO(minDate);
        return isValid(p) ? p : undefined;
    }, [minDate]);

    const parsedMaxDate = useMemo(() => {
        if (!maxDate) return undefined;
        if (maxDate instanceof Date) return maxDate;
        const p = parseISO(maxDate);
        return isValid(p) ? p : undefined;
    }, [maxDate]);

    const handleRawChange = (e) => {
        const raw = e?.target?.value;
        if (!raw) return;
        const clean = raw.trim();
        const parts = clean.split(/[-/.]/);
        if (parts.length === 3) {
            let day, month, year;
            if (parts[0].length === 4) {
                year = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10) - 1;
                day = parseInt(parts[2], 10);
            } else if (parts[2].length === 4) {
                day = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10) - 1;
                year = parseInt(parts[2], 10);
            }
            if (year >= 1900 && year <= 2100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
                const d = new Date(year, month, day);
                if (isValid(d)) {
                    handleChange(d);
                }
            }
        }
        if (typeof rest.onChangeRaw === 'function') {
            rest.onChangeRaw(e);
        }
    };

    return (
        <DatePicker
            ref={datePickerRef}
            selected={selectedDate}
            onChange={handleChange}
            onChangeRaw={handleRawChange}
            onSelect={() => {
                if (datePickerRef.current && typeof datePickerRef.current.setOpen === 'function') {
                    datePickerRef.current.setOpen(false);
                }
            }}
            onClickOutside={() => {
                if (datePickerRef.current && typeof datePickerRef.current.setOpen === 'function') {
                    datePickerRef.current.setOpen(false);
                }
            }}
            dateFormat={activeFormat}
            strictParsing={false}
            placeholderText={placeholder || activeFormat.toLowerCase()}
            className={className}
            required={required}
            disabled={disabled || readOnly}
            minDate={parsedMinDate}
            maxDate={parsedMaxDate}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            shouldCloseOnSelect={true}
            id={id}
            autoFocus={autoFocus}
            wrapperClassName="w-100"
            autoComplete="off"
            {...rest}
        />
    );
};

export default CompanyDatePicker;
