import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { Card, Form, Button } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { usePermission } from '../../../hooks/usePermission';
import axiosInstance from '../../../services/AxiosInstance';
import TyreSizeFormModal from './TyreSizeFormModal';
import { usePageTitle } from '../../../context/TitleContext';

const TyreSizeList = ({ currentUser }) => {
    const { can } = usePermission();
    usePageTitle("Tyre Size");
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [itemToEdit, setItemToEdit] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get('/api/logistics/tyre-sizes/');
            setData(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error fetching tyre sizes:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterType]);

    const filteredData = data.filter((item) => {
        const term = searchTerm.toLowerCase().trim();
        const matchesSearch =
            !term ||
            (item.size || '').toLowerCase().includes(term) ||
            (item.tyre_type_display || '').toLowerCase().includes(term) ||
            (item.created_by_name || '').toLowerCase().includes(term);
        const matchesType = filterType === 'all' || item.tyre_type === filterType;
        return matchesSearch && matchesType;
    });

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);

    const typeBadge = (tyreType) => {
        const map = {
            front: 'badge-primary',
            rear: 'badge-info',
            both: 'badge-success',
        };
        return map[tyreType] || 'badge-secondary';
    };

    const handleEdit = (item) => {
        setIsEditing(true);
        setItemToEdit(item);
        setShowModal(true);
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Tyre Size?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await axiosInstance.delete(`/api/logistics/tyre-sizes/${id}/`);
                Swal.fire({ icon: 'success', title: 'Deleted', text: 'Tyre size deleted successfully', timer: 2000, showConfirmButton: false });
                fetchData();
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete tyre size' });
            }
        }
    };

    return (
        <Fragment>
            <div className="container-fluid">
                <style>
                    {`
                        @media (max-width: 991px) {
                            .tyre-header-container {
                                flex-direction: column !important;
                                align-items: flex-start !important;
                                gap: 15px !important;
                            }
                            .tyre-controls-wrapper {
                                flex-direction: column !important;
                                width: 100% !important;
                                gap: 10px !important;
                            }
                            .tyre-search-bar {
                                width: 100% !important;
                            }
                            .tyre-add-btn {
                                width: 100% !important;
                            }
                        }
                        .tyre-table {
                            min-width: 800px !important;
                        }
                        .tyre-table th, .tyre-table td {
                            white-space: nowrap !important;
                        }
                    `}
                </style>
                <div className="row">
                    <div className="col-lg-12">
                        <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center tyre-header-container">
                            <Card.Title className="mb-0">Tyre Size Master</Card.Title>
                            <div className="d-flex align-items-center gap-2 tyre-controls-wrapper">
                                <div className="tyre-search-bar" style={{ width: '300px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Tyre Sizes..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                {/* <Form.Select
                                    value={filterType}
                                    onChange={(e) => setFilterType(e.target.value)}
                                    style={{ height: '38px', borderRadius: '6px', fontSize: '13px', width: 'auto' }}
                                >
                                    <option value="all">All Types</option>
                                    <option value="front">Front Tyre</option>
                                    <option value="rear">Rear Tyre</option>
                                </Form.Select> */}
                                {can('tyre size master', 'create') && (
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => {
                                            setIsEditing(false);
                                            setItemToEdit(null);
                                            setShowModal(true);
                                        }}
                                        className="d-flex align-items-center justify-content-center tyre-add-btn"
                                        style={{
                                            height: '38px', borderRadius: '6px', whiteSpace: 'nowrap', padding: '0 16px',
                                            backgroundColor: 'rgb(61, 53, 119)', borderColor: 'rgb(61, 53, 119)', fontSize: '13px'
                                        }}
                                    >
                                        <i className="fa fa-plus me-2"></i>Tyre Size
                                    </Button>
                                )}
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
                                    <table className="table table-responsive-md tyre-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '80px', whiteSpace: 'nowrap' }}><strong>SL.NO</strong></th>
                                                <th><strong>TYRE SIZE</strong></th>
                                                <th><strong>TYRE TYPE</strong></th>
                                                <th><strong>CREATED BY</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentItems.length === 0 ? (
                                                <tr>
                                                    <td colSpan="5" className="text-center py-4 text-muted">
                                                        {searchTerm || filterType !== 'all' ? 'No matching tyre sizes found' : 'No tyre sizes found. Click "Add Tyre Size" to create one.'}
                                                    </td>
                                                </tr>
                                            ) : (
                                                currentItems.map((item, idx) => (
                                                    <tr key={item.id}>
                                                        <td><strong>{indexOfFirstItem + idx + 1}</strong></td>
                                                        <td><strong>{item.size}</strong></td>
                                                        <td>
                                                            <span className={`badge ${typeBadge(item.tyre_type)} light`}>
                                                                {item.tyre_type_display}
                                                            </span>
                                                        </td>
                                                        <td>{item.created_by_name || '-'}</td>
                                                        <td className="text-end">
                                                            {(can('tyre size master', 'edit') || can('tyre size master', 'delete')) ? (
                                                                <div className="d-flex justify-content-end">
                                                                    {can('tyre size master', 'edit') && (
                                                                        <Button variant="outline-primary" size="sm" className="shadow me-1"
                                                                            style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontSize: '12px', borderRadius: '6px' }}
                                                                            onClick={() => handleEdit(item)}>
                                                                            <i className="fa fa-pencil-alt"></i>
                                                                        </Button>
                                                                    )}
                                                                    {can('tyre size master', 'delete') && (
                                                                        <Button variant="outline-danger" size="sm" className="shadow"
                                                                            style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontSize: '12px', borderRadius: '6px' }}
                                                                            onClick={() => handleDelete(item.id, item.size)}>
                                                                            <i className="fa fa-trash"></i>
                                                                        </Button>
                                                                    )}
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

                                    {!loading && totalPages > 1 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredData.length)} of {filteredData.length} entries
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
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>
            </div>

            <TyreSizeFormModal 
                show={showModal} 
                onHide={() => setShowModal(false)} 
                isEditing={isEditing} 
                itemToEdit={itemToEdit} 
                onSave={fetchData} 
            />
        </Fragment>
    );
};

export default TyreSizeList;
