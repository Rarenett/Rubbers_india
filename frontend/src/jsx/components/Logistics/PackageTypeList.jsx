import React from 'react';
import { Card } from 'react-bootstrap';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import CreateButton from '../../../components/permissions/CreateButton';

const PackageTypeList = ({
    data,
    loading,
    searchTerm,
    onSearchChange,
    onEdit,
    onDelete,
    onExport,
    onAdd,
    currentUser,
    can,
}) => {
    // Temporarily bypassing permission check for new module testing
    const hasEdit   = true; // !can || can('package-type', 'edit');
    const hasDelete = true; // !can || can('package-type', 'delete');

    return (
        <Card>
            <Card.Header className="d-flex justify-content-between align-items-center flex-wrap">
                <Card.Title className="mb-0">Package Dimensions Management</Card.Title>
                <div className="d-flex align-items-center gap-3 flex-wrap mt-2 mt-sm-0">
                    <div className="search-bar-container" style={{ margin: 0 }}>
                        <span className="search-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                        </span>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search Package Types..."
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                        />
                    </div>
                    <div className="d-flex gap-2 align-items-center">
                        <button className="btn btn-sm btn-light border" onClick={() => onExport('pdf')} title="Export PDF">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                <polyline points="10 9 9 9 8 9"></polyline>
                            </svg>
                        </button>
                        <button className="btn btn-sm btn-light border" onClick={() => onExport('excel')} title="Export Excel">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path>
                                <path d="m13 13 3 4"></path><path d="m16 13-3 4"></path>
                            </svg>
                        </button>
                        <button className="btn btn-sm btn-light border" onClick={() => onExport('print')} title="Print">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                                <rect x="6" y="14" width="12" height="8"></rect>
                            </svg>
                        </button>
                        {onAdd && (
                            <CreateButton 
                                module="packagetypes" 
                                onClick={onAdd}
                                className="d-flex align-items-center justify-content-center"
                                style={{ height: '38px', borderRadius: '6px', padding: '0 16px', whiteSpace: 'nowrap' }}
                            >
                                Package Dimension
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
                                <th><strong>PACKID</strong></th>
                                <th><strong>NAME</strong></th>
                                <th><strong>DIMENSIONS (L×W×H)</strong></th>
                                <th><strong>WEIGHT</strong></th>
                                <th><strong>VOLUME</strong></th>
                                <th><strong>NARRATION</strong></th>
                                <th className="text-end"><strong>ACTIONS</strong></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="7" className="text-center py-4">Loading...</td></tr>
                            ) : data.length === 0 ? (
                                <tr><td colSpan="7" className="text-center py-4 text-muted">No package types found.</td></tr>
                            ) : (
                                data.map((item, idx) => (
                                    <tr key={item.id || idx}>
                                        <td className="fw-bold text-primary">{item.pack_id}</td>
                                        <td className="fw-bold">{item.pack_name}</td>
                                        <td className="text-muted">
                                            {item.length} × {item.width} × {item.height}
                                        </td>
                                        <td className="text-muted">{item.weight}</td>
                                        <td className="text-muted">{item.volume}</td>
                                        <td className="text-muted" style={{ maxWidth: '200px' }}>
                                            {item.narration
                                                ? item.narration.length > 50
                                                    ? item.narration.slice(0, 50) + '…'
                                                    : item.narration
                                                : '—'}
                                        </td>
                                        <td className="text-end">
                                            <div className="d-flex justify-content-end gap-2">
                                                {hasEdit && (
                                                    <EditButton
                                                        module="packagetypes"
                                                        onClick={() => onEdit(item)}
                                                        className="sharp btn-xs"
                                                    />
                                                )}
                                                {hasDelete && (
                                                    <DeleteButton
                                                        module="packagetypes"
                                                        onClick={() => onDelete(item.id)}
                                                        className="sharp btn-xs"
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
                </div>
            </Card.Body>
        </Card>
    );
};

export default PackageTypeList;
