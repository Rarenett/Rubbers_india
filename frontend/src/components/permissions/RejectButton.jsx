import React from 'react';
import { Button } from 'react-bootstrap';
import { usePermission } from '../../hooks/usePermission';

const RejectButton = ({ module, onClick, children, className, variant = "danger", size = "sm", ...props }) => {
    const { can } = usePermission();

    // Hide the button if the user cannot reject in this module
    if (!can(module, 'reject')) {
        return null;
    }

    return (
        <Button
            variant={variant}
            size={size}
            className={`btn-reject-action ${className || ''}`.trim()}
            onClick={onClick}
            {...props}
        >
            <i className="fa fa-times"></i>
            {children || "Reject"}
        </Button>
    );
};

export default RejectButton;
