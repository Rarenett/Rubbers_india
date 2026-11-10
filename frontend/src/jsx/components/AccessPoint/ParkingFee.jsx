import React, { useState, useEffect, useRef } from 'react';
import { Card, Modal, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { getParkingFees, createParkingFee, updateParkingFee, deleteParkingFee } from '../../../services/GateManagementService';
import { usePermission } from '../../../hooks/usePermission';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import { usePageTitle } from '../../../context/TitleContext';
import { useDispatch, useSelector } from 'react-redux';
import { navtoggle } from '../../../store/actions/AuthActions';
import Pagination from '../Common/Pagination';

const ParkingFee = () => {
    usePageTitle("Parking Fee");
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
    const [parkingFees, setParkingFees] = useState([]);
    const [editMode, setEditMode] = useState(false);
    const [editId, setEditId] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    
    const [formData, setFormData] = useState({
        min_minutes: 0,
        max_minutes: '',
        fee: 0,
        is_active: true
    });
    
    
    
    
    
    
    

    useEffect(() => {
        fetchParkingFees();
    }, []);

    const fetchParkingFees = async () => {
        try {
            const data = await getParkingFees();
            let arr = Array.isArray(data) ? data : (data.results || []);
            setParkingFees(arr);
        } catch (error) {
            console.error("Error fetching parking fees", error);
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
                min_minutes: area.min_minutes ?? 0,
                max_minutes: area.max_minutes ?? '',
                fee: area.fee ?? 0,
                is_active: area.is_active ?? true
            });
        } else {
            setEditMode(false);
            setEditId(null);
            setFormData({ min_minutes: 0,
        max_minutes: '',
        fee: 0,
        is_active: true });
        }
        setShowModal(true);
    };

    const handleEdit = (area) => {
        handleShowModal(area);
    };

    const resetForm = () => {
        setEditMode(false);
        setEditId(null);
        setFormData({ min_minutes: 0,
        max_minutes: '',
        fee: 0,
        is_active: true });
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
            title: 'Delete Parking Fee?',
            text: `Are you sure you want to delete "${name || 'this parking fee'}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deleteParkingFee(id);
                Swal.fire({ icon: 'success', title: 'Deleted', text: 'Parking Fee deleted successfully', timer: 2000, showConfirmButton: false });
                fetchParkingFees();
            } catch (error) {
                let errorMsg = 'Failed to delete parking fee';
                if (error.response && error.response.data && error.response.data.detail) {
                    errorMsg = error.response.data.detail;
                }
                Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();


        try {
            setLoading(true);
            const payload = {
                min_minutes: parseInt(formData.min_minutes) || 0,
                max_minutes: formData.max_minutes ? parseInt(formData.max_minutes) : null,
                fee: parseFloat(formData.fee) || 0,
                is_active: formData.is_active
            };

            if (editMode) {
                await updateParkingFee(editId, payload);
                Swal.fire({
                    icon: 'success',
                    title: 'Updated',
                    text: 'Parking Fee updated successfully',
                    timer: 2000,
                    showConfirmButton: false,
                    returnFocus: false
                });
            } else {
                await createParkingFee(payload);
                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: 'Parking Fee created successfully',
                    timer: 2000,
                    showConfirmButton: false,
                    returnFocus: false
                });
            }
            resetForm();
            fetchParkingFees();
        } catch (error) {
            console.error("Error saving parking fee:", error);
            
            let errorMsg = `Failed to ${editMode ? 'update' : 'create'} parking fee.`;
            if (error.response && error.response.data) {
                const d = error.response.data;
                if (Array.isArray(d.non_field_errors)) errorMsg = d.non_field_errors[0];
                else if (Array.isArray(d.min_minutes)) errorMsg = d.min_minutes[0];
                else if (Array.isArray(d.max_minutes)) errorMsg = d.max_minutes[0];
                else if (Array.isArray(d.fee)) errorMsg = d.fee[0];
                else if (typeof d === 'string') errorMsg = d;
                else if (d.detail) errorMsg = d.detail;
            }

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

    const filteredAreas = parkingFees;
    const totalPages = Math.ceil(filteredAreas.length / itemsPerPage);
    const indexOfFirst = (currentPage - 1) * itemsPerPage;
    const indexOfLast = indexOfFirst + itemsPerPage;
    const currentAreas = filteredAreas.slice(indexOfFirst, indexOfLast);

    return (
        <div className="container-fluid parking-fee-page">
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
                            <Card.Title className="mb-0 text-nowrap">Parking Fee Management</Card.Title>
                            <div className="d-flex flex-wrap align-items-center gap-3 flex-grow-1 justify-content-end header-actions-wrapper">
                                <div className="d-flex gap-2 align-items-center justify-content-start flex-shrink-0">
                                    <CreateButton
                                        module="parking_fee"
                                        onClick={() => handleShowModal()}
                                    >
                                        Parking Fee
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
                                <div className="table-responsive parking-fee-table-wrapper">
                                    <table className="table table-responsive-md">
                                        <thead>
                                            <tr>
                                                <th><strong>SL NO</strong></th>
                                                <th><strong>DURATION FROM</strong></th>
                                                <th><strong>DURATION TO</strong></th>
                                                <th><strong>FEE (₹)</strong></th>
                                                <th><strong>STATUS</strong></th>
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
                                                        <td>{area.min_minutes} min</td>
                                                        <td>{area.max_minutes ? `${area.max_minutes} min` : 'No Limit'}</td>
                                                        <td>₹{area.fee}</td>
                                                        <td>
                                                            <span className={`badge light badge-${area.is_active ? 'success' : 'danger'}`}>
                                                                <i className={`fa fa-circle text-${area.is_active ? 'success' : 'danger'} me-1`}></i>
                                                                {area.is_active ? 'Active' : 'Inactive'}
                                                            </span>
                                                        </td>
                                                        <td className="text-end">
                                                            <div className="d-flex justify-content-end align-items-center gap-2">
                                                                {can('parking_fee', 'edit') || can('parking_fee', 'delete') ? (
                                                                    <>
                                                                        <EditButton
                                                                            module="parking_fee"
                                                                            onClick={() => handleEdit(area)}
                                                                        />
                                                                        <DeleteButton
                                                                            module="parking_fee"
                                                                            onClick={() => handleDelete(area.id, `${area.min_minutes} to ${area.max_minutes || 'No Limit'}`)}
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
                                {editMode ? 'Edit Parking Fee' : 'Save'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage parking fee
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={resetForm}>
                        &times;
                    </button>
                </div>

                <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown} onFocus={handleFocus}>
                    <div className="modal-body-custom" style={{ overflowY: 'auto', overflowX: 'hidden', maxHeight: 'calc(100vh - 220px)' }}>
                        <div className="row">
                            <div className="col-sm-6 mb-3">
                                <Form.Label className="form-label-custom">Minimum Duration (Minutes) <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="number"
                                    name="min_minutes"
                                    value={formData.min_minutes}
                                    onChange={handleChange}
                                    required
                                    min="0"
                                    className="form-control-custom"
                                />
                            </div>
                            <div className="col-sm-6 mb-3">
                                <Form.Label className="form-label-custom">Maximum Duration (Minutes)</Form.Label>
                                <Form.Control
                                    type="number"
                                    name="max_minutes"
                                    value={formData.max_minutes}
                                    onChange={handleChange}
                                    min="0"
                                    placeholder="Leave blank for No Limit"
                                    className="form-control-custom"
                                />
                            </div>
                            <div className="col-sm-6 mb-3">
                                <Form.Label className="form-label-custom">Fee Amount (₹) <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="number"
                                    name="fee"
                                    value={formData.fee}
                                    onChange={handleChange}
                                    required
                                    min="0"
                                    step="0.01"
                                    className="form-control-custom"
                                />
                            </div>
                            <div className="col-sm-6 mb-3 d-flex align-items-center">
                                <Form.Check
                                    type="switch"
                                    id="is_active"
                                    name="is_active"
                                    label="Active"
                                    checked={formData.is_active}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
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
                                editMode ? 'Update Parking Fee' : 'Save'
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
                    background-color: #0a500f;
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
                    background-color: #dc3545 !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s;
                }
                .parkarea-custom-modal .btn-close-custom:hover {
                    background-color: #bb2d3b !important;
                }
                .parkarea-custom-modal .btn-save-custom {
                    background-color: #0a500f !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s;
                }
                .parkarea-custom-modal .btn-save-custom:hover {
                    background-color: #073d0b !important;
                }
                
                /* Responsive Scoped Styles for Parking Fee */
                .parking-fee-page .parking-fee-table-wrapper {
                    width: 100%;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                }
                .parking-fee-page .search-bar-wrapper {
                    max-width: 250px;
                }
                @media (max-width: 768px) {
                    .parking-fee-page .header-actions-wrapper {
                        width: 100% !important;
                        flex-direction: column !important;
                        align-items: stretch !important;
                    }
                    .parking-fee-page .search-bar-wrapper {
                        max-width: 100% !important;
                    }
                    .parking-fee-page .header-actions-wrapper > div {
                        width: 100% !important;
                    }
                    .parking-fee-page .header-actions-wrapper .btn {
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
        </div>
    );
};

export default ParkingFee;
