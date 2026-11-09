import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import CreateButton from '../../../components/permissions/CreateButton';
import { formatDate } from '../../../utils/dateUtils';

const SalesReturnList = ({
    data = [],
    loading = false,
    searchTerm = '',
    onSearchChange,
    onEdit,
    onDelete,
    onExport,
    onAdd,
    can
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, data.length]);

    const totalPages = Math.ceil(data.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = data.slice(indexOfFirstItem, indexOfLastItem);

    return (
        <div className="fd-section-container" style={{ borderRadius: '8px' }}>
            <style>
                {`
                    @media (max-width: 991px) {
                        .srl-main-wrapper {
                            flex-direction: column !important;
                            align-items: stretch !important;
                            gap: 15px !important;
                        }
                        .srl-controls-wrapper {
                            width: 100% !important;
                            justify-content: flex-start !important;
                            gap: 10px !important;
                            flex-direction: row !important;
                            align-items: center !important;
                            flex-wrap: nowrap !important;
                            overflow-x: auto !important;
                            padding-bottom: 4px;
                        }
                        .srl-search-bar {
                            flex-grow: 1 !important;
                            max-width: none !important;
                            min-width: 200px !important;
                            width: auto !important;
                        }
                        .export-buttons-container {
                            flex-wrap: nowrap !important;
                            white-space: nowrap !important;
                        }
                    }
                    .srl-table {
                        min-width: 1000px !important;
                    }
                    .srl-table th, .srl-table td {
                        white-space: nowrap !important;
                    }
                `}
            </style>
            <div className="fd-section-header srl-main-wrapper">
                <h3>Sales Returns</h3>

                <div className="d-flex align-items-center gap-2 flex-wrap srl-controls-wrapper">
                    <div className="search-bar-container srl-search-bar">
                    <span className="search-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" strokeWidth="3"
                            strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                    </span>

                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search by Return No, Customer, Date, Amount, Status, GST Type..."
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                        
                    </div>

                    <div className="d-flex gap-2 ms-2 export-buttons-container flex-wrap">

                        <button className="btn btn-sm btn-light border" onClick={() => onExport('pdf')} title="Export PDF">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        </button>

                        <button className="btn btn-sm btn-light border" onClick={() => onExport('excel')} title="Export Excel">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
                        </button>

                        <button className="btn btn-sm btn-light border" onClick={() => onExport('print')} title="Print">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                        </button>
                        {onAdd && (
                            <CreateButton module="sales_return" onClick={onAdd}>
                                Sales Return
                            </CreateButton>
                        )}
                        <Link
                            to="/sales/tally-return-sync"
                            className="btn btn-sm btn-outline-primary d-inline-flex align-items-center"
                            style={{
                                height: '34px',
                                fontSize: '13px',
                                fontWeight: '500',
                                padding: '0 12px',
                                textDecoration: 'none'
                            }}
                            title="Tally Sales Return Synchronization"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="me-1"
                            >
                                <polyline points="23 4 23 10 17 10"></polyline>
                                <polyline points="1 20 1 14 7 14"></polyline>
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                            </svg>
                            <span>Tally Sync</span>
                        </Link>

                    </div>
                </div>
            </div>

            <div className="table-responsive">
                <table className="fd-table srl-table">
                    <thead>
                        <tr>
                            <th style={{ width: '60px' }}>Sl.No</th>
                            <th>Return No</th>
                            <th>Date</th>
                            <th>Customer</th>
                            <th>GST Type</th>
                            <th>Sales Inv.No</th>
                            <th className="text-end">Total Amount</th>
                            <th>Status</th>
                            <th className="text-end">Actions</th>
                        </tr>    
                    </thead>

                    <tbody>

                        {loading ? (
                            <tr>
                                <td colSpan="9" className="text-center py-4">
                                    Loading...
                                </td>
                            </tr>
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan="9" className="text-center py-4 text-muted">
                                    No sales returns found.
                                </td>
                            </tr>
                        ) : (
                            currentItems.map((order, idx) => (
                                <tr key={order.id || idx}>

                                    <td>{indexOfFirstItem + idx + 1}</td>

                                    <td>
                                        <span className="text-primary fw-bold">
                                            {order.return_no}
                                        </span>
                                    </td>

                                    <td>{formatDate(order.entry_date)}</td>

                                    <td className="fw-semibold">
                                        {order.customer_ledger_name || '—'}
                                    </td>

                                    <td>
                                        <span className="badge badge-light text-dark">
                                            {order.return_type}
                                        </span>
                                    </td>

                                    <td>
                                        {order.sales_invoice_no || '—'}
                                    </td>

                                    <td className="text-end fw-bold text-success">
                                        {order.total_amount}
                                    </td>

                                    <td>
                                            {order.is_posted ? (
                                                <span className="badge bg-success">
                                                    Posted
                                                </span>
                                            ) : (
                                                <span className="badge badge-warning light">
                                                    Draft
                                                </span>
                                            )}
                                    </td>

                                    <td className="text-end">
                                        <div className="d-flex justify-content-end gap-2">
                                            <EditButton
                                                module="sales_return"
                                                onClick={() => onEdit(order)}
                                                title="Edit Sales Return"
                                            />
                                            <DeleteButton
                                                module="sales_return"
                                                onClick={() => onDelete(order.id)}
                                                title="Delete Sales Return"
                                            />
                                        </div>
                                    </td>

                                </tr>
                            ))
                        )}

                    </tbody>
                </table>
            </div>

            {data.length > 0 && (
                <div className="d-flex justify-content-between align-items-center mt-3">
                    <div className="text-muted" style={{ fontSize: '13px' }}>
                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, data.length)} of {data.length} entries
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
        </div>
    );
};

export default SalesReturnList;
