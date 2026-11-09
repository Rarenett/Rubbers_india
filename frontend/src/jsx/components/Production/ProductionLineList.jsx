import React, { useState, useEffect, Fragment, useRef } from 'react';
import { Card, Table, Spinner, Form, Modal, Row, Col, Button } from 'react-bootstrap';
import MainSweetAlert from 'sweetalert2';
import ProductionService from '../../../services/ProductionService';
import PageTitle from '../../layouts/PageTitle';
import { usePageTitle } from '../../../context/TitleContext';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';

// ── Inline Modal Form ────────────────────────────────────────────────────────
const ProductionLineFormModal = ({ show, onHide, lineId, onSuccess }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (show) {
            if (lineId) {
                ProductionService.getProductionLine(lineId).then(res => {
                    setName(res.data.name);
                    setDescription(res.data.description || '');
                    setIsActive(res.data.is_active);
                });
            } else {
                setName(''); setDescription(''); setIsActive(true);
            }
        }
    }, [show, lineId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name) {
            MainSweetAlert.fire('Validation', 'Please enter a name.', 'warning');
            return;
        }
        setLoading(true);
        try {
            const payload = { name, description, is_active: isActive };
            if (lineId) {
                await ProductionService.updateProductionLine(lineId, payload);
                MainSweetAlert.fire({ icon: 'success', title: 'Updated', text: 'Product Line updated successfully', timer: 2000, showConfirmButton: false });
            } else {
                await ProductionService.createProductionLine(payload);
                MainSweetAlert.fire({ icon: 'success', title: 'Created', text: 'Product Line created successfully', timer: 2000, showConfirmButton: false });
            }
            onSuccess();
            onHide();
        } catch (error) {
            const msg = error.response?.data?.name?.[0] || 'Failed to save product line.';
            MainSweetAlert.fire('Error', msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const lineRef = useRef(null);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            const container = e.currentTarget;
            const elements = Array.from(container.querySelectorAll('input, select, textarea, button[type="submit"]')).filter(
                el => !el.disabled && !el.readOnly && el.tabIndex !== -1
            );
            const index = elements.indexOf(e.target);
            if (index > -1 && index < elements.length - 1) {
                e.preventDefault();
                elements[index + 1].focus();
            }
        }
    };

    const handleEntered = () => {
        if (lineRef.current) {
            lineRef.current.focus();
        }
    };

    return (
        <>
            <style>{`
                .pl-modal .modal-content { border-radius: 16px !important; border: none !important; box-shadow: 0 10px 40px rgba(0,0,0,0.12) !important; overflow: hidden; }
                .pl-modal .modal-header-custom { display:flex; align-items:center; justify-content:space-between; padding:24px 28px 16px; border-bottom:1px solid #f1f5f9; }
                .pl-modal .modal-icon-circle { width:48px; height:48px; background:#2ece8a; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 10px rgba(46,206,138,.2); }
                .pl-modal .modal-close-x { border:none; background:transparent; font-size:24px; color:#aaa; cursor:pointer; }
                .pl-modal .modal-close-x:hover { color:#555; }
                .pl-modal .modal-body-custom { padding:24px 28px; }
                .pl-modal .modal-footer-custom { display:flex; justify-content:flex-end; padding:20px 28px 24px; border-top:1px solid #f1f5f9; background:#fafbfc; gap:12px; }
                .pl-modal .form-label-custom { font-size:14px; font-weight:500; color:#4a5568; margin-bottom:8px; }
                .pl-modal .form-control-custom { border:1px solid #cbd5e1; border-radius:10px; padding:12px 16px; font-size:14px; color:inherit; width:100%; transition:border-color .2s,box-shadow .2s; }
                .pl-modal .form-control-custom:focus { outline:none; border-color:#2ece8a; box-shadow:0 0 0 3px rgba(46,206,138,.15); }
                .pl-modal .btn-close-custom { background:#7A70BA !important; color:white !important; border-radius:8px !important; font-weight:500 !important; font-size:14px !important; padding:10px 24px !important; border:none !important; cursor:pointer; }
                .pl-modal .btn-save-custom { background:#2ece8a !important; color:white !important; border-radius:8px !important; font-weight:500 !important; font-size:14px !important; padding:10px 24px !important; border:none !important; cursor:pointer; }

                /* Dark mode overrides */
                [data-theme-version="dark"] .pl-modal .modal-content { background-color: #2F363E !important; }
                [data-theme-version="dark"] .pl-modal .modal-header-custom { border-bottom-color: #3d464e !important; }
                [data-theme-version="dark"] .pl-modal .modal-footer-custom { background-color: #24292D !important; border-top-color: #3d464e !important; }
                [data-theme-version="dark"] .pl-modal .form-label-custom { color: #a0aec0 !important; }
                [data-theme-version="dark"] .pl-modal .form-control-custom { background-color: #24292D !important; border-color: #4a5568 !important; color: #fff !important; }
                [data-theme-version="dark"] .pl-modal .modal-title { color: #fff !important; }
            `}</style>

            <Modal show={show} onHide={onHide} onEntered={handleEntered} centered dialogClassName="pl-modal">
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <i className="fa fa-industry text-white" style={{ fontSize: '20px' }}></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px' }}>
                                {lineId ? 'Edit Product Line' : 'Create Product Line'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Enter product line details</p>
                        </div>
                    </div>
                    <button className="modal-close-x" onClick={onHide}>&times;</button>
                </div>

                <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
                    <div className="modal-body-custom">
                        <Row>
                            <Col md={12}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="form-label-custom">Line Name <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        ref={lineRef}
                                        type="text" className="form-control-custom"
                                        placeholder="e.g. Line A, Line 1"
                                        value={name} onChange={e => setName(e.target.value)}
                                        required
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={12}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="form-label-custom">Description</Form.Label>
                                    <Form.Control
                                        as="textarea" rows={2} className="form-control-custom"
                                        placeholder="Optional description"
                                        value={description} onChange={e => setDescription(e.target.value)}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={12}>
                                <Form.Check
                                    type="switch" id="is-active-pl"
                                    label="Active"
                                    checked={isActive}
                                    onChange={e => setIsActive(e.target.checked)}
                                />
                            </Col>
                        </Row>
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={onHide}>Cancel</Button>
                        <Button type="submit" className="btn-save-custom" disabled={loading}>
                            {loading ? 'Saving...' : (lineId ? 'Update' : 'Save')}
                        </Button>
                    </div>
                </Form>
            </Modal>
        </>
    );
};

