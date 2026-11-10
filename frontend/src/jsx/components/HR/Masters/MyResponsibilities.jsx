import React, { useState, useEffect, Fragment } from 'react';
import { Button, Modal, Form, Spinner, Card, Tab, Nav, Badge } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { getMyAssignedResponsibilityReminders, submitResponsibilityUpdate, getMySubmittedUpdates } from '../../../../services/HRManagementService';
import PageTitle from '../../../layouts/PageTitle';

const MyResponsibilities = () => {
    const [reminders, setReminders] = useState([]);
    const [submittedUpdates, setSubmittedUpdates] = useState([]);
    const [activeTab, setActiveTab] = useState('pending');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [selectedReminder, setSelectedReminder] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Form State
    const [updateDate, setUpdateDate] = useState('');
    const [remarks, setRemarks] = useState('');
    const [fileUpload, setFileUpload] = useState(null);
    const [fileUploadName, setFileUploadName] = useState('No file chosen');

    useEffect(() => {
        fetchMyResponsibilities();
    }, []);

    const fetchMyResponsibilities = async () => {
        setLoading(true);
        try {
            const [pendingData, submittedData] = await Promise.all([
                getMyAssignedResponsibilityReminders(),
                getMySubmittedUpdates()
            ]);
            setReminders(pendingData);
            setSubmittedUpdates(submittedData);
        } catch (error) {
            console.error("Error fetching my responsibilities:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to load responsibilities.',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleShowUpdate = (reminder) => {
        setSelectedReminder(reminder);
        setUpdateDate(new Date().toISOString().split('T')[0]); // Default to today
        setRemarks('');
        setFileUpload(null);
        setFileUploadName('No file chosen');
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedReminder(null);
    };

    const handleFileChange = (e) => {
        if (e.target.files.length > 0) {
            setFileUpload(e.target.files[0]);
            setFileUploadName(e.target.files[0].name);
        } else {
            setFileUpload(null);
            setFileUploadName('No file chosen');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!selectedReminder || !updateDate || !remarks) {
            Swal.fire({
                icon: 'warning',
                title: 'Required Fields',
                text: 'Please provide both an update date and remarks.',
            });
            return;
        }

        setIsSubmitting(true);
        
        try {
            const formData = new FormData();
            formData.append('reminder', selectedReminder.id);
            formData.append('update_date', updateDate);
            formData.append('remarks', remarks);
            if (fileUpload) {
                formData.append('file_upload', fileUpload);
            }

            await submitResponsibilityUpdate(formData);
            
            Swal.fire({
                icon: 'success',
                title: 'Success!',
                text: 'Responsibility update submitted successfully.',
                timer: 1500,
                showConfirmButton: false
            });
            
            handleCloseModal();
            fetchMyResponsibilities(); // Refresh the list
        } catch (error) {
            console.error("Error submitting update:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to submit update. Please try again.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredReminders = reminders.filter(r => 
        (r.responsibility_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.department_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredSubmittedUpdates = submittedUpdates.filter(u => 
        (u.responsibility_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.department_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="container-fluid">
            <div className="row">
                    <div className="col-lg-12">
                        <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap">
                            <Card.Title className="mb-0">My Responsibilities</Card.Title>
                            <div className="d-flex align-items-center gap-2">
                                <div style={{ width: '300px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Responsibilities..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '37px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
                                <Nav className="nav nav-tabs mb-4">
                                    <Nav.Item>
                                        <Nav.Link eventKey="pending" className="cursor-pointer">
                                            Pending
                                        </Nav.Link>
                                    </Nav.Item>
                                    <Nav.Item>
                                        <Nav.Link eventKey="submitted" className="cursor-pointer">
                                            Submitted
                                        </Nav.Link>
                                    </Nav.Item>
                                </Nav>
                                <Tab.Content>
                                    <Tab.Pane eventKey="pending">
                                        {loading ? (
                                            <div className="text-center py-5">
                                                <div className="spinner-border text-primary" role="status">
                                                    <span className="visually-hidden">Loading...</span>
                                                </div>
                                            </div>
                                        ) : filteredReminders.length === 0 ? (
                                            <div className="text-center py-5">
                                                <h5 className="text-muted">You have no pending responsibilities to update.</h5>
                                            </div>
                                        ) : (
                                            <div className="table-responsive">
                                                <table className="table table-responsive-md">
                                                    <thead>
                                                        <tr>
                                                            <th style={{ width: '80px', whiteSpace: 'nowrap' }}><strong>SL NO</strong></th>
                                                            <th><strong>RESPONSIBILITY</strong></th>
                                                            <th><strong>DEPARTMENT</strong></th>
                                                            <th><strong>DATE</strong></th>
                                                            <th><strong>FREQUENCY (DAYS)</strong></th>
                                                            <th className="text-end"><strong>ACTIONS</strong></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredReminders.map((reminder, index) => (
                                                            <tr key={reminder.id}>
                                                                <td>{index + 1}</td>
                                                                <td><strong>{reminder.responsibility_name}</strong></td>
                                                                <td>{reminder.department_name}</td>
                                                                <td>{reminder.reminder_date ? reminder.reminder_date.split('-').reverse().join('-') : ''}</td>
                                                                <td>{reminder.frequency_days || '-'}</td>
                                                                <td className="text-end">
                                                                    <Button 
                                                                        variant="success" 
                                                                        size="sm" 
                                                                        onClick={() => handleShowUpdate(reminder)}
                                                                        style={{ borderRadius: '8px', padding: '6px 14px' }}
                                                                    >
                                                                        Submit Update
                                                                    </Button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </Tab.Pane>
                                    <Tab.Pane eventKey="submitted">
                                        {loading ? (
                                            <div className="text-center py-5">
                                                <div className="spinner-border text-primary" role="status">
                                                    <span className="visually-hidden">Loading...</span>
                                                </div>
                                            </div>
                                        ) : filteredSubmittedUpdates.length === 0 ? (
                                            <div className="text-center py-5">
                                                <h5 className="text-muted">You have no submitted responsibility updates.</h5>
                                            </div>
                                        ) : (
                                            <div className="table-responsive">
                                                <table className="table table-responsive-md">
                                                    <thead>
                                                        <tr>
                                                            <th style={{ width: '80px', whiteSpace: 'nowrap' }}><strong>SL NO</strong></th>
                                                            <th><strong>RESPONSIBILITY</strong></th>
                                                            <th><strong>DEPARTMENT</strong></th>
                                                            <th><strong>UPDATE DATE</strong></th>
                                                            <th><strong>REMARKS</strong></th>
                                                            <th className="text-end"><strong>ATTACHMENT</strong></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredSubmittedUpdates.map((update, index) => (
                                                            <tr key={update.id}>
                                                                <td>{index + 1}</td>
                                                                <td><strong>{update.responsibility_name}</strong></td>
                                                                <td>{update.department_name}</td>
                                                                <td>{update.update_date ? update.update_date.split('-').reverse().join('-') : ''}</td>
                                                                <td>{update.remarks}</td>
                                                                <td className="text-end">
                                                                    {update.file_upload ? (
                                                                        <a href={update.file_upload} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm" style={{ borderRadius: '6px', padding: '4px 10px' }}>
                                                                            <i className="fas fa-paperclip me-1"></i> View
                                                                        </a>
                                                                    ) : (
                                                                        <span className="text-muted">-</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </Tab.Pane>
                                </Tab.Content>
                            </Tab.Container>
                        </Card.Body>
                    </Card>
                </div>
            </div>

            <style>{`
                .item-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .item-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .item-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #0a500f;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .item-custom-modal .modal-close-x {
                    border: none;
                    background: transparent;
                    font-size: 24px;
                    color: #aaa;
                    cursor: pointer;
                    transition: color 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 4px;
                }
                .item-custom-modal .modal-close-x:hover {
                    color: #555;
                }
                .item-custom-modal .modal-body-custom {
                    padding: 24px 28px;
                }
                .item-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .item-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .item-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .item-custom-modal .form-control-custom::placeholder {
                    color: #94a3b8;
                }
                .item-custom-modal .btn-close-custom {
                    background-color: #dc3545 !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s;
                }
                .item-custom-modal .btn-close-custom:hover {
                    background-color: #bb2d3b !important;
                }
                .item-custom-modal .btn-save-custom {
                    background-color: #0a500f !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s;
                }
                .item-custom-modal .btn-save-custom:hover {
                    background-color: #073d0b !important;
                }
                .item-custom-modal .file-upload-wrapper {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    overflow: hidden;
                    background-color: #fff;
                }
                .item-custom-modal .file-upload-btn {
                    background-color: #f1f5f9;
                    padding: 10px 16px;
                    border-right: 1px solid #cbd5e1;
                    color: #475569;
                    font-size: 13px;
                    font-weight: 500;
                }
                .item-custom-modal .file-upload-text {
                    padding: 10px 16px;
                    color: #334155;
                    font-size: 13px;
                    flex: 1;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .item-custom-modal .file-input-hidden {
                    position: absolute;
                    left: -9999px;
                }
                .item-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
            `}</style>
            <Modal show={showModal} onHide={handleCloseModal} dialogClassName="item-custom-modal" centered backdrop="static">
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <i className="fas fa-pencil-alt text-white" style={{ fontSize: '20px' }}></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                 Responsibility Update
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter update details for this responsibility
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={handleCloseModal}>
                        &times;
                    </button>
                </div>
                <Form onSubmit={handleSubmit}>
                    <div className="modal-body-custom">
                        {selectedReminder && (
                            <div className="mb-4 p-3 rounded" style={{ backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0' }}>
                                <div style={{ fontWeight: '600', color: '#334155', fontSize: '15px' }}>{selectedReminder.responsibility_name}</div>
                                <div style={{ color: '#64748b', fontSize: '13px', marginTop: '2px' }}>
                                    Date: {selectedReminder.reminder_date ? selectedReminder.reminder_date.split('-').reverse().join('-') : ''} | Dept: {selectedReminder.department_name}
                                </div>
                            </div>
                        )}
                        
                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Update Date <span className="text-danger">*</span></Form.Label>
                            <Form.Control 
                                type="date" 
                                className="form-control-custom"
                                value={updateDate} 
                                onChange={(e) => setUpdateDate(e.target.value)} 
                                required
                            />
                        </div>

                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Remarks / Report <span className="text-danger">*</span></Form.Label>
                            <Form.Control 
                                as="textarea" 
                                className="form-control-custom"
                                rows={4}
                                placeholder="Write your update remarks here..." 
                                value={remarks} 
                                onChange={(e) => setRemarks(e.target.value)}
                                required
                            />
                        </div>

                        <div className="mb-2">
                            <Form.Label className="form-label-custom">Supporting Document (Optional)</Form.Label>
                            <label className="file-upload-wrapper w-100 cursor-pointer m-0">
                                <div className="file-upload-btn">Choose File</div>
                                <div className="file-upload-text">{fileUploadName}</div>
                                <input 
                                    type="file" 
                                    className="file-input-hidden"
                                    onChange={handleFileChange}
                                />
                            </label>
                            <div className="text-muted mt-1" style={{ fontSize: '12px' }}>
                                Upload any relevant proof or documentation.
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <button type="button" className="btn-close-custom" onClick={handleCloseModal}>Close</button>
                        <button type="submit" className="btn-save-custom" disabled={isSubmitting}>
                            {isSubmitting ? <Spinner size="sm" animation="border" className="me-2" /> : null}
                            Submit Update
                        </button>
                    </div>
                </Form>
            </Modal>
        </div>
    );
};

export default MyResponsibilities;
