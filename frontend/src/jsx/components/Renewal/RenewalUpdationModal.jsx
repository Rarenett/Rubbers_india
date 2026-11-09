import React, { useState, useEffect, useRef, Fragment } from 'react';
import { Modal, Row, Col, Form, Spinner } from 'react-bootstrap';
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

// Custom Checkbox Option component for interactive multi-select
const CheckboxOption = (props) => {
    return (
        <components.Option {...props}>
            <div className="d-flex align-items-center">
                <input
                    type="checkbox"
                    checked={props.isSelected}
                    onChange={() => {}}
                    className="form-check-input me-2"
                    style={{ pointerEvents: 'none' }}
                />
                <span style={{ fontWeight: props.data.value === 'SELECT_ALL' ? '600' : '400' }}>
                    {props.label}
                </span>
            </div>
        </components.Option>
    );
};

const RenewalUpdationModal = ({ show, onHide, onSuccess }) => {
    // Dropdown options
    const [branches, setBranches] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [nameOptions, setNameOptions] = useState([]);

    // Selection controls
    const [selectBranch, setSelectBranch] = useState(null);
    const [selectSubject, setSelectSubject] = useState(null);
    const [selectName, setSelectName] = useState(null);

    // Selected Reminder details
    const [selectedReminder, setSelectedReminder] = useState(null);
    const [loadingReminder, setLoadingReminder] = useState(false);
    const [loadingNames, setLoadingNames] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form data for updation
    const [formData, setFormData] = useState({
        renewal_subject: '',
        department: '',
        allocated_to: [],
        renewal_date: '',
        reminder_days: '',
        remarks: ''
    });

    const formRef = useRef(null);
    const currentSelectControlRef = useRef(null);

    // Initial load
    useEffect(() => {
        if (show) {
            loadInitialData();
            // Auto focus branch select on open
            const timer = setTimeout(() => {
                const modal = document.querySelector('.item-custom-modal') || formRef.current;
                if (modal) {
                    const firstSelectInput = modal.querySelector('.react-select__control input') || modal.querySelector('input:not([disabled]):not([readonly])');
                    if (firstSelectInput) firstSelectInput.focus();
                }
            }, 300);
            return () => clearTimeout(timer);
        } else {
            handleReset();
        }
    }, [show]);

    const loadInitialData = async () => {
        try {
            const [brData, subData, depData] = await Promise.all([
                getBranches(),
                getRenewalSubjects({ is_active: true }),
                getDepartments()
            ]);

            const brList = Array.isArray(brData) ? brData : (brData?.results || []);
            setBranches(brList.map(b => ({ value: b.id, label: b.name })));

            const subList = Array.isArray(subData) ? subData : (subData?.results || []);
            setSubjects(subList.map(s => ({ value: s.id, label: s.subject_name || s.name })));

            const depList = Array.isArray(depData) ? depData : (depData?.results || []);
            setDepartments(depList.map(d => ({ value: d.id, label: d.name })));
        } catch (error) {
            console.error("Error loading initial data for Renewal Updation Modal:", error);
        }
    };

    // Whenever department changes, fetch only the employees under that department
    useEffect(() => {
        loadEmployeesForDept(formData.department || null);
    }, [formData.department]);

    const loadEmployeesForDept = async (deptId) => {
        try {
            const empData = await getEmployees(deptId);
            const empList = Array.isArray(empData) ? empData : (empData?.results || []);
            setEmployees(empList.map(e => ({
                value: e.id,
                label: e.user_name || e.name || `${e.first_name || ''} ${e.last_name || ''}`.trim() || e.user_email || e.email || `Emp #${e.id}`
            })));
        } catch (error) {
            console.error("Error fetching employees for department:", error);
            setEmployees([]);
        }
    };

    // Whenever Branch or Subject changes, fetch available active Renewal Names
    useEffect(() => {
        if (selectBranch && selectSubject) {
            loadRenewalNames(selectBranch.value, selectSubject.value);
        } else {
            setNameOptions([]);
            setSelectName(null);
            setSelectedReminder(null);
        }
    }, [selectBranch, selectSubject]);

    const loadRenewalNames = async (branchId, subjectId) => {
        setLoadingNames(true);
        try {
            const data = await fetchReminderForUpdate({ branch: branchId, renewal_subject: subjectId });
            const names = data?.names || [];
            setNameOptions(names.map(n => ({ value: n, label: n })));
        } catch (error) {
            console.error("Error fetching renewal names:", error);
            setNameOptions([]);
        } finally {
            setLoadingNames(false);
        }
    };

    // Whenever Name is selected, fetch the active RenewalReminder details
    useEffect(() => {
        if (selectBranch && selectSubject && selectName) {
            loadReminderDetails(selectBranch.value, selectSubject.value, selectName.value);
        } else {
            setSelectedReminder(null);
        }
    }, [selectName]);

    const loadReminderDetails = async (branchId, subjectId, name) => {
        setLoadingReminder(true);
        try {
            const res = await fetchReminderForUpdate({ branch: branchId, renewal_subject: subjectId, name: name });
            if (res && res.found && res.data) {
                const data = res.data;
                setSelectedReminder(data);

                const initialAllocated = Array.isArray(data.allocated_to_details)
                    ? data.allocated_to_details.map(emp => emp.id)
                    : (Array.isArray(data.allocated_to) ? data.allocated_to : []);

                setFormData({
                    renewal_subject: data.renewal_subject || subjectId,
                    department: data.department || '',
                    allocated_to: initialAllocated,
                    renewal_date: data.renewal_date ? data.renewal_date.split('T')[0] : '',
                    reminder_days: data.reminder_days || 30,
                    remarks: data.remarks || ''
                });
                setTimeout(() => {
                    const modal = document.querySelector('.item-custom-modal') || formRef.current;
                    if (modal) {
                        const selectInputs = modal.querySelectorAll('.react-select__control input');
                        if (selectInputs.length >= 4) {
                            selectInputs[3].focus();
                        }
                    }
                }, 150);
            } else {
                setSelectedReminder(null);
                Swal.fire({
                    icon: 'warning',
                    title: 'No Active Renewal Found',
                    text: res?.detail || 'Could not locate an active renewal reminder for the selected criteria.'
                });
            }
        } catch (error) {
            console.error("Error loading reminder details:", error);
            setSelectedReminder(null);
        } finally {
            setLoadingReminder(false);
        }
    };

    // Focus Helper for Keyboard Navigation (matching EntryTagForm pattern)
    const getFocusable = (modalSelector = '.item-custom-modal') => {
        const modal = document.querySelector(modalSelector) || formRef.current;
        if (!modal) return [];
        return Array.from(
            modal.querySelectorAll(
                'input.form-control-custom:not([disabled]):not([readonly]), input.form-control:not([disabled]):not([readonly]), textarea.form-control-custom:not([disabled]):not([readonly]), textarea.form-control:not([disabled]):not([readonly]), .react-select__control, button[type="submit"]:not([disabled])'
            )
        ).filter(el => {
            if (el.offsetParent === null) return false;
            if (el.disabled) return false;
            if (el.classList && el.classList.contains('react-select__control--is-disabled')) return false;
            if (el.classList && el.classList.contains('react-select__control')) {
                const inputEl = el.querySelector('input');
                if (inputEl && inputEl.disabled) return false;
            }
            return true;
        });
    };

    const focusNextFromControl = (control) => {
        const modal = (control && control.closest ? control.closest('.modal-content') : null) || document.querySelector('.item-custom-modal') || formRef.current;
        if (!modal) return;
        const all = getFocusable('.item-custom-modal');
        const target = (control && control.classList && control.classList.contains('react-select__control'))
            ? control
            : (control && control.closest ? (control.closest('.react-select__control') || control) : control);
        const index = all.indexOf(target);
        if (index > -1 && index < all.length - 1) {
            const next = all[index + 1];
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

    const handleKeyDown = (e, modalSelector = '.item-custom-modal') => {
        if (e.key !== 'Enter') return;
        if (document.querySelector('.swal2-container')) return;
        if (e.target.tagName.toLowerCase() === 'textarea' && e.shiftKey) return;
        if (e.target.closest('.react-select')) return;

        const all = getFocusable(modalSelector);
        const index = all.indexOf(document.activeElement);
        if (index > -1 && index < all.length - 1) {
            e.preventDefault();
            e.stopPropagation();
            if (document.activeElement && typeof document.activeElement.blur === 'function') {
                document.activeElement.blur();
            }
            const next = all[index + 1];
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
            focusNextFromControl(control);
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

    const handleReset = () => {
        setSelectBranch(null);
        setSelectSubject(null);
        setSelectName(null);
        setSelectedReminder(null);
        setNameOptions([]);
        setFormData({
            renewal_subject: '',
            department: '',
            allocated_to: [],
            renewal_date: '',
            reminder_days: '',
            remarks: ''
        });
    };

    const handleSubmit = async () => {
        if (!selectedReminder) return;

        if (!formData.renewal_date) {
            Swal.fire({
                icon: 'warning',
                title: 'Required Field',
                text: 'Please select a Renewal Date.'
            });
            return;
        }

        if (!formData.reminder_days && formData.reminder_days !== 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Required Field',
                text: 'Please specify the Reminder Days Before.'
            });
            return;
        }

        if (!formData.allocated_to || formData.allocated_to.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Required Field',
                text: 'Please select at least one employee in Allocated To.'
            });
            return;
        }

        setSaving(true);
        try {
            const payload = {
                previous_reminder_id: selectedReminder.id,
                branch: selectBranch.value,
                renewal_subject: selectSubject.value,
                name: selectName.value,
                department: formData.department || null,
                allocated_to: formData.allocated_to || [],
                renewal_date: formData.renewal_date,
                reminder_days: formData.reminder_days || 30,
                remarks: formData.remarks || ''
            };

            await submitRenewalUpdate(payload);

            Swal.fire({
                icon: 'success',
                title: 'Renewal Updated Successfully!',
                text: 'The previous renewal record has been archived (status 0) and the new updated renewal is now active (status 1).',
                timer: 2500,
                showConfirmButton: false
            });

            if (onSuccess) {
                onSuccess();
            }
            onHide();
        } catch (error) {
            console.error("Error updating renewal:", error);
            Swal.fire({
                icon: 'error',
                title: 'Update Failed',
                text: error?.response?.data?.error || 'An error occurred while updating the renewal.'
            });
        } finally {
            setSaving(false);
        }
    };

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '38px',
            borderColor: state.isFocused ? '#2ece8a' : '#cbd5e1',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(46, 206, 138, 0.15)' : 'none',
            '&:hover': { borderColor: '#2ece8a' },
            borderRadius: '10px',
            fontSize: '13px',
            backgroundColor: '#fff',
        }),
        menu: base => ({ ...base, zIndex: 9999, fontSize: '13px', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }),
        menuPortal: base => ({ ...base, zIndex: 99999 }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#2ece8a' : state.isFocused ? 'rgba(46, 206, 138, 0.1)' : 'white',
            color: state.isSelected ? 'white' : '#334155',
            cursor: 'pointer',
            fontSize: '13px',
            padding: '8px 12px',
        }),
    };

    return (
        <Fragment>
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
                .item-custom-modal .form-check-input:checked {
                    background-color: #2ece8a;
                    border-color: #2ece8a;
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
                .item-custom-modal .btn-save-custom:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
            `}</style>

            <Modal
                show={show}
                onHide={onHide}
                dialogClassName="item-custom-modal"
                backdrop="static"
                keyboard={false}
                size="lg"
                centered
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 4H5C3.89 4 3.01 4.9 3.01 6L3 20C3 21.1 3.89 22 5 22H19C20.1 22 21 21.1 21 20V6C21 4.9 20.1 4 19 4ZM19 20H5V9H19V20ZM19 7H5V6H19V7Z" fill="white" />
                                <path d="M7 11H12V16H7V11Z" fill="white" />
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                Renewal Updation Form
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage renewal record
                            </p>
                        </div>
                    </div>
                    <div className="d-flex align-items-center gap-3">
                        {selectedReminder && (
                            <span className="badge" style={{ backgroundColor: 'rgba(46, 206, 138, 0.15)', color: '#2ece8a', fontWeight: '600', fontSize: '12px', padding: '6px 12px', borderRadius: '8px' }}>
                                Active Record (ID: #{selectedReminder.id})
                            </span>
                        )}
                        <button type="button" className="modal-close-x" onClick={onHide}>
                            &times;
                        </button>
                    </div>
                </div>

                <Form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} onKeyDown={(e) => handleKeyDown(e, '.item-custom-modal')} onFocus={handleFocus}>
                    <div className="modal-body-custom">
                        <div ref={formRef}>
                            <div className="row mb-3">
                                <div className="col-md-4">
                                    <Form.Label className="form-label-custom">
                                        Branch <span className="text-danger">*</span>
                                    </Form.Label>
                                    <Select
                                        classNamePrefix="react-select"
                                        options={branches}
                                        value={selectBranch}
                                        onChange={(opt) => {
                                            setSelectBranch(opt);
                                            setTimeout(() => {
                                                const control = currentSelectControlRef.current || document.querySelectorAll('.item-custom-modal .react-select__control')[0];
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
                                </div>

                                <div className="col-md-4">
                                    <Form.Label className="form-label-custom">
                                        Renewal Subject <span className="text-danger">*</span>
                                    </Form.Label>
                                    <Select
                                        classNamePrefix="react-select"
                                        options={subjects}
                                        value={selectSubject}
                                        onChange={(opt) => {
                                            setSelectSubject(opt);
                                            setTimeout(() => {
                                                const control = currentSelectControlRef.current || document.querySelectorAll('.item-custom-modal .react-select__control')[1];
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
                                </div>

                                <div className="col-md-4">
                                    <Form.Label className="form-label-custom">
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
                                            loadingNames
                                                ? "Loading names..."
                                                : selectBranch && selectSubject
                                                    ? "Select Renewal Name..."
                                                    : "Select Branch & Subject first..."
                                        }
                                        isDisabled={!selectBranch || !selectSubject || loadingNames}
                                        isClearable
                                        openMenuOnFocus={true}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        tabSelectsValue={true}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                    />
                                </div>
                            </div>

                            {loadingReminder && (
                                <div className="text-center py-5">
                                    <Spinner animation="border" variant="primary" />
                                    <p className="mt-2 text-muted small">Loading renewal reminder details...</p>
                                </div>
                            )}

                            {selectedReminder && !loadingReminder && (
                                <Fragment>
                                    <div className="row mb-3">
                                        <div className="col-md-4">
                                            <Form.Label className="form-label-custom">
                                                Department
                                            </Form.Label>
                                            <Select
                                                classNamePrefix="react-select"
                                                options={departments}
                                                value={departments.find(d => String(d.value) === String(formData.department)) || null}
                                                onChange={(opt) => {
                                                    setFormData(prev => ({ ...prev, department: opt ? opt.value : '' }));
                                                    setTimeout(() => {
                                                        const control = currentSelectControlRef.current || document.querySelectorAll('.item-custom-modal .react-select__control')[3];
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
                                        </div>

                                        <div className="col-md-4">
                                            <Form.Label className="form-label-custom">
                                                Renewal Date <span className="text-danger">*</span>
                                            </Form.Label>
                                            <CompanyDatePicker
                                                name="renewal_date"
                                                className="form-control-custom w-100"
                                                required
                                                value={formData.renewal_date || ''}
                                                onChange={(e, val) => setFormData(prev => ({ ...prev, renewal_date: val || (e && e.target ? e.target.value : '') }))}
                                                placeholder="DD/MM/YYYY"
                                            />
                                        </div>

                                        <div className="col-md-4">
                                            <Form.Label className="form-label-custom">
                                                Reminder Days Before <span className="text-danger">*</span>
                                            </Form.Label>
                                            <Form.Control
                                                type="number"
                                                className="form-control-custom"
                                                min="0"
                                                max="365"
                                                value={formData.reminder_days || ''}
                                                onChange={(e) => setFormData(prev => ({ ...prev, reminder_days: e.target.value }))}
                                                placeholder="e.g. 30"
                                            />
                                        </div>
                                    </div>

                                    <div className="row mb-3">
                                        <div className="col-md-12">
                                            <Form.Label className="form-label-custom">
                                                Allocated To (Employees) <span className="text-danger">*</span>
                                            </Form.Label>
                                            <Select
                                                classNamePrefix="react-select"
                                                isMulti
                                                closeMenuOnSelect={false}
                                                hideSelectedOptions={false}
                                                options={getEmployeeSelectOptions()}
                                                value={employees.filter(e => formData.allocated_to.includes(e.value))}
                                                onChange={(selectedOptions, actionMeta) => {
                                                    let newSelectedValues = [];
                                                    const clickedOption = actionMeta.option;
                                                    if (clickedOption && clickedOption.value === 'SELECT_ALL') {
                                                        if (formData.allocated_to.length === employees.length) {
                                                            newSelectedValues = [];
                                                        } else {
                                                            newSelectedValues = employees.map(emp => emp.value);
                                                        }
                                                    } else {
                                                        newSelectedValues = (selectedOptions || []).filter(opt => opt.value !== 'SELECT_ALL').map(opt => opt.value);
                                                    }
                                                    setFormData(prev => ({ ...prev, allocated_to: newSelectedValues }));
                                                }}
                                                components={{ Option: CheckboxOption }}
                                                styles={selectStyles}
                                                placeholder="Select Employees..."
                                                openMenuOnFocus={true}
                                                onFocus={handleSelectFocus}
                                                onKeyDown={handleMultiSelectKeyDown}
                                                menuPortalTarget={document.body}
                                                menuPosition="fixed"
                                            />
                                        </div>
                                    </div>

                                    <div className="row mb-3">
                                        <div className="col-md-12">
                                            <Form.Label className="form-label-custom">
                                                Remarks / Instructions
                                            </Form.Label>
                                            <Form.Control
                                                as="textarea"
                                                className="form-control-custom"
                                                rows={3}
                                                value={formData.remarks || ''}
                                                onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                                                placeholder="Add any instructions or notes for the updated renewal..."
                                            />
                                        </div>
                                    </div>
                                </Fragment>
                            )}

                            {!selectedReminder && !loadingReminder && (
                                <div
                                    className="text-center py-5 rounded-3"
                                    style={{
                                        background: '#f8fafc',
                                        border: '1px dashed #cbd5e1',
                                        color: '#64748b'
                                    }}
                                >
                                    <i className="fa fa-calendar mb-3" style={{ fontSize: '36px', color: '#94a3b8' }}></i>
                                    <h6 style={{ fontWeight: '600', color: '#475569' }}>
                                        Select a Renewal Record
                                    </h6>
                                    <p className="mb-0 small" style={{ color: '#64748b' }}>
                                        Choose Branch, Renewal Subject, and Name above to load and update an existing active renewal.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="modal-footer-custom">
                        <button
                            type="button"
                            className="btn-close-custom"
                            onClick={onHide}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-save-custom"
                            disabled={saving || !selectedReminder}
                        >
                            {saving ? (
                                <span><i className="fa fa-spinner fa-spin me-2"></i>Saving...</span>
                            ) : (
                                <span>Save </span>
                            )}
                        </button>
                    </div>
                </Form>
            </Modal>
        </Fragment>
    );
};

export default RenewalUpdationModal;
