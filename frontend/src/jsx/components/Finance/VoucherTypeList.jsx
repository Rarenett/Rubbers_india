import React, { useState, useEffect } from 'react';
import { Button } from 'react-bootstrap';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';

const VoucherTypeList = ({
    data = [],
    loading = false,
    searchTerm = '',
    onSearchChange,
    onEdit,
    onDelete,
    can,
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Reset to page 1 on search change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    const validCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);

    const startIndex = (validCurrentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const currentData = data.slice(startIndex, endIndex);

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    return (
        <>
            <div className="table-responsive">
                <table className="table table-responsive-md">
                    <thead>
                        <tr>
                            <th style={{ width: '80px' }}><strong>Sl No.</strong></th>
                            <th><strong>Name</strong></th>
                            <th><strong>Status</strong></th>
                            <th className="text-end"><strong>Actions</strong></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="4" className="text-center py-4">Loading...</td></tr>
                        ) : currentData.length === 0 ? (
                            <tr><td colSpan="4" className="text-center py-4 text-muted">No voucher types found.</td></tr>
                        ) : currentData.map((vt, idx) => (
                            <tr key={vt.id || (startIndex + idx)}>
                                <td>{startIndex + idx + 1}</td>
                                <td className="fw-semibold text-dark">{vt.name}</td>
                                <td>
                                    {vt.is_active ? (
                                        <span className="badge badge-success light">Active</span>
                                    ) : (
                                        <span className="badge badge-danger light">Inactive</span>
                                    )}
                                </td>
                                <td className="text-end">
                                    <div className="d-flex justify-content-end">
                                        <EditButton module="finance_app_vouchertype" onClick={() => onEdit && onEdit(vt)} className="me-1" />
                                        <DeleteButton module="finance_app_vouchertype" onClick={() => onDelete && onDelete(vt.id)} />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {!loading && totalItems > 0 && (
                <div className="d-flex justify-content-between align-items-center mt-3 pt-2 px-2 flex-wrap gap-2">
                    <div className="text-muted style-sm" style={{ fontSize: '0.85rem' }}>
                        Showing {totalItems === 0 ? 0 : startIndex + 1} to {endIndex} of {totalItems} entries
                    </div>
                    {totalPages > 1 && (
                        <div className="pagination-container">
                            <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                <li className={`page-item page-indicator ${validCurrentPage === 1 ? 'disabled' : ''}`}>
                                    <button
                                        type="button"
                                        className="page-link"
                                        onClick={() => handlePageChange(validCurrentPage - 1)}
                                        disabled={validCurrentPage === 1}
                                    >
                                        <i className="la la-angle-left"></i>
                                    </button>
                                </li>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                    <li key={page} className={`page-item ${validCurrentPage === page ? 'active' : ''}`}>
                                        <button
                                            type="button"
                                            className="page-link"
                                            onClick={() => handlePageChange(page)}
                                        >
                                            {page}
                                        </button>
                                    </li>
                                ))}
                                <li className={`page-item page-indicator ${validCurrentPage === totalPages ? 'disabled' : ''}`}>
                                    <button
                                        type="button"
                                        className="page-link"
                                        onClick={() => handlePageChange(validCurrentPage + 1)}
                                        disabled={validCurrentPage === totalPages}
                                    >
                                        <i className="la la-angle-right"></i>
                                    </button>
                                </li>
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default VoucherTypeList;
