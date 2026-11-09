import React, { useState } from 'react';
import { Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';

const DeleteButton = ({
    module,
    onClick,
    to,
    children,
    className,
    variant = "outline-danger",
    size = "sm",
    style,
    iconClass = "fa fa-trash",
    ...props
}) => {
    const { can } = usePermission();
    const [hovered, setHovered] = useState(false);

    if (module && !can(module, 'delete')) {
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
            className={`shadow btn-delete-action ${className || ''}`.trim()}
            style={mergedStyle}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            {...buttonProps}
            {...props}
        >
            <i
                className={iconClass}
                style={{ color: hovered ? '#fff' : 'inherit' }}
            />
            {children}
        </Button>
    );
};

export default DeleteButton;