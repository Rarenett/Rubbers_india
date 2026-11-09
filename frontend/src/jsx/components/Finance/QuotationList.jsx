import React, { useState, useEffect } from 'react';
import { Card } from 'react-bootstrap';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import CreateButton from '../../../components/permissions/CreateButton';
import { usePageTitle } from '../../../context/TitleContext';

const QuotationList = ({
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

    const getOrderTypeBadgeClass = (type) => {
        const t = (type || '').toLowerCase();

        if (t.includes('interstate') || t.includes('inter_state')) return 'badge badge-info light';
        if (t.includes('local') || t.includes('state')) return 'badge badge-primary light';
        return 'badge badge-secondary light';
    };
    usePageTitle("Quote List");

    return (
        <Card>
            <Card.Header className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                <Card.Title className="mb-0 text-nowrap">Quotations</Card.Title>
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
                            <CreateButton module="quotations" onClick={onAdd}>
                                Quotation
                            </CreateButton>
                        )}
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
                                <th><strong>ENTRY DATE</strong></th>
                                <th><strong>CUSTOMER NAME</strong></th>
                                <th><strong>ORDER TYPE</strong></th>
                                <th className="text-end"><strong>TOTAL AMOUNT</strong></th>
                                <th className="text-end"><strong>ACTIONS</strong></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="7" className="text-center py-4">Loading...</td></tr>
                            ) : data.length === 0 ? (
                                <tr><td colSpan="7" className="text-center py-4 text-muted">No quotations found.</td></tr>
                            ) : currentItems.map((order, idx) => (
                                <tr key={order.id || idx}>
                                    <td>{indexOfFirstItem + idx + 1}</td>
                                    <td>
                                        <span className="text-primary fw-bold">{order.quotation_no}</span>
                                    </td>
                                    <td>{order.entry_date}</td>
                                    <td className="fw-semibold">{order.customer_ledger_name || '—'}</td>
                                    <td>
                                        <span className={getOrderTypeBadgeClass(order.order_type_name || order.order_type)}>
                                            {order.order_type_name || order.order_type}
                                        </span>
                                    </td>
                                    <td className="text-end fw-bold text-success">
                                        {order.total_amount}
                                    </td>
                                    <td className="text-end">
                                        <div className="d-flex justify-content-end gap-2">
                                            <EditButton
                                                module="quotations"
                                                onClick={() => onEdit(order)}
                                                title="Edit Quotation"
                                            />
                                            <DeleteButton
                                                module="quotations"
                                                onClick={() => onDelete(order.id)}
                                                title="Delete Quotation"
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

export default QuotationList;
