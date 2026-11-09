import React from 'react';
import { Button } from 'react-bootstrap';
import { usePermission } from '../../hooks/usePermission';

const AllocateButton = ({ module, onClick, children, className, variant = "warning", size = "sm", ...props }) => {
    const { can } = usePermission();

    // Hide the button if the user cannot allocate in this module
    if (!can(module, 'allocate')) {
        return null;
    }

    return (
        <Button
            variant={variant}
            size={size}
            className={`btn-allocate-action ${className || ''}`.trim()}
            onClick={onClick}
            {...props}
        >
            <i className="fa fa-share-alt"></i>
            {children || "Allocate"}
        </Button>
    );
};

export default AllocateButton;
