import React, { useState, useRef, useEffect } from 'react';
import { Card, Form } from 'react-bootstrap';
import Select from 'react-select';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import CreateButton from '../../../components/permissions/CreateButton';

/**
 * SearchableSelect — Wrapper around react-select to match other pages.
 */
const SearchableSelect = ({ options = [], value, onChange, placeholder = 'Search...', minWidth = '200px' }) => {
    const reactSelectOptions = [
        { value: '', label: placeholder.replace('Search ', 'All ') },
        ...options
    ];
    
    const selectedOption = reactSelectOptions.find(o => String(o.value) === String(value)) || null;

    return (
        <div style={{ minWidth }}>
            <Select
                className="react-select-container"
                classNamePrefix="react-select"
                options={reactSelectOptions}
                value={selectedOption}
                onChange={(opt) => onChange(opt ? opt.value : '')}
                placeholder={placeholder}
                styles={{
                    control: (base, state) => ({
                        ...base,
                        minHeight: '38px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        boxShadow: state.isFocused ? '0 0 0 1px #cbd5e1' : 'none',
                        borderColor: state.isFocused ? '#cbd5e1' : base.borderColor
                    }),
                    menu: (base) => ({
                        ...base,
                        fontSize: '13px',
                        zIndex: 9999
                    })
                }}
            />
        </div>
    );
};

/**
 * VehicleHistoryList
 * Props:
 *  - data            : array of vehicle history objects
 *  - loading         : bool
 *  - searchTerm      : string
 *  - onSearchChange  : (value) => void
 *  - onEdit          : (item) => void
 *  - onDelete        : (id) => void
 *  - onExport        : (format) => void   format: 'pdf' | 'excel' | 'print'
 *  - onAdd           : () => void  (optional — shows the Create button when passed)
 *  - can             : permission checker
 */
