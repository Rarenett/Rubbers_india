import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Form, Badge } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    getStockJournals,
    deleteStockJournal,
} from '../../../services/FinanceService';
import { usePermission } from '../../../hooks/usePermission';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import StockJournalFormModal from './StockJournalFormModal';
import { formatDate } from '../../../utils/dateUtils';

const StockJournalList = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const { can } = usePermission();

    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getStockJournals();
            const journalList = Array.isArray(data) ? data : data?.results || [];
            const sorted = [...journalList].sort((a, b) => {
                if (typeof a.id === 'number' && typeof b.id === 'number') {
                    return b.id - a.id;
                }
                if (a.created_at && b.created_at) {
                    return new Date(b.created_at) - new Date(a.created_at);
                }
                return String(b.id).localeCompare(String(a.id));
            });
            setItems(sorted);
        } catch {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to fetch stock journals.' });
        } finally {
            setLoading(false);
        }
    };

    const handleShowModal = useCallback((item = null) => {
        setEditItem(item);
        setShowModal(true);
    }, []);

    useEffect(() => {
        if (!loading && items.length > 0) {
            const searchParams = new URLSearchParams(location.search);
            const editId = searchParams.get('edit');
            if (editId) {
                const cleanTarget = String(editId).toLowerCase().replace(/[^a-z0-9]/g, '');
                const targetItem = items.find(r => {
                    const rId = String(r.id);
                    const rNo = String(r.voucher_no || r.sj_no || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    return rId === String(editId) || rNo === cleanTarget || (cleanTarget && rNo.endsWith(cleanTarget));
                });
                if (targetItem) {
                    handleShowModal(targetItem);
                }
            }
        }
    }, [loading, items, location.search, handleShowModal]);

    const handleHideModal = () => {
        setShowModal(false);
        setEditItem(null);
    };

    const handleSaved = () => {
        fetchData();
        const searchParams = new URLSearchParams(location.search);
        const returnUrl = searchParams.get('returnUrl') || location.state?.returnUrl;
        if (returnUrl) {
            navigate(decodeURIComponent(returnUrl));
        }
    };

    const handleDelete = async (id, label) => {
        const result = await Swal.fire({
            title: 'Delete Stock Journal?',
            text: `Delete "${label}"? This will also remove the associated stock table entries.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it',
        });
        if (!result.isConfirmed) return;
        try {
            await deleteStockJournal(id);
            Swal.fire({ icon: 'success', title: 'Deleted', text: 'Stock journal deleted successfully', timer: 2000, showConfirmButton: false });
            fetchData();
        } catch (err) {
            const msg = err?.response?.data?.detail || 'Failed to delete stock journal.';
            Swal.fire({ icon: 'error', title: 'Error', text: msg });
        }
    };

    // ─── Filter & Pagination ──────────────────────────────────────────────────
    const filtered = items.filter(item => {
        const term = searchTerm.toLowerCase();
        return (
            (item.journal_no_display || '').toLowerCase().includes(term) ||
            (item.stock_journal_type_name || '').toLowerCase().includes(term) ||
            (item.narration || '').toLowerCase().includes(term) ||
            (item.journal_date || '').includes(term)
        );
    });

    const indexOfLast = currentPage * itemsPerPage;
    const indexOfFirst = indexOfLast - itemsPerPage;
    const currentItems = filtered.slice(indexOfFirst, indexOfLast);
    const totalPages = Math.ceil(filtered.length / itemsPerPage);

    const itemTotal = (journal) => {
        if (!journal.details || journal.details.length === 0) return 0;
        return journal.details.reduce((s, d) => s + parseFloat(d.amount || 0), 0);
    };

    return (
        <div className="container-fluid">

            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        {/* Card Header matches StockItemList */}
                        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                            <Card.Title className="mb-0">Stock Journals Management</Card.Title>
                            <div className="d-flex flex-wrap align-items-center gap-2">
                                <div style={{ minWidth: '180px', flex: '1 1 200px', position: 'relative' }}>
                                    <i
                                        className="fa fa-search position-absolute text-muted"
                                        style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}
                                    />
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Stock Journal..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                <CreateButton module="stock_journal" onClick={() => handleShowModal()}>
                                    Stock Journal
                                </CreateButton>
                            </div>
                        </Card.Header>

                        <Card.Body>
                            {loading ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading…</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-responsive-md">
                                        <thead>
                                            <tr>
                                                <th><strong>SL NO</strong></th>
                                                <th><strong>JOURNAL NO</strong></th>
                                                <th><strong>DATE</strong></th>
                                                <th><strong>JOURNAL TYPE</strong></th>
                                                <th><strong>MOVEMENT</strong></th>
                                                <th><strong>TOTAL ()</strong></th>
                                                <th><strong>NARRATION</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} className="text-center py-4 text-muted">
                                                        No entries
                                                    </td>
                                                </tr>
                                            ) : (
                                                currentItems.map((item, index) => (
                                                    <tr key={item.id}>
                                                        <td><strong>{indexOfFirst + index + 1}</strong></td>
                                                        <td><strong>{item.journal_no_display || '-'}</strong></td>
                                                        <td>{formatDate(item.journal_date)}</td>
                                                        <td>{item.stock_journal_type_name || '—'}</td>
                                                        <td>
                                                            <span className={`badge badge-${item.movement_type === 'IN' ? 'success' : item.movement_type === 'OUT' ? 'warning' : 'info'} light`}>
                                                                {item.movement_type === 'IN' ? 'Production' : item.movement_type === 'OUT' ? 'Consumption' : 'Production/Consumption'}
                                                            </span>
                                                        </td>
                                                        <td>{itemTotal(item).toFixed(2)}</td>
                                                        <td>{item.narration || '—'}</td>
                                                        <td className="text-end">
                                                            {can('finance', 'edit') || can('finance', 'delete') ? (
                                                                <div className="d-flex justify-content-end">
                                                                    <EditButton
                                                                        module="stock_journal"
                                                                        onClick={() => handleShowModal(item)}
                                                                        className="me-1"
                                                                    />
                                                                    <DeleteButton
                                                                        module="stock_journal"
                                                                        onClick={() => handleDelete(item.id, item.journal_no_display || `Journal #${item.id}`)}
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

                            {/* Pagination matches StockItemList */}
                            {filtered.length > 0 && (
                                <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                    <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirst + 1} to {Math.min(indexOfLast, filtered.length)} of {filtered.length} entries
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

            {/* Form Modal */}
            <StockJournalFormModal
                show={showModal}
                onHide={handleHideModal}
                onSaved={handleSaved}
                editItem={editItem}
            />
        </div>
    );
};

export default StockJournalList;
