import React, { useState, useEffect, Fragment } from 'react';
import { Card, Button, Modal, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    getProcessNames,
    createProcessName,
    updateProcessName,
    deleteProcessName,
} from '../../../services/MachineManagementService';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import { usePermission } from '../../../hooks/usePermission';
import { useEnterTraversal } from '../../../hooks/useEnterTraversal';
import { useFormConfig } from '../../../hooks/useFormConfig';

const ProcessNameList = () => {
    const [processNames, setProcessNames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;
    const { can } = usePermission();
    const { handleFormKeyDown } = useEnterTraversal('.sgfm-modal');
    const { isFieldVisible } = useFormConfig('machine_app_processname', 'ProcessNameList');

    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [animateTrigger, setAnimateTrigger] = useState(false);
    const [current, setCurrent] = useState({ id: null, processname: '' });

    useEffect(() => { setCurrentPage(1); }, [searchTerm]);
    useEffect(() => { fetchData(); }, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && showModal) {
                setAnimateTrigger(true);
                setTimeout(() => setAnimateTrigger(false), 300);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showModal]);

    useEffect(() => {
        if (showModal) {
            const timer = setTimeout(() => {
                const input = document.querySelector('.sgfm-modal input:not([disabled]):not([readonly])');
                if (input) input.focus();
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [showModal]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getProcessNames();
            setProcessNames(data);
        } catch {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to fetch process names' });
        } finally {
            setLoading(false);
        }
    };

    const handleShowModal = (obj = null) => {
        if (obj) {
            setCurrent({ id: obj.id, processname: obj.processname || '' });
            setEditMode(true);
        } else {
            setCurrent({ id: null, processname: '' });
            setEditMode(false);
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isFieldVisible('processname') && !current.processname.trim()) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Process Name is required' });
            return;
        }
        try {
            const payload = { processname: current.processname.trim() };
            if (editMode && current.id) {
                await updateProcessName(current.id, payload);
                Swal.fire({ icon: 'success', title: 'Updated', text: 'Process name updated successfully', timer: 2000, showConfirmButton: false });
            } else {
                await createProcessName(payload);
                Swal.fire({ icon: 'success', title: 'Created', text: 'Process name created successfully', timer: 2000, showConfirmButton: false });
            }
            setShowModal(false);
            fetchData();
        } catch (error) {
            let errorMsg = 'Failed to save process name';
            if (error.response?.data) {
                const keys = Object.keys(error.response.data);
                if (keys.length > 0) errorMsg = `${keys[0].toUpperCase()}: ${error.response.data[keys[0]][0]}`;
            }
            Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
        }
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Process Name?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it',
        });
        if (result.isConfirmed) {
            try {
                await deleteProcessName(id);
                Swal.fire({ icon: 'success', title: 'Deleted', text: 'Process name deleted successfully', timer: 2000, showConfirmButton: false });
                fetchData();
            } catch {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete. It may be referenced by other records.' });
            }
        }
    };

    const filtered = processNames.filter(item =>
        (item.processname || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filtered.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filtered.length / itemsPerPage);

    return (
        <Fragment>
            <style>{`
                .sgfm-modal .modal-content { border-radius: 16px !important; border: none !important; box-shadow: 0 10px 40px rgba(0,0,0,0.12) !important; overflow: hidden; }
                .sgfm-modal .modal-header-custom { display: flex; align-items: center; justify-content: space-between; padding: 24px 28px 16px 28px; border-bottom: 1px solid #f1f5f9; }
                .sgfm-modal .modal-icon-circle { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background-color: #2ece8a; box-shadow: 0 4px 10px rgba(46,206,138,0.2); }
                .sgfm-modal .modal-close-x { border: none; background: transparent; font-size: 24px; color: #aaa; cursor: pointer; transition: color 0.2s; display: flex; align-items: center; justify-content: center; padding: 4px; }
                .sgfm-modal .modal-close-x:hover { color: #555; }
                .sgfm-modal .modal-body-custom { padding: 24px 28px; }
                .sgfm-modal .modal-footer-custom { display: flex; align-items: center; justify-content: flex-end; padding: 20px 28px 24px 28px; border-top: 1px solid #f1f5f9; background-color: #fafbfc; gap: 12px; }
                .sgfm-modal .form-label-custom { font-size: 14px; font-weight: 500; color: #4a5568; margin-bottom: 8px; }
                .sgfm-modal .form-control-custom { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px 16px; font-size: 14px; color: #334155; background-color: #fff; transition: border-color 0.2s, box-shadow 0.2s; width: 100%; }
                .sgfm-modal .form-control-custom:focus { outline: none; border-color: #2ece8a; box-shadow: 0 0 0 3px rgba(46,206,138,0.15); }
                .sgfm-modal .form-control-custom::placeholder { color: #94a3b8; }
                .sgfm-modal .btn-close-custom { background-color: #7A70BA !important; color: white !important; border-radius: 8px !important; font-weight: 500 !important; font-size: 14px !important; padding: 10px 24px !important; border: none !important; cursor: pointer; transition: background-color 0.2s; }
                .sgfm-modal .btn-close-custom:hover { background-color: #6357a7 !important; }
                .sgfm-modal .btn-save-custom { background-color: #2ece8a !important; color: white !important; border-radius: 8px !important; font-weight: 500 !important; font-size: 14px !important; padding: 10px 24px !important; border: none !important; cursor: pointer; transition: background-color 0.2s; }
                .sgfm-modal .btn-save-custom:hover { background-color: #26b277 !important; }
                @keyframes modalFeedback { 0%, 100% { transform: scale(1); } 20%, 60% { transform: scale(0.99) translateX(-4px); } 40%, 80% { transform: scale(1.01) translateX(4px); } }
                .modal-feedback { animation: modalFeedback 0.25s ease-in-out !important; }
            `}</style>

            {/* <div className="page-titles">
                <button onClick={() => window.history.back()} className="btn btn-outline-primary btn-sm d-flex align-items-center" style={{ gap: '6px', borderRadius: '6px' }}>
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div> */}

            <div className="container-fluid">
                <div className="row">
                    <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center">
                            <Card.Title className="mb-0">Process Name Management</Card.Title>
                            <div className="d-flex align-items-center gap-2">
                                <div style={{ width: '300px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Process Name..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                
                                <CreateButton module="Processes" onClick={() => handleShowModal()}>
                                    Process Name
                                </CreateButton>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            {loading ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-responsive-md">
                                        <thead>
                                            <tr>
                                                <th><strong>SL.NO</strong></th>
                                                <th><strong>PROCESS NAME</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentItems.length > 0 ? currentItems.map((item, idx) => (
                                                <tr key={item.id}>
                                                    <td>{indexOfFirstItem + idx + 1}</td>
                                                    <td><strong>{item.processname}</strong></td>
                                                    <td className="text-end">
                                                        {can('spareparts', 'edit') || can('spareparts', 'delete') ? (
                                                            <div className="d-flex justify-content-end">
                                                                <EditButton module="Processes" onClick={() => handleShowModal(item)} className="me-1" />
                                                                <DeleteButton module="Processes" onClick={() => handleDelete(item.id, item.processname)} />
                                                            </div>
                                                        ) : (
                                                            <span className="badge badge-danger light mt-1">No Access</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr><td colSpan="3" className="text-center py-4 text-muted">No entries found</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {!loading && filtered.length > 0 && (
                                <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                    <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filtered.length)} of {filtered.length} entries
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
                                                const p = i + 1;
                                                if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
                                                    return <li key={p} className={`page-item ${currentPage === p ? 'active' : ''}`}><button type="button" className="page-link" onClick={() => setCurrentPage(p)} style={{ border: 'none' }}>{p}</button></li>;
                                                } else if (p === currentPage - 2 || p === currentPage + 2) {
                                                    return <li key={p} className="page-item disabled"><span className="page-link" style={{ border: 'none', background: 'none' }}>...</span></li>;
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
            </div>

            {/* Modal */}
            <Modal show={showModal} onHide={() => setShowModal(false)} dialogClassName={`sgfm-modal modal-md ${animateTrigger ? 'modal-feedback' : ''}`} backdrop="static" keyboard={false} centered>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editMode ? 'Edit Process Name' : 'Add Process Name'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Define an independent process for machine operations</p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowModal(false)}>&times;</button>
                </div>
                <Form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown}>
                    <div className="modal-body-custom">
                        {isFieldVisible('processname') && (
                            <div className="col-md-12 mb-3">
                                <Form.Label className="form-label-custom">Process Name <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    autoFocus
                                    type="text"
                                    className="form-control-custom"
                                    placeholder="e.g. Welding, Grinding, Assembly"
                                    value={current.processname}
                                    onChange={(e) => setCurrent({ ...current, processname: e.target.value })}
                                    required
                                />
                            </div>
                        )}
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={() => setShowModal(false)}>Close</Button>
                        <Button type="submit" className="btn-save-custom">{editMode ? 'Save Changes' : 'Create'}</Button>
                    </div>
                </Form>
            </Modal>
        </Fragment>
    );
};

export default ProcessNameList;