import React, { useState, useEffect, useRef, Fragment } from 'react';
import { Card, Button, Modal, Form, Badge } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import {
    getAttendanceProductionTypes,
    createAttendanceProductionType,
    updateAttendanceProductionType,
    deleteAttendanceProductionType,
    getPayrollUnits,
    getPayrollCompoundUnits
} from '../../../services/PayrollService';
import { usePageTitle } from '../../../context/TitleContext';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';

const TYPE_CHOICES = [
    { value: 'attendance_leave_with_pay', label: 'Paid Attendance / Leave', badgeClass: 'badge-success' },
    { value: 'leave_without_pay', label: 'Unpaid Leave / Loss of Pay (LOP)', badgeClass: 'badge-warning' },
    { value: 'production', label: 'Piece-rate / Output Production', badgeClass: 'badge-primary' },
    { value: 'user_defined_calendar', label: 'Custom Working Calendar', badgeClass: 'badge-info' }
];

const PERIOD_CHOICES = [
    { value: 'days', label: 'Days' },
    { value: 'weeks', label: 'Weeks' },
    { value: 'months', label: 'Months' }
];

const EMPTY_ATTENDANCE_TYPE = {
    id: null,
    name: '',
    type: 'attendance_leave_with_pay',
    period_type: 'days',
    payroll_unit: '',
    is_active: true
};

const selectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: '42px',
        borderColor: state.isFocused ? '#0a500f' : '#cbd5e1',
        boxShadow: state.isFocused ? '0 0 0 2px rgba(10, 80, 15, 0.2)' : 'none',
        '&:hover': { borderColor: '#0a500f' },
        borderRadius: '8px',
        fontSize: '14px',
        backgroundColor: '#fff',
        transition: 'border-color 0.2s, box-shadow 0.2s',
    }),
    menu: base => ({
        ...base,
        zIndex: 99999,
        fontSize: '14px',
        borderRadius: '8px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
    }),
    menuPortal: base => ({ ...base, zIndex: 99999 }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isSelected
            ? '#0a500f'
            : state.isFocused
            ? 'rgba(10, 80, 15, 0.1)'
            : 'transparent',
        color: state.isSelected ? '#fff' : '#334155',
        cursor: state.isDisabled ? 'not-allowed' : 'pointer',
        fontSize: '14px',
    }),
    singleValue: base => ({
        ...base,
        color: '#1e293b',
        fontSize: '14px',
    }),
    placeholder: base => ({
        ...base,
        color: '#94a3b8',
        fontSize: '14px',
    }),
};

