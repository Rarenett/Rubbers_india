import React, { useState, useEffect, Fragment, useRef } from 'react';
import { Card, Button, Modal, Form } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import {
    getResponsibilityReminders,
    createResponsibilityReminder,
    updateResponsibilityReminder,
    deleteResponsibilityReminder,
    getResponsibilities,
    getDepartments,
    getEmployees
} from '../../../../services/HRManagementService';
import { usePermission } from '../../../../hooks/usePermission';
import CreateButton from '../../../../components/permissions/CreateButton';
import DeleteButton from '../../../../components/permissions/DeleteButton';
import EditButton from '../../../../components/permissions/EditButton';

const EMPTY_REMINDER = {
    responsibility: '',
    department: '',
    employees: [],
    start_date: '',
    end_date: '',
    frequency_days: '',
    remind_me_before: ''
};

const ResponsibilityReminderList = () => {
    const [reminders, setReminders] = useState([]);
    const [responsibilities, setResponsibilities] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [employees, setEmployees] = useState([]);
    
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    
    const [showModal, setShowModal] = useState(false);
    const [current, setCurrent] = useState({ ...EMPTY_REMINDER });
    const [animateTrigger, setAnimateTrigger] = useState(false);
    
    const { can } = usePermission();

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    useEffect(() => {
        fetchData();
        fetchDropdownData();
    }, []);

    useEffect(() => {
        const handleKeyDownEscape = (e) => {
            if (e.key === 'Escape' && showModal) {
                setAnimateTrigger(true);
                setTimeout(() => setAnimateTrigger(false), 300);
            }
        };
        window.addEventListener('keydown', handleKeyDownEscape);
        return () => window.removeEventListener('keydown', handleKeyDownEscape);
    }, [showModal]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getResponsibilityReminders();
            setReminders(data.results || data);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to fetch responsibility reminders.' });
        } finally {
            setLoading(false);
        }
    };

    const fetchDropdownData = async () => {
        try {
            const [respData, deptData, empData] = await Promise.all([
                getResponsibilities(),
                getDepartments(),
                getEmployees()
            ]);
            setResponsibilities(respData.results || respData || []);
            setDepartments(deptData.results || deptData || []);
            setEmployees(empData.results || empData || []);
        } catch (error) {
            console.error('Failed to fetch dropdown data', error);
        }
    };

    const handleShowModal = () => {
        setCurrent({ ...EMPTY_REMINDER });
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setCurrent({ ...EMPTY_REMINDER });
    };

    const handleEdit = (reminder) => {
        setCurrent({
            ...reminder,
            employees: reminder.employee_details?.map(emp => ({ value: emp.id, label: emp.name })) || []
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (!current.responsibility || !current.department || !current.start_date || !current.end_date || !current.frequency_days) {
                Swal.fire({ icon: 'warning', title: 'Warning', text: 'Please fill all required fields.' });
                return;
            }
            
            const payload = {
                ...current,
                employees: current.employees.map(emp => emp.value)
            };
            
            if (current.id) {
                await updateResponsibilityReminder(current.id, payload);
                Swal.fire({ icon: 'success', title: 'Success', text: 'Responsibility Reminder updated successfully!', timer: 2000, showConfirmButton: false });
            } else {
                await createResponsibilityReminder(payload);
                Swal.fire({ icon: 'success', title: 'Success', text: 'Responsibility Reminder scheduled successfully!', timer: 2000, showConfirmButton: false });
            }
            
            handleCloseModal();
            fetchData();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error || 'Failed to save responsibility reminder.' });
        }
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: 'Delete Reminder?',
            text: "Are you sure you want to delete this reminder?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deleteResponsibilityReminder(id);
                Swal.fire({ icon: 'success', title: 'Deleted', text: 'Responsibility reminder deleted successfully', timer: 2000, showConfirmButton: false });
                fetchData();
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete responsibility reminder.' });
            }
        }
    };

    const handleEmployeeChange = (selectedOptions) => {
        setCurrent(prev => ({
            ...prev,
            employees: selectedOptions || []
        }));
    };

    const filteredReminders = reminders.filter(r => 
        (r.responsibility_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.department_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredReminders.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredReminders.length / itemsPerPage);

    const respOptions = responsibilities.map(r => ({ 
        value: r.id, 
        label: r.dutyname_name ? `${r.dutyname_name} - ${r.name}` : r.name 
    }));
    const deptOptions = departments.map(d => ({ value: d.id, label: d.name }));
    const empOptions = employees
        .filter(emp => !current.department || emp.department_id === current.department)
        .map(emp => ({ 
            value: emp.id, 
            label: emp.full_name || emp.user_name || emp.email || 'Unknown' 
        }));

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '38px',
            borderColor: state.isFocused ? '#2ece8a' : '#cbd5e1',
            boxShadow: state.isFocused ? '0 0 0 2px rgba(46,206,138,0.15)' : 'none',
            '&:hover': { borderColor: '#2ece8a' },
            borderRadius: '10px',
            fontSize: '13px',
        }),
        menu: base => ({ ...base, zIndex: 9999, fontSize: '0.875rem' }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#2ece8a' : state.isFocused ? '#f0fdf6' : 'white',
            color: state.isSelected ? 'white' : '#333',
            cursor: 'pointer',
        }),
    };

    return (
        <div className="container-fluid">
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
                    background-color: #2ece8a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
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
                    max-height: 70vh;
                    overflow-y: auto;
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
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                }
                .item-custom-modal .form-control-custom::placeholder {
                    color: #94a3b8;
                }
                .item-custom-modal .btn-close-custom {
                    background-color: #7A70BA !important;
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
                    background-color: #6357a7 !important;
                }
                .item-custom-modal .btn-save-custom {
                    background-color: #2ece8a !important;
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
                    background-color: #26b277 !important;
                }
                @keyframes modalFeedback {
                    0%, 100% { transform: scale(1); }
                    20%, 60% { transform: scale(0.99) translateX(-4px); }
                    40%, 80% { transform: scale(1.01) translateX(4px); }
                }
                .modal-feedback {
                    animation: modalFeedback 0.25s ease-in-out !important;
                }
            `}</style>
            
            {/* <div className="page-titles">
                <button 
                    onClick={() => window.history.back()} 
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div> */}

            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center">
                            <Card.Title className="mb-0">Responsibility Reminders</Card.Title>
                            <div className="d-flex align-items-center gap-2">
                                <div style={{ width: '300px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Reminders..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '37px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                <div className="d-flex gap-2 ms-auto">
                                    <CreateButton module="responsibility-reminders" onClick={handleShowModal}>
                                        Create Reminder
                                    </CreateButton>
                                </div>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            {loading ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-responsive-md">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '80px', whiteSpace: 'nowrap' }}><strong>SL NO</strong></th>
                                                <th><strong>RESPONSIBILITY</strong></th>
                                                <th><strong>DEPARTMENT</strong></th>
                                                <th><strong>EMPLOYEES</strong></th>
                                                <th><strong>START DATE</strong></th>
                                                <th><strong>END DATE</strong></th>
                                                <th><strong>FREQUENCY (DAYS)</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredReminders.length === 0 ? (
                                                <tr><td colSpan="8" className="text-center py-4 text-muted">No reminders found</td></tr>
                                            ) : (
                                                currentItems.map((reminder, index) => (
                                                    <tr key={reminder.id}>
                                                        <td>{indexOfFirstItem + index + 1}</td>
                                                        <td><strong>{reminder.responsibility_name}</strong></td>
                                                        <td>{reminder.department_name}</td>
                                                        <td>
                                                            {reminder.employee_details?.map(emp => (
                                                                <span key={emp.id} className="badge badge-primary light me-1">{emp.name}</span>
                                                            ))}
                                                        </td>
                                                        <td>{reminder.start_date ? reminder.start_date.split('-').reverse().join('-') : ''}</td>
                                                        <td>{reminder.end_date ? reminder.end_date.split('-').reverse().join('-') : ''}</td>
                                                        <td>{reminder.frequency_days}</td>
                                                        <td className="text-end">
                                                            {can('hr', 'delete') || can('hr', 'edit') ? (
                                                                <div className="d-flex justify-content-end gap-2">
                                                                    {can('hr', 'edit') && (
                                                                        <EditButton 
                                                                            module="responsibility-reminders" 
                                                                            onClick={() => handleEdit(reminder)} 
                                                                            disabled={reminder.has_updates}
                                                                            title={reminder.has_updates ? "Cannot edit: Updates already submitted" : ""}
                                                                        />
                                                                    )}
                                                                    {can('hr', 'delete') && (
                                                                        <DeleteButton module="responsibility-reminders" onClick={() => handleDelete(reminder.id)} />
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="badge badge-danger light mt-1">No Access</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                    
                                    {totalPages > 1 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3">
                                            <span className="text-muted">
                                                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredReminders.length)} of {filteredReminders.length} entries
                                            </span>
                                            <div className="d-flex gap-1">
                                                <Button 
                                                    variant="outline-primary" 
                                                    size="sm" 
                                                    disabled={currentPage === 1}
                                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                                >
                                                    Previous
                                                </Button>
                                                <Button 
                                                    variant="outline-primary" 
                                                    size="sm" 
                                                    disabled={currentPage === totalPages}
                                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                                >
                                                    Next
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>

            <Modal 
                show={showModal} 
                onHide={handleCloseModal} 
                dialogClassName={`item-custom-modal ${animateTrigger ? 'modal-feedback' : ''}`}
                backdrop="static"
                keyboard={false}
                size="lg"
                centered
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-11v6h2v-6h-2zm0-4v2h2V7h-2z" fill="white" />
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {current.id ? 'Edit Responsibility Reminder' : 'Schedule Responsibility Reminder'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                {current.id ? 'Update reminder schedule details' : 'Enter details to create a new reminder schedule'}
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={handleCloseModal}>
                        &times;
                    </button>
                </div>

                <Form onSubmit={handleSubmit}>
                    <div className="modal-body-custom">
                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Responsibility <span className="text-danger">*</span></Form.Label>
                                <Select
                                    styles={selectStyles}
                                    options={respOptions}
                                    value={respOptions.find(opt => opt.value === current.responsibility) || null}
                                    onChange={(opt) => setCurrent({ ...current, responsibility: opt ? opt.value : '' })}
                                    placeholder="Select Responsibility"
                                    isClearable
                                    required
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Department <span className="text-danger">*</span></Form.Label>
                                <Select
                                    styles={selectStyles}
                                    options={deptOptions}
                                    value={deptOptions.find(opt => opt.value === current.department) || null}
                                    onChange={(opt) => setCurrent({ ...current, department: opt ? opt.value : '' })}
                                    placeholder="Select Department"
                                    isClearable
                                    required
                                />
                            </div>
                            
                            <div className="col-md-12 mb-3">
                                <Form.Label className="form-label-custom">Employees <span className="text-danger">*</span></Form.Label>
                                <Select
                                    styles={selectStyles}
                                    isMulti
                                    options={empOptions}
                                    value={current.employees}
                                    onChange={handleEmployeeChange}
                                    placeholder="Select Employees"
                                    required
                                />
                            </div>

                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Start Date <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="date"
                                    className="form-control-custom"
                                    value={current.start_date}
                                    onChange={(e) => setCurrent({ ...current, start_date: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">End Date <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="date"
                                    className="form-control-custom"
                                    value={current.end_date}
                                    onChange={(e) => setCurrent({ ...current, end_date: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Frequency (Days) <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="number"
                                    className="form-control-custom"
                                    value={current.frequency_days}
                                    onChange={(e) => setCurrent({ ...current, frequency_days: e.target.value })}
                                    min="1"
                                    placeholder="e.g. 90"
                                    required
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Remind Me Before (Days)</Form.Label>
                                <Form.Control
                                    type="number"
                                    className="form-control-custom"
                                    value={current.remind_me_before}
                                    onChange={(e) => setCurrent({ ...current, remind_me_before: e.target.value })}
                                    min="0"
                                    placeholder="e.g. 3"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <button type="button" className="btn-close-custom" onClick={handleCloseModal}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-save-custom">
                            {current.id ? 'Update Reminder' : 'Save Reminder'}
                        </button>
                    </div>
                </Form>
            </Modal>
        </div>
    );
};

export default ResponsibilityReminderList;
