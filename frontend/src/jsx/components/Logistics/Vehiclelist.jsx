import React, { useState, useEffect } from 'react';
import { Card, Form } from 'react-bootstrap';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import CreateButton from '../../../components/permissions/CreateButton';
/**
 * VehicleList
 * Props:
 *  - data            : array of vehicle objects
 *  - loading         : bool
 *  - searchTerm      : string
 *  - onSearchChange  : (value) => void
 *  - onEdit          : (item) => void
 *  - onDelete        : (id) => void
 *  - onExport        : (format) => void
 *  - onAdd           : () => void
 *  - currentUser     : auth user object
 *  - can             : permission can checker function
 */
const VehicleList = ({
    data,
    loading,
    searchTerm,
    onSearchChange,
    onEdit,
    onDelete,
    onExport,
    onAdd,
    currentUser,
    can
}) => {
    const hasEdit = !can || can('vehicle', 'edit');
    const hasDelete = !can || can('vehicle', 'delete');
    const [brokenImages, setBrokenImages] = useState({});

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
                        .vh-header-container {
                            flex-direction: column !important;
                            align-items: flex-start !important;
                            gap: 15px !important;
                        }
                        .vh-controls-wrapper {
                            flex-direction: column !important;
                            width: 100% !important;
                            align-items: stretch !important;
                            gap: 10px !important;
                        }
                        .vh-search-bar {
                            width: 100% !important;
                        }
                        .vh-add-btn {
                            width: 100% !important;
                        }
                    }
                    .vh-table {
                        min-width: 1000px !important;
                    }
                    .vh-table th, .vh-table td {
                        white-space: nowrap !important;
                    }
                `}
            </style>
        <Card>
            <Card.Header className="d-flex justify-content-between align-items-center vh-header-container">
                <Card.Title className="mb-0">Vehicles</Card.Title>
                <div className="d-flex align-items-center gap-2 vh-controls-wrapper">
                    <div className="vh-search-bar" style={{ width: '300px', position: 'relative' }}>
                        <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                        <Form.Control
                            type="text"
                            placeholder="Search vehicles, Number, Driver..."
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
                            module="vehicle"
                            onClick={onAdd}
                            className="vh-add-btn"
                            style={{ height: '38px', borderRadius: '6px', padding: '0 16px' }}
                        >
                            Vehicle
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
                        <table className="table table-responsive-md vh-table">
                            <thead>
                                <tr>
                                    <th><strong>SL.NO</strong></th>
                                    <th><strong>IMAGE</strong></th>
                                    <th><strong>CODE</strong></th>
                                    <th><strong>VEHICLE NAME</strong></th>
                                    <th><strong>NUMBER</strong></th>
                                    <th><strong>DRIVER</strong></th>
                                    <th><strong>CATEGORY</strong></th>
                                    <th><strong>STATUS</strong></th>
                                    <th className="text-end"><strong>ACTIONS</strong></th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentData.length === 0 ? (
                                    <tr>
                                        <td colSpan="9" className="text-center py-4 text-muted">
                                            No vehicles found.
                                        </td>
                                    </tr>
                                ) : (
                                    currentData.map((item, idx) => (
                                        <tr key={item.id || idx}>
                                            <td>{indexOfFirstItem + idx + 1}</td>
                                            <td>
    {(() => {
        const rawImg = item.vehicle_img_preview || item.vehicle_img;
        const isAbsolute = rawImg && (rawImg.startsWith('http://') || rawImg.startsWith('https://') || rawImg.startsWith('blob:'));
        const apiBase = import.meta.env.VITE_API_BASE_URL || '';
        const resolvedSrc = rawImg
            ? (isAbsolute ? rawImg : `${apiBase}${rawImg.startsWith('/') ? '' : '/'}${rawImg}`)
            : null;

        const rowKey = item.id || idx;
        const hasFailed = brokenImages[rowKey];

        if (resolvedSrc && !hasFailed) {
            return (
                <img
                    src={resolvedSrc}
                    alt={item.vehicle_name}
                    onError={() => setBrokenImages(prev => ({ ...prev, [rowKey]: true }))}
                    style={{
                        width: '40px',
                        height: '40px',
                        objectFit: 'cover',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0'
                    }}
                />
            );
        }

        return (
            <div
                className="d-flex align-items-center justify-content-center bg-light text-muted"
                style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    border: '1px solid #e2e8f0'
                }}
            >
                No Img
            </div>
        );
    })()}
</td>
                                            <td>
                                                <span className="badge badge-info light">{item.vehicle_code}</span>
                                            </td>
                                            <td><strong>{item.vehicle_name}</strong></td>
                                            <td>
                                                <span className="badge badge-secondary light">{item.vehicle_number}</span>
                                            </td>
                                            <td>
                                                {item.driver_name ||
                                                item.driver_full_name ||
                                                item.user_full_name ||
                                                '—'}
                                            </td>
                                            <td>{item.category_name || '—'}</td>
                                            <td>
                                                <span
                                                    className={`badge light badge-${
                                                        item.vehicle_status === 'available'
                                                            ? 'success'
                                                            : item.vehicle_status === 'in_use'
                                                            ? 'info'
                                                            : item.vehicle_status === 'maintenance'
                                                            ? 'warning'
                                                            : 'danger'
                                                    }`}
                                                >
                                                    {item.vehicle_status}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="d-flex justify-content-end gap-1">
                                                    {hasEdit && (
                                                        <EditButton
                                                            module="vehicle"
                                                            onClick={() => onEdit(item)}
                                                        />
                                                    )}
                                                    {hasDelete && (
                                                        <DeleteButton
                                                            module="vehicle"
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

export default VehicleList;