// ── List Page ─────────────────────────────────────────────────────────────────
const ProductionLineList = () => {
    usePageTitle('Product Lines');
    const [lines, setLines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedId, setSelectedId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => { fetchLines(); }, []);

    const fetchLines = async () => {
        setLoading(true);
        try {
            const res = await ProductionService.getProductionLines();
            setLines(res.data.results || res.data);
        } catch {
            MainSweetAlert.fire('Error', 'Failed to fetch product lines.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id, name) => {
        const result = await MainSweetAlert.fire({
            title: `Delete "${name}"?`,
            text: 'This action cannot be undone.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });
        if (result.isConfirmed) {
            try {
                await ProductionService.deleteProductionLine(id);
                MainSweetAlert.fire({ icon: 'success', title: 'Deleted', text: 'Production Line deleted successfully', timer: 1500, showConfirmButton: false });
                fetchLines();
            } catch {
                MainSweetAlert.fire('Error', 'Failed to delete product line.', 'error');
            }
        }
    };

    const filtered = lines.filter(l =>
        (l.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const indexOfFirst = (currentPage - 1) * itemsPerPage;
    const indexOfLast = indexOfFirst + itemsPerPage;
    const currentLines = filtered.slice(indexOfFirst, indexOfLast);

    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-12">
                    <Card>
                        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                            <Card.Title>Product Lines</Card.Title>
                            <div className="d-flex flex-wrap align-items-center gap-2">
                                <div style={{ minWidth: '180px', flex: '1 1 200px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text" placeholder="Search Product Line..."
                                        value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                        style={{ height: '34px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                <CreateButton module="product_line" onClick={() => { setSelectedId(null); setShowModal(true); }}>
                                    Create Line
                                </CreateButton>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            {loading ? (
                                <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>
                            ) : (
                                <Table responsive hover className="mb-0">
                                    <thead>
                                        <tr>
                                            <th>SL No</th>
                                            <th>Line Name</th>
                                            <th>Description</th>
                                            <th>Status</th>
                                            <th className="text-end">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.length === 0 ? (
                                            <tr><td colSpan="5" className="text-center py-4 text-muted">No product lines found.</td></tr>
                                        ) : (
                                            currentLines.map((line, i) => (
                                                <tr key={line.id}>
                                                    <td>{indexOfFirst + i + 1}</td>
                                                    <td><strong>{line.name}</strong></td>
                                                    <td>{line.description || '-'}</td>
                                                    <td>
                                                        <span className={`badge badge-${line.is_active ? 'success' : 'secondary'} light`}>
                                                            {line.is_active ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </td>
                                                    <td className="text-end">
                                                        <div className="d-flex justify-content-end" style={{ gap: '8px' }}>
                                                            <EditButton module="product_line" onClick={() => { setSelectedId(line.id); setShowModal(true); }} />
                                                            <DeleteButton module="product_line" onClick={() => handleDelete(line.id, line.name)} />
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </Table>
                            )}

                            {/* Pagination */}
                            {!loading && filtered.length > 0 && (
                                <div className="d-flex justify-content-between align-items-center mt-4 mb-3">
                                    <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirst + 1} to {Math.min(indexOfLast, filtered.length)} of {filtered.length} entries
                                    </div>
                                    {totalPages > 1 && (
                                        <nav>
                                            <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                    <button type="button" className="page-link" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} style={{ border: 'none', background: 'none' }}>
                                                        <i className="la la-angle-left" />
                                                    </button>
                                                </li>
                                                {Array.from({ length: totalPages }, (_, i) => {
                                                    const page = i + 1;
                                                    if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                                                        return (
                                                            <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                                                                <button type="button" className="page-link" onClick={() => setCurrentPage(page)} style={{ border: 'none' }}>{page}</button>
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
                                                    <button type="button" className="page-link" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} style={{ border: 'none', background: 'none' }}>
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

            <ProductionLineFormModal
                show={showModal}
                onHide={() => setShowModal(false)}
                lineId={selectedId}
                onSuccess={fetchLines}
            />
        </div>
    );
};

export default ProductionLineList;
