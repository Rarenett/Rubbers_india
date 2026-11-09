import React, { useState, useEffect, Fragment, useRef } from 'react';
import { Card, Modal, Form } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import Select, { components } from 'react-select';
import Swal from 'sweetalert2';
import {
    getRenewalReminders,
    createRenewalReminder,
    updateRenewalReminder,
    deleteRenewalReminder,
    getBranches,
    getDepartments,
    getEmployees,
    getRenewalSubjects
} from '../../../services/RenewalService';
import { usePermission } from '../../../hooks/usePermission';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import RenewalSubjectModal from './RenewalSubjectModal';
import CompanyDatePicker from '../Common/CompanyDatePicker';
import { formatDate } from '../../../utils/dateUtils';
import RenewalUpdationModal from './RenewalUpdationModal';

const selectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: '40px',
        height: 'auto',
        borderColor: state.isFocused ? '#2ece8a' : '#cbd5e1',
        boxShadow: state.isFocused ? '0 0 0 3px rgba(46, 206, 138, 0.15)' : 'none',
        borderRadius: '10px',
        backgroundColor: '#fff',
        fontSize: '13px',
        '&:hover': {
            borderColor: state.isFocused ? '#2ece8a' : '#cbd5e1',
        },
    }),
    valueContainer: (base) => ({
        ...base,
        padding: '4px 10px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px',
        alignItems: 'center',
    }),
    input: (base) => ({
        ...base,
        margin: 0,
        padding: 0,
        color: '#334155',
    }),
    placeholder: (base) => ({
        ...base,
        color: '#94a3b8',
    }),
    menu: (base) => ({
        ...base,
        zIndex: 9999,
        borderRadius: '10px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
        fontSize: '13px',
    }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isSelected ? '#2ece8a' : state.isFocused ? 'rgba(46, 206, 138, 0.1)' : '#fff',
        color: state.isSelected ? '#fff' : '#1e293b',
        cursor: 'pointer',
        padding: '8px 14px',
    }),
    multiValue: (base) => ({
        ...base,
        backgroundColor: 'rgba(46, 206, 138, 0.12)',
        borderRadius: '6px',
        border: '1px solid rgba(46, 206, 138, 0.3)',
        margin: '2px',
        display: 'flex',
        alignItems: 'center',
    }),
    multiValueLabel: (base) => ({
        ...base,
        color: '#0f5132',
        fontWeight: '600',
        fontSize: '12px',
        padding: '2px 8px',
    }),
    multiValueRemove: (base) => ({
        ...base,
        color: '#0f5132',
        cursor: 'pointer',
        paddingLeft: '4px',
        paddingRight: '6px',
        borderRadius: '0 6px 6px 0',
        '&:hover': {
            backgroundColor: '#2ece8a',
            color: '#fff',
        },
    }),
};

const CheckboxOption = (props) => {
    return (
        <components.Option {...props}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                    type="checkbox"
                    checked={props.isSelected}
                    onChange={() => null}
                    style={{ marginRight: '10px', cursor: 'pointer' }}
                />
                <label style={{ margin: 0, cursor: 'pointer', fontWeight: props.data?.value === 'all' ? '600' : 'normal' }}>
                    {props.label}
                </label>
            </div>
        </components.Option>
    );
};

