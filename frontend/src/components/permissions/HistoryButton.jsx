import React from 'react';
import { Button } from 'react-bootstrap';
import { usePermission } from '../../hooks/usePermission';

const HistoryButton = ({ module, onClick, children, className, variant = "secondary", size = "sm", ...props }) => {
    const { can } = usePermission();

    // Hide the button if the user cannot view history in this module
    if (!can(module, 'history')) {
        return null;
    }

    return (
        <Button
            variant={variant}
            size={size}
            className={`btn-history-action ${className || ''}`.trim()}
            onClick={onClick}
            {...props}
        >
            <i className="fa fa-history me-1"></i>
            {children || "History"}
        </Button>
    );
};

export default HistoryButton;
