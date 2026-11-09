import React from 'react';
import { Button } from 'react-bootstrap';
import { usePermission } from '../../hooks/usePermission';

const ApproveButton = ({ module, onClick, children, className, variant = "success", size = "sm", ...props }) => {
    const { can } = usePermission();

    // Hide the button if the user cannot approve in this module
    if (!can(module, 'approve')) {
        return null;
    }

    return (
        <Button
            variant={variant}
            size={size}
            className={`btn-approve-action ${className || ''}`.trim()}
            onClick={onClick}
            {...props}
        >
            <i className="fa fa-check"></i>
            {children || "Approve"}
        </Button>
    );
};

export default ApproveButton;
