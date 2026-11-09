import React, { useState, useEffect, useRef, Fragment } from 'react';
import { Card, Button, Modal, Form, Badge } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    getPayrollUnits,
    createPayrollUnit,
    updatePayrollUnit,
    deletePayrollUnit
} from '../../../services/PayrollService';
import { usePageTitle } from '../../../context/TitleContext';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';

const EMPTY_PAYROLL_UNIT = {
    id: null,
    symbol: '',
    formal_name: '',
    decimals: 2,
    is_active: true
};

const PayrollUnitList = () => {
    usePageTitle('Pay Units');

    const [units, setUnits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({ ...EMPTY_PAYROLL_UNIT });
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
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getPayrollUnits();
            setUnits(Array.isArray(data) ? data : (data.results || []));
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to fetch pay units.'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleShowModal = (unit = null) => {
        if (unit) {
            setFormData({
                id: unit.id,
                symbol: unit.symbol || '',
                formal_name: unit.formal_name || '',
                decimals: unit.decimals ?? 2,
                is_active: unit.is_active ?? true
            });
            setEditMode(true);
        } else {
            setFormData({ ...EMPTY_PAYROLL_UNIT });
            setEditMode(false);
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setFormData({ ...EMPTY_PAYROLL_UNIT });
        setSubmitting(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.symbol.trim()) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Unit symbol is required (e.g. hrs, min, days).' });
            return;
        }

        if (!formData.formal_name.trim()) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Formal name is required (e.g. Hours, Minutes, Days).' });
            return;
        }

        const payload = {
            symbol: formData.symbol.trim(),
            formal_name: formData.formal_name.trim(),
            decimals: parseInt(formData.decimals, 10) || 0,
            is_active: formData.is_active
        };

        try {
            setSubmitting(true);
            if (editMode) {
                await updatePayrollUnit(formData.id, payload);
                Swal.fire({
                    icon: 'success',
                    title: 'Updated',
                    text: 'Pay unit updated successfully',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                await createPayrollUnit(payload);
                Swal.fire({
                    icon: 'success',
                    title: 'Created',
                    text: 'Pay unit created successfully',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
            handleCloseModal();
            fetchData();
        } catch (error) {
            let errorMsg = `Failed to ${editMode ? 'update' : 'create'} pay unit`;
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
            title: 'Delete Pay Unit?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deletePayrollUnit(id);
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted',
                    text: 'Pay unit deleted successfully',
                    timer: 2000,
                    showConfirmButton: false
                });
                fetchData();
            } catch (error) {
                let errorMsg = 'Failed to delete pay unit';
                if (error.response && error.response.data && error.response.data.detail) {
                    errorMsg = error.response.data.detail;
                }
                Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
            }
        }
    };

    // Filter units
    const filteredUnits = units.filter(unit =>
        (unit.symbol || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (unit.formal_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredUnits.length / itemsPerPage) || 1;
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentUnits = filteredUnits.slice(indexOfFirstItem, indexOfLastItem);

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    return (
        <Fragment>
            <style>{`
                .payroll-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .payroll-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .payroll-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #2ece8a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
                }
                .payroll-custom-modal .modal-close-x {
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
                .payroll-custom-modal .modal-close-x:hover { color: #555; }
                .payroll-custom-modal .modal-body-custom {
                    padding: 24px 28px;
                }
                .payroll-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .payroll-custom-modal .btn-close-custom {
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
                .payroll-custom-modal .btn-close-custom:hover { background-color: #6357a7 !important; }
                .payroll-custom-modal .btn-save-custom {
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
                .payroll-custom-modal .btn-save-custom:hover { background-color: #26b277 !important; }
            `}</style>

            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                            <Card.Title className="mb-0">Pay Units</Card.Title>
                            <div className="d-flex flex-wrap align-items-center gap-2">
                                <div style={{ minWidth: '180px', flex: '1 1 200px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Pay Unit..."
                                        value={searchTerm}
                                        onChange={handleSearchChange}
                                        style={{ height: '37px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                <CreateButton
                                    module="payunit"
                                    onClick={() => handleShowModal()}
                                >
                                    Pay Unit
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
                                                <th><strong>UNIT SYMBOL / CODE</strong></th>
                                                <th><strong>UNIT FULL NAME</strong></th>
                                                <th><strong>DECIMAL PRECISION</strong></th>
                                                <th style={{ width: '130px' }}><strong>STATUS</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredUnits.length === 0 ? (
                                                <tr>
                                                    <td colSpan="6" className="text-center py-4 text-muted">
                                                        No entries
                                                    </td>
                                                </tr>
                                            ) : (
                                                currentUnits.map((unit, index) => (
                                                    <tr key={unit.id || index}>
                                                        <td><strong>{indexOfFirstItem + index + 1}</strong></td>
                                                        <td>
                                                            <strong>{unit.symbol}</strong>
                                                        </td>
                                                        <td>
                                                            {unit.formal_name || <span className="text-muted">-</span>}
                                                        </td>
                                                        <td>
                                                            <span className="badge badge-dark" style={{ fontSize: '12px' }}>
                                                                {unit.decimals} decimals
                                                            </span>
                                                        </td>
                                                        <td>
                                                            {unit.is_active ? (
                                                                <span className="badge badge-success light">Active</span>
                                                            ) : (
                                                                <span className="badge badge-danger light">Inactive</span>
                                                            )}
                                                        </td>
                                                        <td className="text-end">
                                                            <div className="d-flex justify-content-end">
                                                                <EditButton
                                                                    module="payunit"
                                                                    onClick={() => handleShowModal(unit)}
                                                                    className="me-1"
                                                                />
                                                                <DeleteButton
                                                                    module="payunit"
                                                                    onClick={() => handleDelete(unit.id, unit.formal_name || unit.symbol)}
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

                            {filteredUnits.length > 0 && (
                                <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                    <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredUnits.length)} of {filteredUnits.length} entries
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
                dialogClassName="payroll-custom-modal"
            >
                <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
                    <div className="modal-header-custom">
                        <div className="d-flex align-items-center gap-3">
                            <div className="modal-icon-circle">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7v-7zm4-3h2v10h-2V7zm4 6h2v4h-2v-4z" fill="white"/>
                                </svg>
                            </div>
                            <div>
                                <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                    {editMode ? 'Edit Pay Unit' : 'Create Pay Unit'}
                                </h4>
                                <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                    Enter details to manage pay unit
                                </p>
                            </div>
                        </div>
                        <button type="button" className="modal-close-x" onClick={handleCloseModal}>&times;</button>
                    </div>

                    <div className="modal-body-custom">
                        <div className="mb-3">
                            <Form.Label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                                Unit Symbol / Code <span className="text-danger">*</span>
                            </Form.Label>
                            <Form.Control
                                ref={firstInputRef}
                                type="text"
                                placeholder="e.g. hrs, min, days, pcs"
                                value={formData.symbol}
                                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                                required
                                style={{ borderRadius: '8px', fontSize: '14px', padding: '10px 14px' }}
                            />
                            
                        </div>

                        <div className="mb-3">
                            <Form.Label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                                Unit Full Name <span className="text-danger">*</span>
                            </Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="e.g. Hours, Minutes, Days, Pieces"
                                value={formData.formal_name}
                                onChange={(e) => setFormData({ ...formData, formal_name: e.target.value })}
                                required
                                style={{ borderRadius: '8px', fontSize: '14px', padding: '10px 14px' }}
                            />
                        </div>

                        <div className="mb-3">
                            <Form.Label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                                Decimal Precision
                            </Form.Label>
                            <Form.Control
                                type="number"
                                min="0"
                                max="4"
                                value={formData.decimals}
                                onChange={(e) => setFormData({ ...formData, decimals: e.target.value })}
                                style={{ borderRadius: '8px', fontSize: '14px', padding: '10px 14px' }}
                            />
                            
                        </div>

                        <div className="form-check form-switch mt-3">
                            <input
                                className="form-check-input"
                                type="checkbox"
                                id="unitIsActiveSwitch"
                                checked={formData.is_active}
                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                style={{ cursor: 'pointer' }}
                            />
                            <label className="form-check-label" htmlFor="unitIsActiveSwitch" style={{ fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                                Active Unit
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

export default PayrollUnitList;
