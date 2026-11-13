import React, { useState, useEffect, useRef, Fragment, useContext } from 'react';
import { Card, Modal, Form } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import {
    getCalculationTypes,
    createCalculationType,
    updateCalculationType,
    deleteCalculationType,
    getPayrollUnits,
    getAttendanceProductionTypes,
} from '../../../services/PayrollService';
import { usePageTitle } from '../../../context/TitleContext';
import { ThemeContext } from '../../../context/ThemeContext';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';

const EMPTY_CALCULATION_TYPE = {
    id: null,
    name: '',
    is_calculation_period_required: false,
    payroll_units: [],
    attendance_production_types: [],
    is_active: true
};

const CalculationTypeList = () => {
    usePageTitle('Calculation Methods');
    const { saveBtnColor, cancelBtnColor, customPrimaryColor } = useContext(ThemeContext) || {};

    const [types, setTypes] = useState([]);
    const [units, setUnits] = useState([]);
    const [attendanceTypes, setAttendanceTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({ ...EMPTY_CALCULATION_TYPE });
    const [submitting, setSubmitting] = useState(false);
    const firstInputRef = useRef(null);

    // Auto-focus first input when modal opens
    useEffect(() => {
        if (showModal) {
            const timer = setTimeout(() => {
                if (firstInputRef.current) {
                    firstInputRef.current.focus();
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [showModal]);

    // Keyboard navigation (Enter key moves to next field)
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            if (e.target.tagName.toLowerCase() === 'textarea') return;
            if (e.target.type === 'submit') return;
            if (e.target.tagName.toLowerCase() === 'button' && e.target.type !== 'submit') return;

            const form = e.currentTarget;
            const focusable = Array.from(
                form.querySelectorAll(
                    'input:not([disabled]):not([readonly]):not([type="hidden"]), select:not([disabled]):not([readonly]), button[type="submit"]:not([disabled])'
                )
            ).filter(el => el.offsetParent !== null && el.tabIndex !== -1);

            const index = focusable.indexOf(e.target);
            if (index > -1 && index < focusable.length - 1) {
                e.preventDefault();
                focusable[index + 1].focus();
            }
        }
    };

    useEffect(() => {
        fetchData();
        fetchUnits();
        fetchAttendanceTypes();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getCalculationTypes();
            setTypes(Array.isArray(data) ? data : (data.results || []));
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to fetch calculation types.'
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchUnits = async () => {
        try {
            const data = await getPayrollUnits({ is_active: true });
            setUnits(Array.isArray(data) ? data : (data.results || []));
        } catch (error) {
            console.error('Failed to fetch payroll units:', error);
        }
    };

    const fetchAttendanceTypes = async () => {
        try {
            const data = await getAttendanceProductionTypes({ is_active: true });
            setAttendanceTypes(Array.isArray(data) ? data : (data.results || []));
        } catch (error) {
            console.error('Failed to fetch attendance production types:', error);
        }
    };

    const handleShowModal = (item = null) => {
        if (item) {
            const pUnits = Array.isArray(item.payroll_units) ? item.payroll_units : [];
            const aTypes = Array.isArray(item.attendance_production_types) ? item.attendance_production_types : [];
            const periodReq = item.is_calculation_period_required ?? (pUnits.length > 0);

            setFormData({
                id: item.id,
                name: item.name || '',
                is_calculation_period_required: Boolean(periodReq),
                payroll_units: pUnits,
                attendance_production_types: aTypes,
                is_active: item.is_active ?? true
            });
            setEditMode(true);
        } else {
            setFormData({ ...EMPTY_CALCULATION_TYPE });
            setEditMode(false);
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditMode(false);
        setFormData({ ...EMPTY_CALCULATION_TYPE });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Calculation type name is required.'
            });
            return;
        }

        if (formData.is_calculation_period_required && formData.payroll_units.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Please select at least one calculation period (pay unit).'
            });
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                name: formData.name.trim(),
                is_calculation_period_required: formData.is_calculation_period_required,
                payroll_units: formData.is_calculation_period_required ? formData.payroll_units : [],
                attendance_production_types: formData.attendance_production_types,
                is_active: formData.is_active
            };

            if (editMode) {
                await updateCalculationType(formData.id, payload);
                Swal.fire({
                    icon: 'success',
                    title: 'Updated!',
                    text: 'Calculation type updated successfully.',
                    timer: 1500,
                    showConfirmButton: false
                });
            } else {
                await createCalculationType(payload);
                Swal.fire({
                    icon: 'success',
                    title: 'Created!',
                    text: 'Calculation type created successfully.',
                    timer: 1500,
                    showConfirmButton: false
                });
            }

            handleCloseModal();
            fetchData();
        } catch (error) {
            const errorMsg = error.response?.data?.name?.[0]
                || error.response?.data?.message
                || 'Failed to save calculation type.';
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: errorMsg
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: `Do you want to delete calculation type "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                await deleteCalculationType(id);
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted!',
                    text: 'Calculation type deleted successfully.',
                    timer: 1500,
                    showConfirmButton: false
                });
                fetchData();
            } catch (error) {
                const errorMsg = error.response?.data?.message
                    || 'Failed to delete calculation type because it may be connected to pay heads.';
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: errorMsg
                });
            }
        }
    };

    // Filter by search
    const filteredItems = types.filter(t => {
        const searchLower = searchTerm.toLowerCase();
        return (
            t.name?.toLowerCase().includes(searchLower) ||
            t.payroll_units_details?.some(u =>
                u.formal_name?.toLowerCase().includes(searchLower) ||
                u.symbol?.toLowerCase().includes(searchLower)
            ) ||
            t.attendance_production_types_details?.some(a =>
                a.name?.toLowerCase().includes(searchLower) ||
                a.type_display?.toLowerCase().includes(searchLower)
            )
        );
    });

    // Pagination
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);

    const unitOptions = units.map(u => ({
        value: u.id,
        label: `${u.formal_name} (${u.symbol})`
    }));

    const attendanceTypeOptions = attendanceTypes.map(a => ({
        value: a.id,
        label: `${a.name} (${a.type_display || a.type})`
    }));

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '42px',
            borderColor: state.isFocused ? (customPrimaryColor || 'var(--cc-primary, #0a500f)') : '#cbd5e1',
            borderRadius: '8px',
            fontSize: '13px',
            boxShadow: state.isFocused ? `0 0 0 3px ${customPrimaryColor ? `${customPrimaryColor}26` : 'rgba(10,80,15,0.15)'}` : 'none',
            '&:hover': { borderColor: state.isFocused ? (customPrimaryColor || 'var(--cc-primary, #0a500f)') : '#94a3b8' }
        }),
        menu: (base) => ({
            ...base,
            zIndex: 99999,
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
        }),
        menuPortal: (base) => ({ ...base, zIndex: 99999 }),
        multiValue: (base) => ({
            ...base,
            backgroundColor: 'rgba(10, 80, 15, 0.1)',
            borderRadius: '6px',
        }),
        multiValueLabel: (base) => ({
            ...base,
            color: customPrimaryColor || 'var(--cc-primary, #0a500f)',
            fontWeight: 500,
            fontSize: '12px'
        }),
        multiValueRemove: (base) => ({
            ...base,
            color: customPrimaryColor || 'var(--cc-primary, #0a500f)',
            ':hover': {
                backgroundColor: 'rgba(10, 80, 15, 0.2)',
                color: customPrimaryColor || 'var(--cc-primary, #0a500f)',
            },
        }),
    };

    return (
        <Fragment>
            <style>{`
                .calc-type-custom-modal .modal-content {
                    border: none;
                    border-radius: 16px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.18);
                }
                .modal-header-custom {
                    background: linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%);
                    padding: 20px 24px;
                    border-bottom: 1px solid #e2e8f0;
                    border-top-left-radius: 16px;
                    border-top-right-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .modal-icon-circle {
                    width: 44px;
                    height: 44px;
                    border-radius: 12px;
                    background: var(--form-icon-color, var(--cc-primary, #0a500f)) !important;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                }
                .modal-body-custom {
                    padding: 24px;
                    background: #ffffff;
                }
                .modal-footer-custom {
                    padding: 16px 24px;
                    background: #f8fafc;
                    border-top: 1px solid #e2e8f0;
                    border-bottom-left-radius: 16px;
                    border-bottom-right-radius: 16px;
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                }
                .modal-close-x {
                    background: none;
                    border: none;
                    font-size: 24px;
                    line-height: 1;
                    color: #94a3b8;
                    cursor: pointer;
                    padding: 0;
                    transition: color 0.15s;
                }
                .modal-close-x:hover {
                    color: #475569;
                }
                .btn-close-custom {
                    background-color: var(--cancel-btn-color, #dc3545) !important;
                    border-color: var(--cancel-btn-color, #dc3545) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border-style: solid !important;
                    border-width: 1px !important;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus {
                    background-color: var(--cancel-btn-color, #dc3545) !important;
                    border-color: var(--cancel-btn-color, #dc3545) !important;
                    color: white !important;
                    opacity: 0.9 !important;
                    box-shadow: none !important;
                }
                .btn-save-custom {
                    background-color: var(--save-btn-color, var(--cc-primary, #0a500f)) !important;
                    border-color: var(--save-btn-color, var(--cc-primary, #0a500f)) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border-style: solid !important;
                    border-width: 1px !important;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus {
                    background-color: var(--save-btn-color, var(--cc-primary, #0a500f)) !important;
                    border-color: var(--save-btn-color, var(--cc-primary, #0a500f)) !important;
                    color: white !important;
                    opacity: 0.9 !important;
                    box-shadow: none !important;
                }
                .btn-save-custom:disabled, .btn-close-custom:disabled {
                    opacity: 0.6 !important;
                    cursor: not-allowed !important;
                }
                .calc-search-input {
                    width: 250px;
                    height: 37px;
                    border-radius: 6px;
                    font-size: 13px;
                }
                .calc-th-sl {
                    width: 60px;
                }
                .calc-th-status {
                    width: 120px;
                }
                .calc-badge-unit {
                    font-size: 11px;
                    padding: 5px 8px;
                    border-radius: 4px;
                }
                .calc-badge-attendance {
                    font-size: 11px;
                    padding: 5px 8px;
                    border-radius: 4px;
                }
                .calc-form-label {
                    font-size: 13px;
                    font-weight: 500;
                    color: #334155;
                }
                .calc-form-control {
                    border-radius: 8px;
                    font-size: 14px;
                    padding: 10px 14px;
                }
                .calc-help-text {
                    font-size: 12px;
                }
                .calc-modal-title {
                    font-size: 18px;
                    color: #1e293b;
                }
                .calc-modal-subtitle {
                    font-size: 13px;
                }
                .calc-pagination-info {
                    font-size: 13px;
                }
            `}</style>

            <div className="row">
                <div className="col-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <h4 className="card-title mb-0">Calculation Methods</h4>
                            <div className="d-flex align-items-center gap-2">
                                <input
                                    type="text"
                                    className="form-control calc-search-input"
                                    placeholder="Search calculation methods..."
                                    value={searchTerm}
                                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                />
                                <CreateButton
                                    module="calc-type"
                                    onClick={() => handleShowModal()}
                                >
                                    Calculation Method
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
                                                <th className="calc-th-sl"><strong>SL NO</strong></th>
                                                <th><strong>CALCULATION METHOD NAME</strong></th>
                                                <th><strong>LINKED PAY UNITS / ATTENDANCE TYPES</strong></th>
                                                <th className="calc-th-status"><strong>STATUS</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredItems.length === 0 ? (
                                                <tr>
                                                    <td colSpan="5" className="text-center py-4 text-muted">
                                                        No calculation methods found
                                                    </td>
                                                </tr>
                                            ) : (
                                                currentItems.map((item, index) => (
                                                    <tr key={item.id || index}>
                                                        <td><strong>{indexOfFirstItem + index + 1}</strong></td>
                                                        <td>
                                                            <strong className="text-dark">{item.name}</strong>
                                                        </td>
                                                        <td>
                                                            <div className="d-flex flex-wrap gap-1">
                                                                {item.payroll_units_details && item.payroll_units_details.length > 0 && (
                                                                    item.payroll_units_details.map(u => (
                                                                        <span key={`u-${u.id}`} className="badge badge-primary light calc-badge-unit">
                                                                            <i className="fa fa-clock-o me-1"></i>
                                                                            {u.formal_name} ({u.symbol})
                                                                        </span>
                                                                    ))
                                                                )}
                                                                {item.attendance_production_types_details && item.attendance_production_types_details.length > 0 && (
                                                                    item.attendance_production_types_details.map(a => (
                                                                        <span key={`a-${a.id}`} className="badge badge-success light calc-badge-attendance">
                                                                            <i className="fa fa-calendar-check-o me-1"></i>
                                                                            {a.name} ({a.type_display || a.type})
                                                                        </span>
                                                                    ))
                                                                )}
                                                                {(!item.payroll_units_details || item.payroll_units_details.length === 0) &&
                                                                 (!item.attendance_production_types_details || item.attendance_production_types_details.length === 0) && (
                                                                    <span className="text-muted fst-italic fs-12">No linked items</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            {item.is_active ? (
                                                                <span className="badge badge-success light">Active</span>
                                                            ) : (
                                                                <span className="badge badge-danger light">Inactive</span>
                                                            )}
                                                        </td>
                                                        <td className="text-end">
                                                            <div className="d-flex justify-content-end">
                                                                <EditButton
                                                                    module="calc-type"
                                                                    onClick={() => handleShowModal(item)}
                                                                    className="me-1"
                                                                />
                                                                <DeleteButton
                                                                    module="calc-type"
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

                            {filteredItems.length > 0 && totalPages > 1 && (
                                <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                    <div className="text-muted calc-pagination-info">
                                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredItems.length)} of {filteredItems.length} entries
                                    </div>
                                    <nav>
                                        <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                            <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                <button type="button" className="page-link border-0 bg-transparent" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
                                                    <i className="la la-angle-left" />
                                                </button>
                                            </li>
                                            {Array.from({ length: totalPages }, (_, index) => (
                                                <li key={index + 1} className={`page-item ${currentPage === index + 1 ? 'active' : ''}`}>
                                                    <button type="button" className="page-link border-0" onClick={() => setCurrentPage(index + 1)}>
                                                        {index + 1}
                                                    </button>
                                                </li>
                                            ))}
                                            <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                                <button type="button" className="page-link border-0 bg-transparent" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>
                                                    <i className="la la-angle-right" />
                                                </button>
                                            </li>
                                        </ul>
                                    </nav>
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {/* Modal for Add / Edit */}
            <Modal
                show={showModal}
                onHide={handleCloseModal}
                centered
                size="md"
                dialogClassName="calc-type-custom-modal"
            >
                <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
                    <div className="modal-header-custom">
                        <div className="d-flex align-items-center gap-3">
                            <div className="modal-icon-circle">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14h-2v-4H6v-2h4V7h2v4h4v2h-4v4z" fill="white" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="modal-title font-w600 mb-0 calc-modal-title">
                                    {editMode ? 'Edit Calculation Method' : 'Create Calculation Method'}
                                </h4>
                                <p className="text-muted mb-0 calc-modal-subtitle">
                                    Configure calculation method and link applicable pay units
                                </p>
                            </div>
                        </div>
                        <button type="button" className="modal-close-x" onClick={handleCloseModal}>&times;</button>
                    </div>

                    <div className="modal-body-custom">
                        <div className="row g-3">
                            {/* Calculation Type Name */}
                            <div className="col-md-12">
                                <Form.Label className="calc-form-label">
                                    Calculation Method Name <span className="text-danger">*</span>
                                </Form.Label>
                                <Form.Control
                                    ref={firstInputRef}
                                    type="text"
                                    placeholder="e.g. Fixed Flat Rate, Attendance-Based, Production / Output-Based"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    className="calc-form-control"
                                />
                            </div>

                            {/* Multi-Select: Attendance & Output Types */}
                            <div className="col-md-12">
                                <Form.Label className="calc-form-label">
                                    Attendance & Output Types <span className="text-muted fw-normal">(Optional)</span>
                                </Form.Label>
                                <Select
                                    isMulti
                                    styles={selectStyles}
                                    menuPortalTarget={document.body}
                                    options={attendanceTypeOptions}
                                    value={attendanceTypeOptions.filter(opt => formData.attendance_production_types.includes(opt.value))}
                                    onChange={(selected) => setFormData({
                                        ...formData,
                                        attendance_production_types: selected ? selected.map(s => s.value) : []
                                    })}
                                    placeholder="Select attendance & output types to link..."
                                    isSearchable
                                />
                            </div>

                            {/* Checkbox: Is Calculation Period Required */}
                            <div className="col-md-12 pt-1">
                                <div className="form-check">
                                    <input
                                        className="form-check-input cursor-pointer"
                                        type="checkbox"
                                        id="calcPeriodRequiredCheckbox"
                                        checked={formData.is_calculation_period_required}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            setFormData(prev => ({
                                                ...prev,
                                                is_calculation_period_required: checked,
                                                payroll_units: checked ? prev.payroll_units : []
                                            }));
                                        }}
                                    />
                                    <label
                                        className="form-check-label calc-form-label cursor-pointer"
                                        htmlFor="calcPeriodRequiredCheckbox"
                                    >
                                        Calculation Period is required for this calculation method
                                    </label>
                                </div>
                            </div>

                            {/* Conditional Multi-Select: Calculation Period */}
                            {formData.is_calculation_period_required && (
                                <div className="col-md-12">
                                    <Form.Label className="calc-form-label">
                                        Calculation Period <span className="text-danger">*</span>
                                    </Form.Label>
                                    <Select
                                        isMulti
                                        styles={selectStyles}
                                        menuPortalTarget={document.body}
                                        options={unitOptions}
                                        value={unitOptions.filter(opt => formData.payroll_units.includes(opt.value))}
                                        onChange={(selected) => setFormData({
                                            ...formData,
                                            payroll_units: selected ? selected.map(s => s.value) : []
                                        })}
                                        placeholder="Select calculation periods (pay units)..."
                                        isSearchable
                                    />
                                    <span className="text-muted mt-1 d-block calc-help-text">
                                        These units will be displayed in the Calculation Period dropdown when this type is selected in Pay Components.
                                    </span>
                                </div>
                            )}

                            {/* Active Switch */}
                            <div className="col-md-12 pt-2">
                                <div className="form-check form-switch">
                                    <input
                                        className="form-check-input cursor-pointer"
                                        type="checkbox"
                                        id="calcTypeActiveSwitch"
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                    />
                                    <label className="form-check-label calc-form-label cursor-pointer" htmlFor="calcTypeActiveSwitch">
                                        Active Status
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer-custom">
                        <button
                            type="button"
                            className="btn-close-custom btn-universal-close"
                            onClick={handleCloseModal}
                            disabled={submitting}
                            style={{
                                backgroundColor: cancelBtnColor || 'var(--cancel-btn-color, #dc3545)',
                                borderColor: cancelBtnColor || 'var(--cancel-btn-color, #dc3545)',
                                color: '#ffffff'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-save-custom btn-universal-save"
                            disabled={submitting}
                            style={{
                                backgroundColor: saveBtnColor || 'var(--save-btn-color, var(--cc-primary, #0a500f))',
                                borderColor: saveBtnColor || 'var(--save-btn-color, var(--cc-primary, #0a500f))',
                                color: '#ffffff'
                            }}
                        >
                            {submitting ? 'Saving...' : (editMode ? 'Save Changes' : 'Save')}
                        </button>
                    </div>
                </Form>
            </Modal>
        </Fragment>
    );
};

export default CalculationTypeList;
