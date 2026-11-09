import React, { useState, useEffect } from 'react';
import { Card, Form } from 'react-bootstrap';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import CreateButton from '../../../components/permissions/CreateButton';
import { usePageTitle } from '../../../context/TitleContext';
/**
 * ServiceTypeList
 * Props:
 *  - data           : array of service type objects
 *  - loading        : bool
 *  - searchTerm     : string
 *  - onSearchChange : (value) => void
 *  - onEdit         : (item) => void
 *  - onDelete       : (id) => void
 *  - onAdd          : () => void          (optional — shows header "Add" button if provided)
 *  - onExport       : (format) => void   format: 'pdf' | 'excel' | 'print'
 *  - currentUser    : auth user object
 *  - can            : permission checker
 */
const ServiceTypeList = ({
    data,
    loading,
    searchTerm,
    onSearchChange,
    onEdit,
    onDelete,
    onAdd,
    onExport,
    currentUser,
    can,
}) => {
    const hasEdit   = !can || can('service_type', 'edit');
    const hasDelete = !can || can('service_type', 'delete');
    usePageTitle("Service Management");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentData = data.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(data.length / itemsPerPage);

    return (
        <>
            <style>
                {`
                    @media (max-width: 991px) {
                        .stl-header-container {
                            flex-direction: column !important;
                            align-items: flex-start !important;
                            gap: 15px !important;
                        }
                        .stl-controls-wrapper {
                            flex-direction: column !important;
                            width: 100% !important;
                            align-items: stretch !important;
                            gap: 10px !important;
                        }
                        .stl-search-bar {
                            width: 100% !important;
                        }
                        .stl-add-btn {
                            width: 100% !important;
                        }
                    }
                    .stl-table {
                        min-width: 1000px !important;
                    }
                    .stl-table th, .stl-table td {
                        white-space: nowrap !important;
                    }
                `}
            </style>
        <Card>
            <Card.Header className="d-flex justify-content-between align-items-center stl-header-container">
                <Card.Title className="mb-0">Service Types</Card.Title>
                <div className="d-flex align-items-center gap-2 stl-controls-wrapper">
                    <div className="stl-search-bar" style={{ width: '300px', position: 'relative' }}>
                        <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                        <Form.Control
                            type="text"
                            placeholder="Search by Service Type, Created By..."
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
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
                    {onAdd && (
                        <CreateButton
                            module="service_type"
                            onClick={onAdd}
                            className="stl-add-btn"
                            style={{ height: '38px', borderRadius: '6px', padding: '0 16px' }}
                        >
                            Service Type
                        </CreateButton>
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
                        <table className="table table-responsive-md stl-table">
                            <thead>
                                <tr>
                                    <th><strong>SL.NO</strong></th>
                                    <th><strong>SERVICE TYPE</strong></th>
                                    <th><strong>DESCRIPTION</strong></th>
                                    <th><strong>CREATED BY</strong></th>
                                    <th className="text-end"><strong>ACTIONS</strong></th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentData.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="text-center py-4 text-muted">
                                            No service types found.
                                        </td>
                                    </tr>
                                ) : (
                                    currentData.map((item, idx) => (
                                        <tr key={item.id || idx}>
                                            <td>{indexOfFirstItem + idx + 1}</td>
                                            <td><strong>{item.service_type}</strong></td>
                                            <td className="text-muted" style={{ maxWidth: '300px' }}>
                                                {item.description
                                                    ? item.description.length > 80
                                                        ? item.description.slice(0, 80) + '…'
                                                        : item.description
                                                    : '—'}
                                            </td>
                                            <td>{item.created_by_name || '—'}</td>
                                            <td>
                                                <div className="d-flex justify-content-end gap-1">
                                                    {hasEdit && (
                                                        <EditButton
                                                            module="service_type"
                                                            onClick={() => onEdit(item)}
                                                        />
                                                    )}
                                                    {hasDelete && (
                                                        <DeleteButton
                                                            module="service_type"
                                                            onClick={() => onDelete(item.id)}
                                                        />
                                                    )}
                                                    {!hasEdit && !hasDelete && (
                                                        <span className="badge badge-danger light">
                                                            No Access
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
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
                    </div>
                )}
            </Card.Body>
        </Card>
        </>
    );
};

export default ServiceTypeList;