import React, { useState, useEffect, Fragment, useRef } from 'react';
import { Card, Table, Spinner, Form, Modal, Row, Col, Button } from 'react-bootstrap';
import Select from 'react-select';
import MainSweetAlert from 'sweetalert2';
import ProductionService from '../../../services/ProductionService';
import PageTitle from '../../layouts/PageTitle';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';

// ── Inline Modal Form ────────────────────────────────────────────────────────
const ShiftFormModal = ({ show, onHide, shiftId, onSuccess, factories, breakTypes }) => {
    const [name, setName] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [factoryId, setFactoryId] = useState('');
    const [allowedBreakTypes, setAllowedBreakTypes] = useState([]);
    const [loading, setLoading] = useState(false);

    const factoryRef = useRef(null);

    useEffect(() => {
        if (show) {
            if (shiftId) {
                ProductionService.getShift(shiftId).then(res => {
                    setName(res.data.name);
                    setStartTime(res.data.start_time);
                    setEndTime(res.data.end_time);
                    setIsActive(res.data.is_active);
                    setFactoryId(res.data.factory || '');
                    setAllowedBreakTypes(res.data.allowed_break_types || []);
                });
            } else {
                setName(''); setStartTime(''); setEndTime(''); setIsActive(true); setFactoryId(''); setAllowedBreakTypes([]);
            }
        }
    }, [show, shiftId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name || !startTime || !endTime || !factoryId) {
            MainSweetAlert.fire('Validation', 'Please fill all required fields including Factory.', 'warning');
            return;
        }
        setLoading(true);
        try {
            const payload = { name, start_time: startTime, end_time: endTime, is_active: isActive, factory: factoryId, allowed_break_types: allowedBreakTypes };
            if (shiftId) {
                await ProductionService.updateShift(shiftId, payload);
                MainSweetAlert.fire({ icon: 'success', title: 'Updated', text: 'Shift updated successfully', timer: 2000, showConfirmButton: false });
            } else {
                await ProductionService.createShift(payload);
                MainSweetAlert.fire({ icon: 'success', title: 'Created', text: 'Shift created successfully', timer: 2000, showConfirmButton: false });
            }
            onSuccess();
            onHide();
        } catch (error) {
            const msg = error.response?.data?.name?.[0] || 'Failed to save shift.';
            MainSweetAlert.fire('Error', msg, 'error');
        } finally {
            setLoading(false);
        }
    };

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
        if (factoryRef.current) {
            factoryRef.current.focus();
            try {
                if (typeof factoryRef.current.showPicker === 'function') {
                    factoryRef.current.showPicker();
                }
            } catch (error) {
                console.warn("showPicker is not supported in this browser");
            }
        }
    };

    return (
        <>
            <style>{`
                .shift-modal .modal-content { border-radius: 16px !important; border: none !important; box-shadow: 0 10px 40px rgba(0,0,0,0.12) !important; overflow: hidden; }
                .shift-modal .modal-header-custom { display:flex; align-items:center; justify-content:space-between; padding:24px 28px 16px; border-bottom:1px solid #f1f5f9; }
                .shift-modal .modal-icon-circle { width:48px; height:48px; background:var(--form-icon-color, #0a500f); border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 10px rgba(10, 80, 15,.2); }
                .shift-modal .modal-close-x { border:none; background:transparent; font-size:24px; color:#aaa; cursor:pointer; transition:color .2s; }
                .shift-modal .modal-close-x:hover { color:#555; }
                .shift-modal .modal-body-custom { padding:24px 28px; }
                .shift-modal .modal-footer-custom { display:flex; justify-content:flex-end; padding:20px 28px 24px; border-top:1px solid #f1f5f9; background:#fafbfc; gap:12px; }
                .shift-modal .form-label-custom { font-size:14px; font-weight:500; color:#4a5568; margin-bottom:8px; }
                .shift-modal .form-control-custom { border:1px solid #cbd5e1; border-radius:10px; padding:12px 16px; font-size:14px; color:inherit; width:100%; transition:border-color .2s,box-shadow .2s; }
                .shift-modal .form-control-custom:focus { outline:none; border-color:#0a500f; box-shadow:0 0 0 3px rgba(10, 80, 15,.15); }
                .shift-modal .btn-close-custom { background-color: var(--cancel-btn-color, #dc3545) !important; color:white !important; border-radius:8px !important; font-weight:500 !important; font-size:14px !important; padding:10px 24px !important; border:none !important; cursor:pointer; }
                .shift-modal .btn-save-custom { background:var(--save-btn-color, #0a500f) !important; color:white !important; border-radius:8px !important; font-weight:500 !important; font-size:14px !important; padding:10px 24px !important; border:none !important; cursor:pointer; }
                .shift-break-box { max-height: 150px; overflow-y: auto; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px 16px; background-color: #ffffff; }

                /* Dark mode overrides */
                [data-theme-version="dark"] .shift-modal .modal-content { background-color: #2F363E !important; }
                [data-theme-version="dark"] .shift-modal .modal-header-custom { border-bottom-color: #3d464e !important; }
                [data-theme-version="dark"] .shift-modal .modal-footer-custom { background-color: #24292D !important; border-top-color: #3d464e !important; }
                [data-theme-version="dark"] .shift-modal .form-label-custom { color: #a0aec0 !important; }
                [data-theme-version="dark"] .shift-modal .form-control-custom { background-color: #24292D !important; border-color: #4a5568 !important; color: #fff !important; }
                [data-theme-version="dark"] .shift-modal .modal-title { color: #fff !important; }
                [data-theme-version="dark"] .shift-break-box { background-color: #24292D !important; border-color: #4a5568 !important; }
            `}</style>

            <Modal show={show} onHide={onHide} onEntered={handleEntered} centered dialogClassName="shift-modal">
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <i className="fa fa-clock text-white" style={{ fontSize: '20px' }}></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px' }}>
                                {shiftId ? 'Edit Shift' : 'Create Shift'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Enter shift details</p>
                        </div>
                    </div>
                    <button className="modal-close-x" onClick={onHide}>&times;</button>
                </div>

                <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
                    <div className="modal-body-custom">
                        <Row>
                            <Col md={12}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="form-label-custom">Factory <span className="text-danger">*</span></Form.Label>
                                    <Form.Select
                                        ref={factoryRef}
                                        className="form-control-custom"
                                        value={factoryId}
                                        onChange={e => setFactoryId(e.target.value)}
                                        required
                                    >
                                        <option value="">Select Factory...</option>
                                        {factories.map(f => (
                                            <option key={f.id} value={f.id}>{f.name}</option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={12}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="form-label-custom">Shift Name <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="text" className="form-control-custom"
                                        placeholder="e.g. Morning Shift"
                                        value={name} onChange={e => setName(e.target.value)}
                                        required
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="form-label-custom">Start Time <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="time" className="form-control-custom"
                                        value={startTime} onChange={e => setStartTime(e.target.value)} required
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="form-label-custom">End Time <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="time" className="form-control-custom"
                                        value={endTime} onChange={e => setEndTime(e.target.value)} required
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={12}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="form-label-custom">Allowed Break Types</Form.Label>
                                    <div className="shift-break-box">
                                        {breakTypes.map(bt => (
                                            <Form.Check
                                                key={bt.id}
                                                type="checkbox"
                                                id={`bt-${bt.id}`}
                                                label={bt.name}
                                                checked={allowedBreakTypes.includes(bt.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setAllowedBreakTypes([...allowedBreakTypes, bt.id]);
                                                    } else {
                                                        setAllowedBreakTypes(allowedBreakTypes.filter(id => id !== bt.id));
                                                    }
                                                }}
                                            />
                                        ))}
                                        {breakTypes.length === 0 && <span className="text-muted" style={{ fontSize: '13px' }}>No break types available</span>}
                                    </div>
                                </Form.Group>
                            </Col>
                            <Col md={12}>
                                <Form.Check
                                    type="switch" id="is-active-shift"
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
                            {loading ? 'Saving...' : (shiftId ? 'Update' : 'Save')}
                        </Button>
                    </div>
                </Form>
            </Modal>
        </>
    );
};

// ── List Page ─────────────────────────────────────────────────────────────────
const ShiftList = () => {
    const [shifts, setShifts] = useState([]);
    const [factories, setFactories] = useState([]);
    const [breakTypes, setBreakTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedId, setSelectedId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterFactory, setFilterFactory] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        fetchFactories();
        fetchBreakTypes();
    }, []);

    useEffect(() => {
        fetchShifts();
    }, [filterFactory]);

    const fetchFactories = async () => {
        try {
            const res = await ProductionService.getFactories();
            setFactories(res.data.results || res.data);
        } catch {
            console.error('Failed to fetch factories');
        }
    };

    const fetchBreakTypes = async () => {
        try {
            const res = await ProductionService.getBreakTypes();
            setBreakTypes(res.data.results || res.data);
        } catch {
            console.error('Failed to fetch break types');
        }
    };

    const fetchShifts = async () => {
        setLoading(true);
        try {
            const params = filterFactory ? `?factory_id=${filterFactory}` : '';
            const res = await ProductionService.getShifts(params);
            setShifts(res.data.results || res.data);
        } catch {
            MainSweetAlert.fire('Error', 'Failed to fetch shifts.', 'error');
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
                await ProductionService.deleteShift(id);
                MainSweetAlert.fire({ icon: 'success', title: 'Deleted', text: 'Shift deleted successfully', timer: 1500, showConfirmButton: false });
                fetchShifts();
            } catch {
                MainSweetAlert.fire('Error', 'Failed to delete shift.', 'error');
            }
        }
    };

    const getFactoryName = (shift) => {
        if (shift.factory_name) return shift.factory_name;
        const found = factories.find(f => String(f.id) === String(shift.factory));
        return found ? found.name : 'Unassigned Factory';
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterFactory]);

    const filteredShifts = shifts
        .filter(s => {
            const fName = getFactoryName(s);
            const matchSearch = (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                fName.toLowerCase().includes(searchTerm.toLowerCase());
            const matchFactory = filterFactory ? String(s.factory) === String(filterFactory) : true;
            return matchSearch && matchFactory;
        })
        .sort((a, b) => {
            const factoryA = getFactoryName(a).toLowerCase();
            const factoryB = getFactoryName(b).toLowerCase();
            if (factoryA < factoryB) return -1;
            if (factoryA > factoryB) return 1;
            return (a.start_time || '').localeCompare(b.start_time || '');
        });

    const totalPages = Math.ceil(filteredShifts.length / itemsPerPage);
    const indexOfFirst = (currentPage - 1) * itemsPerPage;
    const indexOfLast = indexOfFirst + itemsPerPage;
    const currentShifts = filteredShifts.slice(indexOfFirst, indexOfLast);

    const formatTime = (t) => {
        if (!t) return '-';
        const [h, m] = t.split(':');
        const hour = parseInt(h, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        return `${hour % 12 || 12}:${m} ${ampm}`;
    };

    return (
        <div className="container-fluid">
            <style>{`
                .shift-factory-row {
                    background-color: #f8fafc !important;
                }
                [data-theme-version="dark"] .shift-factory-row,
                [data-theme-version="dark"] .shift-factory-row td {
                    background-color: #24292D !important;
                    color: #fff !important;
                }
            `}</style>
            <div className="row">
                <div className="col-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <Card.Title>Shift List</Card.Title>
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                {/* Factory Filter */}
                                <div style={{ flex: '0 0 auto', minWidth: '180px' }}>
                                    <Form.Select
                                        value={filterFactory}
                                        onChange={e => {
                                            setFilterFactory(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        style={{ height: '38px', borderRadius: '6px', fontSize: '13px' }}
                                    >
                                        <option value="">All Factories</option>
                                        {factories.map(f => (
                                            <option key={f.id} value={f.id}>{f.name}</option>
                                        ))}
                                    </Form.Select>
                                </div>

                                {/* Search */}
                                <div style={{ flex: '1 1 auto', minWidth: '200px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search shifts..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>

                                <CreateButton module="shift" onClick={() => { setSelectedId(null); setShowModal(true); }}>
                                    Shift
                                </CreateButton>
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
                                    <table className="table table-responsive-md">
                                        <thead>
                                            <tr>
                                                <th><strong>FACTORY</strong></th>
                                                <th><strong>SHIFT NAME</strong></th>
                                                <th><strong>START TIME</strong></th>
                                                <th><strong>END TIME</strong></th>
                                                <th><strong>ALLOWED BREAKS</strong></th>
                                                <th><strong>STATUS</strong></th>
                                                <th className="text-end"><strong>ACTION</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredShifts.length === 0 ? (
                                                <tr>
                                                    <td colSpan="7" className="text-center py-4 text-muted">No shifts found.</td>
                                                </tr>
                                            ) : (
                                                Object.entries(
                                                    currentShifts.reduce((acc, shift) => {
                                                        const fName = getFactoryName(shift);
                                                        if (!acc[fName]) acc[fName] = [];
                                                        acc[fName].push(shift);
                                                        return acc;
                                                    }, {})
                                                ).map(([factoryName, items]) => (
                                                    <Fragment key={factoryName}>
                                                        <tr className="bg-light shift-factory-row">
                                                            <td colSpan="7">
                                                                <strong>
                                                                    <i className="fa fa-industry text-primary me-2"></i>
                                                                    {factoryName}
                                                                </strong>
                                                            </td>
                                                        </tr>
                                                        {items.map(shift => (
                                                            <tr key={shift.id}>
                                                                <td></td>
                                                                <td>
                                                                    <i className="fa fa-level-up-alt fa-rotate-90 text-muted me-2 ms-2"></i>
                                                                    <strong>{shift.name}</strong>
                                                                </td>
                                                                <td>{formatTime(shift.start_time)}</td>
                                                                <td>{formatTime(shift.end_time)}</td>
                                                                <td>
                                                                    {shift.allowed_break_types && shift.allowed_break_types.length > 0 ? (
                                                                        <div className="d-flex flex-wrap gap-1">
                                                                            {shift.allowed_break_types.map(btId => {
                                                                                const bt = breakTypes.find(b => b.id === btId);
                                                                                return bt ? (
                                                                                    <span key={btId} className="badge badge-light border text-dark font-w500" style={{ fontSize: '11px' }}>
                                                                                        {bt.name}
                                                                                    </span>
                                                                                ) : null;
                                                                            })}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-muted small">—</span>
                                                                    )}
                                                                </td>
                                                                <td>
                                                                    <span className={`badge badge-${shift.is_active ? 'success' : 'secondary'} light`}>
                                                                        {shift.is_active ? 'Active' : 'Inactive'}
                                                                    </span>
                                                                </td>
                                                                <td className="text-end">
                                                                    <div className="d-flex justify-content-end gap-1">
                                                                        <EditButton module="shift" onClick={() => { setSelectedId(shift.id); setShowModal(true); }} />
                                                                        <DeleteButton module="shift" onClick={() => handleDelete(shift.id, shift.name)} />
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </Fragment>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Pagination */}
                            {!loading && filteredShifts.length > 0 && (
                                <div className="d-flex justify-content-between align-items-center mt-4 mb-3">
                                    <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirst + 1} to {Math.min(indexOfLast, filteredShifts.length)} of {filteredShifts.length} entries
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

            <ShiftFormModal
                show={showModal}
                onHide={() => setShowModal(false)}
                shiftId={selectedId}
                onSuccess={fetchShifts}
                factories={factories}
                breakTypes={breakTypes}
            />
        </div>
    );
};

export default ShiftList;