const VehicleHistoryList = ({
    data,
    loading,
    searchTerm,
    onSearchChange,
    onEdit,
    onDelete,
    onExport,
    onAdd,
    can,

    vehicles,
    serviceTypes,

    vehicleFilter,
    setVehicleFilter,

    serviceTypeFilter,
    setServiceTypeFilter,

    fromDate,
    setFromDate,
    toDate,
    setToDate,
}) => {
    const hasEdit   = !can || can('vehicle_history', 'edit');
    const hasDelete = !can || can('vehicle_history', 'delete');

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, vehicleFilter, serviceTypeFilter, fromDate, toDate]);

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentData = data.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(data.length / itemsPerPage);

    return (
        <>
            <style>
                {`
                    @media (max-width: 991px) {
                        .vhl-main-wrapper {
                            flex-direction: column !important;
                            align-items: stretch !important;
                                               .vhl-filters-wrapper {
                            flex-direction: column !important;
                            align-items: stretch !important;
                            width: 100% !important;
                        }
                        .vhl-filters-wrapper > .react-select-container {
                            width: 100% !important;
                        }
                        .vhl-date-row {
                            display: flex !important;
                            flex-direction: row !important;
                            width: 100% !important;
                            justify-content: space-between !important;
                        }
                        .vhl-date-wrapper {
                            width: 48% !important;
                            flex-direction: column !important;
                            align-items: flex-start !important;
                            gap: 4px !important;
                        }
                        .vhl-date-input {
                            width: 100% !important;
                        }
                        .vhl-controls-wrapper {
                            flex-direction: column !important;
                            align-items: stretch !important;
                            width: 100% !important;
                        }
                        .vhl-add-btn {
                            width: 100% !important;
                        }
                    }
                    .vhl-table {
                        min-width: 1000px !important;
                    }
                    .vhl-table th, .vhl-table td {
                        white-space: nowrap !important;
                    }
                `}
            </style>
        <Card>
            <Card.Header className="d-flex flex-column align-items-stretch gap-3">
                <Card.Title className="mb-0">Vehicle History</Card.Title>
                {/* Filter row */}
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 vhl-main-wrapper">
                    <div className="d-flex align-items-center flex-wrap gap-2 vhl-filters-wrapper">
                        <div className="react-select-container">
                            <SearchableSelect
                                options={(vehicles || []).map((v) => ({ value: v.id, label: `${v.vehicle_number} - ${v.vehicle_name}` }))}
                                value={vehicleFilter}
                                onChange={(val) => setVehicleFilter(val)}
                                placeholder="Search Vehicles..."
                                minWidth="220px"
                            />
                        </div>
                        <div className="react-select-container">
                            <SearchableSelect
                                options={(serviceTypes || []).map((s) => ({ value: s.id, label: s.service_type }))}
                                value={serviceTypeFilter}
                                onChange={(val) => setServiceTypeFilter(val)}
                                placeholder="Search Service Types..."
                                minWidth="220px"
                            />
                        </div>
                        <div className="d-flex align-items-center gap-2 vhl-date-row">
                            <div className="d-flex align-items-center gap-2 vhl-date-wrapper">
                                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#475569', whiteSpace: 'nowrap', margin: 0 }}>
                                    From
                                </label>
                                <Form.Control
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                    className="vhl-date-input"
                                    style={{ height: '38px', borderRadius: '6px', width: '150px', fontSize: '13px' }}
                                />
                            </div>
                            <div className="d-flex align-items-center gap-2 vhl-date-wrapper">
                                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#475569', whiteSpace: 'nowrap', margin: 0 }}>
                                    To
                                </label>
                                <Form.Control
                                    type="date"
                                    value={toDate}
                                    min={fromDate || undefined}
                                    onChange={(e) => setToDate(e.target.value)}
                                    className="vhl-date-input"
                                    style={{ height: '38px', borderRadius: '6px', width: '150px', fontSize: '13px' }}
                                />
                            </div>
                        </div>
                        {/* {(fromDate || toDate) && (
                            <button
                                className="btn btn-sm btn-outline-secondary"
                                style={{ borderRadius: '6px', height: '38px', fontWeight: 600, whiteSpace: 'nowrap' }}
                                onClick={() => { setFromDate(''); setToDate(''); }}
                            >
                                ✕ Clear
                            </button>
                        )} */}
                    </div>
                    <div className="d-flex align-items-center gap-2 vhl-controls-wrapper">
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
                                module="vehicle_history"
                                onClick={onAdd}
                                className="vhl-add-btn"
                                style={{ height: '38px', borderRadius: '6px', padding: '0 16px' }}
                            >
                                Record
                            </CreateButton>
                        )}
                    </div>
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
                        <table className="table table-responsive-md vhl-table">
                            <thead>
                                <tr>
                                    <th><strong>SL.NO</strong></th>
                                    <th><strong>TRANS NO</strong></th>
                                    <th><strong>TRANS DATE</strong></th>
                                    <th><strong>VEHICLE NO</strong></th>
                                    <th><strong>VEHICLE NAME</strong></th>
                                    <th><strong>DRIVER</strong></th>
                                    <th><strong>ACTUAL KM</strong></th>
                                    <th><strong>SERVICE TYPE</strong></th>
                                    <th><strong>COST</strong></th>
                                    <th><strong>ATTACHMENT</strong></th>
                                    <th className="text-end"><strong>ACTIONS</strong></th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentData.length === 0 ? (
                                    <tr>
                                        <td colSpan="11" className="text-center py-4 text-muted">
                                            No records found.
                                        </td>
                                    </tr>
                                ) : (
                                    currentData.map((item, idx) => (
                                        <tr key={item.id || idx}>
                                            <td>{indexOfFirstItem + idx + 1}</td>
                                            <td>
                                                <span className="badge badge-info light">{item.trans_no}</span>
                                            </td>
                                            <td>{item.trans_date}</td>
                                            <td>
                                                <span className="badge badge-secondary light">{item.vehicle_number_display}</span>
                                            </td>
                                            <td><strong>{item.vehicle_name}</strong></td>
                                            <td>{item.driver_name || '—'}</td>
                                            <td>{item.actual_km ? `${item.actual_km} km` : '—'}</td>
                                            <td>{item.service_type_name || '—'}</td>
                                            <td>{item.cost ? `${parseFloat(item.cost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}</td>
                                            <td>
                                                {item.attachment_url ? (
                                                    <a
                                                        href={item.attachment_url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="btn btn-sm btn-outline-secondary"
                                                        title="View attachment"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                                        </svg>
                                                    </a>
                                                ) : '—'}
                                            </td>
                                            <td>
                                                <div className="d-flex justify-content-end gap-1">
                                                    {hasEdit && (
                                                        <EditButton
                                                            module="vehicle_history"
                                                            onClick={() => onEdit(item)}
                                                        />
                                                    )}
                                                    {hasDelete && (
                                                        <DeleteButton
                                                            module="vehicle_history"
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

export default VehicleHistoryList;