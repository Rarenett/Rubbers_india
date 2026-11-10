import React, { useState, useEffect, Fragment } from 'react';

import { Card, Button, Modal, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    getUnits,
    createUnit,
    updateUnit,
    deleteUnit
} from '../../../services/InventoryService';
import { usePermission } from '../../../hooks/usePermission';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';

const EMPTY_UNIT = {
    id: null,
    name: '',
    uqc_code: '',
    decimal_places: 0
};

const UnitList = () => {
    const [units, setUnits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { can } = usePermission();

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [currentUnit, setCurrentUnit] = useState({ ...EMPTY_UNIT });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getUnits();
            setUnits(data);
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to fetch inventory units',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleShowModal = (unit = null) => {
        if (unit) {
            setCurrentUnit({ ...unit });
            setEditMode(true);
        } else {
            setCurrentUnit({ ...EMPTY_UNIT });
            setEditMode(false);
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setCurrentUnit({ ...EMPTY_UNIT });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!currentUnit.name.trim()) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Unit name is required' });
            return;
        }
        if (!currentUnit.uqc_code.trim()) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'UQC Code is required' });
            return;
        }

        try {
            const payload = {
                name: currentUnit.name.trim(),
                uqc_code: currentUnit.uqc_code.trim().toUpperCase(),
                decimal_places: parseInt(currentUnit.decimal_places) || 0
            };

            if (editMode) {
                await updateUnit(currentUnit.id, payload);
                Swal.fire({ icon: 'success', title: 'Updated', text: 'Unit updated successfully', timer: 2000, showConfirmButton: false });
            } else {
                await createUnit(payload);
                Swal.fire({ icon: 'success', title: 'Created', text: 'Unit created successfully', timer: 2000, showConfirmButton: false });
            }
            handleCloseModal();
            fetchData();
        } catch (error) {
            let errorMsg = `Failed to ${editMode ? 'update' : 'create'} unit`;
            if (error.response && error.response.data) {
                const data = error.response.data;
                if (typeof data === 'object') {
                    errorMsg = Object.keys(data)
                        .map(key => `${key.replace('_', ' ').toUpperCase()}: ${data[key]}`)
                        .join('\n');
                } else if (typeof data === 'string') {
                    errorMsg = data;
                }
            }
            Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
        }
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Unit?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deleteUnit(id);
                Swal.fire({ icon: 'success', title: 'Deleted', text: 'Unit deleted successfully', timer: 2000, showConfirmButton: false });
                fetchData();
            } catch (error) {
                let errorMsg = 'Failed to delete unit';
                if (error.response && error.response.data && error.response.data.detail) {
                    errorMsg = error.response.data.detail;
                }
                Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
            }
        }
    };

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const filteredUnits = units.filter(unit =>
        (unit.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (unit.uqc_code || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredUnits.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = (currentPage - 1) * itemsPerPage;
    const currentUnits = filteredUnits.slice(indexOfFirstItem, indexOfLastItem);

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    return (
        <Fragment>
            {/* Inline Styles for Custom Popup matching Mock Image */}
            <style>{`
                .unit-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .unit-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .unit-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #0a500f;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .unit-custom-modal .modal-close-x {
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
                .unit-custom-modal .modal-close-x:hover {
                    color: #555;
                }
                .unit-custom-modal .modal-body-custom {
                    padding: 28px;
                }
                .unit-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .unit-custom-modal .form-label-custom {
                    font-size: 14px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 8px;
                }
                .unit-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 12px 16px;
                    font-size: 14px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .unit-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .unit-custom-modal .form-control-custom::placeholder {
                    color: #94a3b8;
                }
                .unit-custom-modal .btn-close-custom {
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
                .unit-custom-modal .btn-close-custom:hover {
                    background-color: #bb2d3b !important;
                }
                .unit-custom-modal .btn-save-custom {
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
                .unit-custom-modal .btn-save-custom:hover {
                    background-color: #073d0b !important;
                }
            `}</style>

            

            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                            <Card.Title className="mb-0">Units Management</Card.Title>
                            <div className="d-flex flex-wrap align-items-center gap-2">
                                <div style={{ minWidth: '180px', flex: '1 1 200px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Unit..."
                                        value={searchTerm}
                                        onChange={handleSearchChange}
                                        style={{ height: '37px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                <CreateButton
                                    module="units"
                                    onClick={() => handleShowModal()}
                                >
                                    Unit
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
                                                <th><strong>NAME</strong></th>
                                                <th><strong>UQC CODE</strong></th>
                                                <th><strong>DECIMAL PLACES</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentUnits.length === 0 ? (
                                                <tr>
                                                    <td colSpan="5" className="text-center py-4 text-muted">
                                                        No units found
                                                    </td>
                                                </tr>
                                            ) : (
                                                currentUnits.map((unit, index) => (
                                                    <tr key={unit.id || index}>
                                                        <td><strong>{indexOfFirstItem + index + 1}</strong></td>
                                                        <td><strong>{unit.name}</strong></td>
                                                        <td><span className="badge badge-success light">{unit.uqc_code}</span></td>
                                                        <td>{unit.decimal_places}</td>
                                                        <td className="text-end">
                                                            {can('inventory', 'edit') || can('inventory', 'delete') ? (
                                                                <div className="d-flex justify-content-end">
                                                                    <EditButton
                                                                        module="units"
                                                                        onClick={() => handleShowModal(unit)}
                                                                        className="me-1"
                                                                    />
                                                                    <DeleteButton
                                                                        module="units"
                                                                        onClick={() => handleDelete(unit.id, unit.name)}
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <span className="badge badge-danger light mt-1">No Access</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )))}
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

            {/* Custom Styled Popup Modal */}
            <Modal 
                show={showModal} 
                onHide={handleCloseModal}
                dialogClassName="unit-custom-modal"
                centered
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            {/* Custom tag/price ticket icon using FontAwesome */}
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M21.41 11.58L12.42 2.59A1.996 1.996 0 0 0 11.01 2H4c-1.1 0-2 .9-2 2v7.01c0 .53.21 1.04.58 1.41l8.99 8.99c.78.78 2.05.78 2.83 0l7.01-7.01c.78-.78.78-2.05 0-2.83zM5.5 8.25C4.67 8.25 4 7.58 4 6.75s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" fill="white"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editMode ? 'Edit Unit' : 'Create Unit'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details and set decimal places to manage unit
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
                                <Form.Label className="form-label-custom">Unit Name <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    value={currentUnit.name}
                                    onChange={(e) => setCurrentUnit({ ...currentUnit, name: e.target.value })}
                                    placeholder="Enter unit name"
                                    required
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">UQC Code <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    value={currentUnit.uqc_code}
                                    onChange={(e) => setCurrentUnit({ ...currentUnit, uqc_code: e.target.value })}
                                    placeholder="e.g. NOS, KGS, LTR"
                                    required
                                />
                            </div>
                        </div>
                        <div className="row">
                            <div className="col-md-6 mb-1">
                                <Form.Label className="form-label-custom">Decimal Places <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="number"
                                    className="form-control-custom"
                                    min="0"
                                    max="4"
                                    value={currentUnit.decimal_places}
                                    onChange={(e) => setCurrentUnit({ ...currentUnit, decimal_places: parseInt(e.target.value) || 0 })}
                                    placeholder="Enter decimal places (0-4)"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={handleCloseModal}>
                            Close
                        </Button>
                        <Button type="submit" className="btn-save-custom">
                            Save
                        </Button>
                    </div>
                </Form>
            </Modal>
        </Fragment>
    );
};

export default UnitList;
