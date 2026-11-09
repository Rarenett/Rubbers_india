import React from 'react';
import { Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';

const CreateButton = ({ module, onClick, to, children, className, variant = "primary", style, ...props }) => {
    const { can } = usePermission();
    const navigate = useNavigate();

    // Hide the button if the user cannot create in this module
    if (module && !can(module, 'create')) {
        return null;
    }

    const handleClick = (e) => {
        if (onClick) {
            onClick(e);
        } else if (to) {
            navigate(to);
        }
    };

    const defaultStyle = {
        backgroundColor: 'rgb(61, 53, 119)',
        borderColor: 'rgb(61, 53, 119)',
        color: 'white',
        height: '34px',
        display: 'flex',
        alignItems: 'center',
        fontSize: '13px'
    };

    const mergedStyle = {
        ...defaultStyle,
        ...style
    };

    return (
        <Button
            variant={variant}
            className={`btn-create-action ${className || ''}`.trim()}
            style={mergedStyle}
            onClick={handleClick}
            {...props}
        >
            <i className="fa fa-plus me-2"></i>
            {children || "Create"}
        </Button>
    );
};

export default CreateButton;
