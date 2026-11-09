import React, { useState, useEffect } from 'react';
import { Card, Button, Form, Modal } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { useEnterTraversal } from '../../../../hooks/useEnterTraversal';
import { usePageTitle } from '../../../../context/TitleContext';
import {
    getCustomerTypes,
    createCustomerType,
    updateCustomerType,
    deleteCustomerType,
} from '../../../../services/HRManagementService';

const CustomerType = () => {
    usePageTitle("Associate Types");
    const [customerTypes, setCustomerTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // --- Customer Type modal state ---
    const [showTypeModal, setShowTypeModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [typeName, setTypeName] = useState('');
    const [detailsNeeded, setDetailsNeeded] = useState(false);
    const [typeSubmitting, setTypeSubmitting] = useState(false);

    const saveBtnRef = React.useRef(null);
    const cancelBtnRef = React.useRef(null);

    const { handleFormKeyDown } = useEnterTraversal('.ct-custom-modal');

    useEffect(() => {
        fetchCustomerTypes();
    }, []);

    const fetchCustomerTypes = async () => {
        setLoading(true);
        try {
            const data = await getCustomerTypes();
            const arr = Array.isArray(data) ? data : (data.results || []);
            arr.sort((a, b) => a.name.localeCompare(b.name));
            setCustomerTypes(arr);
        } catch (error) {
            console.error('Error fetching associate types:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredTypes = customerTypes.filter(t =>
        !searchTerm || t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentTypes = filteredTypes.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredTypes.length / itemsPerPage);

    const handleCloseTypeModal = () => {
        setShowTypeModal(false);
        setEditId(null);
        setTypeName('');
        setDetailsNeeded(false);
    };

    const handleEditType = (type) => {
        setEditId(type.id);
        setTypeName(type.name);
        setDetailsNeeded(type.details_needed);
        setShowTypeModal(true);
    };

    const handleDeleteType = async (id, name) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: `Delete associate type: ${name}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });
        if (result.isConfirmed) {
            try {
                await deleteCustomerType(id);
                Swal.fire('Deleted!', 'Associate type deleted.', 'success');
                fetchCustomerTypes();
            } catch {
                Swal.fire('Error', 'Failed to delete associat type', 'error');
            }
        }
    };

    const handleTypeSubmit = async (e) => {
        e.preventDefault();
        setTypeSubmitting(true);
        try {
            if (editId) {
                await updateCustomerType(editId, { name: typeName, details_needed: detailsNeeded });
                await Swal.fire({ icon: 'success', title: 'Updated', text: 'Associate type updated.', confirmButtonColor: 'var(--primary)' });
                handleCloseTypeModal();
            } else {
                await createCustomerType({ name: typeName, details_needed: detailsNeeded });
                await Swal.fire({ icon: 'success', title: 'Created', text: 'Associate type created.', confirmButtonColor: 'var(--primary)' });
                handleCloseTypeModal();
            }
            fetchCustomerTypes();
        } catch {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to save associate type.' });
        } finally {
            setTypeSubmitting(false);
        }
    };

    const onCancelBtnKeyDown = (e) => {
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (saveBtnRef.current) saveBtnRef.current.focus();
        }
    };

    const onSaveBtnKeyDown = (e) => {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (cancelBtnRef.current) cancelBtnRef.current.focus();
        }
    };

    return (
        <>
            <style>{`
                .ct-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .ct-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .ct-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #2ece8a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
                }
                .ct-custom-modal .modal-close-x {
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
                .ct-custom-modal .modal-close-x:hover { color: #555; }
                .ct-custom-modal .modal-body-custom {
                    padding: 24px 28px;
                }
                .ct-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .ct-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .ct-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .ct-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                }
                .ct-custom-modal .form-control-custom::placeholder { color: #94a3b8; }
                .ct-custom-modal .form-check-input:checked {
                    background-color: #2ece8a;
                    border-color: #2ece8a;
                }
                .ct-custom-modal .btn-close-custom {
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
                .ct-custom-modal .btn-close-custom:hover { background-color: #6357a7 !important; }
                .ct-custom-modal .btn-close-custom:focus {
                    outline: none !important;
                    box-shadow: 0 0 0 4px rgba(122, 112, 186, 0.3) !important;
                }
                .ct-custom-modal .btn-save-custom {
                    background-color: #2ece8a !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, box-shadow 0.2s;
                }
                .ct-custom-modal .btn-save-custom:hover { background-color: #26b277 !important; }
                .ct-custom-modal .btn-save-custom:focus {
                    outline: none !important;
                    box-shadow: 0 0 0 4px rgba(46, 206, 138, 0.3) !important;
                }
            `}</style>

        <div className="container-fluid">
            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center">
                            <Card.Title className="mb-0">Associate Types</Card.Title>
                            <div className="d-flex align-items-center gap-2">
                                <div style={{ width: '300px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Associate Type..."
                                        value={searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => setShowTypeModal(true)}
                                    className="d-flex align-items-center justify-content-center"
                                    style={{
                                        height: '38px', borderRadius: '6px', whiteSpace: 'nowrap', padding: '0 16px',
                                        backgroundColor: 'rgb(61, 53, 119)', borderColor: 'rgb(61, 53, 119)', fontSize: '13px'
                                    }}
                                >
                                    <i className="fa fa-plus me-2"></i> Associate Type
                                </Button>
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
                                                <th><strong>SL No</strong></th>
                                                <th><strong>NAME</strong></th>
                                                <th><strong>DETAILS NEEDED</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentTypes.length === 0 ? (
                                                <tr>
                                                    <td colSpan="4" className="text-center py-4 text-muted">No entries</td>
                                                </tr>
                                            ) : (
                                                currentTypes.map((type, index) => (
                                                    <tr key={type.id}>
                                                        <td>{indexOfFirstItem + index + 1}</td>
                                                        <td><strong>{type.name}</strong></td>
                                                        <td>
                                                            {type.details_needed
                                                                ? <span className="badge badge-success light">Yes</span>
                                                                : <span className="badge badge-danger light">No</span>
                                                            }
                                                        </td>
                                                        <td className="text-end">
                                                            <div className="d-flex justify-content-end">
                                                                <Button variant="outline-primary" size="sm" className="shadow me-1"
                                                                    style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontSize: '12px', borderRadius: '6px' }}
                                                                    onClick={() => handleEditType(type)}>
                                                                    <i className="fa fa-pencil-alt"></i>
                                                                </Button>
                                                                <Button variant="outline-danger" size="sm" className="shadow"
                                                                    style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontSize: '12px', borderRadius: '6px' }}
                                                                    onClick={() => handleDeleteType(type.id, type.name)}>
                                                                    <i className="fa fa-trash"></i>
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            {!loading && totalPages > 1 && (
                                <div className="d-flex justify-content-between align-items-center mt-3">
                                    <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredTypes.length)} of {filteredTypes.length} entries
                                    </div>
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
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {/* Customer Type Modal */}
            <Modal show={showTypeModal} onHide={handleCloseTypeModal} dialogClassName="ct-custom-modal" backdrop="static" keyboard={false} enforceFocus={false} centered>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 10H9v-2h6v2zm3-4H6V8h12v2z" fill="white" />
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editId ? 'Edit Associate Type' : 'Create Associate Type'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage associate type
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={handleCloseTypeModal}>&times;</button>
                </div>

                <Form onSubmit={handleTypeSubmit} onKeyDown={handleFormKeyDown}>
                    <div className="modal-body-custom">
                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Name <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                type="text"
                                className="form-control-custom"
                                placeholder="Enter associate type name"
                                value={typeName}
                                onChange={(e) => setTypeName(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>
                        <div className="d-flex align-items-center" style={{ gap: '10px' }}>
                            <Form.Check
                                type="checkbox"
                                id="detailsNeeded"
                                checked={detailsNeeded}
                                onChange={(e) => setDetailsNeeded(e.target.checked)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (saveBtnRef.current) saveBtnRef.current.focus();
                                    }
                                }}
                            />
                            <Form.Label htmlFor="detailsNeeded" className="form-label-custom mb-0" style={{ cursor: 'pointer' }}>
                                Details Needed
                            </Form.Label>
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={handleCloseTypeModal} onKeyDown={onCancelBtnKeyDown} ref={cancelBtnRef}>Close</Button>
                        <Button type="submit" className="btn-save-custom" disabled={typeSubmitting} onKeyDown={onSaveBtnKeyDown} ref={saveBtnRef}>
                            {typeSubmitting ? 'Saving...' : 'Save'}
                        </Button>
                    </div>
                </Form>
            </Modal>
        </div>
        </>
    );
};

export default CustomerType;
