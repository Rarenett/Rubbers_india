import React from 'react';
import { Button } from 'react-bootstrap';
import { usePermission } from '../../hooks/usePermission';

const DetailsButton = ({ module, onClick, children, className, variant = "info", size = "sm", ...props }) => {
    const { can } = usePermission();

    // Hide the button if the user cannot view details in this module
    if (!can(module, 'details')) {
        return null;
    }

    return (
        <Button
            variant={variant}
            size={size}
            className={`btn-details-action ${className || ''}`.trim()}
            onClick={onClick}
            {...props}
        >
            <i className="fa fa-eye"></i>
            {children || "Details"}
        </Button>
    );
};

export default DetailsButton;
