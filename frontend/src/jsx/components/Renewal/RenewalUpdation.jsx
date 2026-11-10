import React, { useState, useEffect, useRef, Fragment } from 'react';
import { Card, Form, Row, Col } from 'react-bootstrap';
import Select, { components } from 'react-select';
import Swal from 'sweetalert2';
import {
    getBranches,
    getDepartments,
    getEmployees,
    getRenewalSubjects,
    fetchReminderForUpdate,
    submitRenewalUpdate
} from '../../../services/RenewalService';
import CompanyDatePicker from '../Common/CompanyDatePicker';
import { formatDate } from '../../../utils/dateUtils';
import { usePageTitle } from '../../../context/TitleContext';


// React-Select styles matching Access Point GateForm design
const selectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: '40px',
        height: 'auto',
        borderColor: state.isFocused ? '#0a500f' : '#cbd5e1',
        boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 80, 15, 0.15)' : 'none',
        borderRadius: '10px',
        backgroundColor: '#fff',
        fontSize: '13px',
        fontWeight: '500',
        transition: 'all 0.2s ease',
        '&:hover': {
            borderColor: state.isFocused ? '#0a500f' : '#94a3b8'
        }
    }),
    valueContainer: (base) => ({
        ...base,
        padding: '4px 12px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px'
    }),
    multiValue: (base) => ({
        ...base,
        backgroundColor: 'rgba(10, 80, 15, 0.12)',
        border: '1px solid rgba(10, 80, 15, 0.3)',
        borderRadius: '6px',
        margin: 0
    }),
    multiValueLabel: (base) => ({
        ...base,
        color: '#0f5132',
        fontSize: '12px',
        fontWeight: '600'
    }),
    multiValueRemove: (base) => ({
        ...base,
        color: '#0f5132',
        '&:hover': {
            backgroundColor: '#0a500f',
            color: '#fff',
            borderRadius: '0 6px 6px 0'
        }
    }),
    menu: (base) => ({
        ...base,
        borderRadius: '10px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
        zIndex: 9999,
        overflow: 'hidden'
    }),
    menuPortal: (base) => ({ ...base, zIndex: 99999 }),
    option: (base, state) => ({
        ...base,
        fontSize: '13px',
        fontWeight: '500',
        backgroundColor: state.isSelected
            ? '#0a500f'
            : state.isFocused
                ? 'rgba(10, 80, 15, 0.1)'
                : '#fff',
        color: state.isSelected ? '#fff' : '#1e293b',
        padding: '10px 14px',
        cursor: 'pointer'
    })
};

// Custom CheckboxOption for multi-select (Select All + employee checkboxes)
const CheckboxOption = (props) => {
    return (
        <div>
            <components.Option {...props}>
                <input
                    type="checkbox"
                    checked={props.isSelected}
                    onChange={() => null}
                    style={{
                        marginRight: '10px',
                        accentColor: '#0a500f',
                        cursor: 'pointer',
                        width: '15px',
                        height: '15px',
                        verticalAlign: 'middle'
                    }}
                />
                <span style={{ fontWeight: props.value === 'SELECT_ALL' ? '700' : '500', verticalAlign: 'middle' }}>
                    {props.label}
                </span>
            </components.Option>
        </div>
    );
};

