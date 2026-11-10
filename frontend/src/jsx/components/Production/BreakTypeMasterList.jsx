import React, { Fragment, useState, useEffect, useRef } from 'react';
import { Row, Col, Card, Table, Button, Form, Modal } from 'react-bootstrap';
import ProductionService from '../../../services/ProductionService';
import MainSweetAlert from 'sweetalert2';
import { toast } from 'react-toastify';
import PageTitle from '../../layouts/PageTitle';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';

// ── Form Modal ─────────────────────────────────────────────────────────────────
const BreakTypeFormModal = ({ show, onHide, onSuccess, breakTypeId }) => {
    const [name, setName] = useState('');
    const [durationMinutes, setDurationMinutes] = useState(15);
    const [reduceFromTotalHours, setReduceFromTotalHours] = useState(true);
    const [isActive, setIsActive] = useState(true);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (show) {
            if (breakTypeId) {
                fetchBreakType();
            } else {
                setName('');
                setDurationMinutes(15);
                setReduceFromTotalHours(true);
                setIsActive(true);
            }
        }
    }, [show, breakTypeId]);

    const fetchBreakType = async () => {
        try {
            const response = await ProductionService.getBreakType(breakTypeId);
            const data = response.data;
            setName(data.name);
            setDurationMinutes(data.duration_minutes);
            setReduceFromTotalHours(data.reduce_from_total_hours);
            setIsActive(data.is_active);
        } catch (error) {
            toast.error('Failed to load break type details.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name) {
            MainSweetAlert.fire('Validation', 'Please enter a name.', 'warning');
            return;
        }
        setLoading(true);
        try {
            const payload = { 
                name, 
                duration_minutes: durationMinutes, 
                reduce_from_total_hours: reduceFromTotalHours, 
                is_active: isActive 
            };
            if (breakTypeId) {
                await ProductionService.updateBreakType(breakTypeId, payload);
                MainSweetAlert.fire({ icon: 'success', title: 'Updated', text: 'Break Type updated successfully', timer: 2000, showConfirmButton: false });
            } else {
                await ProductionService.createBreakType(payload);
                MainSweetAlert.fire({ icon: 'success', title: 'Created', text: 'Break Type created successfully', timer: 2000, showConfirmButton: false });
            }
            onSuccess();
            onHide();
        } catch (error) {
            const msg = error.response?.data?.name?.[0] || 'Failed to save break type.';
            MainSweetAlert.fire('Error', msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const nameRef = useRef(null);
    const handleEntered = () => { if (nameRef.current) nameRef.current.focus(); };

    return (
        <>
            <style>{`
                .bt-modal .modal-content { border-radius: 16px !important; border: none !important; box-shadow: 0 10px 40px rgba(0,0,0,0.12) !important; overflow: hidden; }
                .bt-modal .modal-header-custom { display:flex; align-items:center; justify-content:space-between; padding:24px 28px 16px; border-bottom:1px solid #f1f5f9; }
                .bt-modal .modal-icon-circle { width:48px; height:48px; background:#0a500f; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 10px rgba(10, 80, 15,.2); }
                .bt-modal .modal-close-x { border:none; background:transparent; font-size:24px; color:#aaa; cursor:pointer; }
                .bt-modal .modal-close-x:hover { color:#555; }
                .bt-modal .modal-body-custom { padding:24px 28px; }
                .bt-modal .modal-footer-custom { display:flex; justify-content:flex-end; padding:20px 28px 24px; border-top:1px solid #f1f5f9; background:#fafbfc; gap:12px; }
                .bt-modal .form-label-custom { font-size:14px; font-weight:500; color:#4a5568; margin-bottom:8px; }
                .bt-modal .form-control-custom { border:1px solid #cbd5e1; border-radius:10px; padding:12px 16px; font-size:14px; color:inherit; width:100%; transition:border-color .2s,box-shadow .2s; }
                .bt-modal .form-control-custom:focus { outline:none; border-color:#0a500f; box-shadow:0 0 0 3px rgba(10, 80, 15,.15); }
                .bt-modal .btn-close-custom { background:#dc3545 !important; color:white !important; border-radius:8px !important; font-weight:500 !important; font-size:14px !important; padding:10px 24px !important; border:none !important; cursor:pointer; }
                .bt-modal .btn-save-custom { background:#0a500f !important; color:white !important; border-radius:8px !important; font-weight:500 !important; font-size:14px !important; padding:10px 24px !important; border:none !important; cursor:pointer; }
                .bt-modal .reduce-hint { font-size: 12px; color: #64748b; margin-top: 4px; }
                .bt-reduce-box { background: #fffbeb; border: 1px solid #fde68a; }

                /* Dark mode overrides */
                [data-theme-version="dark"] .bt-modal .modal-content { background-color: #2F363E !important; }
                [data-theme-version="dark"] .bt-modal .modal-header-custom { border-bottom-color: #3d464e !important; }
                [data-theme-version="dark"] .bt-modal .modal-footer-custom { background-color: #24292D !important; border-top-color: #3d464e !important; }
                [data-theme-version="dark"] .bt-modal .form-label-custom { color: #a0aec0 !important; }
                [data-theme-version="dark"] .bt-modal .form-control-custom { background-color: #24292D !important; border-color: #4a5568 !important; color: #fff !important; }
                [data-theme-version="dark"] .bt-modal .modal-title { color: #fff !important; }
                [data-theme-version="dark"] .bt-reduce-box { background: #24292D !important; border-color: #4a5568 !important; }
                [data-theme-version="dark"] .bt-modal .reduce-hint { color: #a0aec0 !important; }
            `}</style>

            <Modal show={show} onHide={onHide} onEntered={handleEntered} centered dialogClassName="bt-modal">
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <i className="fa fa-coffee text-white" style={{ fontSize: '20px' }}></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px' }}>
                                {breakTypeId ? 'Edit Break Type' : 'Create Break Type'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Configure break type settings</p>
                        </div>
                    </div>
                    <button className="modal-close-x" onClick={onHide}>&times;</button>
                </div>

                <Form onSubmit={handleSubmit}>
                    <div className="modal-body-custom">
                        <Row>
                            <Col md={12}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="form-label-custom">Break Name <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        ref={nameRef}
                                        type="text" className="form-control-custom"
                                        placeholder="e.g. Lunch Break, Tea Break"
                                        value={name} onChange={e => setName(e.target.value)}
                                        required
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={12}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="form-label-custom">Duration (minutes)</Form.Label>
                                    <Form.Control
                                        type="number" min="0" className="form-control-custom"
                                        value={durationMinutes} onChange={e => setDurationMinutes(parseInt(e.target.value) || 0)}
                                        required
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={12}>
                                <Form.Group className="mb-3">
                                    <div className="p-3 rounded bt-reduce-box">
                                        <Form.Check
                                            type="checkbox" id="reduce-hours"
                                            label={<strong>Reduce from Total Worked Hours</strong>}
                                            checked={reduceFromTotalHours}
                                            onChange={e => setReduceFromTotalHours(e.target.checked)}
                                        />
                                        <p className="reduce-hint mb-0 mt-1">
                                            If checked, this break's duration will be deducted from the employee's net worked hours.
                                        </p>
                                    </div>
                                </Form.Group>
                            </Col>
                            <Col md={12}>
                                <Form.Check
                                    type="switch" id="is-active-bt"
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
                            {loading ? 'Saving...' : (breakTypeId ? 'Update' : 'Save')}
                        </Button>
                    </div>
                </Form>
            </Modal>
        </>
    );
};

// ── List Page ─────────────────────────────────────────────────────────────────
const BreakTypeMasterList = () => {
    const [breakTypes, setBreakTypes] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        fetchBreakTypes();
    }, []);

    const fetchBreakTypes = async () => {
        try {
            const response = await ProductionService.getBreakTypes();
            setBreakTypes(response.data);
        } catch (error) {
            toast.error('Failed to fetch break types.');
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
                await ProductionService.deleteBreakType(id);
                MainSweetAlert.fire({ icon: 'success', title: 'Deleted', text: 'Break Type deleted successfully', timer: 1500, showConfirmButton: false });
                fetchBreakTypes();
            } catch {
                MainSweetAlert.fire('Error', 'Failed to delete break type. It may be in use.', 'error');
            }
        }
    };

    const filtered = breakTypes.filter(bt =>
        (bt.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const indexOfFirst = (currentPage - 1) * itemsPerPage;
    const indexOfLast = indexOfFirst + itemsPerPage;
    const currentBreakTypes = filtered.slice(indexOfFirst, indexOfLast);

    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <Card.Title>Break Types</Card.Title>
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                <div style={{ width: '240px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text" placeholder="Search Break Types..."
                                        value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                        style={{ height: '34px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                <CreateButton module="break_type" onClick={() => { setEditId(null); setShowModal(true); }}>
                                    Create Break Type
                                </CreateButton>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            <Table responsive hover className="mb-0">
                                <thead>
                                    <tr>
                                        <th>SL No</th>
                                        <th>Break Name</th>
                                        <th>Duration</th>
                                        <th>Reduces Worked Hours</th>
                                        <th>Status</th>
                                        <th className="text-end">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr><td colSpan="6" className="text-center py-4 text-muted">No break types found.</td></tr>
                                    ) : (
                                        currentBreakTypes.map((bt, i) => (
                                            <tr key={bt.id}>
                                                <td>{indexOfFirst + i + 1}</td>
                                                <td><strong>{bt.name}</strong></td>
                                                <td>{bt.duration_minutes} mins</td>
                                                <td>{bt.reduce_from_total_hours ? 'Yes' : 'No'}</td>
                                                <td>
                                                    <span className={`badge badge-${bt.is_active ? 'success' : 'secondary'} light`}>
                                                        {bt.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="text-end">
                                                    <div className="d-flex justify-content-end" style={{ gap: '8px' }}>
                                                        <EditButton module="break_type" onClick={() => { setEditId(bt.id); setShowModal(true); }} />
                                                        <DeleteButton module="break_type" onClick={() => handleDelete(bt.id, bt.name)} />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </Table>

                            {/* Pagination */}
                            {filtered.length > 0 && (
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

            <BreakTypeFormModal 
                show={showModal} 
                onHide={() => setShowModal(false)} 
                breakTypeId={editId}
                onSuccess={fetchBreakTypes}
            />
        </div>
    );
};

export default BreakTypeMasterList;
