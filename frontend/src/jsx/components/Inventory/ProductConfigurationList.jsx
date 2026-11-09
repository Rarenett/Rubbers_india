import React from 'react';
import { usePageTitle } from '../../../context/TitleContext';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';

// ── Helper: render a boolean badge ────────────────────────────────────────────
const BoolBadge = ({ value }) =>
    value ? (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                color: '#065f46',
                padding: '3px 10px',
                borderRadius: '20px',
                fontWeight: 600,
                fontSize: '0.78rem',
                border: '1px solid #6ee7b7',
            }}
        >
            ✓ Yes
        </span>
    ) : (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: '#f1f5f9',
                color: '#64748b',
                padding: '3px 10px',
                borderRadius: '20px',
                fontWeight: 500,
                fontSize: '0.78rem',
                border: '1px solid #e2e8f0',
            }}
        >
            — No
        </span>
    );

// ── Main List Component ────────────────────────────────────────────────────────
const ProductConfigurationList = ({
    data = [],
    loading = false,
    onEdit,
    onDelete,
}) => {
    usePageTitle("Voucher Mapping");
    const [currentPage, setCurrentPage] = React.useState(1);
    const itemsPerPage = 10;

    React.useEffect(() => {
        setCurrentPage(1);
    }, [data.length]);

    const totalPages = Math.ceil(data.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = data.slice(indexOfFirstItem, indexOfLastItem);

    return (
        <div>
            <div className="table-responsive">
                <table className="table table-responsive-md">
                <thead>
                    <tr>
                        <th style={{ width: '80px' }}><strong>SI NO</strong></th>
                        <th><strong>VOUCHER TYPE</strong></th>
                        <th className="text-center"><strong>BATCH</strong></th>
                        <th className="text-center"><strong>MFG. DATE</strong></th>
                        <th className="text-center"><strong>EXPIRY DATE</strong></th>
                        <th className="text-center"><strong>GODOWN</strong></th>
                        <th className="text-center"><strong>ROW NARRATION</strong></th>
                        <th className="text-center" style={{ width: '110px' }}><strong>ACTIONS</strong></th>
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
                    ) : data.length === 0 ? (
                        <tr>
                            <td colSpan="8" className="text-center py-4 text-muted">
                                No voucher mapping found.
                            </td>
                        </tr>
                    ) : (
                        currentItems.map((config, i) => (
                            <tr key={config.id}>
                                <td className="text-center"><strong>{indexOfFirstItem + i + 1}</strong></td>
                                <td>
                                    <div className="d-flex align-items-center gap-2">
                                        <div
                                            className="d-flex align-items-center justify-content-center"
                                            style={{
                                                width: '36px', height: '36px', borderRadius: '10px',
                                                background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
                                                fontSize: '1rem', flexShrink: 0,
                                            }}
                                        >
                                            🧾
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem' }}>
                                                {config.voucher_type_name}
                                            </div>
                                            <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                                                Code: {config.voucher_type_code}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="text-center"><BoolBadge value={config.maintain_batch} /></td>
                                <td className="text-center"><BoolBadge value={config.maintain_manufacture_date} /></td>
                                <td className="text-center"><BoolBadge value={config.maintain_expiry_date} /></td>
                                <td className="text-center"><BoolBadge value={config.maintain_warehouse} /></td>
                                <td className="text-center"><BoolBadge value={config.maintain_narration} /></td>
                                <td className="text-center">
                                    <div className="d-flex justify-content-center gap-1">
                                        <button
                                            className="btn btn-outline-primary btn-sm shadow"
                                            style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontSize: '12px', borderRadius: '6px' }}
                                            onClick={() => onEdit(config)}
                                            title="Edit Mapping"
                                        >
                                            <i className="fa fa-pencil-alt"></i>
                                        </button>
                                        <button
                                            className="btn btn-outline-danger btn-sm shadow"
                                            style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontSize: '12px', borderRadius: '6px' }}
                                            onClick={() => onDelete(config.id)}
                                            title="Delete Mapping"
                                        >
                                            <i className="fa fa-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
        
        {data.length > 0 && (
            <div className="d-flex justify-content-between align-items-center mt-3 px-3 pb-3">
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
    );
};

export default ProductConfigurationList;
