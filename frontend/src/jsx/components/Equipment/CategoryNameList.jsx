import React, { useState, useEffect, Fragment } from 'react';
import { useFormConfig } from "../../../hooks/useFormConfig";
import { Card, Button, Modal, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    getCategoryNames,
    createCategoryName,
    updateCategoryName,
    deleteCategoryName,
    getTypeNames,
} from '../../../services/MachineManagementService';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import { usePermission } from '../../../hooks/usePermission';
import { useEnterTraversal } from '../../../hooks/useEnterTraversal';
import Select from 'react-select';
import TypeNameFormModal from './TypeNameFormModal';

const CategoryNameList = () => {
    const { isFieldVisible, stripHiddenFields } = useFormConfig('machine_app_categoryname', 'CategoryNameList');
    const [categories, setCategories] = useState([]);
    const [typeNames, setTypeNames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;
    const { can } = usePermission();

    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [animateTrigger, setAnimateTrigger] = useState(false);
    const [showTypeModal, setShowTypeModal] = useState(false);
    const [current, setCurrent] = useState({ id: null, categoryname: '', typename: '' });

    const { handleFormKeyDown, handleSelectFocus, handleSelectKeyDown, makeSelectChange } = useEnterTraversal('.sgfm-modal', setCurrent);

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
            const [catData, typeData] = await Promise.all([getCategoryNames(), getTypeNames()]);
            setCategories(catData);
            setTypeNames(typeData);
        } catch {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to fetch category data' });
        } finally {
            setLoading(false);
        }
    };

    const handleShowModal = (obj = null) => {
        if (obj) {
            setCurrent({ id: obj.id, categoryname: obj.categoryname || '', typename: obj.typename || '' });
            setEditMode(true);
        } else {
            setCurrent({ id: null, categoryname: '', typename: '' });
            setEditMode(false);
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isFieldVisible('categoryname') && !current.categoryname.trim()) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Category Name is required' });
            return;
        }
        if (isFieldVisible('typename') && !current.typename) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Please select a Type Name' });
            return;
        }
        try {
            const rawPayload = { categoryname: current.categoryname.trim(), typename: current.typename };
            const payload = stripHiddenFields(rawPayload);
            if (editMode && current.id) {
                await updateCategoryName(current.id, payload);
                Swal.fire({ icon: 'success', title: 'Updated', text: 'Category name updated successfully', timer: 2000, showConfirmButton: false });
            } else {
                await createCategoryName(payload);
                Swal.fire({ icon: 'success', title: 'Created', text: 'Category name created successfully', timer: 2000, showConfirmButton: false });
            }
            setShowModal(false);
            fetchData();
        } catch (error) {
            let errorMsg = 'Failed to save category name';
            if (error.response?.data) {
                const keys = Object.keys(error.response.data);
                if (keys.length > 0) errorMsg = `${keys[0].toUpperCase()}: ${error.response.data[keys[0]][0]}`;
            }
            Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
        }
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Category?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it',
        });
        if (result.isConfirmed) {
            try {
                await deleteCategoryName(id);
                Swal.fire({ icon: 'success', title: 'Deleted', text: 'Category name deleted successfully', timer: 2000, showConfirmButton: false });
                fetchData();
            } catch {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete. It may be referenced by sub-categories.' });
            }
        }
    };

    const filtered = categories.filter(item =>
        (item.categoryname || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.typename_details || '').toLowerCase().includes(searchTerm.toLowerCase())
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
                .sgfm-modal .modal-icon-circle { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background-color: #0a500f; box-shadow: 0 4px 10px rgba(10, 80, 15,0.2); }
                .sgfm-modal .modal-close-x { border: none; background: transparent; font-size: 24px; color: #aaa; cursor: pointer; transition: color 0.2s; display: flex; align-items: center; justify-content: center; padding: 4px; }
                .sgfm-modal .modal-close-x:hover { color: #555; }
                .sgfm-modal .modal-body-custom { padding: 24px 28px; }
                .sgfm-modal .modal-footer-custom { display: flex; align-items: center; justify-content: flex-end; padding: 20px 28px 24px 28px; border-top: 1px solid #f1f5f9; background-color: #fafbfc; gap: 12px; }
                .sgfm-modal .form-label-custom { font-size: 14px; font-weight: 500; color: #4a5568; margin-bottom: 8px; }
                .sgfm-modal .form-control-custom { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px 16px; font-size: 14px; color: #334155; background-color: #fff; transition: border-color 0.2s, box-shadow 0.2s; width: 100%; }
                .sgfm-modal .form-control-custom:focus { outline: none; border-color: #0a500f; box-shadow: 0 0 0 3px rgba(10, 80, 15,0.15); }
                .sgfm-modal .form-control-custom::placeholder { color: #94a3b8; }
                .sgfm-modal .btn-close-custom { background-color: #dc3545 !important; color: white !important; border-radius: 8px !important; font-weight: 500 !important; font-size: 14px !important; padding: 10px 24px !important; border: none !important; cursor: pointer; transition: background-color 0.2s; }
                .sgfm-modal .btn-close-custom:hover { background-color: #bb2d3b !important; }
                .sgfm-modal .btn-save-custom { background-color: #0a500f !important; color: white !important; border-radius: 8px !important; font-weight: 500 !important; font-size: 14px !important; padding: 10px 24px !important; border: none !important; cursor: pointer; transition: background-color 0.2s; }
                .sgfm-modal .btn-save-custom:hover { background-color: #073d0b !important; }
                .quick-add-btn {
                    display: inline-flex; align-items: center; justify-content: center;
                    width: 44px; height: 44px; border-radius: 8px;
                    background: linear-gradient(135deg, #0a500f, #073d0b); border: none;
                    color: white; font-size: 20px; font-weight: 400; line-height: 1;
                    cursor: pointer; flex-shrink: 0; transition: opacity 0.2s, transform 0.15s;
                    box-shadow: 0 2px 6px rgba(10, 80, 15,0.35);
                }
                .quick-add-btn:hover { opacity: 0.88; transform: scale(1.05); }
                .quick-add-btn:active { transform: scale(0.96); }
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
                            <Card.Title className="mb-0">Category Name Management</Card.Title>
                            <div className="d-flex align-items-center gap-2">
                                <div style={{ width: '300px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Category..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                <CreateButton module="equip_categories" onClick={() => handleShowModal()}>
                                    Category
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
                                                <th><strong>CATEGORY NAME</strong></th>
                                                <th><strong>TYPE NAME</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentItems.length > 0 ? currentItems.map((item, idx) => (
                                                <tr key={item.id}>
                                                    <td>{indexOfFirstItem + idx + 1}</td>
                                                    <td><strong>{item.categoryname}</strong></td>
                                                    <td>
                                                        <span>
                                                            {item.typename_details || '—'}
                                                        </span>
                                                    </td>
                                                    <td className="text-end">
                                                        {can('spareparts', 'edit') || can('spareparts', 'delete') ? (
                                                            <div className="d-flex justify-content-end">
                                                                <EditButton module="equip_categories" onClick={() => handleShowModal(item)} className="me-1" />
                                                                <DeleteButton module="equip_categories" onClick={() => handleDelete(item.id, item.categoryname)} />
                                                            </div>
                                                        ) : (
                                                            <span className="badge badge-danger light mt-1">No Access</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr><td colSpan="4" className="text-center py-4 text-muted">No entries found</td></tr>
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
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 7h18M3 12h12M3 17h8" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editMode ? 'Edit Category' : 'Add Category'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Assign a category under a type name</p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowModal(false)}>&times;</button>
                </div>
                <Form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown}>
                    <div className="modal-body-custom">
                        <div className="row">
                            {isFieldVisible('categoryname') && (
                                <div className="col-md-12 mb-3">
                                    <Form.Label className="form-label-custom">Category Name <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        autoFocus
                                        type="text"
                                        className="form-control-custom"
                                        placeholder="e.g. Engine Parts, Body Parts"
                                        value={current.categoryname}
                                        onChange={(e) => setCurrent({ ...current, categoryname: e.target.value })}
                                        required
                                    />
                                </div>
                            )}
                            {isFieldVisible('typename') && (
                                <div className="col-md-12 mb-3">
                                    <Form.Label className="form-label-custom">Type Name <span className="text-danger">*</span></Form.Label>
                                    <div className="d-flex align-items-center gap-2">
                                        <div className="flex-grow-1">
                                            <Select
                                                classNamePrefix="react-select"
                                                options={typeNames.map(t => ({ value: t.id, label: t.typename }))}
                                                value={typeNames.map(t => ({ value: t.id, label: t.typename })).find(opt => opt.value === current.typename) || null}
                                                onChange={makeSelectChange('typename')}
                                                onFocus={handleSelectFocus}
                                                onKeyDown={handleSelectKeyDown}
                                                placeholder="— Select Type Name —"
                                                isClearable
                                                styles={{
                                                    control: (base, state) => ({
                                                        ...base, minHeight: '44px',
                                                        borderColor: state.isFocused ? '#0a500f' : '#cbd5e1',
                                                        boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 80, 15,0.15)' : 'none',
                                                        borderRadius: '10px', fontSize: '14px', '&:hover': { borderColor: '#0a500f' }
                                                    }),
                                                    menu: base => ({ ...base, zIndex: 99999, fontSize: '14px' }),
                                                    option: (base, state) => ({
                                                        ...base, backgroundColor: state.isSelected ? '#0a500f' : state.isFocused ? '#eafff5' : 'white',
                                                        color: state.isSelected ? 'white' : '#333', cursor: 'pointer'
                                                    })
                                                }}
                                            />
                                        </div>
                                        <button type="button" className="quick-add-btn" onClick={() => setShowTypeModal(true)} title="Add New Type Name">+</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={() => setShowModal(false)}>Close</Button>
                        <Button type="submit" className="btn-save-custom">{editMode ? 'Save Changes' : 'Create'}</Button>
                    </div>
                </Form>
            </Modal>

            <TypeNameFormModal 
                show={showTypeModal}
                onHide={() => setShowTypeModal(false)}
                onSaved={async (newType) => {
                    const freshData = await getTypeNames();
                    setTypeNames(freshData);
                    setCurrent({ ...current, typename: newType.id });
                }}
            />
        </Fragment>
    );
};

export default CategoryNameList;