import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, Modal, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import WalletService from '../../../services/WalletService';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import { usePageTitle } from '../../../context/TitleContext';
import { useDispatch, useSelector } from 'react-redux';
import { navtoggle } from '../../../store/actions/AuthActions';
import Pagination from '../Common/Pagination';

const WalletReason = () => {
    usePageTitle("Reason");
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

    const [reasons, setReasons] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Search and Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentId, setCurrentId] = useState(null);
    const [formData, setFormData] = useState({
        reason: '',
        description: '',
        status: 'Active'
    });
    const [formErrors, setFormErrors] = useState({});

    // Fetch records
    const fetchReasons = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (statusFilter !== 'All') {
                params.status = statusFilter;
            }
            const data = await WalletService.getReasons(params);
            const list = Array.isArray(data) ? data : (data?.results || []);
            setReasons(list);
        } catch (error) {
            console.error('Error fetching reasons:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to load reason records.'
            });
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        fetchReasons();
    }, [fetchReasons]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter]);

    // Filter and Search logic
    const filteredRecords = useMemo(() => {
        return reasons.filter(item => {
            const matchesSearch = !searchTerm || 
                (item.reason && item.reason.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [reasons, searchTerm, statusFilter]);

    // Pagination slice
    const totalRecords = filteredRecords.length;
    const totalPages = Math.ceil(totalRecords / itemsPerPage) || 1;
    const indexOfLast = currentPage * itemsPerPage;
    const indexOfFirst = indexOfLast - itemsPerPage;
    const currentRecords = filteredRecords.slice(indexOfFirst, indexOfLast);

    // Modal Handlers
    const handleShowModal = (item = null) => {
        if (item && item.id) {
            setIsEditMode(true);
            setCurrentId(item.id);
            setFormData({
                reason: item.reason || '',
                description: item.description || '',
                status: item.status || 'Active'
            });
        } else {
            setIsEditMode(false);
            setCurrentId(null);
            setFormData({
                reason: '',
                description: '',
                status: 'Active'
            });
        }
        setFormErrors({});
        setShowModal(true);
    };

    const handleEdit = (item) => {
        handleShowModal(item);
    };

    const resetForm = () => {
        setIsEditMode(false);
        setCurrentId(null);
        setFormData({
            reason: '',
            description: '',
            status: 'Active'
        });
        setFormErrors({});
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

    const handleFocus = () => {
        // Keeps standard focus behavior
    };

    // Validation
    const validateForm = () => {
        const errors = {};
        const trimmedReason = formData.reason.trim();

        if (!trimmedReason) {
            errors.reason = 'Reason name is required.';
        } else {
            // Check client-side duplicate
            const isDuplicate = reasons.some(item => 
                item.reason.toLowerCase() === trimmedReason.toLowerCase() &&
                (!isEditMode || item.id !== currentId)
            );
            if (isDuplicate) {
                errors.reason = `Reason '${trimmedReason}' already exists.`;
            }
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Form Submit
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        setSubmitting(true);
        const payload = {
            reason: formData.reason.trim(),
            description: formData.description.trim(),
            status: formData.status
        };

        try {
            if (isEditMode) {
                await WalletService.updateReason(currentId, payload);
                Swal.fire({
                    icon: 'success',
                    title: 'Updated',
                    text: 'Reason updated successfully',
                    timer: 2000,
                    showConfirmButton: false,
                    returnFocus: false
                });
            } else {
                await WalletService.createReason(payload);
                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: 'Reason created successfully',
                    timer: 2000,
                    showConfirmButton: false,
                    returnFocus: false
                });
            }
            resetForm();
            fetchReasons();
        } catch (error) {
            console.error('Error saving reason:', error);
            const serverErrors = error.response?.data;
            if (serverErrors && typeof serverErrors === 'object') {
                const formatted = {};
                if (serverErrors.reason) {
                    formatted.reason = Array.isArray(serverErrors.reason) ? serverErrors.reason[0] : serverErrors.reason;
                }
                if (serverErrors.non_field_errors || serverErrors.detail || serverErrors.error) {
                    formatted.general = serverErrors.non_field_errors?.[0] || serverErrors.detail || serverErrors.error;
                }
                setFormErrors(formatted);
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Failed to save reason. Please try again.',
                    returnFocus: false
                });
            }
        } finally {
            setSubmitting(false);
            setTimeout(() => {
                if (document.activeElement && typeof document.activeElement.blur === 'function') {
                    document.activeElement.blur();
                }
            }, 100);
        }
    };

    // Toggle Status
    const handleToggleStatus = async (item) => {
        const nextStatus = item.status === 'Active' ? 'Inactive' : 'Active';
        const actionLabel = item.status === 'Active' ? 'deactivate' : 'activate';

        const result = await Swal.fire({
            title: 'Are you sure?',
            text: `Do you want to ${actionLabel} "${item.reason}"?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: `Yes, ${actionLabel}`,
            cancelButtonText: 'Cancel'
        });

        if (result.isConfirmed) {
            try {
                await WalletService.toggleReasonStatus(item.id);
                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: `Reason has been set to ${nextStatus}.`,
                    timer: 1800,
                    showConfirmButton: false
                });
                fetchReasons();
            } catch (error) {
                console.error('Error toggling status:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Failed to update status.'
                });
            }
        }
    };

    // Delete Record
    const handleDelete = async (item) => {
        if (item.points_entries_count > 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Cannot Delete Reason',
                html: `The reason <b>"${item.reason}"</b> has already been used for <b>${item.points_entries_count}</b> point ${item.points_entries_count === 1 ? 'entry' : 'entries'}.<br/><br/><span class="text-muted small">Reasons associated with existing point entries cannot be deleted to preserve transaction and audit history.</span>`,
                confirmButtonColor: '#2ece8a',
                confirmButtonText: 'Understood'
            });
            return;
        }

        const result = await Swal.fire({
            title: 'Delete Reason?',
            text: `Are you sure you want to delete "${item.reason || 'this reason'}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await WalletService.deleteReason(item.id);
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted',
                    text: 'Reason deleted successfully',
                    timer: 2000,
                    showConfirmButton: false
                });
                fetchReasons();
            } catch (error) {
                console.error('Error deleting reason:', error);
                const errMsg = error.response?.data?.error || error.response?.data?.detail || 'Failed to delete reason.';
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: errMsg
                });
            }
        }
    };

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
                            <Card.Title className="mb-0 text-nowrap">Reason Management</Card.Title>
                            <div className="d-flex flex-wrap align-items-center gap-3 flex-grow-1 justify-content-end header-actions-wrapper">
                                <div className="search-bar-container m-0 search-bar-wrapper" style={{ flex: '1 1 auto', minWidth: '180px', maxWidth: '300px' }}>
                                    <span className="search-icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                    </span>
                                    <input
                                        type="text"
                                        className="search-input"
                                        placeholder="Search reason..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <Form.Select
                                    style={{ width: '130px', height: '38px', fontSize: '13px', borderRadius: '8px', borderColor: '#cbd5e1' }}
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="form-control"
                                >
                                    <option value="All">All Status</option>
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                </Form.Select>
                                <div className="d-flex gap-2 align-items-center justify-content-start flex-shrink-0">
                                    <CreateButton
                                        module="wallet_reason"
                                        onClick={() => handleShowModal()}
                                    >
                                        Reason
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
                                                <th><strong>REASON</strong></th>
                                                <th><strong>DESCRIPTION</strong></th>
                                                <th><strong>STATUS</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredRecords.length === 0 ? (
                                                <tr>
                                                    <td colSpan="5" className="text-center py-4 text-muted">
                                                        No entries
                                                    </td>
                                                </tr>
                                            ) : (
                                                currentRecords.map((item, index) => (
                                                    <tr key={item.id}>
                                                        <td>{indexOfFirst + index + 1}</td>
                                                        <td><strong>{item.reason || '-'}</strong></td>
                                                        <td>{item.description || '-'}</td>
                                                        <td>
                                                            <span 
                                                                className={`badge rounded-pill ${item.status === 'Active' ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-danger text-white'}`}
                                                                style={{ fontSize: '11px', padding: '4px 10px', cursor: 'pointer' }}
                                                                onClick={() => handleToggleStatus(item)}
                                                                title="Click to toggle status"
                                                            >
                                                                {item.status}
                                                            </span>
                                                        </td>
                                                        <td className="text-end">
                                                            <div className="d-flex justify-content-end align-items-center gap-2">
                                                                <EditButton
                                                                    module="wallet_reason"
                                                                    onClick={() => handleEdit(item)}
                                                                />
                                                                <DeleteButton
                                                                    module="wallet_reason"
                                                                    onClick={() => handleDelete(item)}
                                                                    title={
                                                                        item.points_entries_count > 0
                                                                            ? `Cannot delete: used in ${item.points_entries_count} point ${item.points_entries_count === 1 ? 'entry' : 'entries'}`
                                                                            : 'Delete Reason'
                                                                    }
                                                                />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {!loading && filteredRecords.length > 0 && (
                                <Pagination
                                    currentPage={currentPage}
                                    setCurrentPage={setCurrentPage}
                                    totalPages={totalPages}
                                    indexOfFirst={indexOfFirst}
                                    indexOfLast={indexOfLast}
                                    totalRecords={filteredRecords.length}
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
                                <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM16 18H8V16H16V18ZM16 14H8V12H16V14ZM13 9V3.5L18.5 9H13Z" fill="white" />
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {isEditMode ? 'Edit Reason' : 'Add Reason'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage wallet reason
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={resetForm}>
                        &times;
                    </button>
                </div>

                <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown} onFocus={handleFocus}>
                    <div className="modal-body-custom" style={{ overflowY: 'auto', overflowX: 'hidden', maxHeight: 'min(400px, 52vh)' }}>
                        {formErrors.general && (
                            <div className="alert alert-danger py-2 mb-3" style={{ fontSize: '13px' }}>{formErrors.general}</div>
                        )}

                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Reason <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                type="text"
                                name="reason"
                                className={`form-control-custom ${formErrors.reason ? 'is-invalid' : ''}`}
                                placeholder="Enter reason (e.g. Returned by customer, Defective goods, Promotional discount)"
                                value={formData.reason}
                                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                autoFocus
                                required
                            />
                            {formErrors.reason && (
                                <div className="text-danger mt-1" style={{ fontSize: '12px' }}>{formErrors.reason}</div>
                            )}
                        </div>

                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Description <span className="text-muted fw-normal">(Optional)</span></Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                name="description"
                                className="form-control-custom"
                                placeholder="Provide notes or additional context for this reason..."
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>

                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Status</Form.Label>
                            <Form.Select
                                name="status"
                                className="form-control-custom"
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            >
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </Form.Select>
                        </div>
                    </div>

                    <div className="modal-footer-custom">
                        <button type="button" className="btn-close-custom" onClick={resetForm}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-save-custom" disabled={submitting}>
                            {submitting ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                    Saving...
                                </>
                            ) : (
                                isEditMode ? 'Update Reason' : 'Save'
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
                    background-color: #2ece8a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
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
                    max-height: min(400px, 52vh) !important;
                    overflow-y: auto !important;
                    overflow-x: hidden !important;
                    scrollbar-width: thin;
                    scrollbar-color: #cbd5e1 #f1f5f9;
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
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                }
                .parkarea-custom-modal .form-control-custom::placeholder {
                    color: #94a3b8;
                }
                .parkarea-custom-modal .btn-close-custom {
                    background-color: #7A70BA !important;
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
                    background-color: #6357a7 !important;
                }
                .parkarea-custom-modal .btn-save-custom {
                    background-color: #2ece8a !important;
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
                    background-color: #26b277 !important;
                }
                
                /* Scoped Search Bar Styles matching Park Area */
                .park-area-page .search-bar-container {
                    position: relative;
                    display: flex;
                    align-items: center;
                }
                .park-area-page .search-bar-container .search-icon {
                    position: absolute;
                    left: 12px;
                    display: flex;
                    align-items: center;
                    pointer-events: none;
                    color: #64748b;
                }
                .park-area-page .search-bar-container .search-input {
                    width: 100%;
                    height: 38px;
                    padding: 0.5rem 1rem 0.5rem 2.4rem;
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                    font-size: 13px;
                    color: #334155;
                    background: #fff;
                    transition: all 0.2s ease;
                }
                .park-area-page .search-bar-container .search-input:focus {
                    outline: none;
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                }

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
        </div>
    );
};

export default WalletReason;
