import React, { useState, useEffect, useRef } from 'react';
import { Card, Modal, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { getParkAreas, createParkArea, updateParkArea, deleteParkArea } from '../../../services/GateManagementService';
import { usePermission } from '../../../hooks/usePermission';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import { usePageTitle } from '../../../context/TitleContext';
import { useDispatch, useSelector } from 'react-redux';
import { navtoggle } from '../../../store/actions/AuthActions';
import Pagination from '../Common/Pagination';

const ParkArea = () => {
    usePageTitle("Park Area");
    const dispatch = useDispatch();
    const sideMenu = useSelector(state => state.sideMenu);
    const sideMenuRef = useRef(sideMenu);
    
    useEffect(() => {
        sideMenuRef.current = sideMenu;
    }, [sideMenu]);

    useEffect(() => {
        if (window.innerWidth <= 1199 && sideMenuRef.current) {
            dispatch(navtoggle());
        }
    }, [dispatch]);

    const { can } = usePermission();
    const [loading, setLoading] = useState(false);
    const [parkAreas, setParkAreas] = useState([]);
    const [editMode, setEditMode] = useState(false);
    const [editId, setEditId] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [formData, setFormData] = useState({
        name: '',
        is_main_area: false,
        parent_area: '',
        number_of_slots: '',
        nature: 'Park',
        sort_order: 0
    });
    const [parentAreas, setParentAreas] = useState([]);
    
    // Slots State
    const [showSlotsModal, setShowSlotsModal] = useState(false);
    const [selectedParkAreaForSlots, setSelectedParkAreaForSlots] = useState(null);
    const [parkAreaSlots, setParkAreaSlots] = useState([]);
    
    const handleViewSlots = async (area) => {
        try {
            setLoading(true);
            const { getParkAreaSlots } = await import('../../../services/GateManagementService');
            const data = await getParkAreaSlots(area.id);
            setParkAreaSlots(data);
            setSelectedParkAreaForSlots(area);
            setShowSlotsModal(true);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to fetch slots' });
        } finally {
            setLoading(false);
        }
    };
    
    // Fetch parent areas when modal opens
    useEffect(() => {
        if (showModal) {
            import('../../../services/GateManagementService').then(({ getMainParkAreas }) => {
                getMainParkAreas().then(data => {
                    setParentAreas(Array.isArray(data) ? data : (data.results || []));
                }).catch(err => console.error(err));
            });
        }
    }, [showModal]);

    useEffect(() => {
        fetchParkAreas();
    }, []);

    const fetchParkAreas = async () => {
        try {
            const data = await getParkAreas();
            let arr = Array.isArray(data) ? data : (data.results || []);
            setParkAreas(arr);
        } catch (error) {
            console.error("Error fetching park areas", error);
        }
    };

    const handleChange = (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

    const handleShowModal = (area = null) => {
        if (area && area.id) {
            setEditMode(true);
            setEditId(area.id);
            setFormData({
                name: area.name || '',
                is_main_area: area.is_main_area || false,
                parent_area: area.parent_area || '',
                number_of_slots: area.number_of_slots || '',
                nature: area.nature || 'Park',
                sort_order: area.sort_order || 0
            });
        } else {
            setEditMode(false);
            setEditId(null);
            setFormData({ name: '', is_main_area: false, parent_area: '', number_of_slots: '', nature: 'Park', sort_order: 0 });
        }
        setShowModal(true);
    };

    const handleEdit = (area) => {
        handleShowModal(area);
    };

    const resetForm = () => {
        setEditMode(false);
        setEditId(null);
        setFormData({ name: '', is_main_area: false, parent_area: '', number_of_slots: '', nature: 'Park', sort_order: 0 });
        setShowModal(false);
        setTimeout(() => {
            if (document.activeElement && typeof document.activeElement.blur === 'function') {
                document.activeElement.blur();
            }
        }, 100);
    };

    useEffect(() => {
        if (showModal) {
            const timer = setTimeout(() => {
                const inputs = Array.from(
                    document.querySelectorAll('.parkarea-custom-modal input:not([disabled]):not([readonly]), .parkarea-custom-modal textarea:not([disabled]):not([readonly])')
                ).filter(el => el.offsetParent !== null && el.type !== 'hidden');
                if (inputs.length > 0) {
                    inputs[0].focus();
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [showModal]);

    const getFocusable = () => {
        const modal = document.querySelector('.parkarea-custom-modal');
        if (!modal) return [];
        return Array.from(
            modal.querySelectorAll(
                '.form-control-custom, button[type="submit"]:not([disabled])'
            )
        ).filter(el => el.offsetParent !== null && !el.disabled);
    };

    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        if (e.target.tagName.toLowerCase() === 'textarea' && e.shiftKey) return;

        const all = getFocusable();
        const index = all.indexOf(document.activeElement);
        if (index > -1 && index < all.length - 1) {
            e.preventDefault();
            if (index === all.length - 2) {
                all[all.length - 1].click();
            } else {
                all[index + 1].focus();
            }
        }
    };

    const handleFocus = (e) => {
        // Removed e.target.select() to prevent automatic highlighting
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Park Area?',
            text: `Are you sure you want to delete "${name || 'this park area'}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deleteParkArea(id);
                Swal.fire({ icon: 'success', title: 'Deleted', text: 'Park Area deleted successfully', timer: 2000, showConfirmButton: false });
                fetchParkAreas();
            } catch (error) {
                let errorMsg = 'Failed to delete park area';
                if (error.response && error.response.data && error.response.data.detail) {
                    errorMsg = error.response.data.detail;
                }
                Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const trimmedName = (formData.name || '').trim().toLowerCase();

        if (trimmedName) {
            const duplicateName = parkAreas.some(a => {
                if (editMode && a.id === editId) return false;
                return (a.name || '').trim().toLowerCase() === trimmedName;
            });

            if (duplicateName) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Duplicate Park Area',
                    text: 'A park area with this Name already exists!'
                });
                return;
            }
        }

        try {
            setLoading(true);
            const payload = {
                name: (formData.name || '').trim(),
                is_main_area: formData.is_main_area,
                parent_area: formData.is_main_area ? null : (formData.parent_area || null),
                number_of_slots: formData.is_main_area ? (formData.number_of_slots || null) : null,
                nature: formData.nature || 'Park',
                sort_order: formData.is_main_area ? 0 : (formData.sort_order || 0)
            };

            if (editMode) {
                await updateParkArea(editId, payload);
                Swal.fire({
                    icon: 'success',
                    title: 'Updated',
                    text: 'Park Area updated successfully',
                    timer: 2000,
                    showConfirmButton: false,
                    returnFocus: false
                });
            } else {
                await createParkArea(payload);
                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: 'Park Area created successfully',
                    timer: 2000,
                    showConfirmButton: false,
                    returnFocus: false
                });
            }
            resetForm();
            fetchParkAreas();
        } catch (error) {
            console.error("Error saving park area:", error);
            const errorMsg = error.response?.data?.name?.[0] ||
                error.response?.data?.detail ||
                `Failed to ${editMode ? 'update' : 'create'} park area.`;
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: errorMsg,
                returnFocus: false
            });
        } finally {
            setLoading(false);
            setTimeout(() => {
                if (document.activeElement && typeof document.activeElement.blur === 'function') {
                    document.activeElement.blur();
                }
            }, 100);
        }
    };

    const filteredAreas = parkAreas.filter(area =>
        (area.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (area.nature || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredAreas.length / itemsPerPage);
    const indexOfFirst = (currentPage - 1) * itemsPerPage;
    const indexOfLast = indexOfFirst + itemsPerPage;
    const currentAreas = filteredAreas.slice(indexOfFirst, indexOfLast);

    return (
        <div className="container-fluid park-area-page">
            <div className="page-titles">
                <button
                    onClick={() => window.history.back()}
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div>

            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                            <Card.Title className="mb-0 text-nowrap">Park Area Management</Card.Title>
                            <div className="d-flex flex-wrap align-items-center gap-3 flex-grow-1 justify-content-end header-actions-wrapper">
                                <div className="search-bar-container m-0 search-bar-wrapper" style={{ flex: '1 1 auto', minWidth: '200px', maxWidth: '350px' }}>
                                    <span className="search-icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                    </span>
                                    <input
                                        type="text"
                                        className="search-input"
                                        placeholder="Search park area..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="d-flex gap-2 align-items-center justify-content-start flex-shrink-0">
                                    <CreateButton
                                        module="park_area"
                                        onClick={() => handleShowModal()}
                                    >
                                        Park Area
                                    </CreateButton>
                                </div>
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
                                <div className="table-responsive park-area-table-wrapper">
                                    <table className="table table-responsive-md">
                                        <thead>
                                            <tr>
                                                <th><strong>SL NO</strong></th>
                                                <th><strong>PARK AREA NAME</strong></th>
                                                <th><strong>PARENT AREA</strong></th>
                                                <th><strong>NATURE</strong></th>
                                                <th><strong>SORT ORDER</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredAreas.length === 0 ? (
                                                <tr>
                                                    <td colSpan="6" className="text-center py-4 text-muted">
                                                        No entries
                                                    </td>
                                                </tr>
                                            ) : (
                                                currentAreas.map((area, index) => (
                                                    <tr key={area.id}>
                                                        <td>{indexOfFirst + index + 1}</td>
                                                        <td><strong>{area.name || '-'}</strong></td>
                                                        <td>{area.parent_area ? (parkAreas.find(p => String(p.id) === String(area.parent_area))?.name || area.parent_area) : '-'}</td>
                                                        <td>{area.nature || 'Park'}</td>
                                                        <td>{area.sort_order ?? 0}</td>
                                                        <td className="text-end">
                                                            <div className="d-flex justify-content-end align-items-center gap-2">
                                                                {area.is_main_area && (
                                                                    <button 
                                                                        className="btn btn-outline-info shadow" 
                                                                        onClick={() => handleViewSlots(area)}
                                                                        title="View Slots"
                                                                        style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                                    >
                                                                        <i className="fa fa-eye"></i>
                                                                    </button>
                                                                )}
                                                                {can('park_area', 'edit') || can('park_area', 'delete') ? (
                                                                    <>
                                                                        <EditButton
                                                                            module="park_area"
                                                                            onClick={() => handleEdit(area)}
                                                                        />
                                                                        <DeleteButton
                                                                            module="park_area"
                                                                            onClick={() => handleDelete(area.id, area.name)}
                                                                        />
                                                                    </>
                                                                ) : null}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {!loading && filteredAreas.length > 0 && (
                                <Pagination
                                    currentPage={currentPage}
                                    setCurrentPage={setCurrentPage}
                                    totalPages={totalPages}
                                    indexOfFirst={indexOfFirst}
                                    indexOfLast={indexOfLast}
                                    totalRecords={filteredAreas.length}
                                    loading={loading}
                                />
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>

            <Modal
                show={showModal}
                onHide={resetForm}
                dialogClassName="parkarea-custom-modal"
                backdrop="static"
                keyboard={false}
                restoreFocus={false}
                size="md"
                centered
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM10 19H5V5H10V19ZM19 19H12V5H19V19Z" fill="white" />
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editMode ? 'Edit Park Area' : 'Save'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage park area
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={resetForm}>
                        &times;
                    </button>
                </div>

                <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown} onFocus={handleFocus}>
                    <div className="modal-body-custom" style={{ overflowY: 'auto', overflowX: 'hidden', maxHeight: 'calc(100vh - 220px)' }}>
                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Park Area Name <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                type="text"
                                name="name"
                                className="form-control-custom"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="Enter park area name"
                                autoFocus
                                required
                            />
                        </div>

                        <div className="mb-3">
                            <Form.Check 
                                type="checkbox"
                                id="is_main_area"
                                name="is_main_area"
                                label="Is Main Area? (Primary Park Area)"
                                checked={formData.is_main_area}
                                onChange={handleChange}
                            />
                        </div>
                        
                        {!formData.is_main_area && (
                            <div className="mb-3">
                                <Form.Label className="form-label-custom">Parent Area <span className="text-danger">*</span></Form.Label>
                                <Form.Select
                                    name="parent_area"
                                    className="form-control-custom"
                                    value={formData.parent_area}
                                    onChange={handleChange}
                                    required={!formData.is_main_area}
                                >
                                    <option value="">-- Select Parent Area --</option>
                                    {parentAreas.filter(p => p.id !== editId).map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </Form.Select>
                            </div>
                        )}
                        
                        {formData.is_main_area && (
                            <div className="mb-3">
                                <Form.Label className="form-label-custom">Number of Slots <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="number"
                                    name="number_of_slots"
                                    className="form-control-custom"
                                    value={formData.number_of_slots}
                                    onChange={handleChange}
                                    required={formData.is_main_area}
                                    min="1"
                                />
                            </div>
                        )}
                        

                        {!formData.is_main_area && (
                            <div className="mb-3">
                                <Form.Label className="form-label-custom">Sort Order <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="number"
                                    name="sort_order"
                                    className="form-control-custom"
                                    value={formData.sort_order}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        )}
                    </div>

                    <div className="modal-footer-custom">
                        <button type="button" className="btn-close-custom" onClick={resetForm}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-save-custom" disabled={loading}>
                            {loading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                    Saving...
                                </>
                            ) : (
                                editMode ? 'Update Park Area' : 'Save'
                            )}
                        </button>
                    </div>
                </Form>
            </Modal>

            <style>{`
                .parkarea-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .parkarea-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .parkarea-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: var(--form-icon-color, #0a500f);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .parkarea-custom-modal .modal-close-x {
                    border: none;
                    background: transparent;
                    font-size: 24px;
                    color: #aaa;
                    cursor: pointer;
                    transition: color 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 4px;
                }
                .parkarea-custom-modal .modal-close-x:hover {
                    color: #555;
                }
                .parkarea-custom-modal .modal-body-custom {
                    padding: 24px 28px;
                    max-height: 55vh;
                    overflow-y: auto;
                }
                .parkarea-custom-modal .modal-body-custom::-webkit-scrollbar {
                    width: 6px;
                }
                .parkarea-custom-modal .modal-body-custom::-webkit-scrollbar-track {
                    background: #f1f5f9;
                    border-radius: 4px;
                }
                .parkarea-custom-modal .modal-body-custom::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 4px;
                }
                .parkarea-custom-modal .modal-body-custom::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
                .parkarea-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .parkarea-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .parkarea-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .parkarea-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .parkarea-custom-modal .form-control-custom::placeholder {
                    color: #94a3b8;
                }
                .parkarea-custom-modal .btn-close-custom {
                    background-color: var(--cancel-btn-color, #dc3545) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s;
                }
                .parkarea-custom-modal .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .parkarea-custom-modal .btn-save-custom {
                    background-color: var(--save-btn-color, #0a500f) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s;
                }
                .parkarea-custom-modal .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }
                
                /* Responsive Scoped Styles for Park Area */
                .park-area-page .park-area-table-wrapper {
                    width: 100%;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                }
                .park-area-page .search-bar-wrapper {
                    max-width: 250px;
                }
                @media (max-width: 768px) {
                    .park-area-page .header-actions-wrapper {
                        width: 100% !important;
                        flex-direction: column !important;
                        align-items: stretch !important;
                    }
                    .park-area-page .search-bar-wrapper {
                        max-width: 100% !important;
                    }
                    .park-area-page .header-actions-wrapper > div {
                        width: 100% !important;
                    }
                    .park-area-page .header-actions-wrapper .btn {
                        width: 100% !important;
                    }
                }
                @media (max-width: 576px) {
                    .parkarea-custom-modal.modal {
                        padding: 0 12px !important;
                    }
                    .parkarea-custom-modal .modal-dialog {
                        max-width: calc(100vw - 24px) !important;
                        margin: 12px auto !important;
                    }
                    .parkarea-custom-modal .modal-body-custom {
                        padding: 16px !important;
                    }
                    .parkarea-custom-modal .modal-header-custom {
                        padding: 16px !important;
                    }
                    .parkarea-custom-modal .modal-footer-custom {
                        flex-direction: column !important;
                        padding: 16px !important;
                    }
                    .parkarea-custom-modal .btn-close-custom,
                    .parkarea-custom-modal .btn-save-custom {
                        width: 100% !important;
                    }
                }
            `}</style>
            
            <Modal
                show={showSlotsModal}
                onHide={() => setShowSlotsModal(false)}
                dialogClassName="parkarea-custom-modal"
                backdrop="static"
                keyboard={false}
                restoreFocus={false}
                size="md"
                centered
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM10 19H5V5H10V19ZM19 19H12V5H19V19Z" fill="white" />
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {selectedParkAreaForSlots?.name || 'Park Area'} Slots
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Total Slots: {parkAreaSlots.length} &bull; <span className="text-success fw-medium">Available: {parkAreaSlots.filter(s => s.status === 'Available').length}</span> &bull; <span className="text-danger fw-medium">Occupied: {parkAreaSlots.filter(s => s.status === 'Occupied').length}</span>
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowSlotsModal(false)}>
                        &times;
                    </button>
                </div>
                
                <div className="modal-body-custom">
                    <div className="row g-3">
                        {parkAreaSlots.map(slot => (
                            <div className="col-4 col-sm-3 col-md-3" key={slot.id}>
                                <div 
                                    className="form-control-custom text-center d-flex flex-column justify-content-center align-items-center p-2" 
                                    style={{ 
                                        height: '100%', 
                                        cursor: 'default',
                                        borderColor: slot.status === 'Occupied' ? '#fca5a5' : '#e2e8f0',
                                        backgroundColor: slot.status === 'Occupied' ? 'rgba(239, 68, 68, 0.04)' : undefined
                                    }}
                                >
                                    <i 
                                        className="fa fa-car mb-1" 
                                        style={{ 
                                            fontSize: '24px', 
                                            color: slot.status === 'Available' ? '#0a500f' : '#ef4444' 
                                        }}
                                    ></i>
                                    <span className="mb-1 d-block text-dark" style={{ fontSize: '13px', fontWeight: '600' }}>Slot {slot.slot_number}</span>
                                    <span 
                                        className={`badge rounded-pill ${slot.status === 'Available' ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-danger text-white'}`} 
                                        style={{ fontSize: '11px', padding: '3px 8px' }}
                                    >
                                        {slot.status}
                                    </span>
                                    {slot.occupied_by && (
                                        <div className="text-muted small mt-1 text-truncate w-100" style={{ fontSize: '10px' }} title={slot.occupied_by}>
                                            <i className="fa fa-info-circle me-1 text-danger"></i>{slot.occupied_by}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {parkAreaSlots.length === 0 && (
                            <div className="col-12 text-center py-4 text-muted">
                                No slots available.
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="modal-footer-custom">
                    <button type="button" className="btn-close-custom" onClick={() => setShowSlotsModal(false)}>
                        Close
                    </button>
                </div>
            </Modal>
            
        </div>
    );
};

export default ParkArea;
