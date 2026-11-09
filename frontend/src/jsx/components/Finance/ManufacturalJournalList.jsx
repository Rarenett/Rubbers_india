import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Form, Badge } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    getManufacturalJournals,
    deleteManufacturalJournal,
} from '../../../services/FinanceService';
import { usePermission } from '../../../hooks/usePermission';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import ManufacturalJournalFormModal from './ManufacturalJournalFormModal';
import { formatDate } from '../../../utils/dateUtils';

const ManufacturalJournalList = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const firstDayOfMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    const lastDayObj = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const lastDayOfMonth = `${lastDayObj.getFullYear()}-${pad(lastDayObj.getMonth() + 1)}-${pad(lastDayObj.getDate())}`;

    const [searchTerm, setSearchTerm] = useState('');
    const [fromDate, setFromDate] = useState(firstDayOfMonth);
    const [toDate, setToDate] = useState(lastDayOfMonth);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const { can } = usePermission();

    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, fromDate, toDate]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getManufacturalJournals();
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
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to fetch manufactural journals.' });
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
                    const rNo = String(r.voucher_no || r.mj_no || '').toLowerCase().replace(/[^a-z0-9]/g, '');
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
            title: 'Delete Manufactural Journal?',
            text: `Delete "${label}"? This will also remove the associated stock table entries.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it',
        });
        if (!result.isConfirmed) return;
        try {
            await deleteManufacturalJournal(id);
            Swal.fire({ icon: 'success', title: 'Deleted', text: 'Manufactural journal deleted successfully', timer: 2000, showConfirmButton: false });
            fetchData();
        } catch (err) {
            const msg = err?.response?.data?.detail || 'Failed to delete manufactural journal.';
            Swal.fire({ icon: 'error', title: 'Error', text: msg });
        }
    };

    // ─── Filter & Pagination ──────────────────────────────────────────────────
    const filtered = items.filter(item => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = (
            (item.journal_no_display || '').toLowerCase().includes(term) ||
            (item.manufactural_journal_type_name || '').toLowerCase().includes(term) ||
            (item.narration || '').toLowerCase().includes(term) ||
            (item.batch_number || '').toLowerCase().includes(term) ||
            (item.journal_date || '').includes(term)
        );

        let matchesDate = true;
        const vDate = item.journal_date;
        if (fromDate && vDate) {
            if (vDate < fromDate) matchesDate = false;
        }
        if (toDate && vDate) {
            if (vDate > toDate) matchesDate = false;
        }

        return matchesSearch && matchesDate;
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
        <Fragment>
            <div className="container-fluid">
                <div className="row">
                    <div className="col-lg-12">
                        <Card>
                            <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                                <Card.Title className="mb-0">Manufactural Journals Management</Card.Title>
                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                    <div className="d-flex align-items-center gap-1">
                                        <span className="text-muted" style={{ fontSize: '12px', fontWeight: '500' }}>From:</span>
                                        <input
                                            type="date"
                                            className="form-control form-control-sm"
                                            value={fromDate}
                                            onChange={(e) => {
                                                setFromDate(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                            style={{ width: '135px', height: '34px', fontSize: '12px', borderRadius: '6px' }}
                                        />
                                    </div>
                                    <div className="d-flex align-items-center gap-1">
                                        <span className="text-muted" style={{ fontSize: '12px', fontWeight: '500' }}>To:</span>
                                        <input
                                            type="date"
                                            className="form-control form-control-sm"
                                            value={toDate}
                                            onChange={(e) => {
                                                setToDate(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                            style={{ width: '135px', height: '34px', fontSize: '12px', borderRadius: '6px' }}
                                        />
                                    </div>
                                    <div style={{ width: '250px', position: 'relative' }}>
                                        <i
                                            className="fa fa-search position-absolute text-muted"
                                            style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}
                                        />
                                        <Form.Control
                                            type="text"
                                            placeholder="Search Manufactural Journal..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            style={{ height: '34px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                        />
                                    </div>
                                    <CreateButton module="finance" onClick={() => handleShowModal()}>
                                        Manufactural Journal
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
                                        <table className="table table-responsive-md align-middle mb-0">
                                            <thead>
                                                <tr>
                                                    <th style={{ padding: '12px 16px', fontSize: '13px' }}><strong>SL. NO.</strong></th>
                                                    <th style={{ padding: '12px 16px', fontSize: '13px' }}><strong>JOURNAL NO</strong></th>
                                                    <th style={{ padding: '12px 16px', fontSize: '13px' }}><strong>DATE</strong></th>
                                                    <th style={{ padding: '12px 16px', fontSize: '13px' }}><strong>JOURNAL TYPE</strong></th>
                                                    <th style={{ padding: '12px 16px', fontSize: '13px' }}><strong>BATCH NO</strong></th>
                                                    <th style={{ padding: '12px 16px', fontSize: '13px' }}><strong>MOVEMENT</strong></th>
                                                    <th style={{ padding: '12px 16px', fontSize: '13px' }}><strong>TOTAL (₹)</strong></th>
                                                    <th style={{ padding: '12px 16px', fontSize: '13px' }}><strong>NARRATION</strong></th>
                                                    <th className="text-end" style={{ padding: '12px 16px', fontSize: '13px' }}><strong>ACTIONS</strong></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filtered.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={9} className="text-center py-4 text-muted">
                                                            No entries
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    currentItems.map((item, idx) => (
                                                        <tr key={item.id}>
                                                            <td style={{ padding: '10px 16px', verticalAlign: 'middle' }}><strong>{indexOfFirst + idx + 1}</strong></td>
                                                            <td style={{ padding: '10px 16px', verticalAlign: 'middle' }}><strong>{item.journal_no_display || '—'}</strong></td>
                                                            <td style={{ padding: '10px 16px', verticalAlign: 'middle' }}>{formatDate(item.journal_date)}</td>
                                                            <td style={{ padding: '10px 16px', verticalAlign: 'middle' }}>{item.manufactural_journal_type_name || '—'}</td>
                                                            <td style={{ padding: '10px 16px', verticalAlign: 'middle' }}>{item.batch_number ? <span className="badge badge-light border font-w600" style={{ color: '#7A70BA' }}>{item.batch_number}</span> : '—'}</td>
                                                            <td style={{ padding: '10px 16px', verticalAlign: 'middle' }}>
                                                                <span className={`badge badge-${item.movement_type === 'IN' ? 'success' : item.movement_type === 'OUT' ? 'warning' : 'info'} light`}>
                                                                    {item.movement_type === 'IN' ? 'Production' : item.movement_type === 'OUT' ? 'Consumption' : 'Production/Consumption'}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '10px 16px', verticalAlign: 'middle' }}>₹ {itemTotal(item).toFixed(2)}</td>
                                                            <td style={{ padding: '10px 16px', verticalAlign: 'middle' }}>{item.narration || '—'}</td>
                                                            <td className="text-end" style={{ padding: '10px 16px', verticalAlign: 'middle' }}>
                                                                {can('finance', 'edit') || can('finance', 'delete') ? (
                                                                    <div className="d-flex justify-content-end">
                                                                        <EditButton
                                                                            module="finance"
                                                                            onClick={() => handleShowModal(item)}
                                                                            className="me-1"
                                                                        />
                                                                        <DeleteButton
                                                                            module="finance"
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

                                {totalPages > 1 && (
                                    <div className="d-flex justify-content-between align-items-center mt-3">
                                        <div className="text-muted" style={{ fontSize: '13px' }}>
                                            Showing {indexOfFirst + 1} to {Math.min(indexOfLast, filtered.length)} of {filtered.length} entries
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
                            </Card.Body>
                        </Card>
                    </div>
                </div>
            </div>

            <ManufacturalJournalFormModal
                show={showModal}
                onHide={handleHideModal}
                onSaved={handleSaved}
                editItem={editItem}
            />
        </Fragment>
    );
};

export default ManufacturalJournalList;
