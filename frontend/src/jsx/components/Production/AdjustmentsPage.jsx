import React, { useState, useEffect, Fragment } from 'react';
import { Card, Button, Spinner, Table, Form } from 'react-bootstrap';
import ProductionService from '../../../services/ProductionService';
import AdjustmentModal from './AdjustmentModal';
import { usePageTitle } from '../../../context/TitleContext';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import Swal from 'sweetalert2';

const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const cleanDate = String(dateStr).split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
        if (parts[0].length === 4) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return cleanDate;
    }
    return dateStr;
};

const AdjustmentsPage = () => {
    usePageTitle("Production Adjustments");

    const [adjustments, setAdjustments] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [search, setSearch] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [editingAdjustment, setEditingAdjustment] = useState(null);

    const handleEditAdjustment = (entry) => {
        if (entry.has_rnd_entry) {
            Swal.fire({
                icon: 'warning',
                title: 'Action Not Allowed',
                text: 'This adjustment entry cannot be edited because an R&D entry has already been saved for it.'
            });
            return;
        }
        setEditingAdjustment(entry);
        setShowModal(true);
    };

    useEffect(() => {
        fetchAdjustments();
    }, [fromDate, toDate]);

    useEffect(() => {
        setCurrentPage(1);
    }, [search, fromDate, toDate]);

    const fetchAdjustments = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (fromDate) params.append('from_date', fromDate);
            if (toDate) params.append('to_date', toDate);

            const queryString = params.toString() ? `?${params.toString()}` : '';
            const res = await ProductionService.getAdjustments(queryString);
            const list = res.data.results || res.data || [];
            setAdjustments(list);
        } catch (error) {
            console.error('Failed to load adjustments:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleResetFilters = () => {
        setSearch('');
        setFromDate('');
        setToDate('');
        setTimeout(() => {
            ProductionService.getAdjustments('').then(res => {
                setAdjustments(res.data.results || res.data || []);
            });
        }, 50);
    };

    // Calculate summary statistics
    const totalAdjustments = adjustments.length;
    const totalManufacturedCases = adjustments.reduce(
        (sum, item) => sum + (Number(item.manufactured_quantity) || 0),
        0
    );
    const totalConsumedAlternates = adjustments.reduce(
        (sum, item) => sum + (Number(item.consumed_alternate_quantity) || 0),
        0
    );

    // Search filter
    const filteredAdjustments = adjustments.filter(adj => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        const itemName = (adj.stock_item_name || '').toLowerCase();
        const itemCode = (adj.stock_item_code || '').toLowerCase();
        return itemName.includes(q) || itemCode.includes(q);
    });

    const totalPages = Math.ceil(filteredAdjustments.length / itemsPerPage);
    const indexOfFirst = (currentPage - 1) * itemsPerPage;
    const indexOfLast = indexOfFirst + itemsPerPage;
    const currentAdjustments = filteredAdjustments.slice(indexOfFirst, indexOfLast);

    return (
        <div className="container-fluid">
            
            {/* Adjustments Table Card */}
            <div className="row">
                <div className="col-12">
                    <Card>
                        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                            <Card.Title>Production Adjustments</Card.Title>
                            <div className="d-flex flex-wrap align-items-center gap-2">
                                {/* Search */}
                                <div style={{ minWidth: '180px', flex: '1 1 200px', position: 'relative' }}>
                                    <i
                                        className="fa fa-search position-absolute text-muted"
                                        style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}
                                    ></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Stock Item..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        style={{ height: '34px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>

                                {/* From Date */}
                                <Form.Control
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                    style={{ height: '34px', fontSize: '13px', borderRadius: '6px', width: '145px' }}
                                    title="From Date"
                                />

                                {/* To Date */}
                                <Form.Control
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => setToDate(e.target.value)}
                                    style={{ height: '34px', fontSize: '13px', borderRadius: '6px', width: '145px' }}
                                    title="To Date"
                                />

                                {/* Reset Filter Button */}
                                {(search || fromDate || toDate) && (
                                    <Button
                                        variant="outline-secondary"
                                        size="sm"
                                        onClick={handleResetFilters}
                                        style={{ height: '34px', fontSize: '12px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
                                        title="Reset Filters"
                                    >
                                        <i className="fa fa-undo me-1"></i> Reset
                                    </Button>
                                )}

                                {/* New Adjustment Action Button */}
                                <CreateButton
                                    onClick={() => { setEditingAdjustment(null); setShowModal(true); }}
                                >
                                 Adjustment
                                </CreateButton>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            {loading ? (
                                <div className="text-center p-5">
                                    <Spinner animation="border" variant="primary" />
                                    <div className="mt-2 text-muted">Loading adjustments...</div>
                                </div>
                            ) : (
                                <Fragment>
                                    <Table responsive hover className="mb-0">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '60px' }}>SL No</th>
                                                <th>Date</th>
                                                <th>Stock Item</th>
                                                <th className="text-center">Manufactured Qty</th>
                                                <th className="text-center">Consumed Qty</th>
                                                <th className="text-center" style={{ width: '90px' }}>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredAdjustments.length === 0 ? (
                                                <tr>
                                                    <td colSpan="6" className="text-center py-4 text-muted">
                                                        No production adjustment entries found.
                                                    </td>
                                                </tr>
                                            ) : (
                                                currentAdjustments.map((entry, index) => (
                                                    <tr key={entry.id}>
                                                        <td>{indexOfFirst + index + 1}</td>
                                                        <td>
                                                            {formatDate(entry.adjusted_date || entry.created_at)}
                                                        </td>
                                                        <td>
                                                            <strong>{entry.stock_item_name}</strong>
                                                            {entry.stock_item_code && (
                                                                <div className="text-muted small">
                                                                    {entry.stock_item_code}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="text-center">
                                                            <span className="badge badge-success light font-w600">
                                                                {entry.manufactured_quantity} {entry.primary_unit_name || 'Case'}
                                                            </span>
                                                        </td>
                                                        <td className="text-center">
                                                            <span className="font-w500 text-dark">
                                                                {entry.consumed_alternate_quantity} {entry.alternate_unit_name || 'Nos'}
                                                            </span>
                                                        </td>
                                                        <td className="text-center">
                                                            {!entry.has_rnd_entry ? (
                                                                <EditButton
                                                                    onClick={() => handleEditAdjustment(entry)}
                                                                    title="Edit Adjustment"
                                                                />
                                                            ) : (
                                                                <span
                                                                    className="badge light badge-light text-muted font-w600"
                                                                    style={{ fontSize: '11px', padding: '5px 8px', cursor: 'not-allowed' }}
                                                                    title="R&D entry already saved; adjustment cannot be edited"
                                                                >
                                                                    <i className="fa fa-lock me-1 text-danger"></i> R&D Saved
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </Table>

                                    {/* Pagination */}
                                    {!loading && filteredAdjustments.length > 0 && (
                                        <div className="d-flex justify-content-between align-items-center mt-4 mb-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                                Showing {indexOfFirst + 1} to {Math.min(indexOfLast, filteredAdjustments.length)} of {filteredAdjustments.length} entries
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
                                    )}
                                </Fragment>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {/* Modal for Creating / Editing Adjustment */}
            <AdjustmentModal
                show={showModal}
                onHide={() => {
                    setShowModal(false);
                    setEditingAdjustment(null);
                }}
                onSuccess={fetchAdjustments}
                adjustment={editingAdjustment}
            />
        </div>
    );
};

export default AdjustmentsPage;
