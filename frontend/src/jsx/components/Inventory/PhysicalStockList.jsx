import React, { useState, useEffect, Fragment } from 'react';
import { Card, Form } from 'react-bootstrap';
import { usePermission } from '../../../hooks/usePermission';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import CreateButton from '../../../components/permissions/CreateButton';

const PhysicalStockList = ({
    data = [],
    loading = false,
    searchTerm = '',
    onSearchChange,
    onEdit,
    onDelete,
    onExport,
    onAdd,
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const { can } = usePermission();

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = data.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(data.length / itemsPerPage);

    return (
        <Fragment>
            <style dangerouslySetInnerHTML={{__html: `
                .stock-header-container {
                    display: flex !important;
                    flex-direction: row !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    flex-wrap: wrap !important;
                    gap: 15px !important;
                }
                .stock-controls-wrapper {
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                    flex-wrap: wrap !important;
                }
                .stock-search-bar {
                    width: 300px !important;
                }
                .stock-add-btn-short-text {
                    display: none !important;
                }
                .stock-add-btn-full-text {
                    display: inline !important;
                }
                @media (max-width: 767px) {
                    .stock-header-container {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        gap: 12px !important;
                    }
                    .stock-controls-wrapper {
                        width: 100% !important;
                        justify-content: flex-start !important;
                        gap: 8px !important;
                    }
                    .stock-search-bar {
                        width: 100% !important;
                        order: 3 !important;
                        margin-top: 4px !important;
                    }
                    .stock-export-btn {
                        order: 2 !important;
                    }
                    .stock-add-btn {
                        width: auto !important;
                        flex-grow: 0 !important;
                        order: 1 !important;
                        font-size: 12px !important;
                        padding: 0 10px !important;
                        justify-content: center !important;
                    }
                }
                @media (max-width: 400px) {
                    .stock-controls-wrapper {
                        gap: 6px !important;
                    }
                    .stock-export-btn {
                        width: 32px !important;
                        height: 32px !important;
                    }
                    .stock-add-btn {
                        height: 32px !important;
                        font-size: 11px !important;
                        padding: 0 8px !important;
                    }
                }
                @media (min-width: 768px) and (max-width: 850px) {
                    .stock-search-bar {
                        width: 220px !important;
                    }
                    .stock-add-btn-short-text {
                        display: inline !important;
                    }
                    .stock-add-btn-full-text {
                        display: none !important;
                    }
                }
                @media (min-width: 540px) and (max-width: 540px) {
                    .stock-header-container {
                        flex-direction: row !important;
                        align-items: center !important;
                        justify-content: space-between !important;
                        gap: 8px !important;
                    }
                    .stock-controls-wrapper {
                        width: auto !important;
                        flex-direction: row !important;
                        align-items: center !important;
                        gap: 6px !important;
                    }
                    .stock-search-bar {
                        width: 170px !important;
                        order: unset !important;
                        margin-top: 0 !important;
                    }
                    .stock-export-btn {
                        order: unset !important;
                        width: 32px !important;
                        height: 32px !important;
                    }
                    .stock-add-btn {
                        width: auto !important;
                        height: 32px !important;
                        order: unset !important;
                        font-size: 11px !important;
                        padding: 0 8px !important;
                    }
                    .stock-add-btn-short-text {
                        display: inline !important;
                    }
                    .stock-add-btn-full-text {
                        display: none !important;
                    }
                }
                @media (min-width: 344px) and (max-width: 344px) {
                    .stock-add-btn-short-text {
                        display: inline !important;
                    }
                    .stock-add-btn-full-text {
                        display: none !important;
                    }
                }
            `}} />
            <div className="page-titles">
                {/* <button 
                    onClick={() => window.history.back()} 
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button> */}
            </div>

            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center stock-header-container">
                            <Card.Title className="mb-0">Physical Stock Management</Card.Title>
                            <div className="d-flex align-items-center gap-2 stock-controls-wrapper">
                                <div className="stock-search-bar" style={{ position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Physical Stock..."
                                        value={searchTerm}
                                        onChange={(e) => onSearchChange(e.target.value)}
                                        style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                <button className="btn btn-sm btn-light border stock-export-btn" style={{ borderRadius: '6px', width: '38px', height: '38px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0' }} onClick={() => onExport('pdf')} title="Export PDF">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                </button>
                                <button className="btn btn-sm btn-light border stock-export-btn" style={{ borderRadius: '6px', width: '38px', height: '38px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0' }} onClick={() => onExport('excel')} title="Export Excel">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
                                </button>
                                <CreateButton
                                    module="inventory"
                                    onClick={onAdd}
                                    className="stock-add-btn"
                                    style={{ height: '38px', borderRadius: '6px', padding: '0 16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <span className="stock-add-btn-full-text">Physical Stock</span>
                                    <span className="stock-add-btn-short-text">Stock</span>
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
                                                <th style={{ width: '60px' }}><strong>SL.NO</strong></th>
                                                <th><strong>VOUCHER NO</strong></th>
                                                <th><strong>DATE</strong></th>
                                                <th><strong>CREATED BY</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.length === 0 ? (
                                                <tr>
                                                    <td colSpan="5" className="text-center py-4 text-muted">
                                                        No entries
                                                    </td>
                                                </tr>
                                            ) : (
                                                currentItems.map((order, idx) => (
                                                    <tr key={order.id || idx}>
                                                        <td><strong>{indexOfFirstItem + idx + 1}</strong></td>
                                                        <td>
                                                            <span className="text-primary fw-bold">{order.voucher_no}</span>
                                                        </td>
                                                        <td>{order.date}</td>
                                                        <td>{order.created_by_name || '—'}</td>
                                                        <td className="text-end">
                                                            {can('inventory', 'edit') || can('inventory', 'delete') ? (
                                                                <div className="d-flex justify-content-end">
                                                                    <EditButton
                                                                        module="inventory"
                                                                        onClick={() => onEdit(order)}
                                                                        className="me-1"
                                                                    />
                                                                    <DeleteButton
                                                                        module="inventory"
                                                                        onClick={() => onDelete(order.id)}
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
                </div>
            </div>
        </Fragment>
    );
};

export default PhysicalStockList;