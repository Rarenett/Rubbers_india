import React, { useState } from 'react';
import { Table, Dropdown, Spinner, Pagination } from 'react-bootstrap';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import CreateButton from '../../../components/permissions/CreateButton';
import { formatDate } from '../../../utils/dateUtils';

const WarehouseTransferList = ({
    data,
    loading,
    searchTerm,
    onSearchChange,
    onEdit,
    onDelete,
    onExport,
    onOpenItemMovement,
    onAdd,
    can
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const totalPages = Math.ceil(data.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentData = data.slice(startIndex, startIndex + itemsPerPage);

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    return (
        <div>

            {/* ── Toolbar ── */}
            <div className="d-flex align-items-center justify-content-between gap-2 mb-3 px-1">
                {/* Search */}
                <div style={{ width: '260px', position: 'relative' }}>
                    <i
                        className="fa fa-search position-absolute text-muted"
                        style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}
                    />
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Search transfers..."
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        style={{ height: '36px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                    />
                </div>

                {/* Export + Create */}
                <div className="d-flex align-items-center gap-2">
                    <div className="d-flex gap-1">
                        <button className="btn btn-sm btn-light border" onClick={() => onExport && onExport('pdf')} title="Export PDF">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        </button>
                        <button className="btn btn-sm btn-light border" onClick={() => onExport && onExport('excel')} title="Export Excel">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
                        </button>
                        <button className="btn btn-sm btn-light border" onClick={() => onExport && onExport('print')} title="Print">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                        </button>
                    </div>

                    {onAdd && (
                        <CreateButton module="warehouse_transfers" onClick={onAdd}>
                            Warehouse Transfer
                        </CreateButton>
                    )}
                </div>
            </div>

            <div className="table-responsive">
                <table className="table table-responsive-md">
                    <thead>
                        <tr>
                            <th style={{ width: '60px' }}>Sl.No</th>
                            <th>WT No.</th>
                            <th>Entry Date</th>
                            <th>Destination Warehouse</th>
                            <th>Narration</th>
                            <th className="text-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="5" className="text-center py-5">
                                    <Spinner animation="border" variant="primary" />
                                </td>
                            </tr>
                        ) : currentData.length > 0 ? (
                            currentData.map((item, idx) => (
                                <tr key={item.id}>
                                    <td>{startIndex + idx + 1}</td>
                                    <td>
                                        <span className="fw-bold" style={{ color: 'var(--fd-accent)' }}>{item.wt_no}</span>
                                    </td>
                                    <td>
                                        {item.entry_date 
                                            ? item.entry_date.includes('-') && item.entry_date.split('-')[0].length === 4
                                                ? item.entry_date.split('-').reverse().join('/')
                                                : item.entry_date 
                                            : ''}
                                    </td>
                                    <td>{item.destination_warehouse_name}</td>
                                    <td>{item.narration || '-'}</td>
                                    <td className="text-end">
                                        <div className="d-flex justify-content-end gap-2">
                                            <EditButton
                                                module="warehouse_transfers"
                                                onClick={() => onEdit(item)}
                                                variant="outline-success"
                                            />
                                            <DeleteButton
                                                module="warehouse_transfers"
                                                onClick={() => onDelete(item.id)}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="6" className="text-center py-5 text-muted">
                                    <div className="d-flex flex-column align-items-center">
                                        <i className="flaticon-381-box-2 mb-3" style={{ fontSize: '3rem', color: '#cbd5e1' }}></i>
                                        <h5 className="text-secondary fw-semibold">No Warehouse Transfers Found</h5>
                                        <p className="small mb-0">Try adjusting your search criteria.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center mt-3 mb-3 px-3">
                    <div className="text-muted" style={{ fontSize: '13px' }}>
                        Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, data.length)} of {data.length} entries
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
    );
};

export default WarehouseTransferList;
