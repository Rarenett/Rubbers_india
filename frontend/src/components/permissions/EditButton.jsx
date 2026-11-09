import React from 'react';
import { Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';

const EditButton = ({ module, action = 'edit', icon = 'fa fa-pencil-alt', onClick, to, children, className, variant = "outline-primary", size = "sm", style, ...props }) => {
    const { can } = usePermission();

    // Hide the button if the user cannot perform this action in this module
    if (module && !can(module, action)) {
        return null;
    }

    const buttonProps = to ? { as: Link, to } : { onClick };

    const defaultStyle = {
        width: '28px',
        height: '28px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0',
        fontSize: '12px',
        borderRadius: '6px',
    };

    const mergedStyle = {
        ...defaultStyle,
        ...style,
    };

    return (
        <Button
            variant={variant}
            size={size}
            className={`shadow btn-edit-action ${className || ''}`.trim()}
            style={mergedStyle}
            {...buttonProps}
            {...props}
        >
            <i className={icon}></i>
            {children}
        </Button>
    );
};

export default EditButton;
