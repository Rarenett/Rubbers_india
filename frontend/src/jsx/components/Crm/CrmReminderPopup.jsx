import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../../services/AxiosInstance';
import { Modal, Button } from 'react-bootstrap';

const CrmReminderPopup = () => {
    const navigate = useNavigate();
    const [reminders, setReminders] = useState([]);
    const [show, setShow] = useState(false);
    const [currentReminder, setCurrentReminder] = useState(null);

    useEffect(() => {
        const checkReminders = async () => {
            try {
                const res = await axiosInstance.get('/api/crm/assignments/reminders/');
                if (res.data.length > 0) {
                    const latest = res.data[0];
                    // Only show if it's a "new" reminder or if the popup is closed
                    if (!currentReminder || currentReminder.id !== latest.id) {
                        setCurrentReminder(latest);
                        setShow(true);
                    }
                    setReminders(res.data);
                } else {
                    setShow(false);
                    setCurrentReminder(null);
                }
            } catch (error) {
                console.error("Error fetching CRM reminders:", error);
            }
        };

        // Poll every 60 seconds
        const interval = setInterval(checkReminders, 60000);
        checkReminders(); // Initial check

        return () => clearInterval(interval);
    }, [currentReminder]);

    const handleAction = () => {
        setShow(false);
        navigate(`/crm/interactions?leadId=${currentReminder.lead}`);
    };

    if (!currentReminder) return null;

    return (
        <Modal show={show} onHide={() => setShow(false)} centered className="crm-reminder-modal">
            <Modal.Header closeButton style={{ background: 'var(--crm-accent)', color: 'white', border: 'none' }}>
                <Modal.Title className="fw-800">
                    <i className="fa fa-phone-square me-2"></i> Follow-up Reminder
                </Modal.Title>
            </Modal.Header>
            <Modal.Body className="p-4" style={{ background: 'var(--crm-card-bg)' }}>
                <div className="d-flex align-items-center mb-4">
                    <div className="flex-shrink-0">
                        <div style={{
                            width: '60px', height: '60px', borderRadius: '15px',
                            background: 'var(--crm-accent-soft)', color: 'var(--crm-accent)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.5rem', fontWeight: '800'
                        }}>
                            {currentReminder.lead_detail?.last_name?.[0] || 'L'}
                        </div>
                    </div>
                    <div className="ms-3">
                        <h4 className="mb-1 fw-800 text-dark">
                            {currentReminder.lead_detail?.first_name} {currentReminder.lead_detail?.last_name}
                        </h4>
                        <p className="mb-0 text-muted fw-600">{currentReminder.lead_detail?.company || 'Private Entity'}</p>
                    </div>
                </div>
                
                <div className="p-3 rounded-20 border mb-4" style={{ background: 'var(--crm-bg)' }}>
                    <small className="text-muted text-uppercase fw-800 d-block mb-1" style={{ fontSize: '0.65rem' }}>Previous Findings</small>
                    <p className="mb-0 fw-700 italic" style={{ fontSize: '0.9rem' }}>
                        "{currentReminder.remarks || 'No previous remarks found'}"
                    </p>
                </div>

                <div className="alert alert-warning py-2 mb-0 d-flex align-items-center gap-2" style={{ borderRadius: '12px', border: 'none' }}>
                    <i className="fa fa-clock-o"></i>
                    <span className="fw-700">Scheduled: {new Date(currentReminder.target_time).toLocaleString()}</span>
                </div>
            </Modal.Body>
            <Modal.Footer className="border-0 p-4 pt-0" style={{ background: 'var(--crm-card-bg)' }}>
                <Button variant="link" className="text-secondary fw-700" style={{ textDecoration: 'none' }} onClick={() => setShow(false)}>
                    Snooze
                </Button>
                <Button 
                    className="px-4 py-2" 
                    style={{ background: 'var(--crm-accent)', border: 'none', borderRadius: '12px', fontWeight: '800' }}
                    onClick={handleAction}
                >
                    Contact Now
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default CrmReminderPopup;
