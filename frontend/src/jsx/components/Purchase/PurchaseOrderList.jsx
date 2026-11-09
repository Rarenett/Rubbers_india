import React, { useState, useEffect, Fragment } from 'react';
import { Card, Button, Form } from 'react-bootstrap';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import CreateButton from '../../../components/permissions/CreateButton';
import { formatDate } from '../../../utils/dateUtils';

const PurchaseOrderList = ({
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
    }, [searchTerm]);

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = data.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(data.length / itemsPerPage);

    return (
        <Fragment>
            
            {/* <div className="page-titles">
                <button 
                    onClick={() => window.history.back()} 
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div> */}

            <style>
                {`
                    @media (max-width: 991px) {
                        .pol-main-wrapper {
                            flex-direction: column !important;
                            align-items: stretch !important;
                            gap: 15px !important;
                        }
                        .pol-controls-wrapper {
                            width: 100% !important;
                            justify-content: flex-start !important;
                            gap: 10px !important;
                            flex-direction: row !important;
                            align-items: center !important;
                            flex-wrap: nowrap !important;
                            overflow-x: auto !important;
                            padding-bottom: 4px;
                        }
                        .pol-search-bar {
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
                    .pol-table {
                        min-width: 1000px !important;
                    }
                    .pol-table th, .pol-table td {
                        white-space: nowrap !important;
                    }
                `}
            </style>
            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center pol-main-wrapper">
                            <Card.Title className="mb-0">Purchase Orders</Card.Title>
                            <div className="d-flex align-items-center gap-2 flex-wrap pol-controls-wrapper">
                                <div className="pol-search-bar" style={{ minWidth: '260px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search by PO No, Supplier, Date, Amount, Status, Order Type..."
                                        value={searchTerm}
                                        onChange={(e) => onSearchChange(e.target.value)}
                                        style={{ height: '37px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                <div className="d-flex gap-2 ms-2 export-buttons-container flex-wrap">
                                    <button className="btn btn-sm btn-light border" onClick={() => onExport('pdf')} title="Export PDF" style={{ height: '34px', display: 'flex', alignItems: 'center' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                    </button>

                                    <button className="btn btn-sm btn-light border" onClick={() => onExport('excel')} title="Export Excel" style={{ height: '34px', display: 'flex', alignItems: 'center' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
                                    </button>

                                    <button className="btn btn-sm btn-light border" onClick={() => onExport('print')} title="Print" style={{ height: '34px', display: 'flex', alignItems: 'center' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                    </button>
                                    {can('purchase_order', 'create') && (
                                        <CreateButton module="purchase_order" onClick={onAdd} className="pol-add-btn">
                                            Purchase Order
                                        </CreateButton>
                                    )}
                                </div>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            <div className="table-responsive">
                                <table className="table table-responsive-md pol-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '60px' }}><strong>Sl.No</strong></th>
                                            <th style={{ width: '12%' }}><strong>PO No</strong></th>
                                            <th style={{ width: '12%' }}><strong>Date</strong></th>
                                            <th style={{ width: '20%' }}><strong>Supplier</strong></th>
                                            <th style={{ width: '10%' }}><strong>Order Type</strong></th>
                                            <th className="text-center" style={{ width: '13%' }}><strong>Items</strong></th>
                                            <th className="text-end" style={{ width: '15%' }}><strong>Total Amount</strong></th>
                                            {/* <th><strong>Status</strong></th> */}
                                            <th className="text-end" style={{ width: '13%' }}><strong>Actions</strong></th>
                                        </tr>    
                                    </thead>

                                    <tbody>
                                        {loading ? (
                                            <tr>
                                                <td colSpan="9" className="text-center py-5">
                                                    <div className="spinner-border text-primary" role="status">
                                                        <span className="visually-hidden">Loading...</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : currentItems.length === 0 ? (
                                            <tr>
                                                <td colSpan="9" className="text-center py-4 text-muted">
                                                    No purchase orders found.
                                                </td>
                                            </tr>
                                        ) : (
                                            currentItems.map((order, idx) => (
                                                <tr key={order.id || indexOfFirstItem + idx}>
                                                    <td>{indexOfFirstItem + idx + 1}</td>
                                                    <td>
                                                        <span className="text-primary fw-bold">
                                                            {order.po_no}
                                                        </span>
                                                    </td>
                                                    <td>{formatDate(order.entry_date)}</td>
                                                    <td className="fw-semibold">
                                                        {order.supplier_name || '—'}
                                                    </td>
                                                    <td>
                                                        <span className="badge badge-light text-dark">
                                                            {String(order.order_type_name || order.order_type || '').replace(/_/g, ' ')}
                                                        </span>
                                                    </td>
                                                    <td className="text-center fw-bold text-primary">
                                                        {(order.items || []).length}
                                                    </td>
                                                    <td className="text-end fw-bold text-success">
                                                        {order.total_amount}
                                                    </td>
                                                    {/* <td>
                                                        {order.is_posted ? (
                                                            <span className="badge bg-success">
                                                                Posted
                                                            </span>
                                                        ) : (
                                                            <span className="badge bg-warning text-dark">
                                                                Draft
                                                            </span>
                                                        )}
                                                    </td> */}
                                                    <td className="text-end">
                                                        <div className="d-flex justify-content-end gap-2">
                                                            <EditButton
                                                                module="purchase_order"
                                                                onClick={() => onEdit(order)}
                                                                title="Edit Purchase Order"
                                                            />
                                                            <DeleteButton
                                                                module="purchase_order"
                                                                onClick={() => onDelete(order.id)}
                                                                title="Delete Purchase Order"
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                                
                                {data.length > 0 && (
                                    <div className="d-flex justify-content-between align-items-center mt-3 mb-4">
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
                        </Card.Body>
                    </Card>
                </div>
            </div>
        </Fragment>
    );
};

export default PurchaseOrderList;