const RenewalUpdation = () => {
    usePageTitle("Renewal Update");
    // Dropdown Data Sources
    const [branches, setBranches] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [nameOptions, setNameOptions] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [employees, setEmployees] = useState([]);

    // Selection criteria
    const [selectBranch, setSelectBranch] = useState(null);
    const [selectSubject, setSelectSubject] = useState(null);
    const [selectName, setSelectName] = useState(null);

    // Selected active reminder and editable form state
    const [selectedReminder, setSelectedReminder] = useState(null);
    const [loadingReminder, setLoadingReminder] = useState(false);
    const [formData, setFormData] = useState({
        department: null,
        allocated_to: [],
        renewal_date: '',
        reminder_days: 30,
        remarks: ''
    });

    const formRef = useRef(null);
    const currentSelectControlRef = useRef(null);

    // Load initial branches, subjects, and departments
    useEffect(() => {
        loadDropdownData();
    }, []);

    const loadDropdownData = async () => {
        try {
            const [bRes, sRes, dRes] = await Promise.all([
                getBranches(),
                getRenewalSubjects({ is_active: true }),
                getDepartments()
            ]);

            const branchList = Array.isArray(bRes) ? bRes : (bRes.results || []);
            setBranches(branchList.map(b => ({
                value: b.id,
                label: b.name
            })));

            const subjectList = Array.isArray(sRes) ? sRes : (sRes.results || []);
            setSubjects(subjectList.map(s => ({
                value: s.id,
                label: s.name
            })));

            const deptList = Array.isArray(dRes) ? dRes : (dRes.results || []);
            setDepartments(deptList.map(d => ({
                value: d.id,
                label: d.name
            })));
        } catch (err) {
            console.error('Error loading initial dropdowns:', err);
        }
    };

    // Auto-focus Branch select on load
    useEffect(() => {
        const timer = setTimeout(() => {
            const container = document.querySelector('.renewal-updation-page') || formRef.current || document;
            const firstSelectInput = container.querySelector('.react-select__control input') || container.querySelector('input:not([disabled]):not([readonly])');
            if (firstSelectInput) firstSelectInput.focus();
        }, 300);
        return () => clearTimeout(timer);
    }, []);

    // Whenever Branch or Renewal Subject changes, fetch available active renewal names
    useEffect(() => {
        if (selectBranch && selectSubject) {
            fetchAvailableNames(selectBranch.value, selectSubject.value);
        } else {
            setNameOptions([]);
            setSelectName(null);
            setSelectedReminder(null);
        }
    }, [selectBranch, selectSubject]);

    const fetchAvailableNames = async (branchId, subjectId) => {
        try {
            const res = await fetchReminderForUpdate({
                branch: branchId,
                renewal_subject: subjectId
            });
            if (res && Array.isArray(res.names)) {
                const uniqueNames = Array.from(new Set(res.names.filter(Boolean).map(n => n.trim())));
                setNameOptions(uniqueNames.map(n => ({
                    value: n,
                    label: n
                })));
            } else {
                setNameOptions([]);
            }
        } catch (err) {
            console.error('Error fetching available names:', err);
            setNameOptions([]);
        }
    };

    // Whenever Name of the Renewal is selected, fetch the active reminder details
    useEffect(() => {
        if (selectBranch && selectSubject && selectName) {
            loadActiveReminder(selectBranch.value, selectSubject.value, selectName.value);
        } else {
            setSelectedReminder(null);
        }
    }, [selectBranch, selectSubject, selectName]);

    const loadActiveReminder = async (branchId, subjectId, nameValue) => {
        setLoadingReminder(true);
        try {
            const res = await fetchReminderForUpdate({
                branch: branchId,
                renewal_subject: subjectId,
                name: nameValue
            });

            if (res && res.found && res.data) {
                const data = res.data;
                setSelectedReminder(data);

                // Prefill form state
                const initialAllocated = Array.isArray(data.allocated_to_details)
                    ? data.allocated_to_details.map(emp => emp.id)
                    : [];

                setFormData({
                    department: data.department || null,
                    allocated_to: initialAllocated,
                    renewal_date: data.renewal_date || '',
                    reminder_days: data.reminder_days || 30,
                    remarks: data.remarks || ''
                });

                // Load employees for the department if department is set
                if (data.department) {
                    loadEmployeesForDept(data.department);
                } else {
                    setEmployees([]);
                }
                setTimeout(() => {
                    const container = document.querySelector('.renewal-updation-page') || formRef.current || document;
                    const selectInputs = container.querySelectorAll('.react-select__control input');
                    if (selectInputs.length >= 4) {
                        selectInputs[3].focus();
                    }
                }, 150);
            } else {
                setSelectedReminder(null);
                Swal.fire({
                    icon: 'info',
                    title: 'No Active Renewal Found',
                    text: 'No active renewal reminder (status 1) was found for the selected criteria.',
                    confirmButtonColor: '#0a500f'
                });
            }
        } catch (err) {
            console.error('Error loading reminder for updation:', err);
            setSelectedReminder(null);
        } finally {
            setLoadingReminder(false);
        }
    };

    const loadEmployeesForDept = async (deptId) => {
        try {
            const res = await getEmployees(deptId);
            const empList = Array.isArray(res) ? res : (res.results || []);
            setEmployees(empList.map(emp => ({
                value: emp.id,
                label: emp.user_name || emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.user_email || emp.email || `Emp #${emp.id}`
            })));
        } catch (err) {
            console.error('Error loading employees for department:', err);
            setEmployees([]);
        }
    };

    // Handle Department change in editable form
    const handleDepartmentChange = (selectedOption) => {
        const deptId = selectedOption ? selectedOption.value : null;
        setFormData(prev => ({
            ...prev,
            department: deptId,
            allocated_to: [] // Reset selected employees on department change
        }));
        if (deptId) {
            loadEmployeesForDept(deptId);
        } else {
            setEmployees([]);
        }
    };

    // Handle Allocated To (with Select All support)
    const handleAllocatedChange = (selectedOptions) => {
        let newIds = [];
        if (!selectedOptions || selectedOptions.length === 0) {
            newIds = [];
        } else {
            const hasSelectAll = selectedOptions.some(opt => opt.value === 'SELECT_ALL');
            if (hasSelectAll) {
                const allSelectedAlready = formData.allocated_to.length === employees.length && employees.length > 0;
                if (allSelectedAlready) {
                    newIds = [];
                } else {
                    newIds = employees.map(emp => emp.value);
                }
            } else {
                newIds = selectedOptions.map(opt => opt.value);
            }
        }

        setFormData(prev => ({
            ...prev,
            allocated_to: newIds
        }));
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

    // Keyboard navigation (EntryTagForm / GateEntryForm pattern)
    const getFocusable = (containerSelector = '.renewal-updation-page') => {
        const root = document.querySelector(containerSelector) || formRef.current || document;
        return Array.from(
            root.querySelectorAll(
                'input.form-control-custom:not([disabled]):not([readonly]), input.form-control:not([disabled]):not([readonly]), textarea.form-control-custom:not([disabled]):not([readonly]), textarea.form-control:not([disabled]):not([readonly]), .react-select__control, button[type="submit"]:not([disabled]), button.btn-save-custom:not([disabled])'
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

    const focusNextFromControl = (control) => {
        const all = getFocusable();
        const target = (control && control.classList && control.classList.contains('react-select__control'))
            ? control
            : (control && control.closest ? (control.closest('.react-select__control') || control) : control);
        const idx = all.indexOf(target);
        if (idx > -1 && idx < all.length - 1) {
            const next = all[idx + 1];
            if (next.tagName && next.tagName.toLowerCase() === 'button') {
                next.click();
            } else if (next.classList && next.classList.contains('react-select__control')) {
                const inputEl = next.querySelector('input');
                if (inputEl) inputEl.focus();
            } else {
                next.focus();
            }
        }
    };

    const handleKeyDown = (e, containerSelector = '.renewal-updation-page') => {
        if (e.key !== 'Enter') return;
        if (document.querySelector('.swal2-container')) return;
        if (e.target.tagName.toLowerCase() === 'textarea' && e.shiftKey) return;
        if (e.target.closest('.react-select')) return;

        const all = getFocusable(containerSelector);
        const idx = all.indexOf(document.activeElement);
        if (idx > -1 && idx < all.length - 1) {
            e.preventDefault();
            e.stopPropagation();
            const next = all[idx + 1];
            if (next.tagName && next.tagName.toLowerCase() === 'button') {
                next.click();
            } else if (next.classList && next.classList.contains('react-select__control')) {
                const inputEl = next.querySelector('input');
                if (inputEl) inputEl.focus();
            } else {
                next.focus();
            }
        }
    };

    const handleFocus = (e) => {
        if (e.target.tagName.toLowerCase() === 'input' && e.target.type !== 'checkbox' && e.target.type !== 'radio') {
            e.target.select();
        }
    };

    const handleSelectFocus = (e) => {
        const control = e.target.closest('.react-select__control');
        if (control) {
            control.classList.add('react-select__control--is-focused');
            currentSelectControlRef.current = control;
        }
    };

    // For single-select dropdowns:
    // - Arrow keys: native react-select navigation
    // - Tab: tabSelectsValue selects focused option → onChange → focusNextFromControl
    // - Enter (menu open): react-select selects option → onChange → focusNextFromControl
    // - Enter (menu closed): advance to next field
    const handleSelectKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        if (document.querySelector('.swal2-container')) return;
        const control = e.target.closest('.react-select__control');
        if (!control) return;
        const menuIsOpen = control.classList.contains('react-select__control--menu-is-open');
        if (!menuIsOpen) {
            // Menu is closed — advance to the next field
            e.preventDefault();
            e.stopPropagation();
            focusNextFromControl(control);
        }
        // Menu is open — let react-select select the focused option;
        // onChange will call focusNextFromControl automatically
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

        if (e.key === 'Tab' && menuIsOpen) {
            // Prevent Tab from moving browser focus away
            e.preventDefault();
            e.stopPropagation();
            // Click the highlighted option to toggle its checkbox (menu stays open)
            const focusedOpt = document.querySelector('.react-select__option--is-focused');
            if (focusedOpt) focusedOpt.click();
        } else if (e.key === 'Enter') {
            // Prevent react-select from toggling the focused option on Enter
            e.preventDefault();
            e.stopPropagation();
            // Blur the internal input — this closes the menu without modifying any selection
            const input = control.querySelector('input');
            if (input) input.blur();
            setTimeout(() => focusNextFromControl(control), 80);
        }
    };

    const handleTextareaKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const all = getFocusable();
            const idx = all.indexOf(e.target);
            if (idx > -1 && idx < all.length - 1) {
                const next = all[idx + 1];
                if (next.tagName && next.tagName.toLowerCase() === 'button') {
                    next.click();
                } else if (next.classList && next.classList.contains('react-select__control')) {
                    const inputEl = next.querySelector('input');
                    if (inputEl) inputEl.focus();
                } else {
                    next.focus();
                }
            }
        }
    };

    // Build employee options with prominent "Select All"
    const getEmployeeSelectOptions = () => {
        if (!employees || employees.length === 0) return [];
        const isAllSelected = employees.length > 0 && formData.allocated_to.length === employees.length;
        return [
            {
                value: 'SELECT_ALL',
                label: isAllSelected ? 'Unselect All' : 'Select All',
                isSelected: isAllSelected
            },
            ...employees.map(emp => ({
                ...emp,
                isSelected: formData.allocated_to.includes(emp.value)
            }))
        ];
    };

    // Reset Form & Selection
    const handleReset = () => {
        setSelectBranch(null);
        setSelectSubject(null);
        setSelectName(null);
        setSelectedReminder(null);
        setFormData({
            department: null,
            allocated_to: [],
            renewal_date: '',
            reminder_days: 30,
            remarks: ''
        });
    };

    // Save Renewal Update (Status 0 -> 1 archiving)
    const handleSaveUpdate = async (e) => {
        if (e) e.preventDefault();
        if (!selectedReminder) return;

        if (!formData.renewal_date) {
            Swal.fire({
                icon: 'warning',
                title: 'Missing Required Field',
                text: 'Please specify the new Renewal Date.',
                confirmButtonColor: '#0a500f'
            });
            return;
        }

        if (!formData.reminder_days && formData.reminder_days !== 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Missing Required Field',
                text: 'Please specify the Reminder Days Before.',
                confirmButtonColor: '#0a500f'
            });
            return;
        }

        if (!formData.allocated_to || formData.allocated_to.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Missing Required Field',
                text: 'Please select at least one employee in Allocated To.',
                confirmButtonColor: '#0a500f'
            });
            return;
        }

        try {
            const payload = {
                previous_reminder_id: selectedReminder.id,
                branch: selectBranch.value,
                renewal_subject: selectSubject.value,
                name: selectName.value,
                department: formData.department,
                allocated_to: formData.allocated_to,
                renewal_date: formData.renewal_date,
                reminder_days: formData.reminder_days,
                remarks: formData.remarks
            };

            await submitRenewalUpdate(payload);

            Swal.fire({
                icon: 'success',
                title: 'Renewal Updated Successfully!',
                text: `Renewal "${selectName.value}" has been updated. Previous record is archived (status 0) and the new record is now active (status 1).`,
                confirmButtonColor: '#0a500f'
            });

            handleReset();
        } catch (err) {
            console.error('Error saving renewal update:', err);
            Swal.fire({
                icon: 'error',
                title: 'Update Failed',
                text: 'Could not save the renewal updation. Please check inputs or try again.',
                confirmButtonColor: '#d33'
            });
        }
    };

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
                
                <div className="row renewal-updation-page" ref={formRef} onKeyDown={handleKeyDown} onFocus={handleFocus}>
                {/* 1. TOP SELECTION CARD */}
                <Col lg={12} className="mb-4">
                    <Card
                        className="shadow-sm border-0"
                        style={{
                            borderRadius: '16px',
                            background: 'linear-gradient(to right, #ffffff, #fcfcfd)'
                        }}
                    >
                        <Card.Header
                            className="bg-white border-bottom-0 pt-4 pb-0 d-flex align-items-center justify-content-start"
                            style={{ borderRadius: '16px 16px 0 0' }}
                        >
                            <div className="d-flex align-items-center">
                                <div
                                    className="d-flex align-items-center justify-content-center rounded-circle me-3"
                                    style={{
                                        width: '44px',
                                        height: '44px',
                                        backgroundColor: 'rgba(10, 80, 15, 0.15)',
                                        color: '#0a500f',
                                        fontSize: '20px'
                                    }}
                                >
                                    <i className="fa fa-calendar"></i>
                                </div>
                                <div>
                                    <h4
                                        className="mb-0"
                                        style={{
                                            color: '#1e293b',
                                            fontWeight: '700',
                                            fontSize: '1.25rem'
                                        }}
                                    >
                                        Renewal Updation Management
                                    </h4>
                                    <small className="text-muted" style={{ fontWeight: '500' }}>
                                        Select Branch, Renewal Subject, and Name to prefill and update an active renewal
                                    </small>
                                </div>
                            </div>
                        </Card.Header>

                        <Card.Body className="p-0">
                            <div style={{ padding: '24px 32px' }}>
                            <Row className="g-3">
                                {/* Branch */}
                                <Col md={4}>
                                    <Form.Label
                                        style={{
                                            fontSize: '0.82rem',
                                            fontWeight: '600',
                                            color: '#475569',
                                            marginBottom: '6px'
                                        }}
                                    >
                                        Branch <span className="text-danger">*</span>
                                    </Form.Label>
                                    <Select
                                        classNamePrefix="react-select"
                                        options={branches}
                                        value={selectBranch}
                                        onChange={(opt) => {
                                            setSelectBranch(opt);
                                            setTimeout(() => {
                                                const control = currentSelectControlRef.current || document.querySelectorAll('.renewal-updation-page .react-select__control')[0];
                                                if (control) focusNextFromControl(control);
                                            }, 50);
                                        }}
                                        styles={selectStyles}
                                        placeholder="Select Branch..."
                                        isClearable
                                        openMenuOnFocus={true}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        tabSelectsValue={true}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                    />
                                </Col>

                                {/* Renewal Subject */}
                                <Col md={4}>
                                    <Form.Label
                                        style={{
                                            fontSize: '0.82rem',
                                            fontWeight: '600',
                                            color: '#475569',
                                            marginBottom: '6px'
                                        }}
                                    >
                                        Renewal Subject <span className="text-danger">*</span>
                                    </Form.Label>
                                    <Select
                                        classNamePrefix="react-select"
                                        options={subjects}
                                        value={selectSubject}
                                        onChange={(opt) => {
                                            setSelectSubject(opt);
                                            setTimeout(() => {
                                                const control = currentSelectControlRef.current || document.querySelectorAll('.renewal-updation-page .react-select__control')[1];
                                                if (control) focusNextFromControl(control);
                                            }, 50);
                                        }}
                                        styles={selectStyles}
                                        placeholder="Select Subject..."
                                        isClearable
                                        openMenuOnFocus={true}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        tabSelectsValue={true}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                    />
                                </Col>

                                {/* Name of Renewal */}
                                <Col md={4}>
                                    <Form.Label
                                        style={{
                                            fontSize: '0.82rem',
                                            fontWeight: '600',
                                            color: '#475569',
                                            marginBottom: '6px'
                                        }}
                                    >
                                        Name of the Renewal <span className="text-danger">*</span>
                                    </Form.Label>
                                    <Select
                                        classNamePrefix="react-select"
                                        options={nameOptions}
                                        value={selectName}
                                        onChange={(opt) => {
                                            setSelectName(opt);
                                        }}
                                        styles={selectStyles}
                                        placeholder={
                                            !selectBranch || !selectSubject
                                                ? 'Select Branch & Subject first...'
                                                : 'Select Renewal Name...'
                                        }
                                        isClearable
                                        isDisabled={!selectBranch || !selectSubject}
                                        openMenuOnFocus={true}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        tabSelectsValue={true}
                                        noOptionsMessage={() => 'No active renewal names found'}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                    />
                                </Col>
                            </Row>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>

                {/* 2. EDITABLE UPDATION FORM CARD */}
                {loadingReminder && (
                    <Col lg={12} className="text-center my-4">
                        <div className="spinner-border text-success" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                    </Col>
                )}

                {selectedReminder && !loadingReminder && (
                    <Col lg={12}>
                        <Card
                            className="shadow-sm border-0"
                            style={{
                                borderRadius: '16px',
                                background: '#ffffff',
                                borderTop: '4px solid #0a500f'
                            }}
                        >
                            <Card.Header
                                className="bg-white border-bottom pt-4 pb-3 d-flex align-items-center justify-content-between"
                                style={{ borderRadius: '16px 16px 0 0' }}
                            >
                                <div className="d-flex align-items-center">
                                    <div
                                        className="d-flex align-items-center justify-content-center rounded-circle me-3"
                                        style={{
                                            width: '40px',
                                            height: '40px',
                                            backgroundColor: 'rgba(10, 80, 15, 0.12)',
                                            color: '#0a500f',
                                            fontSize: '18px'
                                        }}
                                    >
                                        <i className="fa fa-pencil-alt"></i>
                                    </div>
                                    <div>
                                        <h5
                                            className="mb-0"
                                            style={{
                                                color: '#1e293b',
                                                fontWeight: '700',
                                                fontSize: '1.1rem'
                                            }}
                                        >
                                            Update Renewal: <span style={{ color: '#0a500f' }}>{selectedReminder.name}</span>
                                        </h5>
                                        <small className="text-muted">
                                            Original Renewal Date: {selectedReminder.renewal_date ? formatDate(selectedReminder.renewal_date) : '-'} | Previous Status: Active (1)
                                        </small>
                                    </div>
                                </div>
                                <span className="badge badge-success light p-2" style={{ fontSize: '12px', fontWeight: '600' }}>
                                    Active Record #1
                                </span>
                            </Card.Header>

                            <Card.Body className="p-0">
                                <div style={{ padding: '24px 32px' }}>
                                <Form onSubmit={handleSaveUpdate}>
                                    <Row className="g-3">
                                        {/* Department */}
                                        <Col md={4}>
                                            <Form.Label
                                                style={{
                                                    fontSize: '0.82rem',
                                                    fontWeight: '600',
                                                    color: '#475569',
                                                    marginBottom: '6px'
                                                }}
                                            >
                                                Department
                                            </Form.Label>
                                            <Select
                                                classNamePrefix="react-select"
                                                options={departments}
                                                value={departments.find(d => d.value === formData.department) || null}
                                                onChange={(opt) => {
                                                    handleDepartmentChange(opt);
                                                    setTimeout(() => {
                                                        const control = currentSelectControlRef.current || document.querySelectorAll('.renewal-updation-page .react-select__control')[3];
                                                        if (control) focusNextFromControl(control);
                                                    }, 50);
                                                }}
                                                styles={selectStyles}
                                                placeholder="Select Department..."
                                                isClearable
                                                openMenuOnFocus={true}
                                                onFocus={handleSelectFocus}
                                                onKeyDown={handleSelectKeyDown}
                                                tabSelectsValue={true}
                                                menuPortalTarget={document.body}
                                                menuPosition="fixed"
                                            />
                                        </Col>

                                        {/* Renewal Date */}
                                        <Col md={4}>
                                            <Form.Label
                                                style={{
                                                    fontSize: '0.82rem',
                                                    fontWeight: '600',
                                                    color: '#475569',
                                                    marginBottom: '6px'
                                                }}
                                            >
                                                Renewal Date <span className="text-danger">*</span>
                                            </Form.Label>
                                            <CompanyDatePicker
                                                name="renewal_date"
                                                className="form-control"
                                                required
                                                minDate={new Date()}
                                                value={formData.renewal_date || ''}
                                                onChange={(e, val) => handleInputChange('renewal_date', val || (e && e.target ? e.target.value : e))}
                                                style={{
                                                    height: '40px',
                                                    borderRadius: '10px',
                                                    border: '1px solid #cbd5e1',
                                                    fontSize: '13px'
                                                }}
                                            />
                                        </Col>

                                        {/* Reminder Days Before */}
                                        <Col md={4}>
                                            <Form.Label
                                                style={{
                                                    fontSize: '0.82rem',
                                                    fontWeight: '600',
                                                    color: '#475569',
                                                    marginBottom: '6px'
                                                }}
                                            >
                                                Reminder Days Before <span className="text-danger">*</span>
                                            </Form.Label>
                                            <Form.Control
                                                type="number"
                                                name="reminder_days"
                                                className="form-control-custom"
                                                value={formData.reminder_days}
                                                onChange={handleChange}
                                                min="0"
                                                style={{
                                                    height: '40px',
                                                    borderRadius: '10px',
                                                    border: '1px solid #cbd5e1',
                                                    fontSize: '13px'
                                                }}
                                            />
                                        </Col>

                                        {/* Allocated To (Multi Select + Checkboxes) */}
                                        <Col md={12}>
                                            <Form.Label
                                                style={{
                                                    fontSize: '0.82rem',
                                                    fontWeight: '600',
                                                    color: '#475569',
                                                    marginBottom: '6px'
                                                }}
                                            >
                                                Allocated To (Employees) <span className="text-danger">*</span>
                                            </Form.Label>
                                            <Select
                                                classNamePrefix="react-select"
                                                isMulti
                                                closeMenuOnSelect={false}
                                                hideSelectedOptions={false}
                                                components={{ Option: CheckboxOption }}
                                                options={getEmployeeSelectOptions()}
                                                value={employees.filter(e => formData.allocated_to.includes(e.value))}
                                                onChange={handleAllocatedChange}
                                                styles={selectStyles}
                                                placeholder={
                                                    !formData.department
                                                        ? 'Select Department first...'
                                                        : 'Select Employees...'
                                                }
                                                isDisabled={!formData.department}
                                                openMenuOnFocus={true}
                                                onFocus={handleSelectFocus}
                                                onKeyDown={handleMultiSelectKeyDown}
                                                menuPortalTarget={document.body}
                                                menuPosition="fixed"
                                            />
                                        </Col>

                                        {/* Remarks */}
                                        <Col md={12}>
                                            <Form.Label
                                                style={{
                                                    fontSize: '0.82rem',
                                                    fontWeight: '600',
                                                    color: '#475569',
                                                    marginBottom: '6px'
                                                }}
                                            >
                                                Remarks / Instructions
                                            </Form.Label>
                                            <Form.Control
                                                as="textarea"
                                                rows={3}
                                                name="remarks"
                                                className="form-control-custom"
                                                value={formData.remarks}
                                                onChange={handleChange}
                                                placeholder="Enter any notes or instructions for this renewal updation..."
                                                style={{
                                                    borderRadius: '10px',
                                                    border: '1px solid #cbd5e1',
                                                    fontSize: '13px',
                                                    padding: '10px 14px'
                                                }}
                                            />
                                        </Col>

                                        {/* Footer action buttons */}
                                        <Col md={12} className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
                                            <button
                                                type="button"
                                                onClick={handleReset}
                                                className="btn btn-outline-secondary px-4 py-2"
                                                style={{
                                                    borderRadius: '10px',
                                                    fontWeight: '600',
                                                    fontSize: '13px'
                                                }}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                className="btn btn-save-custom px-4 py-2"
                                                style={{
                                                    backgroundColor: '#0a500f',
                                                    borderColor: '#0a500f',
                                                    color: '#ffffff',
                                                    borderRadius: '10px',
                                                    fontWeight: '600',
                                                    fontSize: '13px',
                                                    boxShadow: '0 4px 12px rgba(10, 80, 15, 0.25)'
                                                }}
                                            >
                                                <i className="fa fa-check me-2"></i>
                                                Save Updation
                                            </button>
                                        </Col>
                                    </Row>
                                </Form>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                )}
            </div>
            </div>
        </Fragment>
    );
};

export default RenewalUpdation;
