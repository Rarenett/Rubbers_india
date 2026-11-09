import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, Dropdown } from 'react-bootstrap';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import CreateButton from '../../../components/permissions/CreateButton';
import { formatDate, formatDateTime } from '../../../utils/dateUtils';

const ExportDropdownToggle = React.forwardRef(({ children, onClick }, ref) => (
    <button
        type="button"
        ref={ref}
        onClick={(e) => {
            e.preventDefault();
            onClick(e);
        }}
        className="btn btn-sm d-inline-flex align-items-center justify-content-center"
        style={{
            width: '28px',
            height: '28px',
            padding: 0,
            background: '#ffffff',
            border: '1px solid #3b82f6',
            color: '#2563eb',
            borderRadius: '6px',
            boxShadow: '0 1px 2px rgba(37, 99, 235, 0.08)',
            transition: 'all 0.2s ease',
            cursor: 'pointer'
        }}
        title="Export Order"
    >
        {children}
    </button>
));

const SalesOrderList = ({
    data = [],
    loading = false,
    searchTerm = '',
    onSearchChange,
    onEdit,
    onDelete,
    onExport,
    onExportIndividual,
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

    // Helper to render status badge classes
    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'Delivered':
                return 'badge badge-success light';
            case 'Pending':
                return 'badge badge-warning light';
            case 'Cancelled':
                return 'badge badge-danger light';
            case 'Shipped':
                return 'badge badge-info light';
            case 'On Hold':
                return 'badge badge-secondary light';
            default:
                return 'badge bg-light text-dark';
        }
    };

    // Helper to render approval status text classes
    const getApprovalStatusTextClass = (status) => {
        if (status === 'Approved') return 'text-success fw-bold';
        if (status === 'Not Approved') return 'text-danger fw-bold';
        return 'text-muted fw-bold';
    };

    return (
        <Card>
            <Card.Header className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                <Card.Title className="mb-0 text-nowrap">Sales Orders</Card.Title>
                <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-3 flex-grow-1 justify-content-md-end">
                    <div className="search-bar-container w-100" style={{ margin: 0, maxWidth: '250px' }}>
                        <span className="search-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </span>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search by order no, customer, location..."
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                        />
                    </div>
                    <div className="d-flex gap-2 align-items-center justify-content-start flex-shrink-0">
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
                            <CreateButton module="sales-orders" onClick={onAdd}>
                                Sales Order
                            </CreateButton>
                        )}
                        <Link
                            to="/sales/tally-sync"
                            className="btn btn-sm btn-outline-primary d-inline-flex align-items-center"
                            style={{
                                height: '34px',
                                fontSize: '13px',
                                fontWeight: '500',
                                padding: '0 12px',
                                textDecoration: 'none'
                            }}
                            title="Tally Synchronization"
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
            </Card.Header>
            <Card.Body>
                <div className="table-responsive">
                    <table className="table table-responsive-md">
                        <thead>
                            <tr>
                                <th style={{ width: '60px' }}><strong>SI NO</strong></th>
                                <th><strong>ORDER NO.</strong></th>
                                <th><strong>ORDER DATE</strong></th>
                                <th><strong>CUSTOMER NAME</strong></th>
                                <th><strong>DRIVER</strong></th>
                                <th className="text-end"><strong>TOTAL AMOUNT</strong></th>
                                <th><strong>DELIVERY DATE & TIME</strong></th>
                                <th><strong>STATUS</strong></th>
                                <th><strong>APPROVAL STATUS</strong></th>
                                <th className="text-end"><strong>ACTIONS</strong></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="10" className="text-center py-4">Loading...</td></tr>
                        ) : data.length === 0 ? (
                            <tr><td colSpan="10" className="text-center py-4 text-muted">No sales orders found.</td></tr>
                        ) : currentItems.map((order, idx) => (
                            <tr key={order.id || idx}>
                                <td>{indexOfFirstItem + idx + 1}</td>
                                <td>
                                    <span className="text-primary fw-bold">{order.so_no}</span>
                                </td>
                                <td>{formatDate(order.entry_date)}</td>
                                <td className="fw-semibold">{order.customer_ledger_name || '—'}</td>
                                <td>{order.driver_name || '—'}</td>
                                <td className="text-end fw-bold text-success">
                                    {order.total_amount}
                                </td>
                                <td>
                                    {formatDateTime(order.preferred_delivery_date)}
                                </td>
                                <td>
                                    <span className={getStatusBadgeClass(order.status)}>
                                        {order.status}
                                    </span>
                                </td>
                                <td>
                                    <span className={getApprovalStatusTextClass(order.approval_status)}>
                                        {order.approval_status || 'Pending'}
                                    </span>
                                </td>
                                <td className="text-end">
                                    <div className="d-flex justify-content-end align-items-center gap-1">
                                        <Dropdown className="d-inline-block">
                                            <Dropdown.Toggle as={ExportDropdownToggle}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" style={{ minWidth: '14px', minHeight: '14px' }} viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                            </Dropdown.Toggle>
                                            <Dropdown.Menu align="end" style={{ borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', minWidth: '140px', zIndex: 1050 }}>
                                                <Dropdown.Item onClick={() => onExportIndividual && onExportIndividual(order, 'pdf')} className="d-flex align-items-center gap-2 py-2 px-3" style={{ fontSize: '13px' }}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                                    <span className="fw-500">PDF</span>
                                                </Dropdown.Item>
                                                <Dropdown.Item onClick={() => onExportIndividual && onExportIndividual(order, 'excel')} className="d-flex align-items-center gap-2 py-2 px-3" style={{ fontSize: '13px' }}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
                                                    <span className="fw-500">Excel</span>
                                                </Dropdown.Item>
                                                <Dropdown.Item onClick={() => onExportIndividual && onExportIndividual(order, 'print')} className="d-flex align-items-center gap-2 py-2 px-3" style={{ fontSize: '13px' }}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                                    <span className="fw-500">Print</span>
                                                </Dropdown.Item>
                                            </Dropdown.Menu>
                                        </Dropdown>
                                        <EditButton
                                            module="sales-orders"
                                            onClick={() => onEdit(order)}
                                            title="Edit Order"
                                            disabled={order.status?.toLowerCase() !== 'pending'}
                                        />
                                        <DeleteButton
                                            module="sales-orders"
                                            onClick={() => onDelete(order.id)}
                                            title="Delete Order"
                                            disabled={order.status?.toLowerCase() !== 'pending'}
                                        />
                                    </div>
                                </td>
                            </tr>
                        ))}
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
            </Card.Body>
        </Card>
    );
};

export default SalesOrderList;
