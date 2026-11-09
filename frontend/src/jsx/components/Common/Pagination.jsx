import React from 'react';

const Pagination = ({ currentPage, setCurrentPage, totalPages, indexOfFirst, indexOfLast, totalRecords, loading }) => {
    if (loading || totalRecords === 0) return null;

    return (
        <div className="d-flex justify-content-between align-items-center mt-4 mb-3">
            <div className="text-muted" style={{ fontSize: '13px' }}>
                Showing {indexOfFirst + 1} to {Math.min(indexOfLast, totalRecords)} of {totalRecords} entries
            </div>
            {totalPages > 1 && (
                <nav>
                    <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                        <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                            <button 
                                type="button" 
                                className="page-link" 
                                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} 
                                disabled={currentPage === 1} 
                                style={{ border: 'none', background: 'none' }}
                            >
                                <i className="la la-angle-left" />
                            </button>
                        </li>
                        {Array.from({ length: totalPages }, (_, i) => {
                            const page = i + 1;
                            if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                                return (
                                    <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                                        <button 
                                            type="button" 
                                            className="page-link" 
                                            onClick={() => setCurrentPage(page)} 
                                            style={{ border: 'none' }}
                                        >
                                            {page}
                                        </button>
                                    </li>
                                );
                            } else if (page === currentPage - 2 || page === currentPage + 2) {
                                return (
                                    <li key={page} className="page-item disabled">
                                        <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                    </li>
                                );
                            }
                            return null;
                        })}
                        <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                            <button 
                                type="button" 
                                className="page-link" 
                                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} 
                                disabled={currentPage === totalPages} 
                                style={{ border: 'none', background: 'none' }}
                            >
                                <i className="la la-angle-right" />
                            </button>
                        </li>
                    </ul>
                </nav>
            )}
        </div>
    );
};

export default Pagination;