const AttendanceProductionTypeList = () => {
    usePageTitle('Attendance & Output Types');

    const [items, setItems] = useState([]);
    const [payrollUnits, setPayrollUnits] = useState([]);
    const [compoundUnits, setCompoundUnits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({ ...EMPTY_ATTENDANCE_TYPE });
    const [submitting, setSubmitting] = useState(false);
    const firstInputRef = useRef(null);
    const currentSelectControlRef = useRef(null);
    const formDataRef = useRef(formData);
    formDataRef.current = formData;

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

    const focusNextField = () => {
        const modal = document.querySelector('.type-custom-modal');
        if (!modal) return;
        if (formDataRef.current?.type === 'production') {
            const unitSelect = modal.querySelector('.unit-dropdown-select .react-select__control input');
            if (unitSelect) unitSelect.focus();
            else {
                const saveBtn = modal.querySelector('button[type="submit"]');
                if (saveBtn) saveBtn.focus();
            }
        } else {
            const saveBtn = modal.querySelector('button[type="submit"]');
            if (saveBtn) saveBtn.focus();
        }
    };

    const handleSelectFocus = (e) => {
        currentSelectControlRef.current = e.target.closest('.react-select__control');
    };

    const handleTypeSelectKeyDown = (e) => {
        if (e.key === 'Enter') {
            setTimeout(() => {
                focusNextField();
            }, 60);
        }
    };

    const makeTypeSelectChange = (opt) => {
        const newType = opt ? opt.value : '';
        setFormData(prev => ({
            ...prev,
            type: newType,
            // If changing to production, default period_type to days or clear, but ensure payroll_unit is handled
            period_type: newType === 'production' ? '' : (prev.period_type || 'days'),
            payroll_unit: newType === 'production' ? prev.payroll_unit : ''
        }));
        setTimeout(() => {
            focusNextField();
        }, 60);
    };

    const handleNextSelectKeyDown = (e) => {
        if (e.key === 'Enter') {
            setTimeout(() => {
                const modal = document.querySelector('.type-custom-modal');
                if (modal) {
                    const saveBtn = modal.querySelector('button[type="submit"]');
                    if (saveBtn) saveBtn.focus();
                }
            }, 60);
        }
    };

    const makeUnitSelectChange = (opt) => {
        setFormData(prev => ({ ...prev, payroll_unit: opt ? opt.value : '' }));
        setTimeout(() => {
            const modal = document.querySelector('.type-custom-modal');
            if (modal) {
                const saveBtn = modal.querySelector('button[type="submit"]');
                if (saveBtn) saveBtn.focus();
            }
        }, 60);
    };

    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        if (e.target.tagName.toLowerCase() === 'textarea') return;
        if (e.target.type === 'submit') return;
        if (e.target.classList.contains('unit-type-option')) return;
        if (e.target.closest('.react-select__control')) return;

        const modal = document.querySelector('.type-custom-modal');
        if (!modal) return;
        if (e.target === firstInputRef.current) {
            e.preventDefault();
            const typeInput = modal.querySelector('.type-category-select .react-select__control input');
            if (typeInput) typeInput.focus();
            return;
        }

        const saveBtn = modal.querySelector('button[type="submit"]');
        if (saveBtn) {
            e.preventDefault();
            saveBtn.focus();
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [typesData, unitsData, compoundsData] = await Promise.all([
                getAttendanceProductionTypes(),
                getPayrollUnits(),
                getPayrollCompoundUnits()
            ]);

            setItems(Array.isArray(typesData) ? typesData : (typesData.results || []));
            setPayrollUnits(Array.isArray(unitsData) ? unitsData : (unitsData.results || []));
            setCompoundUnits(Array.isArray(compoundsData) ? compoundsData : (compoundsData.results || []));
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to fetch attendance & production types.'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleShowModal = (item = null) => {
        if (item) {
            setFormData({
                id: item.id,
                name: item.name || '',
                type: item.type || 'attendance_leave_with_pay',
                period_type: item.period_type || 'days',
                payroll_unit: item.payroll_unit || '',
                is_active: item.is_active ?? true
            });
            setEditMode(true);
        } else {
            setFormData({ ...EMPTY_ATTENDANCE_TYPE });
            setEditMode(false);
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setFormData({ ...EMPTY_ATTENDANCE_TYPE });
        setSubmitting(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Type name is required.' });
            return;
        }

        if (formData.type === 'production' && !formData.payroll_unit) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Please select a payroll unit for production.' });
            return;
        }

        const payload = {
            name: formData.name.trim(),
            type: formData.type,
            period_type: formData.type === 'production' ? '' : (formData.period_type || 'days'),
            payroll_unit: formData.type === 'production' ? (parseInt(formData.payroll_unit, 10) || null) : null,
            is_active: formData.is_active
        };

        try {
            setSubmitting(true);
            if (editMode) {
                await updateAttendanceProductionType(formData.id, payload);
                Swal.fire({
                    icon: 'success',
                    title: 'Updated',
                    text: 'Attendance/Production type updated successfully',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                await createAttendanceProductionType(payload);
                Swal.fire({
                    icon: 'success',
                    title: 'Created',
                    text: 'Attendance/Production type created successfully',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
            handleCloseModal();
            fetchData();
        } catch (error) {
            let errorMsg = `Failed to ${editMode ? 'update' : 'create'} attendance/production type`;
            if (error.response && error.response.data) {
                const data = error.response.data;
                if (typeof data === 'object') {
                    errorMsg = Object.keys(data)
                        .map(key => `${key.replace('_', ' ').toUpperCase()}: ${Array.isArray(data[key]) ? data[key].join(', ') : data[key]}`)
                        .join('\n');
                } else if (typeof data === 'string') {
                    errorMsg = data;
                }
            }
            Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Attendance/Production Type?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deleteAttendanceProductionType(id);
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted',
                    text: 'Type deleted successfully',
                    timer: 2000,
                    showConfirmButton: false
                });
                fetchData();
            } catch (error) {
                let errorMsg = 'Failed to delete attendance/production type';
                if (error.response && error.response.data && error.response.data.detail) {
                    errorMsg = error.response.data.detail;
                }
                Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
            }
        }
    };

    const getTypeMeta = (val) => {
        return TYPE_CHOICES.find(c => c.value === val) || { label: val, badgeClass: 'badge-secondary' };
    };

    const renderUnitDisplay = (item) => {
        if (item.type === 'production') {
            if (item.payroll_unit_name || item.payroll_unit_symbol) {
                return (
                    <span className="badge badge-primary light" style={{ fontSize: '12px' }}>
                        {item.payroll_unit_name || ''} ({item.payroll_unit_symbol || ''})
                    </span>
                );
            }
            if (item.payroll_unit) {
                const foundUnit = payrollUnits.find(u => u.id === item.payroll_unit);
                if (foundUnit) {
                    return (
                        <span className="badge badge-primary light" style={{ fontSize: '12px' }}>
                            {foundUnit.formal_name} ({foundUnit.symbol})
                        </span>
                    );
                }
            }
            if (item.compound_unit_display) {
                return (
                    <span className="badge badge-primary light" style={{ fontSize: '12px' }}>
                        {item.compound_unit_display}
                    </span>
                );
            }
            return <span className="text-muted">—</span>;
        }

        // For non-production types: show Period Type
        const periodVal = item.period_type || 'days';
        const periodLabel = item.period_type_display || PERIOD_CHOICES.find(p => p.value === periodVal)?.label || (periodVal.charAt(0).toUpperCase() + periodVal.slice(1));
        return (
            <span className="badge badge-info light" style={{ fontSize: '12px' }}>
                {periodLabel}
            </span>
        );
    };

    // Filter items
    const filteredItems = items.filter(item => {
        const matchesSearch = (item.name || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'all' || item.type === typeFilter;
        return matchesSearch && matchesType;
    });

    const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);

    return (
        <Fragment>
            <style>{`
                .type-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .type-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .type-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: var(--form-icon-color, #0a500f);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .type-custom-modal .modal-close-x {
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
                .type-custom-modal .modal-close-x:hover { color: #555; }
                .type-custom-modal .modal-body-custom {
                    padding: 24px 28px;
                }
                .type-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .type-custom-modal .btn-close-custom {
                    background-color: var(--cancel-btn-color, #dc3545) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .type-custom-modal .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .type-custom-modal .btn-save-custom {
                    background-color: var(--save-btn-color, #0a500f) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .type-custom-modal .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }

                .unit-type-option {
                    cursor: pointer;
                    padding: 10px 14px;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    background-color: #fff;
                    font-size: 13px;
                    font-weight: 500;
                    transition: all 0.15s;
                }
                .unit-type-option.active {
                    border-color: #0a500f;
                    background-color: #e6f9f1;
                    color: #1a7f53;
                    font-weight: 600;
                }
                .unit-type-option:focus {
                    outline: none;
                    border-color: #0a500f !important;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.25) !important;
                }
            `}</style>

            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                            <Card.Title className="mb-0">Attendance & Output Types</Card.Title>
                            <div className="d-flex flex-wrap align-items-center gap-2">
                                <Form.Select
                                    value={typeFilter}
                                    onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
                                    style={{ width: 'auto', minWidth: '180px', height: '37px', borderRadius: '6px', fontSize: '13px' }}
                                >
                                    <option value="all">All Type Categories</option>
                                    {TYPE_CHOICES.map(c => (
                                        <option key={c.value} value={c.value}>{c.label}</option>
                                    ))}
                                </Form.Select>
                                <div style={{ minWidth: '180px', flex: '1 1 200px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Output Type..."
                                        value={searchTerm}
                                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                        style={{ height: '37px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                <CreateButton
                                    module="att-prd"
                                    onClick={() => handleShowModal()}
                                >
                                    Attendance & Output Type
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
                                                <th style={{ width: '80px' }}><strong>SL NO</strong></th>
                                                <th><strong>NAME</strong></th>
                                                <th><strong>TYPE CATEGORY</strong></th>
                                                <th><strong>UNIT / PERIOD TYPE</strong></th>
                                                <th style={{ width: '130px' }}><strong>STATUS</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredItems.length === 0 ? (
                                                <tr>
                                                    <td colSpan="6" className="text-center py-4 text-muted">
                                                        No entries
                                                    </td>
                                                </tr>
                                            ) : (
                                                currentItems.map((item, index) => {
                                                    const meta = getTypeMeta(item.type);
                                                    return (
                                                        <tr key={item.id || index}>
                                                            <td><strong>{indexOfFirstItem + index + 1}</strong></td>
                                                            <td>
                                                                <strong>{item.name}</strong>
                                                            </td>
                                                            <td>
                                                                {item.type_display || meta.label}
                                                            </td>
                                                            <td>
                                                                {renderUnitDisplay(item)}
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
                                                                        module="att-prd"
                                                                        onClick={() => handleShowModal(item)}
                                                                        className="me-1"
                                                                    />
                                                                    <DeleteButton
                                                                        module="att-prd"
                                                                        onClick={() => handleDelete(item.id, item.name)}
                                                                    />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {filteredItems.length > 0 && (
                                <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                    <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredItems.length)} of {filteredItems.length} entries
                                    </div>
                                    {totalPages > 1 && (
                                        <nav>
                                            <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                    <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ border: 'none', background: 'none' }}>
                                                        <i className="la la-angle-left" />
                                                    </button>
                                                </li>
                                                {Array.from({ length: totalPages }, (_, index) => {
                                                    const pageNumber = index + 1;
                                                    if (
                                                        pageNumber === 1 ||
                                                        pageNumber === totalPages ||
                                                        (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                                                    ) {
                                                        return (
                                                            <li key={pageNumber} className={`page-item ${currentPage === pageNumber ? 'active' : ''}`}>
                                                                <button type="button" className="page-link" onClick={() => setCurrentPage(pageNumber)} style={{ border: 'none' }}>
                                                                    {pageNumber}
                                                                </button>
                                                            </li>
                                                        );
                                                    } else if (
                                                        pageNumber === currentPage - 2 ||
                                                        pageNumber === currentPage + 2
                                                    ) {
                                                        return (
                                                            <li key={pageNumber} className="page-item disabled">
                                                                <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                                            </li>
                                                        );
                                                    }
                                                    return null;
                                                })}
                                                <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                                    <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} style={{ border: 'none', background: 'none' }}>
                                                        <i className="la la-angle-right" />
                                                    </button>
                                                </li>
                                            </ul>
                                        </nav>
                                    )}
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
                dialogClassName="type-custom-modal"
            >
                <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
                    <div className="modal-header-custom">
                        <div className="d-flex align-items-center gap-3">
                            <div className="modal-icon-circle">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5v-5z" fill="white"/>
                                </svg>
                            </div>
                            <div>
                                <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                    {editMode ? 'Edit Attendance & Output Type' : 'Create Attendance & Output Type'}
                                </h4>
                                <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                    Enter details to manage attendance & output type
                                </p>
                            </div>
                        </div>
                        <button type="button" className="modal-close-x" onClick={handleCloseModal}>&times;</button>
                    </div>

                    <div className="modal-body-custom">
                        <div className="mb-3">
                            <Form.Label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                                Name <span className="text-danger">*</span>
                            </Form.Label>
                            <Form.Control
                                ref={firstInputRef}
                                type="text"
                                placeholder="e.g. Present, Absent, Overtime, Production Pieces"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                                style={{ borderRadius: '8px', fontSize: '14px', padding: '10px 14px' }}
                            />
                        </div>

                        <div className="mb-3 type-category-select">
                            <Form.Label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                                Type Category <span className="text-danger">*</span>
                            </Form.Label>
                            <Select
                                classNamePrefix="react-select"
                                options={TYPE_CHOICES}
                                value={TYPE_CHOICES.find(c => c.value === formData.type) || null}
                                onChange={makeTypeSelectChange}
                                onFocus={handleSelectFocus}
                                onKeyDown={handleTypeSelectKeyDown}
                                placeholder="Select Type Category..."
                                openMenuOnFocus={true}
                                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                styles={selectStyles}
                            />
                        </div>

                        {/* Conditional field: Production -> Pay Unit dropdown, Otherwise -> Period Type (default Days) */}
                        {formData.type === 'production' ? (
                            <div className="mb-3 unit-dropdown-select">
                                <Form.Label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                                    Pay Unit <span className="text-danger">*</span>
                                </Form.Label>
                                <Select
                                    classNamePrefix="react-select"
                                    options={payrollUnits.map(u => ({
                                        value: u.id,
                                        label: `${u.formal_name} (${u.symbol})`
                                    }))}
                                    value={
                                        formData.payroll_unit
                                            ? {
                                                value: formData.payroll_unit,
                                                label: (() => {
                                                    const u = payrollUnits.find(item => String(item.id) === String(formData.payroll_unit));
                                                    return u ? `${u.formal_name} (${u.symbol})` : '';
                                                })()
                                            }
                                            : null
                                    }
                                    onChange={makeUnitSelectChange}
                                    onFocus={handleSelectFocus}
                                    onKeyDown={handleNextSelectKeyDown}
                                    placeholder="Select Pay Unit..."
                                    openMenuOnFocus={true}
                                    menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                    styles={selectStyles}
                                />
                            </div>
                        ) : (
                            <div className="mb-3 period-type-select">
                                <Form.Label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                                    Period Type
                                </Form.Label>
                                <Form.Control
                                    type="text"
                                    value="Days"
                                    readOnly
                                    disabled
                                    style={{
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        padding: '10px 14px',
                                        backgroundColor: '#f1f5f9',
                                        borderColor: '#cbd5e1',
                                        color: '#475569',
                                        cursor: 'not-allowed',
                                        fontWeight: 500
                                    }}
                                />
                            </div>
                        )}

                        <div className="form-check form-switch mt-3">
                            <input
                                className="form-check-input"
                                type="checkbox"
                                id="attendanceIsActiveSwitch"
                                checked={formData.is_active}
                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                style={{ cursor: 'pointer' }}
                            />
                            <label className="form-check-label" htmlFor="attendanceIsActiveSwitch" style={{ fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                                Active Type
                            </label>
                        </div>
                    </div>

                    <div className="modal-footer-custom">
                        <Button
                            type="button"
                            className="btn-close-custom"
                            onClick={handleCloseModal}
                            disabled={submitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="btn-save-custom"
                            disabled={submitting}
                        >
                            {submitting ? 'Saving...' : (editMode ? 'Save Changes' : 'Save')}
                        </Button>
                    </div>
                </Form>
            </Modal>
        </Fragment>
    );
};

export default AttendanceProductionTypeList;
