import React, { Fragment, useState, useEffect } from 'react';
import { Card, Form } from 'react-bootstrap';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';

const FileList = ({
    data,
    loading,
    searchTerm,
    onSearchChange,
    onEdit,
    onDelete,
    onExport,
    onAllocate,
    onShowHistory,
    onAdd,
    currentUser,
    module = "file"
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
            <style dangerouslySetInnerHTML={{__html: `
                .file-header-container {
                    display: flex !important;
                    flex-direction: row !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    flex-wrap: wrap !important;
                    gap: 15px !important;
                }
                .file-controls-wrapper {
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                    flex-wrap: wrap !important;
                }
                .file-search-bar {
                    width: 300px !important;
                }
                @media (max-width: 767px) {
                    .file-header-container {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        gap: 12px !important;
                    }
                    .file-controls-wrapper {
                        width: 100% !important;
                        justify-content: flex-start !important;
                        gap: 8px !important;
                    }
                    .file-search-bar {
                        width: 100% !important;
                        order: 3 !important;
                        margin-top: 4px !important;
                    }
                    .file-export-btn {
                        order: 2 !important;
                    }
                    .file-add-btn {
                        width: auto !important;
                        flex-grow: 0 !important;
                        order: 1 !important;
                        font-size: 12px !important;
                        padding: 0 10px !important;
                        justify-content: center !important;
                    }
                    .file-btn-text-extra {
                        display: none !important;
                    }
                }
                @media (max-width: 400px) {
                    .file-controls-wrapper {
                        gap: 6px !important;
                    }
                    .file-export-btn {
                        width: 32px !important;
                        height: 32px !important;
                    }
                    .file-add-btn {
                        height: 32px !important;
                        font-size: 11px !important;
                        padding: 0 8px !important;
                    }
                }
                @media (min-width: 768px) and (max-width: 850px) {
                    .file-search-bar {
                        width: 220px !important;
                    }
                    .file-btn-text-extra {
                        display: none !important;
                    }
                }
                @media (min-width: 540px) and (max-width: 540px) {
                    .file-header-container {
                        flex-direction: row !important;
                        align-items: center !important;
                        justify-content: space-between !important;
                        gap: 8px !important;
                    }
                    .file-controls-wrapper {
                        width: auto !important;
                        flex-direction: row !important;
                        align-items: center !important;
                        gap: 6px !important;
                    }
                    .file-search-bar {
                        width: 170px !important;
                        order: unset !important;
                        margin-top: 0 !important;
                    }
                    .file-export-btn {
                        order: unset !important;
                        width: 32px !important;
                        height: 32px !important;
                    }
                    .file-add-btn {
                        width: auto !important;
                        height: 32px !important;
                        order: unset !important;
                        font-size: 11px !important;
                        padding: 0 8px !important;
                    }
                    .file-btn-text-extra {
                        display: none !important;
                    }
                }
                @media (min-width: 344px) and (max-width: 344px) {
                    .file-header-container {
                        flex-direction: row !important;
                        align-items: center !important;
                        justify-content: space-between !important;
                        gap: 6px !important;
                    }
                    .file-controls-wrapper {
                        width: auto !important;
                        flex-direction: row !important;
                        align-items: center !important;
                        gap: 4px !important;
                    }
                    .file-search-bar {
                        width: 130px !important;
                        order: unset !important;
                        margin-top: 0 !important;
                    }
                    .file-export-btn {
                        order: unset !important;
                        width: 28px !important;
                        height: 28px !important;
                    }
                    .file-add-btn {
                        width: auto !important;
                        height: 28px !important;
                        order: unset !important;
                        font-size: 10px !important;
                        padding: 0 6px !important;
                    }
                    .file-btn-text-extra {
                        display: none !important;
                    }
                }
            `}} />
            <div className="container-fluid">
                <div className="row">
                    <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center file-header-container">
                            <Card.Title className="mb-0">File Directory</Card.Title>
                            <div className="d-flex align-items-center gap-2 file-controls-wrapper">
                                <div className="file-search-bar" style={{ position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Files..."
                                        value={searchTerm}
                                        onChange={(e) => onSearchChange(e.target.value)}
                                        style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                <button className="btn btn-sm btn-light border file-export-btn" style={{ borderRadius: '6px', width: '38px', height: '38px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0' }} onClick={() => onExport && onExport('pdf')} title="Export PDF">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                </button>
                                <button className="btn btn-sm btn-light border file-export-btn" style={{ borderRadius: '6px', width: '38px', height: '38px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0' }} onClick={() => onExport && onExport('excel')} title="Export Excel">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
                                </button>
                                <button className="btn btn-sm btn-light border file-export-btn" style={{ borderRadius: '6px', width: '38px', height: '38px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0' }} onClick={() => onExport && onExport('print')} title="Print">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                </button>
                                <CreateButton
                                    module={module}
                                    onClick={onAdd}
                                    className="file-add-btn"
                                    style={{ height: '38px', borderRadius: '6px', padding: '0 16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    File <span className="file-btn-text-extra" style={{ marginLeft: '4px' }}>Directory</span>
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
                                                <th><strong>SL.NO</strong></th>
                                                <th><strong>FILE NAME</strong></th>
                                                <th><strong>LOCATION</strong></th>
                                                <th><strong>CUSTODIAN NAME</strong></th>
                                                <th><strong>STATUS</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.length === 0 ? (
                                                <tr>
                                                    <td colSpan="6" className="text-center py-4 text-muted">
                                                        No entries
                                                    </td>
                                                </tr>
                                            ) : (
                                                currentItems.map((item, idx) => (
                                                    <tr key={item.id || idx}>
                                                        <td>{indexOfFirstItem + idx + 1}</td>
                                                        <td><strong>{item.file_name}</strong></td>
                                                        <td>
                                                            <div className="d-flex flex-column gap-1">
                                                                <small>Room: {item.room_name || '—'}</small>
                                                                <small>Shelf: {item.shelf_name || '—'}</small>
                                                                <small>Rack: {item.rack_name || '—'}</small>
                                                            </div>
                                                        </td>
                                                        <td>{item.rack_custodian_name || '—'}</td>
                                                        <td>
                                                            <span className={`badge badge-${item.status === 'Available' ? 'success' : item.status === 'Allocated' ? 'primary' : 'secondary'} light`}>
                                                                {item.status}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div className="d-flex justify-content-end gap-1">
                                                                <button className="btn btn-outline-info shadow" style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', borderRadius: '6px' }} onClick={() => onShowHistory(item)} title="Allocation History">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                                                </button>
                                                                <EditButton 
                                                                    module={module} 
                                                                    onClick={() => onEdit(item)}
                                                                />
                                                                <DeleteButton 
                                                                    module={module} 
                                                                    onClick={() => onDelete(item.id)}
                                                                />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            
                            {/* Pagination */}
                            {!loading && data.length > 0 && (
                                <div className="d-flex justify-content-between align-items-center mt-3 mb-3 pt-3 border-top">
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

export default FileList;