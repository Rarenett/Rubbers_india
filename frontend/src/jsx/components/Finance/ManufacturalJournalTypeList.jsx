import React, { useState, useEffect, Fragment } from 'react';
import { Card, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    getManufacturalJournalTypes,
    deleteManufacturalJournalType,
} from '../../../services/FinanceService';
import { usePermission } from '../../../hooks/usePermission';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import ManufacturalJournalTypeFormModal from './ManufacturalJournalTypeFormModal';

const ManufacturalJournalTypeList = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const { can } = usePermission();

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getManufacturalJournalTypes();
            setItems(data);
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to fetch manufactural journal types',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleShowModal = (item = null) => {
        setEditItem(item || null);
        setShowModal(true);
    };

    const handleHideModal = () => {
        setShowModal(false);
        setEditItem(null);
    };

    const handleSaved = () => {
        fetchData();
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Manufactural Journal Type?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it',
        });

        if (result.isConfirmed) {
            try {
                await deleteManufacturalJournalType(id);
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted',
                    text: 'Manufactural journal type deleted successfully',
                    timer: 2000,
                    showConfirmButton: false,
                });
                fetchData();
            } catch (error) {
                let errorMsg = 'Failed to delete manufactural journal type';
                if (error.response && error.response.data && error.response.data.detail) {
                    errorMsg = error.response.data.detail;
                }
                Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
            }
        }
    };

    const filteredItems = items.filter(item =>
        (item.manufactural_journal_type || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

    const movementBadge = (type) => {
        if (type === 'IN') return <span className="badge badge-success light">Production</span>;
        if (type === 'OUT') return <span className="badge badge-danger light">Consumption</span>;
        if (type === 'IN & OUT') return <span className="badge badge-info light">Production/Consumption</span>;
        return <span className="text-muted">-</span>;
    };

    return (
        <Fragment>
            <div className="container-fluid">
                <div className="row">
                    <div className="col-lg-12">
                        <Card>
                            <Card.Header className="d-flex justify-content-between align-items-center">
                                <Card.Title className="mb-0">Manufactural Journal Types</Card.Title>
                                <div className="d-flex align-items-center gap-2">
                                    <div style={{ width: '300px', position: 'relative' }}>
                                        <i
                                            className="fa fa-search position-absolute text-muted"
                                            style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}
                                        ></i>
                                        <Form.Control
                                            type="text"
                                            placeholder="Search Manufactural Journal Type..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                        />
                                    </div>
                                    <CreateButton
                                        module="finance"
                                        onClick={() => handleShowModal()}
                                    >
                                        Manufactural Journal Type
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
                                        <table className="table table-responsive-md align-middle mb-0">
                                            <thead>
                                                <tr>
                                                    <th style={{ padding: '12px 16px', fontSize: '13px' }}><strong>NAME</strong></th>
                                                    <th style={{ padding: '12px 16px', fontSize: '13px' }}><strong>MOVEMENT TYPE</strong></th>
                                                    <th className="text-end" style={{ padding: '12px 16px', fontSize: '13px' }}><strong>ACTIONS</strong></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredItems.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="3" className="text-center py-4 text-muted">
                                                            No entries
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    currentItems.map((item) => (
                                                        <tr key={item.id}>
                                                            <td style={{ padding: '10px 16px', verticalAlign: 'middle' }}><strong>{item.manufactural_journal_type}</strong></td>
                                                            <td style={{ padding: '10px 16px', verticalAlign: 'middle' }}>{movementBadge(item.movement_type)}</td>
                                                            <td className="text-end" style={{ padding: '10px 16px', verticalAlign: 'middle' }}>
                                                                {can('finance', 'edit') || can('finance', 'delete') ? (
                                                                    <div className="d-flex justify-content-end">
                                                                        <EditButton
                                                                            module="finance"
                                                                            onClick={() => handleShowModal(item)}
                                                                            className="me-1"
                                                                        />
                                                                        <DeleteButton
                                                                            module="finance"
                                                                            onClick={() => handleDelete(item.id, item.manufactural_journal_type)}
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <span className="badge badge-danger light mt-1">No Access</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))
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
                                                    <button
                                                        type="button"
                                                        className="page-link"
                                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                                        disabled={currentPage === 1}
                                                        style={{ border: 'none', background: 'none' }}
                                                    >
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
                                                                <button
                                                                    type="button"
                                                                    className="page-link"
                                                                    onClick={() => setCurrentPage(pageNumber)}
                                                                    style={{ border: 'none' }}
                                                                >
                                                                    {pageNumber}
                                                                </button>
                                                            </li>
                                                        );
                                                    } else if (pageNumber === currentPage - 2 || pageNumber === currentPage + 2) {
                                                        return (
                                                            <li key={pageNumber} className="page-item disabled">
                                                                <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                                            </li>
                                                        );
                                                    }
                                                    return null;
                                                })}
                                                <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                                    <button
                                                        type="button"
                                                        className="page-link"
                                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                                        disabled={currentPage === totalPages}
                                                        style={{ border: 'none', background: 'none' }}
                                                    >
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
            </div>

            <ManufacturalJournalTypeFormModal
                show={showModal}
                onHide={handleHideModal}
                onSaved={handleSaved}
                editItem={editItem}
            />
        </Fragment>
    );
};

export default ManufacturalJournalTypeList;
