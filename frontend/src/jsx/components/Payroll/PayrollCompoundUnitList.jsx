import React, { useState, useEffect, useRef, Fragment } from 'react';
import { Card, Button, Modal, Form, Badge } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import {
    getPayrollCompoundUnits,
    createPayrollCompoundUnit,
    updatePayrollCompoundUnit,
    deletePayrollCompoundUnit,
    getPayrollUnits
} from '../../../services/PayrollService';
import { usePageTitle } from '../../../context/TitleContext';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';

const EMPTY_COMPOUND_UNIT = {
    id: null,
    compound_unit: '',
    conversion_factor: '',
    base_unit: '',
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

const PayrollCompoundUnitList = () => {
    usePageTitle('Compound Pay Units');

    const [compoundUnits, setCompoundUnits] = useState([]);
    const [payrollUnits, setPayrollUnits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({ ...EMPTY_COMPOUND_UNIT });
    const [submitting, setSubmitting] = useState(false);
    const currentSelectControlRef = useRef(null);

    // Auto-focus first input/dropdown when modal opens
    useEffect(() => {
        if (showModal) {
            const timer = setTimeout(() => {
                const modal = document.querySelector('.compound-custom-modal');
                if (modal) {
                    const first = modal.querySelector('.react-select__control input, input:not([disabled]):not([readonly])');
                    if (first) first.focus();
                }
            }, 120);
            return () => clearTimeout(timer);
        }
    }, [showModal]);

    // Keyboard navigation
    const getFocusable = () => {
        const modal = document.querySelector('.compound-custom-modal');
        if (!modal) return [];
        return Array.from(
            modal.querySelectorAll(
                '.react-select__control, input.form-control, input.form-check-input, button[type="submit"]:not([disabled])'
            )
        ).filter(el => el.offsetParent !== null && !el.disabled);
    };

    const focusNextFromControl = (control) => {
        const all = getFocusable();
        const index = all.indexOf(control);
        if (index > -1 && index < all.length - 1) {
            const next = all[index + 1];
            if (next.classList.contains('react-select__control')) {
                next.querySelector('input')?.focus();
            } else {
                next.focus();
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        if (e.target.tagName.toLowerCase() === 'textarea') return;
        if (e.target.type === 'submit') return;
        if (e.target.tagName.toLowerCase() === 'button' && e.target.type !== 'submit') return;
        if (e.target.closest('.react-select__control')) return;

        const all = getFocusable();
        const currentControl = e.target.closest('.react-select__control') || e.target;
        const index = all.indexOf(currentControl);
        if (index > -1 && index < all.length - 1) {
            e.preventDefault();
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
            const control = e.target.closest('.react-select__control');
            setTimeout(() => {
                if (control) focusNextFromControl(control);
            }, 60);
        }
    };

    const makeSelectChange = (field) => (opt) => {
        setFormData(prev => ({ ...prev, [field]: opt ? opt.value : '' }));
        const control = currentSelectControlRef.current;
        setTimeout(() => { if (control) focusNextFromControl(control); }, 60);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [compoundData, unitsData] = await Promise.all([
                getPayrollCompoundUnits(),
                getPayrollUnits()
            ]);

            setCompoundUnits(Array.isArray(compoundData) ? compoundData : (compoundData.results || []));
            setPayrollUnits(Array.isArray(unitsData) ? unitsData : (unitsData.results || []));
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to fetch compound pay units.'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleShowModal = (item = null) => {
        if (item) {
            setFormData({
                id: item.id,
                compound_unit: item.compound_unit || '',
                conversion_factor: item.conversion_factor || '',
                base_unit: item.base_unit || '',
                is_active: item.is_active ?? true
            });
            setEditMode(true);
        } else {
            setFormData({ ...EMPTY_COMPOUND_UNIT });
            setEditMode(false);
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setFormData({ ...EMPTY_COMPOUND_UNIT });
        setSubmitting(false);
    };

    const getUnitSymbol = (unitId) => {
        if (!unitId) return '';
        const found = payrollUnits.find(u => String(u.id) === String(unitId));
        return found ? found.symbol : '';
    };

    const getUnitName = (unitId) => {
        if (!unitId) return '';
        const found = payrollUnits.find(u => String(u.id) === String(unitId));
        return found ? `${found.formal_name} (${found.symbol})` : '';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.compound_unit) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Please select a Primary Unit.' });
            return;
        }

        if (!formData.base_unit) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Please select a Base Unit.' });
            return;
        }

        if (String(formData.compound_unit) === String(formData.base_unit)) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Primary Unit and Base Unit cannot be identical.'
            });
            return;
        }

        const factor = parseFloat(formData.conversion_factor);
        if (isNaN(factor) || factor <= 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Conversion factor must be a positive number greater than zero.'
            });
            return;
        }

        const payload = {
            compound_unit: parseInt(formData.compound_unit, 10),
            base_unit: parseInt(formData.base_unit, 10),
            conversion_factor: factor,
            is_active: formData.is_active
        };

        try {
            setSubmitting(true);
            if (editMode) {
                await updatePayrollCompoundUnit(formData.id, payload);
                Swal.fire({
                    icon: 'success',
                    title: 'Updated',
                    text: 'Compound pay unit updated successfully',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                await createPayrollCompoundUnit(payload);
                Swal.fire({
                    icon: 'success',
                    title: 'Created',
                    text: 'Compound pay unit created successfully',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
            handleCloseModal();
            fetchData();
        } catch (error) {
            let errorMsg = `Failed to ${editMode ? 'update' : 'create'} compound pay unit`;
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

    const handleDelete = async (id, equation) => {
        const result = await Swal.fire({
            title: 'Delete Compound Pay Unit?',
            text: `Are you sure you want to delete "${equation}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deletePayrollCompoundUnit(id);
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted',
                    text: 'Compound pay unit deleted successfully',
                    timer: 2000,
                    showConfirmButton: false
                });
                fetchData();
            } catch (error) {
                let errorMsg = 'Failed to delete compound pay unit';
                if (error.response && error.response.data && error.response.data.detail) {
                    errorMsg = error.response.data.detail;
                }
                Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
            }
        }
    };

    // Filter compound units
    const filteredCompoundUnits = compoundUnits.filter(item => {
        const compSymbol = item.compound_unit_symbol || getUnitSymbol(item.compound_unit);
        const compName = item.compound_unit_name || getUnitName(item.compound_unit);
        const baseSymbol = item.base_unit_symbol || getUnitSymbol(item.base_unit);
        const baseName = item.base_unit_name || getUnitName(item.base_unit);

        const search = searchTerm.toLowerCase();
        return compSymbol.toLowerCase().includes(search) ||
            compName.toLowerCase().includes(search) ||
            baseSymbol.toLowerCase().includes(search) ||
            baseName.toLowerCase().includes(search);
    });

    const totalPages = Math.ceil(filteredCompoundUnits.length / itemsPerPage) || 1;
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredCompoundUnits.slice(indexOfFirstItem, indexOfLastItem);

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    // Modal Live Preview Formula
    const selectedCompSymbol = getUnitSymbol(formData.compound_unit) || 'Unit A';
    const selectedBaseSymbol = getUnitSymbol(formData.base_unit) || 'Unit B';
    const enteredFactor = formData.conversion_factor || 'N';

    return (
        <Fragment>
            <style>{`
                .compound-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .compound-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .compound-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #0a500f;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .compound-custom-modal .modal-close-x {
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
                .compound-custom-modal .modal-close-x:hover { color: #555; }
                .compound-custom-modal .modal-body-custom {
                    padding: 24px 28px;
                }
                .compound-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .compound-custom-modal .btn-close-custom {
                    background-color: #dc3545 !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .compound-custom-modal .btn-close-custom:hover { background-color: #bb2d3b !important; }
                .compound-custom-modal .btn-save-custom {
                    background-color: #0a500f !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .compound-custom-modal .btn-save-custom:hover { background-color: #073d0b !important; }

                .preview-box {
                    background-color: #f8fafc;
                    border: 1px dashed #cbd5e1;
                    border-radius: 8px;
                    padding: 14px 16px;
                    text-align: center;
                }
            `}</style>

            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                            <Card.Title className="mb-0">Compound Pay Units</Card.Title>
                            <div className="d-flex flex-wrap align-items-center gap-2">
                                <div style={{ minWidth: '180px', flex: '1 1 200px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Compound Pay Unit..."
                                        value={searchTerm}
                                        onChange={handleSearchChange}
                                        style={{ height: '37px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                <CreateButton
                                    module="cmpunit"
                                    onClick={() => handleShowModal()}
                                >
                                    Compound Pay Unit
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
                                                <th><strong>PRIMARY UNIT</strong></th>
                                                <th><strong>CONVERSION FACTOR</strong></th>
                                                <th><strong>BASE UNIT</strong></th>
                                                <th><strong>CONVERSION RATIO</strong></th>
                                                <th style={{ width: '130px' }}><strong>STATUS</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredCompoundUnits.length === 0 ? (
                                                <tr>
                                                    <td colSpan="7" className="text-center py-4 text-muted">
                                                        No entries
                                                    </td>
                                                </tr>
                                            ) : (
                                                currentItems.map((item, index) => {
                                                    const cSym = item.compound_unit_symbol || getUnitSymbol(item.compound_unit);
                                                    const cName = item.compound_unit_name || getUnitName(item.compound_unit);
                                                    const bSym = item.base_unit_symbol || getUnitSymbol(item.base_unit);
                                                    const bName = item.base_unit_name || getUnitName(item.base_unit);
                                                    const factorFormatted = parseFloat(item.conversion_factor) || item.conversion_factor;
                                                    const equation = `1 ${cSym} = ${factorFormatted} ${bSym}`;

                                                    return (
                                                        <tr key={item.id || index}>
                                                            <td><strong>{indexOfFirstItem + index + 1}</strong></td>
                                                            <td>
                                                                <strong>{cSym}</strong>
                                                                {cName && <span className="text-muted ms-2" style={{ fontSize: '12px' }}>({cName})</span>}
                                                            </td>
                                                            <td>
                                                                <strong>{factorFormatted}</strong>
                                                            </td>
                                                            <td>
                                                                <strong>{bSym}</strong>
                                                                {bName && <span className="text-muted ms-2" style={{ fontSize: '12px' }}>({bName})</span>}
                                                            </td>
                                                            <td>
                                                                <span className="badge badge-primary light" style={{ fontSize: '12px' }}>
                                                                    {equation}
                                                                </span>
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
                                                                        module="cmpunit"
                                                                        onClick={() => handleShowModal(item)}
                                                                        className="me-1"
                                                                    />
                                                                    <DeleteButton
                                                                        module="cmpunit"
                                                                        onClick={() => handleDelete(item.id, equation)}
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

                            {filteredCompoundUnits.length > 0 && (
                                <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                    <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredCompoundUnits.length)} of {filteredCompoundUnits.length} entries
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
                dialogClassName="compound-custom-modal"
            >
                <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
                    <div className="modal-header-custom">
                        <div className="d-flex align-items-center gap-3">
                            <div className="modal-icon-circle">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm6 12H6v-1c0-2 4-3.1 6-3.1s6 1.1 6 3.1v1z" fill="white"/>
                                </svg>
                            </div>
                            <div>
                                <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                    {editMode ? 'Edit Compound Pay Unit' : 'Create Compound Pay Unit'}
                                </h4>
                                <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                    Enter details to manage compound pay unit
                                </p>
                            </div>
                        </div>
                        <button type="button" className="modal-close-x" onClick={handleCloseModal}>&times;</button>
                    </div>

                    <div className="modal-body-custom">
                        {/* Live Equation Preview */}
                        <div className="preview-box mb-4">
                            <span className="text-muted d-block mb-1" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Conversion Ratio Preview
                            </span>
                            <span className="formula-pill" style={{ fontSize: '15px' }}>
                                1 {selectedCompSymbol} = {enteredFactor} {selectedBaseSymbol}
                            </span>
                        </div>

                        <div className="mb-3">
                            <Form.Label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                                Primary Unit <span className="text-danger">*</span>
                            </Form.Label>
                            <Select
                                classNamePrefix="react-select"
                                options={payrollUnits.map(unit => ({
                                    value: unit.id,
                                    label: `${unit.formal_name} (${unit.symbol})`
                                }))}
                                value={
                                    formData.compound_unit
                                        ? {
                                            value: formData.compound_unit,
                                            label: (() => {
                                                const u = payrollUnits.find(unit => String(unit.id) === String(formData.compound_unit));
                                                return u ? `${u.formal_name} (${u.symbol})` : '';
                                            })()
                                        }
                                        : null
                                }
                                onChange={makeSelectChange('compound_unit')}
                                onFocus={handleSelectFocus}
                                onKeyDown={handleSelectKeyDown}
                                placeholder="Select Primary Unit..."
                                openMenuOnFocus={true}
                                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                styles={selectStyles}
                            />
                        </div>

                        <div className="mb-3">
                            <Form.Label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                                Conversion Factor <span className="text-danger">*</span>
                            </Form.Label>
                            <Form.Control
                                type="number"
                                step="any"
                                min="0.0001"
                                placeholder="e.g. 60 (for 60 minutes in 1 hour)"
                                value={formData.conversion_factor}
                                onChange={(e) => setFormData({ ...formData, conversion_factor: e.target.value })}
                                required
                                style={{ borderRadius: '8px', fontSize: '14px', padding: '10px 14px' }}
                            />
                            
                        </div>

                        <div className="mb-3">
                            <Form.Label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                                Base Unit (Sub-Unit) <span className="text-danger">*</span>
                            </Form.Label>
                            <Select
                                classNamePrefix="react-select"
                                options={payrollUnits.map(unit => ({
                                    value: unit.id,
                                    label: `${unit.formal_name} (${unit.symbol})`,
                                    isDisabled: String(unit.id) === String(formData.compound_unit)
                                }))}
                                value={
                                    formData.base_unit
                                        ? {
                                            value: formData.base_unit,
                                            label: (() => {
                                                const u = payrollUnits.find(unit => String(unit.id) === String(formData.base_unit));
                                                return u ? `${u.formal_name} (${u.symbol})` : '';
                                            })()
                                        }
                                        : null
                                }
                                onChange={makeSelectChange('base_unit')}
                                onFocus={handleSelectFocus}
                                onKeyDown={handleSelectKeyDown}
                                placeholder="Select Base Unit..."
                                openMenuOnFocus={true}
                                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                styles={selectStyles}
                            />
                        </div>

                        <div className="form-check form-switch mt-3">
                            <input
                                className="form-check-input"
                                type="checkbox"
                                id="compoundIsActiveSwitch"
                                checked={formData.is_active}
                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                style={{ cursor: 'pointer' }}
                            />
                            <label className="form-check-label" htmlFor="compoundIsActiveSwitch" style={{ fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                                Active Compound Pay Unit
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
                            {submitting ? 'Saving...' : (editMode ? 'Save' : 'Save')}
                        </Button>
                    </div>
                </Form>
            </Modal>
        </Fragment>
    );
};

export default PayrollCompoundUnitList;
