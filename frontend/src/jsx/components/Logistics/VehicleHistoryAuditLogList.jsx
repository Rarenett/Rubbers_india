import React, { useState, useEffect, Fragment } from 'react';
import { Card, Form, Button } from 'react-bootstrap';
import { usePageTitle } from '../../../context/TitleContext';

const VehicleHistoryAuditLogList = ({
    data,
    loading,
    searchTerm,
    onSearchChange,
    onExport
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentData = data.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(data.length / itemsPerPage);
    usePageTitle("Vehicle History Logs");

    return (
        <Fragment>
            <style>
                {`
                    @media (max-width: 991px) {
                        .vhal-main-wrapper {
                            flex-direction: column !important;
                            align-items: flex-start !important;
                            gap: 15px !important;
                        }
                        .vhal-controls-wrapper {
                            flex-direction: column !important;
                            width: 100% !important;
                            align-items: stretch !important;
                            gap: 10px !important;
                        }
                        .vhal-search-bar {
                            width: 100% !important;
                        }
                    }
                    .vhal-table {
                        min-width: 1000px !important;
                    }
                    .vhal-table th, .vhal-table td {
                        white-space: nowrap !important;
                    }
                `}
            </style>
            <div className="container-fluid">
                <div className="row">
                    <div className="col-lg-12">
                        <Card>
                            <Card.Header className="d-flex justify-content-between align-items-center vhal-main-wrapper">
                                <Card.Title className="mb-0">Vehicle History Logs</Card.Title>
                                <div className="d-flex align-items-center gap-2 vhal-controls-wrapper">
                                    <div className="vhal-search-bar" style={{ width: '300px', position: 'relative' }}>
                                        <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                        <Form.Control
                                            type="text"
                                            placeholder="Search logs..."
                                            value={searchTerm}
                                            onChange={(e) => onSearchChange(e.target.value)}
                                            style={{ height: '37px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                        />
                                    </div>
                                    <div className="d-flex gap-2">
                                        <button className="btn btn-sm btn-light border" style={{ borderRadius: '6px', width: '38px', height: '38px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0' }} onClick={() => onExport('pdf')} title="Export PDF">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                        </button>
                                        <button className="btn btn-sm btn-light border" style={{ borderRadius: '6px', width: '38px', height: '38px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0' }} onClick={() => onExport('excel')} title="Export Excel">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
                                        </button>
                                        <button className="btn btn-sm btn-light border" style={{ borderRadius: '6px', width: '38px', height: '38px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0' }} onClick={() => onExport('print')} title="Print">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                        </button>
                                    </div>
                                </div>
                            </Card.Header>
                            <Card.Body>
                                <div className="table-responsive">
                                    <table className="table table-responsive-md vhal-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '60px' }}><strong>SL NO.</strong></th>
                                                <th><strong>DATE & TIME</strong></th>
                                                <th><strong>USER</strong></th>
                                                <th><strong>TRANS NO.</strong></th>
                                                <th><strong>VEHICLE</strong></th>
                                                <th><strong>VEHICLE NO.</strong></th>
                                                <th><strong>ACTION</strong></th>
                                                <th><strong>REMARKS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loading ? (
                                                <tr>
                                                    <td colSpan="8" className="text-center py-5">
                                                        <div className="spinner-border text-primary" role="status">
                                                            <span className="visually-hidden">Loading...</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : currentData.length === 0 ? (
                                                <tr>
                                                    <td colSpan="8" className="text-center py-4 text-muted">
                                                        No Audit Logs Found
                                                    </td>
                                                </tr>
                                            ) : (
                                                currentData.map((item, index) => (
                                                    <tr key={item.id}>
                                                        <td><strong>{indexOfFirstItem + index + 1}</strong></td>
                                                        <td>{new Date(item.modified_at).toLocaleString()}</td>
                                                        <td>{item.username}</td>
                                                        <td className="fw-bold">{item.trans_no}</td>
                                                        <td>{item.vehicle_name}</td>
                                                        <td>{item.vehicle_number}</td>
                                                        <td>
                                                            <span className={`badge ${
                                                                item.action === 'CREATE' ? 'badge-success' :
                                                                item.action === 'EDIT' ? 'badge-warning' :
                                                                'badge-danger'
                                                            } light`}>
                                                                {item.action}
                                                            </span>
                                                        </td>
                                                        <td
                                                            style={{ maxWidth: '320px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                                                            title={item.remarks}
                                                        >
                                                            {item.remarks}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {data.length > 0 && (
                                    <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
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
            </div>
        </Fragment>
    );
};

export default VehicleHistoryAuditLogList;