const RenewalReminderList = () => {
    const { can } = usePermission();
    const [loading, setLoading] = useState(false);
    const [reminders, setReminders] = useState([]);
    const [editMode, setEditMode] = useState(false);
    const [editId, setEditId] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const formRef = useRef(null);
    const currentSelectControlRef = useRef(null);

    // Dropdown options
    const [branchOptions, setBranchOptions] = useState([]);
    const [subjectOptions, setSubjectOptions] = useState([]);
    const [departmentOptions, setDepartmentOptions] = useState([]);
    const [employeeOptions, setEmployeeOptions] = useState([]);

    // Quick-add Subject Modal state
    const [showSubjectModal, setShowSubjectModal] = useState(false);
    const [showUpdationModal, setShowUpdationModal] = useState(false);

    // Form data
    const [formData, setFormData] = useState({
        branch: null,
        renewal_subject: null,
        name: '',
        department: null,
        allocated_to: [],
        renewal_date: '',
        reminder_days: 30,
        remarks: '',
    });

    useEffect(() => {
        fetchReminders();
        fetchDropdownData();
    }, []);

    const fetchReminders = async () => {
        try {
            setLoading(true);
            const data = await getRenewalReminders();
            const arr = Array.isArray(data) ? data : (data.results || []);
            setReminders(arr);
        } catch (error) {
            console.error("Error fetching renewal reminders:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDropdownData = async () => {
        try {
            const [branches, subjects, departments] = await Promise.all([
                getBranches(),
                getRenewalSubjects(),
                getDepartments()
            ]);

            const bArr = Array.isArray(branches) ? branches : (branches.results || []);
            setBranchOptions(bArr.map(b => ({
                value: b.id,
                label: b.branch_name || b.name || `Branch #${b.id}`
            })));

            const sArr = Array.isArray(subjects) ? subjects : (subjects.results || []);
            setSubjectOptions(sArr.map(s => ({
                value: s.id,
                label: s.name
            })));

            const dArr = Array.isArray(departments) ? departments : (departments.results || []);
            setDepartmentOptions(dArr.map(d => ({
                value: d.id,
                label: d.department_name || d.name || `Department #${d.id}`
            })));
        } catch (err) {
            console.error("Error fetching dropdown options:", err);
        }
    };

    // Dependent Dropdown: Fetch concerned employees when department changes
    useEffect(() => {
        if (formData.department) {
            fetchEmployeesByDepartment(formData.department);
        } else {
            setEmployeeOptions([]);
        }
    }, [formData.department]);

    const fetchEmployeesByDepartment = async (deptId) => {
        try {
            const emps = await getEmployees(deptId);
            const eArr = Array.isArray(emps) ? emps : (emps.results || []);
            const options = eArr.map(emp => ({
                value: emp.id,
                label: emp.user_name || emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.user_email || emp.email || `Employee #${emp.id}`
            }));
            if (options.length > 0) {
                setEmployeeOptions(options);
            } else {
                setEmployeeOptions([]);
            }
        } catch (err) {
            console.error("Error fetching employees for department:", err);
            setEmployeeOptions([]);
        }
    };

    const handleShowModal = (reminder = null) => {
        if (reminder && reminder.id) {
            setEditMode(true);
            setEditId(reminder.id);
            setFormData({
                branch: reminder.branch || null,
                renewal_subject: reminder.renewal_subject || null,
                name: reminder.name || '',
                department: reminder.department || null,
                allocated_to: Array.isArray(reminder.allocated_to_details) && reminder.allocated_to_details.length > 0
                    ? reminder.allocated_to_details.map(emp => emp.id)
                    : (Array.isArray(reminder.allocated_to) ? reminder.allocated_to.map(id => (typeof id === 'object' && id !== null) ? id.id : id) : []),
                renewal_date: reminder.renewal_date || '',
                reminder_days: reminder.reminder_days || 30,
                remarks: reminder.remarks || '',
            });
        } else {
            setEditMode(false);
            setEditId(null);
            setFormData({
                branch: null,
                renewal_subject: null,
                name: '',
                department: null,
                allocated_to: [],
                renewal_date: '',
                reminder_days: 30,
                remarks: '',
            });
        }
        setShowModal(true);
    };

    const handleEdit = (reminder) => {
        handleShowModal(reminder);
    };

    const resetForm = () => {
        setEditMode(false);
        setEditId(null);
        setFormData({
            branch: null,
            renewal_subject: null,
            name: '',
            department: null,
            allocated_to: [],
            renewal_date: '',
            reminder_days: 30,
            remarks: '',
        });
        setShowModal(false);
    };

    // Auto-focus first column when form opens (mirrors Access Point pattern)
    useEffect(() => {
        if (showModal) {
            setTimeout(() => {
                const all = getFocusable();
                if (all.length > 0) {
                    const first = all[0];
                    if (first.classList && first.classList.contains('react-select__control')) {
                        const inp = first.querySelector('input');
                        if (inp) inp.focus();
                    } else {
                        first.focus();
                    }
                }
            }, 100);
        }
    }, [showModal]);

    // Keyboard navigation matching GateEntryForm / Access Point
    const getFocusable = (container) => {
        const root = formRef.current
            || container
            || document.querySelector('.gate-custom-modal')
            || document;
        return Array.from(
            root.querySelectorAll(
                'input.form-control-custom:not([disabled]):not([readonly]), textarea.form-control-custom:not([disabled]):not([readonly]), .react-select__control, button[type="submit"]:not([disabled])'
            )
        ).filter(el => {
            if (el.offsetParent === null) return false;
            if (el.disabled) return false;
            if (el.classList && el.classList.contains('react-select__control--is-disabled')) return false;
            if (el.classList && el.classList.contains('react-select__control')) {
                const inp = el.querySelector('input');
                if (inp && inp.disabled) return false;
            }
            return true;
        });
    };

    const focusNextFromControl = (control, container) => {
        const all = getFocusable(container);
        const idx = all.indexOf(control);
        if (idx > -1 && idx < all.length - 1) {
            const next = all[idx + 1];
            if (idx === all.length - 2 && next.type === 'submit') {
                next.focus();
            } else if (next.classList && next.classList.contains('react-select__control')) {
                const inp = next.querySelector('input');
                if (inp) inp.focus();
            } else {
                next.focus();
            }
        } else if (idx === all.length - 1) {
            all[idx].click();
        }
    };

    const handleSelectFocus = (e) => {
        const control = e.target.closest
            ? e.target.closest('.react-select__control')
            : null;
        if (control) currentSelectControlRef.current = control;
    };

    // For single-select dropdowns: Enter (menu open) → react-select selects → onChange advances;
    // Enter (menu closed) → advance directly
    const handleSelectKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        if (document.querySelector('.swal2-container')) return;
        const control = e.target.closest('.react-select__control');
        if (!control) return;
        const menuIsOpen = control.classList.contains('react-select__control--menu-is-open');
        if (!menuIsOpen) {
            e.preventDefault();
            e.stopPropagation();
            const formEl = e.target.closest('form');
            focusNextFromControl(control, formEl);
        }
        // Menu open: let react-select select option → onChange → focusNextFromControl
    };

    // For multi-select (Allocated To):
    // - Arrow keys: navigate options (native react-select)
    // - Tab: toggle the focused option by clicking it (keeps menu open)
    // - Enter: close the menu WITHOUT toggling anything, then advance
    const handleMultiSelectKeyDown = (e) => {
        if (document.querySelector('.swal2-container')) return;
        const control = e.target.closest('.react-select__control');
        if (!control) return;
        const menuIsOpen = control.classList.contains('react-select__control--menu-is-open');

        if ((e.key === 'Tab' || e.key === ' ') && menuIsOpen) {
            e.preventDefault();
            e.stopPropagation();
            const focusedOpt = document.querySelector('.react-select__option--is-focused');
            if (focusedOpt) {
                focusedOpt.click();
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            const input = control.querySelector('input');
            if (input) input.blur();
            const formEl = e.target.closest('form');
            setTimeout(() => focusNextFromControl(control, formEl), 80);
        }
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const getEmployeeSelectOptions = () => {
        if (!employeeOptions || employeeOptions.length === 0) return [];
        const isAllSelected = employeeOptions.length > 0 && formData.allocated_to.length === employeeOptions.length;
        return [
            {
                value: 'SELECT_ALL',
                label: isAllSelected ? 'Unselect All' : 'Select All',
                isSelected: isAllSelected
            },
            ...employeeOptions.map(emp => ({
                ...emp,
                isSelected: formData.allocated_to.some(val => String(val) === String(emp.value))
            }))
        ];
    };

    const handleSelectChange = (field, selectedOption, actionMeta) => {
        if (field === 'department') {
            const newDept = selectedOption ? selectedOption.value : null;
            setFormData(prev => {
                if (String(prev.department) === String(newDept)) return prev;
                return {
                    ...prev,
                    department: newDept,
                    allocated_to: [] // reset allocated employees ONLY on actual department change
                };
            });
            return;
        } else if (field === 'allocated_to') {
            let newSelectedValues = [];
            const clickedOption = actionMeta && actionMeta.option;
            if (clickedOption && (clickedOption.value === 'SELECT_ALL' || clickedOption.value === 'all')) {
                if (formData.allocated_to.length === employeeOptions.length) {
                    newSelectedValues = [];
                } else {
                    newSelectedValues = employeeOptions.map(emp => emp.value);
                }
            } else {
                newSelectedValues = (selectedOption || []).filter(opt => opt.value !== 'SELECT_ALL' && opt.value !== 'all').map(opt => opt.value);
            }
            setFormData(prev => ({
                ...prev,
                allocated_to: newSelectedValues
            }));
            return;
        } else {
            setFormData(prev => ({
                ...prev,
                [field]: selectedOption ? selectedOption.value : null
            }));
        }

        const ctrl = currentSelectControlRef.current;
        const formEl = ctrl?.closest('form');
        if (selectedOption !== null && field !== 'allocated_to') {
            setTimeout(() => {
                if (ctrl) focusNextFromControl(ctrl, formEl);
            }, 50);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;

        const swalContainer = document.querySelector('.swal2-container');
        if (swalContainer) {
            e.preventDefault();
            e.stopPropagation();
            const okBtn = swalContainer.querySelector('.swal2-confirm');
            if (okBtn) okBtn.click();
            return;
        }

        if (e.target.closest('.react-select')) return;
        if (e.target.tagName === 'TEXTAREA') return;

        const all = getFocusable();
        const index = all.indexOf(document.activeElement);
        if (index > -1 && index < all.length - 1) {
            e.preventDefault();
            e.stopPropagation();
            const next = all[index + 1];
            if (next.type === 'submit') {
                next.focus();
            } else if (next.classList && next.classList.contains('react-select__control')) {
                const inp = next.querySelector('input');
                if (inp) inp.focus();
            } else {
                next.focus();
            }
        } else if (index === all.length - 1 && all[index].type === 'submit') {
            e.preventDefault();
            e.stopPropagation();
            all[index].click();
        }
    };

    const handleTextareaKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        if (e.shiftKey) return;
        e.preventDefault();
        e.stopPropagation();
        const all = getFocusable();
        const index = all.indexOf(e.currentTarget);
        if (index > -1 && index < all.length - 1) {
            const next = all[index + 1];
            if (next.type === 'submit') {
                next.focus();
            } else if (next.classList && next.classList.contains('react-select__control')) {
                const inp = next.querySelector('input');
                if (inp) inp.focus();
            } else {
                next.focus();
            }
        } else if (index === all.length - 1 && all[index].type === 'submit') {
            all[index].click();
        }
    };

    const handleSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();

        if (!formData.name || !formData.name.trim()) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Renewal Name is required.',
                returnFocus: false
            });
            return;
        }

        if (!formData.reminder_days && formData.reminder_days !== 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Reminder Days Before is required.',
                returnFocus: false
            });
            return;
        }

        if (!formData.allocated_to || formData.allocated_to.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Please select at least one employee in Allocated To.',
                returnFocus: false
            });
            return;
        }

        try {
            setLoading(true);
            const payload = {
                branch: formData.branch,
                renewal_subject: formData.renewal_subject,
                name: formData.name,
                department: formData.department,
                allocated_to: formData.allocated_to,
                renewal_date: formData.renewal_date || null,
                reminder_days: parseInt(formData.reminder_days, 10) || 0,
                remarks: formData.remarks || '',
            };

            let response;
            if (editMode && editId) {
                response = await updateRenewalReminder(editId, payload);
            } else {
                response = await createRenewalReminder(payload);
            }

            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: editMode ? 'Renewal reminder updated successfully' : 'Renewal reminder created successfully',
                timer: 1500,
                showConfirmButton: false,
                returnFocus: false
            });

            resetForm();
            fetchReminders();
        } catch (error) {
            console.error("Error saving renewal reminder", error);
            let errorMsg = 'Failed to save renewal reminder.';
            if (error.response && error.response.data) {
                const data = error.response.data;
                errorMsg = data.detail || data.name || data.message || errorMsg;
                if (Array.isArray(errorMsg)) errorMsg = errorMsg.join(' ');
            }
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: errorMsg,
                returnFocus: false
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: `Delete Renewal Reminder "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!',
        });

        if (result.isConfirmed) {
            try {
                await deleteRenewalReminder(id);
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted!',
                    text: 'Renewal Reminder deleted successfully.',
                    timer: 1500,
                    showConfirmButton: false,
                });
                fetchReminders();
            } catch (err) {
                console.error('Error deleting reminder:', err);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: err.response?.data?.detail || 'Could not delete reminder.',
                });
            }
        }
    };

    const filteredReminders = reminders.filter(r =>
        (r.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.renewal_subject_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.branch_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.department_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Fragment>
            <div className="container-fluid">
                <div className="page-titles">
                    <button
                        onClick={() => window.history.back()}
                        className="btn btn-outline-primary btn-sm d-flex align-items-center"
                        style={{ gap: '6px', borderRadius: '6px' }}
                    >
                        <i className="fa fa-arrow-left"></i> Back
                    </button>
                </div>
                
                <div className="row">
                    <div className="col-lg-12">
                        <Card>
                            <Card.Header className="d-flex justify-content-between align-items-center">
                                <Card.Title className="mb-0">Renewal Reminders Management</Card.Title>
                            <div className="d-flex align-items-center gap-2">
                                <div style={{ width: '300px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Reminder..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                {/* <Link
                                    to="/renewal/report"
                                    className="btn btn-info d-flex align-items-center justify-content-center"
                                    style={{ height: '38px', borderRadius: '6px', whiteSpace: 'nowrap', padding: '0 16px', fontWeight: '600', fontSize: '13px', color: '#fff', backgroundColor: '#0284c7', borderColor: '#0284c7' }}
                                    title="View Renewal Reminders Report"
                                >
                                    <i className="fa fa-chart-bar me-2"></i>
                                    Report
                                </Link>
                                <Link
                                    to="/renewal/history-report"
                                    className="btn btn-secondary d-flex align-items-center justify-content-center"
                                    style={{ height: '38px', borderRadius: '6px', whiteSpace: 'nowrap', padding: '0 16px', fontWeight: '600', fontSize: '13px', color: '#fff', backgroundColor: '#64748b', borderColor: '#64748b' }}
                                    title="View Renewal History Report"
                                >
                                    <i className="fa fa-history me-2"></i>
                                    History
                                </Link> */}
                                <button
                                    type="button"
                                    className="btn btn-primary d-flex align-items-center justify-content-center"
                                    onClick={() => setShowUpdationModal(true)}
                                    style={{ height: '38px', borderRadius: '6px', whiteSpace: 'nowrap', padding: '0 16px', backgroundColor: '#1a3a72', borderColor: '#1a3a72', fontWeight: '600', fontSize: '13px' }}
                                    title="Open Renewal Updation Form"
                                >
                                    <i className="fa fa-refresh me-2"></i>
                                    Renewal Updation
                                </button>
                                <CreateButton
                                    module="reminder_settings"
                                    onClick={() => handleShowModal()}
                                    className="d-flex align-items-center justify-content-center"
                                    style={{ height: '38px', borderRadius: '6px', whiteSpace: 'nowrap', padding: '0 16px' }}
                                >
                                    Reminder
                                </CreateButton>
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
                                                <th><strong>SL NO</strong></th>
                                                <th><strong>BRANCH</strong></th>
                                                <th><strong>SUBJECT</strong></th>
                                                <th><strong>NAME</strong></th>
                                                <th><strong>DEPARTMENT</strong></th>
                                                <th><strong>ALLOCATED TO</strong></th>
                                                <th><strong>RENEWAL DATE</strong></th>
                                                <th><strong>REMIND BEFORE</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredReminders.length === 0 ? (
                                                <tr>
                                                    <td colSpan="9" className="text-center py-4 text-muted">
                                                        No entries
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredReminders.map((item, index) => (
                                                    <tr key={item.id}>
                                                        <td>{index + 1}</td>
                                                        <td>{item.branch_name || '-'}</td>
                                                        <td><strong>{item.renewal_subject_name || '-'}</strong></td>
                                                        <td>{item.name || '-'}</td>
                                                        <td>{item.department_name || '-'}</td>
                                                        <td>
                                                            {Array.isArray(item.allocated_to_details) && item.allocated_to_details.length > 0 ? (
                                                                <div className="d-flex flex-wrap gap-1">
                                                                    {item.allocated_to_details.map((emp, index) => (
                                                                        <span key={index} className="badge badge-success light me-1 mb-1">
                                                                            {emp.name || emp.email}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            ) : '-'}
                                                        </td>
                                                        <td>{item.renewal_date ? formatDate(item.renewal_date) : '-'}</td>
                                                        <td>{item.reminder_days || 0} days</td>
                                                        <td className="text-end">
                                                            <div className="d-flex justify-content-end">
                                                                <EditButton
                                                                    module="reminder_settings"
                                                                    onClick={() => handleEdit(item)}
                                                                    className="me-1"
                                                                />
                                                                <DeleteButton
                                                                    module="reminder_settings"
                                                                    onClick={() => handleDelete(item.id, item.name)}
                                                                />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Card.Body>
                    </Card>
            </div>
            </div>
            </div>

            {/* Gate Adding Form styled Modal for Renewal Reminders */}
            <Modal
                show={showModal}
                onHide={resetForm}
                dialogClassName="gate-custom-modal"
                backdrop="static"
                keyboard={false}
                restoreFocus={false}
                size="lg"
                centered
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM10 19H5V5H10V19ZM19 19H12V5H19V19Z" fill="white" />
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editMode ? 'Edit Renewal Reminder' : 'Create Renewal Reminder'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage renewal reminder
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={resetForm}>
                        &times;
                    </button>
                </div>

                <Form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
                    <div className="modal-body-custom">
                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Branch <span className="text-danger">*</span></Form.Label>
                                <Select
                                    className="react-select-container"
                                    classNamePrefix="react-select"
                                    styles={selectStyles}
                                    options={branchOptions}
                                    value={branchOptions.find(o => o.value === formData.branch) || null}
                                    onChange={(opt) => handleSelectChange('branch', opt)}
                                    placeholder="Select Branch"
                                    isClearable
                                    onFocus={handleSelectFocus}
                                    onKeyDown={handleSelectKeyDown}
                                    openMenuOnFocus={true}
                                />
                            </div>

                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Renewal Subject <span className="text-danger">*</span></Form.Label>
                                <div className="d-flex gap-2">
                                    <div className="flex-grow-1">
                                        <Select
                                            className="react-select-container"
                                            classNamePrefix="react-select"
                                            styles={selectStyles}
                                            options={subjectOptions}
                                            value={subjectOptions.find(o => o.value === formData.renewal_subject) || null}
                                            onChange={(opt) => handleSelectChange('renewal_subject', opt)}
                                            placeholder="Select Subject"
                                            isClearable
                                            onFocus={handleSelectFocus}
                                            onKeyDown={handleSelectKeyDown}
                                            openMenuOnFocus={true}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-success d-flex align-items-center justify-content-center"
                                        style={{ height: '40px', width: '40px', borderRadius: '10px', backgroundColor: '#2ece8a', borderColor: '#2ece8a' }}
                                        onClick={() => setShowSubjectModal(true)}
                                        title="Quick Add Subject"
                                    >
                                        <i className="fa fa-plus"></i>
                                    </button>
                                </div>
                            </div>

                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Renewal Name <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    name="name"
                                    className="form-control-custom"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Enter reminder name"
                                    required
                                />
                            </div>

                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Department <span className="text-danger">*</span></Form.Label>
                                <Select
                                    className="react-select-container"
                                    classNamePrefix="react-select"
                                    styles={selectStyles}
                                    options={departmentOptions}
                                    value={departmentOptions.find(o => o.value === formData.department) || null}
                                    onChange={(opt) => handleSelectChange('department', opt)}
                                    placeholder="Select Department"
                                    isClearable
                                    onFocus={handleSelectFocus}
                                    onKeyDown={handleSelectKeyDown}
                                    openMenuOnFocus={true}
                                />
                            </div>

                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Allocated To (Employees) <span className="text-danger">*</span></Form.Label>
                                <Select
                                    isMulti
                                    closeMenuOnSelect={false}
                                    hideSelectedOptions={false}
                                    components={{ Option: CheckboxOption }}
                                    className="react-select-container"
                                    classNamePrefix="react-select"
                                    styles={selectStyles}
                                    options={getEmployeeSelectOptions()}
                                    value={employeeOptions.filter(o => formData.allocated_to.some(val => String(val) === String(o.value)))}
                                    onChange={(opt, actionMeta) => handleSelectChange('allocated_to', opt, actionMeta)}
                                    placeholder={formData.department ? "Select concerned employees..." : "Select Department first"}
                                    isDisabled={!formData.department}
                                    onFocus={handleSelectFocus}
                                    onKeyDown={handleMultiSelectKeyDown}
                                    openMenuOnFocus={true}
                                />
                            </div>

                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Renewal Date <span className="text-danger">*</span></Form.Label>
                                <CompanyDatePicker
                                    name="renewal_date"
                                    className="form-control-custom"
                                    required
                                    minDate={new Date()}
                                    value={formData.renewal_date || ''}
                                    onChange={(e, val) => handleInputChange('renewal_date', val || (e && e.target ? e.target.value : e))}
                                />
                            </div>

                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Reminder Days Before <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="number"
                                    name="reminder_days"
                                    className="form-control-custom"
                                    value={formData.reminder_days}
                                    onChange={handleChange}
                                    placeholder="e.g. 30"
                                    min="0"
                                />
                            </div>

                            <div className="col-md-12 mb-3">
                                <Form.Label className="form-label-custom">Remarks / Description</Form.Label>
                                <Form.Control
                                    as="textarea"
                                    rows={3}
                                    name="remarks"
                                    className="form-control-custom"
                                    value={formData.remarks}
                                    onChange={handleChange}
                                    onKeyDown={handleTextareaKeyDown}
                                    placeholder="Enter remarks or notes"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer-custom">
                        <button type="button" className="btn-close-custom" onClick={resetForm}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-save-custom" disabled={loading}>
                            {loading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                    Saving...
                                </>
                            ) : (
                                editMode ? 'Update Reminder' : 'Save'
                            )}
                        </button>
                    </div>
                </Form>
            </Modal>

            {/* Quick-add Subject Modal */}
            <RenewalSubjectModal
                show={showSubjectModal}
                onHide={() => setShowSubjectModal(false)}
                onSaved={() => {
                    fetchDropdownData();
                    setShowSubjectModal(false);
                }}
            />

            {/* Renewal Updation Popup Form Modal */}
            <RenewalUpdationModal
                show={showUpdationModal}
                onHide={() => setShowUpdationModal(false)}
                onSuccess={() => {
                    fetchReminders();
                }}
            />

            <style>{`
                .gate-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .gate-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .gate-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #2ece8a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
                }
                .gate-custom-modal .modal-close-x {
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
                .gate-custom-modal .modal-close-x:hover {
                    color: #555;
                }
                .gate-custom-modal .modal-body-custom {
                    padding: 24px 28px;
                    max-height: 70vh;
                    overflow-y: auto;
                }
                .gate-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .gate-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .gate-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .gate-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                }
                .gate-custom-modal .form-control-custom::placeholder {
                    color: #94a3b8;
                }
                .gate-custom-modal .btn-close-custom {
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
                .gate-custom-modal .btn-close-custom:hover {
                    background-color: #6357a7 !important;
                }
                .gate-custom-modal .btn-save-custom {
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
                .gate-custom-modal .btn-save-custom:hover {
                    background-color: #26b277 !important;
                }
                .gate-custom-modal .react-select__multi-value {
                    background-color: rgba(46, 206, 138, 0.12) !important;
                    border: 1px solid rgba(46, 206, 138, 0.3) !important;
                    border-radius: 6px !important;
                    margin: 2px 4px 2px 0 !important;
                    display: inline-flex !important;
                    align-items: center !important;
                }
                .gate-custom-modal .react-select__multi-value__label {
                    color: #0f5132 !important;
                    font-weight: 600 !important;
                    font-size: 12px !important;
                    padding: 2px 8px !important;
                }
                .gate-custom-modal .react-select__multi-value__remove {
                    color: #0f5132 !important;
                    cursor: pointer !important;
                    border-radius: 0 6px 6px 0 !important;
                }
                .gate-custom-modal .react-select__multi-value__remove:hover {
                    background-color: #2ece8a !important;
                    color: #fff !important;
                }
            `}</style>
        </Fragment>
    );
};

export default RenewalReminderList;
