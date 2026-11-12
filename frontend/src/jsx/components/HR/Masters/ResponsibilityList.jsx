import React, { useState, useEffect, Fragment } from 'react';
import { Card, Button, Modal, Form } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import {
    getResponsibilities,
    createResponsibility,
    updateResponsibility,
    deleteResponsibility,
    getDutyNames
} from '../../../../services/HRManagementService';
import { usePermission } from '../../../../hooks/usePermission';
import CreateButton from '../../../../components/permissions/CreateButton';
import EditButton from '../../../../components/permissions/EditButton';
import DeleteButton from '../../../../components/permissions/DeleteButton';
import { useEnterTraversal } from '../../../../hooks/useEnterTraversal';

const EMPTY_RESPONSIBILITY = {
    id: null,
    name: '',
    dutyname: '',
    remarks: ''
};

const ResponsibilityList = () => {
    const [responsibilities, setResponsibilities] = useState([]);
    const [duties, setDuties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [current, setCurrent] = useState({ ...EMPTY_RESPONSIBILITY });
    const { can } = usePermission();
    
    const { handleFormKeyDown, handleSelectFocus, handleSelectKeyDown, makeSelectChange } = useEnterTraversal('.sgfm-modal', setCurrent);

    useEffect(() => {
        fetchData();
        fetchDuties();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getResponsibilities();
            setResponsibilities(data.results || data);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to fetch responsibilities.' });
        } finally {
            setLoading(false);
        }
    };

    const fetchDuties = async () => {
        try {
            const data = await getDutyNames();
            setDuties(data.results || data);
        } catch (error) {
            console.error('Failed to fetch duties', error);
        }
    };

    const handleShowModal = (responsibility = null) => {
        if (responsibility) {
            setCurrent({ ...responsibility });
            setEditMode(true);
        } else {
            setCurrent({ ...EMPTY_RESPONSIBILITY });
            setEditMode(false);
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setCurrent({ ...EMPTY_RESPONSIBILITY });
        setEditMode(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editMode && current.id) {
                await updateResponsibility(current.id, current);
                Swal.fire({ icon: 'success', title: 'Success', text: 'Responsibility updated successfully!' });
            } else {
                await createResponsibility(current);
                Swal.fire({ icon: 'success', title: 'Success', text: 'Responsibility created successfully!' });
            }
            handleCloseModal();
            fetchData();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.message || 'Failed to save responsibility.' });
        }
    };

    const handleDelete = async (id) => {
        try {
            const result = await Swal.fire({
                title: 'Are you sure?',
                text: "You won't be able to revert this!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, delete it!'
            });

            if (result.isConfirmed) {
                await deleteResponsibility(id);
                Swal.fire('Deleted!', 'Responsibility has been deleted.', 'success');
                fetchData();
            }
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete responsibility.' });
        }
    };

    // Filter data
    const filteredResponsibilities = responsibilities.filter(resp => {
        const term = searchTerm.toLowerCase();
        return (resp.name || '').toLowerCase().includes(term) ||
               (resp.dutyname_name || '').toLowerCase().includes(term) ||
               (resp.remark || '').toLowerCase().includes(term);
    });

    return (
        <div className="container-fluid">
            <style>{`
                .sgfm-modal .modal-content { border-radius: 16px !important; border: none !important; box-shadow: 0 10px 40px rgba(0,0,0,0.12) !important; overflow: hidden; }
                .sgfm-modal .modal-header-custom { display: flex; align-items: center; justify-content: space-between; padding: 24px 28px 16px 28px; border-bottom: 1px solid #f1f5f9; }
                .sgfm-modal .modal-icon-circle { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background-color: var(--form-icon-color, #0a500f); box-shadow: 0 4px 10px rgba(10, 80, 15,0.2); }
                .sgfm-modal .modal-close-x { border: none; background: transparent; font-size: 24px; color: #aaa; cursor: pointer; transition: color 0.2s; display: flex; align-items: center; justify-content: center; padding: 4px; }
                .sgfm-modal .modal-close-x:hover { color: #555; }
                .sgfm-modal .modal-body-custom { padding: 24px 28px; }
                .sgfm-modal .modal-footer-custom { display: flex; align-items: center; justify-content: flex-end; padding: 20px 28px 24px 28px; border-top: 1px solid #f1f5f9; background-color: #fafbfc; gap: 12px; }
                .sgfm-modal .form-label-custom { font-size: 14px; font-weight: 500; color: #4a5568; margin-bottom: 8px; }
                .sgfm-modal .form-control-custom { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px 16px; font-size: 14px; color: #334155; background-color: #fff; transition: border-color 0.2s, box-shadow 0.2s; width: 100%; }
                .sgfm-modal .form-control-custom:focus { outline: none; border-color: #0a500f; box-shadow: 0 0 0 3px rgba(10, 80, 15,0.15); }
                .sgfm-modal .form-control-custom::placeholder { color: #94a3b8; }
                .sgfm-modal .btn-close-custom { background-color: var(--cancel-btn-color, #dc3545) !important; color: white !important; border-radius: 8px !important; font-weight: 500 !important; font-size: 14px !important; padding: 10px 24px !important; border: none !important; cursor: pointer; transition: background-color 0.2s; }
                .sgfm-modal .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .sgfm-modal .btn-save-custom { background-color: var(--save-btn-color, #0a500f) !important; color: white !important; border-radius: 8px !important; font-weight: 500 !important; font-size: 14px !important; padding: 10px 24px !important; border: none !important; cursor: pointer; transition: background-color 0.2s; }
                .sgfm-modal .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }
                @keyframes modalFeedback { 0%, 100% { transform: scale(1); } 20%, 60% { transform: scale(0.99) translateX(-4px); } 40%, 80% { transform: scale(1.01) translateX(4px); } }
                .modal-feedback { animation: modalFeedback 0.25s ease-in-out !important; }
            `}</style>
            {/* <div className="page-titles">
                <button 
                    className="btn btn-outline-primary btn-sm d-flex align-items-center" 
                    onClick={() => window.history.back()} 
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div> */}
            <div className="row">
                <div className="col-xl-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between flex-wrap">
                            <div>
                                <h4 className="fs-20 mb-1">Responsibility Management</h4>
                            </div>
                            <div className="d-flex align-items-center mb-2">
                                <Form.Control
                                    type="text"
                                    placeholder="Search..."
                                    className="me-2"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ width: '250px' }}
                                />
                                <CreateButton
                                    module="responsibilities"
                                    onClick={() => handleShowModal()}
                                >
                                    Add Responsibility
                                </CreateButton>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            {loading ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="sr-only">Loading...</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-responsive-md table-hover">
                                        <thead>
                                            <tr>
                                                <th><strong>S.No.</strong></th>
                                                <th><strong>Responsibility</strong></th>
                                                <th><strong>Duty Name</strong></th>
                                                <th><strong>Remarks</strong></th>
                                                <th><strong>Action</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredResponsibilities.length > 0 ? filteredResponsibilities.map((resp, index) => (
                                                <tr key={resp.id}>
                                                    <td><strong>{index + 1}</strong></td>
                                                    <td>{resp.name}</td>
                                                    <td>{resp.dutyname_name || '-'}</td>
                                                    <td>{resp.remarks || '-'}</td>
                                                    <td>
                                                        <div className="d-flex gap-2">
                                                            <EditButton
                                                                module="responsibilities"
                                                                onClick={() => handleShowModal(resp)}
                                                            />
                                                            <DeleteButton
                                                                module="responsibilities"
                                                                onClick={() => handleDelete(resp.id)}
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan="5" className="text-center">No responsibilities found</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>

            <Modal show={showModal} onHide={handleCloseModal} dialogClassName="sgfm-modal modal-md" backdrop="static" keyboard={false} centered>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 10h16M4 14h10M4 18h6" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editMode ? 'Edit Responsibility' : 'Add Responsibility'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Define the responsibility details</p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={handleCloseModal}>&times;</button>
                </div>
                <Form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown}>
                    <div className="modal-body-custom">
                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Responsibility Name <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                type="text"
                                className="form-control-custom"
                                value={current.name}
                                onChange={(e) => setCurrent({ ...current, name: e.target.value })}
                                required
                                autoFocus
                            />
                        </div>
                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Duty <span className="text-danger">*</span></Form.Label>
                            <Select
                                options={duties.map(d => ({ value: d.id, label: d.name }))}
                                value={current.dutyname ? { value: current.dutyname, label: duties.find(d => d.id === current.dutyname)?.name || 'Select Duty...' } : null}
                                onChange={makeSelectChange('dutyname')}
                                onFocus={handleSelectFocus}
                                onKeyDown={handleSelectKeyDown}
                                classNamePrefix="react-select"
                                placeholder="Select Duty..."
                                styles={{
                                    control: (base) => ({
                                        ...base,
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '10px',
                                        padding: '4px',
                                        boxShadow: 'none',
                                        '&:hover': {
                                            border: '1px solid #cbd5e1'
                                        }
                                    })
                                }}
                            />
                        </div>
                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Remarks</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                className="form-control-custom"
                                value={current.remarks}
                                onChange={(e) => setCurrent({ ...current, remarks: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={handleCloseModal}>
                            Close
                        </Button>
                        <Button type="submit" className="btn-save-custom">
                            Submit
                        </Button>
                    </div>
                </Form>
            </Modal>
        </div>
    );
};

export default ResponsibilityList;
