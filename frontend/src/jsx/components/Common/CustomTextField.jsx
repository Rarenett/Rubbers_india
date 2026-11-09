import React from 'react';
import { Form } from 'react-bootstrap';

/**
 * Reusable Global Text Field Component
 * 
 * Automatic Casing Modes:
 * - casing="title" (DEFAULT): Formats every word with first letter capital (e.g., "Sales Manager", "Purchase Manager")
 * - casing="uppercase": Formats entire text to UPPERCASE (e.g., "DOWNTOWN BRANCH", "DWT")
 * - casing="lowercase": Formats text to lowercase
 * - casing="none": Preserves raw input (for email, url, password, etc.)
 */
const CustomTextField = ({
    label,
    required = false,
    casing = 'title', // 'title' | 'uppercase' | 'lowercase' | 'none'
    value = '',
    onChange,
    onBlur,
    className = 'form-control-custom',
    labelClass = 'form-label-custom',
    containerClass = 'mb-3',
    error,
    style = {},
    type = 'text',
    ...restProps
}) => {
    // Format string according to selected casing
    const formatValue = (val) => {
        if (typeof val !== 'string' || !val) return val;
        if (casing === 'uppercase') {
            return val.toUpperCase();
        }
        if (casing === 'lowercase') {
            return val.toLowerCase();
        }
        if (casing === 'title') {
            return val.replace(/\b\w/g, char => char.toUpperCase());
        }
        return val;
    };

    const handleChange = (e) => {
        if (!onChange) return;

        // Apply casing formatting for text-based input types
        if (['text', 'search', 'textarea'].includes(type) && casing !== 'none') {
            const formatted = formatValue(e.target.value);
            const syntheticEvent = {
                ...e,
                target: {
                    ...e.target,
                    name: e.target.name,
                    value: formatted
                }
            };
            onChange(syntheticEvent);
        } else {
            onChange(e);
        }
    };

    const handleBlur = (e) => {
        if (onBlur) onBlur(e);
    };

    const computedStyle = { ...style };
    if (casing === 'uppercase') {
        computedStyle.textTransform = 'uppercase';
    }

    return (
        <div className={containerClass}>
            {label && (
                <Form.Label className={labelClass}>
                    {label} {required && <span className="text-danger">*</span>}
                </Form.Label>
            )}
            <Form.Control
                type={type}
                className={className}
                value={value ?? ''}
                onChange={handleChange}
                onBlur={handleBlur}
                style={computedStyle}
                {...restProps}
            />
            {error && <small className="text-danger d-block mt-1">{error}</small>}
        </div>
    );
};

export default CustomTextField;
