import React, { useState, useEffect, useRef } from 'react';
import { Row, Col, Card, Form, Button, Table, Spinner, Badge, Modal } from 'react-bootstrap';
import ProductionService from '../../../services/ProductionService';
import MainSweetAlert from 'sweetalert2';
import Select from 'react-select';
import { showRequiredFieldsWarning } from '../../../utils/formValidation';

const EmployeeGroupForm = ({ show, onHide, groupId, onSuccess }) => {
    const [groupName, setGroupName] = useState('');
    const [description, setDescription] = useState('');

    const [designations, setDesignations] = useState([]);
    const [selectedDesignation, setSelectedDesignation] = useState('');

    const [employees, setEmployees] = useState([]);
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [loadingEmployees, setLoadingEmployees] = useState(false);

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (show) {
            fetchDesignations();
            if (groupId) {
                fetchGroupDetails(groupId);
            } else {
                setGroupName('');
                setDescription('');
                setSelectedDesignation('');
                setEmployees([]);
                setSelectedEmployees([]);
            }
        }
    }, [show, groupId]);

    const fetchGroupDetails = async (idToFetch) => {
        try {
            const response = await ProductionService.getEmployeeGroup(idToFetch);
            const group = response.data;
            setGroupName(group.group_name);
            setDescription(group.description || '');

            if (group.members) {
                const mappedEmployees = group.members.map(member => ({
                    id: member.employee,
                    user_name: member.employee_details?.full_name || member.employee_details?.user_name,
                    user_email: member.employee_details?.user_email,
                    designation_title: member.designation_name
                }));
                setSelectedEmployees(mappedEmployees);
            }
        } catch (error) {
            console.error('Error fetching teams details:', error);
            MainSweetAlert.fire('Error', 'Failed to fetch team details', 'error');
        }
    };

    const fetchDesignations = async () => {
        try {
            const response = await ProductionService.getDepartmentDesignations('?department__name=Production');
            if (response.data && response.data.results) {
                setDesignations(response.data.results);
            } else if (Array.isArray(response.data)) {
                setDesignations(response.data);
            }
        } catch (error) {
            console.error('Error fetching designations:', error);
        }
    };

    const fetchEmployeesByDesignation = async (designationId) => {
        if (!designationId) {
            setEmployees([]);
            return;
        }
        setLoadingEmployees(true);
        try {
            const response = await ProductionService.getEmployees(`?designation=${designationId}`);
            if (response.data && response.data.results) {
                setEmployees(response.data.results);
            } else if (Array.isArray(response.data)) {
                setEmployees(response.data);
            }
        } catch (error) {
            console.error('Error fetching employees:', error);
        } finally {
            setLoadingEmployees(false);
        }
    };

    const handleDesignationChange = (e) => {
        const value = e.target.value;
        setSelectedDesignation(value);
        fetchEmployeesByDesignation(value);
    };

    const handleEmployeeSelect = (employee) => {
        const isSelected = selectedEmployees.find(e => e.id === employee.id);
        if (isSelected) {
            setSelectedEmployees(selectedEmployees.filter(e => e.id !== employee.id));
        } else {
            setSelectedEmployees([...selectedEmployees, employee]);
        }
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            const newEmployees = employees.filter(emp => !selectedEmployees.find(se => se.id === emp.id));
            setSelectedEmployees([...selectedEmployees, ...newEmployees]);
        } else {
            const remaining = selectedEmployees.filter(se => !employees.find(emp => emp.id === se.id));
            setSelectedEmployees(remaining);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const missingFields = [];
        if (!groupName || !groupName.trim()) {
            missingFields.push('Team Name');
        }
        if (!selectedEmployees || selectedEmployees.length === 0) {
            missingFields.push('Team Members (select at least one employee)');
        }

        if (missingFields.length > 0) {
            showRequiredFieldsWarning(missingFields);
            return;
        }

        const payload = {
            group_name: groupName,
            description: description,
            member_ids: selectedEmployees.map(emp => emp.id)
        };

        setLoading(true);
        try {
            if (groupId) {
                await ProductionService.updateEmployeeGroup(groupId, payload);
                MainSweetAlert.fire('Success', 'Production Team Updated Successfully', 'success').then(() => {
                    onSuccess();
                    onHide();
                });
            } else {
                await ProductionService.createEmployeeGroup(payload);
                MainSweetAlert.fire('Success', 'Production Team Created Successfully', 'success').then(() => {
                    onSuccess();
                    onHide();
                });
            }
        } catch (error) {
            console.error('Error creating team:', error);
            const data = error.response?.data;
            let errorMsg = 'Failed to create team';

            if (data) {
                if (data.member_ids && Array.isArray(data.member_ids)) {
                    errorMsg = data.member_ids[0];
                } else if (data.group_name && Array.isArray(data.group_name)) {
                    errorMsg = data.group_name[0];
                } else if (data.non_field_errors) {
                    errorMsg = data.non_field_errors[0];
                } else if (typeof data === 'string') {
                    errorMsg = data;
                }
            }

            MainSweetAlert.fire('Error', errorMsg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const removeSelectedEmployee = (id) => {
        setSelectedEmployees(selectedEmployees.filter(e => e.id !== id));
    };

    const isAllSelected = employees.length > 0 && employees.every(emp => selectedEmployees.find(se => se.id === emp.id));

    const currentSelectControlRef = useRef(null);

    const getFocusable = () => {
        const modal = document.querySelector('.egfm-modal');
        if (!modal) return [];
        return Array.from(modal.querySelectorAll(
            'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )).filter(el => !el.closest('.react-select__menu'));
    };

    const focusNextFromControl = (control) => {
        const all = getFocusable();
        const index = all.findIndex(el => el === control || control.contains(el));
        if (index > -1 && index < all.length - 1) {
            all[index + 1].focus();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        const activeEl = document.activeElement;

        if (activeEl.tagName !== 'BUTTON') {
            e.preventDefault();
        }

        const all = getFocusable();
        const index = all.indexOf(activeEl);
        if (index > -1 && index < all.length - 1) {
            const next = all[index + 1];
            if (next.classList.contains('react-select__control')) {
                next.querySelector('input')?.focus();
            } else {
                next.focus();
            }
        }
    };

    const handleSelectFocus = (e) => {
        currentSelectControlRef.current = e.target.closest('.react-select__control');
    };

    const handleSelectKeyDown = (e) => {
        if (e.key === 'Enter') {
            const menuOpen = !!document.querySelector('.react-select__menu');
            if (!menuOpen) {
                e.preventDefault();
                const control = e.target.closest('.react-select__control');
                if (control) focusNextFromControl(control);
            }
        }
    };

    const handleFocus = (e) => {
        if (e.target.tagName === 'INPUT' && (e.target.type === 'number' || e.target.type === 'text')) {
            e.target.select();
        }
    };

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '46px',
            borderColor: state.isFocused ? '#2ece8a' : '#cbd5e1',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(46, 206, 138, 0.15)' : 'none',
            '&:hover': { borderColor: '#2ece8a' },
            borderRadius: '10px',
            fontSize: '14px',
        }),
        menu: base => ({ ...base, zIndex: 99999, fontSize: '14px' }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#2ece8a' : state.isFocused ? '#e9fbf3' : 'white',
            color: state.isSelected ? 'white' : '#334155',
            cursor: 'pointer',
        }),
    };

    const designationOptions = designations.map(desig => ({
        value: desig.id,
        label: `${desig.department_name ? desig.department_name + ' - ' : ''}${desig.designation_name || desig.id}`
    }));

    return (
        <>
            <style>{`
                .egfm-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .egfm-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .egfm-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #2ece8a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
                }
                .egfm-modal .modal-close-x {
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
                .egfm-modal .modal-close-x:hover { color: #555; }
                .egfm-modal .modal-body-custom { padding: 24px 28px; }
                .egfm-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .egfm-modal .form-label-custom {
                    font-size: 14px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 8px;
                }
                .egfm-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 12px 16px;
                    font-size: 14px;
                    color: inherit;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .egfm-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                }
                .egfm-modal .form-control-custom::placeholder { color: #94a3b8; }
                .egfm-modal .btn-close-custom {
                    background-color: #7A70BA !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .egfm-modal .btn-close-custom:hover { background-color: #6357a7 !important; }
                .egfm-modal .btn-save-custom {
                    background-color: #2ece8a !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .egfm-modal .btn-save-custom:hover { background-color: #26b277 !important; }
                .egfm-selected-container {
                    background-color: #ffffff;
                }
                .egfm-selected-item {
                    background-color: #f8f9fa;
                    border-color: #eef0f3;
                }
                .egfm-employee-card {
                    background-color: #ffffff;
                }
                .egfm-row-selected {
                    background-color: #f8f9fa !important;
                }

                /* Dark mode overrides */
                [data-theme-version="dark"] .egfm-modal .modal-content { background-color: #2F363E !important; }
                [data-theme-version="dark"] .egfm-modal .modal-header-custom { border-bottom-color: #3d464e !important; }
                [data-theme-version="dark"] .egfm-modal .modal-footer-custom { background-color: #24292D !important; border-top-color: #3d464e !important; }
                [data-theme-version="dark"] .egfm-modal .form-label-custom { color: #a0aec0 !important; }
                [data-theme-version="dark"] .egfm-modal .form-control-custom { background-color: #24292D !important; border-color: #4a5568 !important; color: #fff !important; }
                [data-theme-version="dark"] .egfm-modal .modal-title { color: #fff !important; }
                [data-theme-version="dark"] .egfm-selected-container { background-color: #24292D !important; border-color: #3d464e !important; }
                [data-theme-version="dark"] .egfm-selected-item { background-color: #2F363E !important; border-color: #3d464e !important; color: #fff !important; }
                [data-theme-version="dark"] .egfm-employee-card { background-color: #24292D !important; border-color: #3d464e !important; }
                [data-theme-version="dark"] .egfm-row-selected { background-color: rgba(46, 206, 138, 0.15) !important; color: #fff !important; }
            `}</style>

            <Modal show={show} onHide={onHide} size="xl" centered dialogClassName="egfm-modal modal-90w">
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <i className="fa fa-users text-white" style={{ fontSize: '20px' }}></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px' }}>
                                {groupId ? 'Edit Production Team' : 'Create Production Team'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage production team
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={onHide}>&times;</button>
                </div>

                <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown} onFocus={handleFocus} noValidate>
                    <div className="modal-body-custom">
                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="form-label-custom">Team Name <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="text"
                                        className="form-control-custom"
                                        placeholder="Enter Team Name"
                                        value={groupName}
                                        onChange={(e) => setGroupName(e.target.value)}
                                        autoFocus
                                        required
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="form-label-custom">Description</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        rows={1}
                                        className="form-control-custom"
                                        placeholder="Enter Description"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <hr />
                        <h5 className="mb-3">Add Members</h5>

                        <Row>
                            <Col md={4}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="form-label-custom">Select Department / Designation</Form.Label>
                                    <Select
                                        classNamePrefix="react-select"
                                        options={designationOptions}
                                        value={designationOptions.find(opt => opt.value === selectedDesignation) || null}
                                        onChange={(opt) => {
                                            const value = opt ? opt.value : '';
                                            setSelectedDesignation(value);
                                            fetchEmployeesByDesignation(value);
                                            if (opt) {
                                                const control = currentSelectControlRef.current;
                                                setTimeout(() => { if (control) focusNextFromControl(control); }, 50);
                                            }
                                        }}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        openMenuOnFocus={true}
                                        styles={selectStyles}
                                        placeholder="Search Designation..."
                                        isClearable
                                    />
                                </Form.Group>

                                <div className="mt-4 mb-4">
                                    <h6 className="mb-3 d-flex justify-content-between align-items-center">
                                        <span>Selected Members</span>
                                        <Badge bg="primary" pill>{selectedEmployees.length}</Badge>
                                    </h6>
                                    <div style={{ maxHeight: '350px', overflowY: 'auto' }} className="border p-2 rounded shadow-sm egfm-selected-container">
                                        {selectedEmployees.length === 0 ? (
                                            <div className="text-center py-4 text-muted">
                                                <i className="fa fa-users mb-2" style={{ fontSize: '24px', opacity: 0.5 }}></i>
                                                <p className="mb-0" style={{ fontSize: '14px' }}>No employees selected.</p>
                                            </div>
                                        ) : (
                                            <div className="d-flex flex-column" style={{ gap: '8px' }}>
                                                {selectedEmployees.map(emp => (
                                                    <div
                                                        key={emp.id}
                                                        className="d-flex justify-content-between align-items-center p-2 rounded border egfm-selected-item"
                                                    >
                                                        <div className="d-flex align-items-center">
                                                            <div
                                                                className="rounded-circle d-flex align-items-center justify-content-center text-white bg-primary me-2 shadow-sm"
                                                                style={{ width: '32px', height: '32px', fontSize: '14px', fontWeight: 'bold', opacity: 0.85 }}
                                                            >
                                                                {(emp.full_name || emp.user_name || emp.employee_details?.full_name || emp.employee_details?.user_name || emp.user?.username || 'N').charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <h6 className="mb-0" style={{ fontSize: '14px' }}>{emp.full_name || emp.user_name || emp.employee_details?.full_name || emp.employee_details?.user_name || emp.user?.username || 'N/A'}</h6>
                                                                {emp.designation_title && <span className="text-muted d-block" style={{ fontSize: '11px' }}>{emp.designation_title}</span>}
                                                            </div>
                                                        </div>
                                                        <Button
                                                            variant="link"
                                                            className="p-0 text-danger ms-2"
                                                            onClick={() => removeSelectedEmployee(emp.id)}
                                                            style={{ textDecoration: 'none', opacity: 0.7 }}
                                                            onMouseOver={(e) => e.currentTarget.style.opacity = 1}
                                                            onMouseOut={(e) => e.currentTarget.style.opacity = 0.7}
                                                        >
                                                            <i className="fa fa-times-circle" style={{ fontSize: '18px' }}></i>
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Col>

                            <Col md={8}>
                                <Card className="border shadow-none egfm-employee-card">
                                    <Card.Header className="border-bottom">
                                        <h6 className="mb-0">Select Employees</h6>
                                    </Card.Header>
                                    <Card.Body className="p-0" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                                        {loadingEmployees ? (
                                            <div className="text-center p-5">
                                                <Spinner animation="border" variant="primary" />
                                            </div>
                                        ) : employees.length === 0 ? (
                                            <div className="text-center p-5 text-muted">
                                                {selectedDesignation ? 'No employees found in this designation.' : 'Select a designation to view employees.'}
                                            </div>
                                        ) : (
                                            <Table hover responsive className="mb-0">
                                                <thead className="table-light sticky-top">
                                                    <tr>
                                                        <th style={{ width: '40px' }}>
                                                            <Form.Check
                                                                type="checkbox"
                                                                checked={isAllSelected}
                                                                onChange={handleSelectAll}
                                                            />
                                                        </th>
                                                        <th>Employee</th>
                                                        <th>Designation</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {employees.map(emp => {
                                                        const isSelected = !!selectedEmployees.find(e => e.id === emp.id);
                                                        return (
                                                            <tr
                                                                key={emp.id}
                                                                onClick={() => handleEmployeeSelect(emp)}
                                                                className={isSelected ? 'egfm-row-selected' : ''}
                                                                style={{ cursor: 'pointer' }}
                                                            >
                                                                <td onClick={(e) => e.stopPropagation()}>
                                                                    <Form.Check
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        onChange={() => handleEmployeeSelect(emp)}
                                                                    />
                                                                </td>
                                                                <td>
                                                                    <div className="d-flex align-items-center">
                                                                        <div
                                                                            className="rounded-circle d-flex align-items-center justify-content-center text-white bg-primary me-3 shadow-sm"
                                                                            style={{ width: '35px', height: '35px', fontSize: '15px', fontWeight: 'bold', opacity: 0.85 }}
                                                                        >
                                                                            {(emp.full_name || emp.user_name || emp.employee_details?.full_name || emp.employee_details?.user_name || emp.user?.username || 'N').charAt(0).toUpperCase()}
                                                                        </div>
                                                                        <div>
                                                                            <h6 className="mb-0">{emp.full_name || emp.user_name || emp.employee_details?.full_name || emp.employee_details?.user_name || emp.user?.username || 'N/A'}</h6>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td>{emp.designation_title || 'N/A'}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </Table>
                                        )}
                                    </Card.Body>
                                </Card>
                            </Col>
                        </Row>

                        <div className="modal-footer-custom">
                            <Button type="button" className="btn-close-custom" onClick={onHide}>Close</Button>
                            <Button type="submit" className="btn-save-custom" disabled={loading}>
                                {loading ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : (groupId ? 'Update' : 'Save')}
                            </Button>
                        </div>
                    </div>
                </Form>
            </Modal>
        </>
    );
};

export default EmployeeGroupForm;
