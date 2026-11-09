import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from 'react-bootstrap';

const GlobalReminderPopup = ({ reminder, onDismiss }) => {
    const navigate = useNavigate();

    const handleOpenTask = () => {
        onDismiss();
        navigate('/task-management/report');
    };

    return (
        <div className="card shadow mb-3 border-left-warning" style={{ width: '300px', backgroundColor: '#fff', borderLeft: '4px solid #ff9f00' }}>
            <div className="card-body p-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                    <h5 className="mb-0 text-warning"><i className="fa fa-bell mr-2"></i> Task Reminder</h5>
                    <button type="button" className="close" onClick={onDismiss}>
                        <span>&times;</span>
                    </button>
                </div>
                <h6 className="font-weight-bold">{reminder.taskName}</h6>
                <p className="mb-2 text-muted" style={{ fontSize: '13px' }}>
                    Your task deadline is approaching. <br/>
                    <strong>{reminder.minutes} minutes</strong> remaining.
                </p>
                <div className="d-flex justify-content-end mt-3">
                    <Button variant="light" size="sm" className="mr-2" onClick={onDismiss}>Dismiss</Button>
                    <Button variant="primary" size="sm" onClick={handleOpenTask}>Open Task</Button>
                </div>
            </div>
        </div>
    );
};

export default GlobalReminderPopup;
