import React, { useState, useEffect, useRef, Fragment } from 'react';
import { Modal, Table, Card, Form, Button } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import {
    fetchPrefixTypes,
    createPrefixType,
    updatePrefixType,
    deletePrefixType,
    formatError,
} from '../../services/PrefixService';
import axiosInstance from '../../services/AxiosInstance';
import CreateButton from '../../components/permissions/CreateButton';
import EditButton from '../../components/permissions/EditButton';
import DeleteButton from '../../components/permissions/DeleteButton';
import { usePageTitle } from '../../context/TitleContext';

const ManagePrefixType = () => {
    usePageTitle("Voucher Types");
    const [prefixTypes, setPrefixTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [currentId, setCurrentId] = useState(null);
    const [formData, setFormData] = useState({
        type_name: '',
        subtype: ''
    });
    const currentSelectControlRef = useRef(null);
    
    // For fetching VoucherTypes
    const [voucherTypes, setVoucherTypes] = useState([]);

    // Reset pagination on search change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    // Autofocus effect
    useEffect(() => {
        if (showModal) {
            const timer = setTimeout(() => {
                const inputs = Array.from(
                    document.querySelectorAll('.prefix-custom-modal input:not([disabled]):not([readonly])')
                ).filter(el => el.offsetParent !== null && el.type !== 'hidden');
                if (inputs.length > 0) inputs[0].focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [showModal]);

    // Keyboard navigation
    const getFocusable = () => {
        const modal = document.querySelector('.prefix-custom-modal');
        if (!modal) return [];
        return Array.from(
            modal.querySelectorAll(
                '.form-control-custom, .react-select__control, input[type="checkbox"]:not([disabled]), button[type="submit"]:not([disabled])'
            )
        ).filter(el => el.offsetParent !== null && !el.disabled);
    };

    const focusNextFromControl = (control) => {
        const all = getFocusable();
        const index = all.indexOf(control);
        if (index > -1 && index < all.length - 1) {
            const next = all[index + 1];
            if (next.classList.contains('react-select__control')) {
                next.querySelector('input')?.focus();
            } else {
                next.focus();
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        const activeEl = document.activeElement;
        
        // Let react-select inputs handle their own Enter keys
        if (activeEl.closest('.react-select__control')) {
            return;
        }

        const all = getFocusable();
        const index = all.indexOf(activeEl);
        if (index > -1 && index < all.length - 1) {
            e.preventDefault();
            const next = all[index + 1];
            if (next.classList.contains('react-select__control')) {
                next.querySelector('input')?.focus();
            } else {
                next.focus();
            }
        }
    };

    const handleSelectFocus = (e) => {
        currentSelectControlRef.current = e.target.closest('.react-select__control');
    };

    const handleSelectKeyDown = (e) => {
        if (e.key === 'Enter') {
            const menuOpen = !!document.querySelector('.react-select__menu');
            if (!menuOpen) {
                e.preventDefault();
                const control = e.target.closest('.react-select__control');
                if (control) focusNextFromControl(control);
            }
        }
    };

    const handleFocus = (e) => {
        if (e.target.tagName === 'INPUT' && (e.target.type === 'number' || e.target.type === 'text')) {
            e.target.select();
        }
    };

    const module = 'company'; // Using 'company' module permission as a fallback

    useEffect(() => {
        loadPrefixTypes();
        loadVoucherTypes();
    }, []);

    const loadVoucherTypes = async () => {
        try {
            const response = await axiosInstance.get('/api/finance/voucher-types/');
            setVoucherTypes(Array.isArray(response.data) ? response.data : (response.data?.results || []));
        } catch (error) {
            console.error("Error loading voucher types", error);
        }
    };

    const loadPrefixTypes = async () => {
        try {
            setLoading(true);
            const response = await fetchPrefixTypes();
            setPrefixTypes(Array.isArray(response.data) ? response.data : (response.data?.results || []));
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: formatError(error), timer: 2000, showConfirmButton: false });
        } finally {
            setLoading(false);
        }
    };

    const handleShowModal = (type = null) => {
        if (type) {
            setEditMode(true);
            setCurrentId(type.id);
            setFormData({
                type_name: type.type_name,
                subtype: type.subtype || ''
            });
        } else {
            setEditMode(false);
            setCurrentId(null);
            setFormData({
                type_name: '',
                subtype: ''
            });
        }
        setShowModal(true);
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Clean up: remove subtype if empty so DRF doesn't get an empty-string FK
            const payload = { ...formData };
            if (!payload.subtype) delete payload.subtype;

            if (editMode) {
                await updatePrefixType(currentId, payload);
                Swal.fire({ icon: 'success', title: 'Updated', text: 'Voucher Type updated successfully.', timer: 2000, showConfirmButton: false });
            } else {
                await createPrefixType(payload);
                Swal.fire({ icon: 'success', title: 'Created', text: 'Voucher Type created successfully.', timer: 2000, showConfirmButton: false });
            }
            setShowModal(false);
            loadPrefixTypes();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: formatError(error), timer: 2000, showConfirmButton: false });
        }
    };

    const handleDelete = (id) => {
        Swal.fire({
            title: 'Are you sure?',
            text: "Once deleted, you will not be able to recover this voucher type!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deletePrefixType(id);
                    Swal.fire({ icon: 'success', title: 'Deleted!', text: 'Voucher Type has been deleted.', timer: 2000, showConfirmButton: false });
                    loadPrefixTypes();
                } catch (error) {
                    Swal.fire({ icon: 'error', title: 'Error', text: formatError(error), timer: 2000, showConfirmButton: false });
                }
            }
        });
    };

    const handleSelectChange = (selectedOption, name) => {
        const value = selectedOption ? selectedOption.value : '';
        handleInputChange({ target: { name, value } });
        if (selectedOption) {
            const control = currentSelectControlRef.current;
            setTimeout(() => { if (control) focusNextFromControl(control); }, 50);
        }
    };

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '38px',
            borderColor: state.isFocused ? '#0a500f' : '#cbd5e1',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 80, 15,0.15)' : 'none',
            '&:hover': { borderColor: '#0a500f' },
            borderRadius: '10px',
            fontSize: '14px',
        }),
        menu: base => ({ ...base, zIndex: 9999, fontSize: '14px' }),
        menuPortal: base => ({ ...base, zIndex: 9999 }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#0a500f' : state.isFocused ? '#eefdf6' : 'white',
            color: state.isSelected ? 'white' : '#333',
            cursor: 'pointer',
        }),
    };

    const filteredPrefixTypes = prefixTypes.filter(type =>
        (type.type_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentPrefixTypes = filteredPrefixTypes.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredPrefixTypes.length / itemsPerPage);

    const voucherTypeOptions = [
        { value: '', label: 'Select a voucher type...' },
        ...voucherTypes.map(vt => ({ value: vt.id, label: vt.name }))
    ];
    const voucherTypeValue = voucherTypeOptions.find(opt => String(opt.value) === String(formData.subtype)) || null;

    return (
        <div className="container-fluid">
            <style>{`
                .prefix-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .prefix-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .prefix-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: var(--form-icon-color, #0a500f);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .prefix-custom-modal .modal-close-x {
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
                .prefix-custom-modal .modal-close-x:hover { color: #555; }
                .prefix-custom-modal .modal-body-custom { padding: 28px; }
                .prefix-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .prefix-custom-modal .form-label-custom {
                    font-size: 14px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 8px;
                }
                .prefix-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 12px 16px;
                    font-size: 14px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .prefix-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .prefix-custom-modal .form-control-custom::placeholder { color: #94a3b8; }
                .prefix-custom-modal .btn-close-custom {
                    background-color: var(--cancel-btn-color, #dc3545) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .prefix-custom-modal .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .prefix-custom-modal .btn-save-custom {
                    background-color: var(--save-btn-color, #0a500f) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .prefix-custom-modal .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }
                .search-input-custom {
                    height: 38px !important;
                    border-radius: 6px !important;
                    padding-left: 35px !important;
                    font-size: 13px !important;
                }
            `}</style>
            <div className="row">
                <div className="col-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center">
                            <Card.Title className="mb-0">Voucher Types</Card.Title>
                            <div className="d-flex gap-2 align-items-center">
                                <div style={{ width: '300px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search voucher types..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="search-input-custom"
                                    />
                                </div>
                                <CreateButton module='prefix-type' onClick={() => handleShowModal()}>
                                     Voucher Type
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
                                    <Table responsive className="mb-0">
                                        <thead>
                                            <tr>
                                                <th>SL No.</th>
                                                <th>Type Name</th>
                                                <th>Voucher Type (Subtype)</th>
                                                <th style={{ textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredPrefixTypes.length === 0 ? (
                                                <tr>
                                                    <td colSpan="4" className="text-center py-4 text-muted">No entries</td>
                                                </tr>
                                            ) : (
                                                currentPrefixTypes.map((type, index) => (
                                                    <tr key={type.id}>
                                                        <td>{indexOfFirstItem + index + 1}</td>
                                                        <td>{type.type_name}</td>
                                                        <td>{type.subtype_name || '-'}</td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            <EditButton 
                                                                module='prefix-type'
                                                                onClick={() => handleShowModal(type)}
                                                                className="me-1"
                                                            />
                                                            <DeleteButton 
                                                                module='prefix-type'
                                                                onClick={() => handleDelete(type.id)}
                                                            />
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </Table>
                                </div>
                            )}

                            {filteredPrefixTypes.length > 0 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredPrefixTypes.length)} of {filteredPrefixTypes.length} entries
                                    </div>
                                            {totalPages > 1 && (
                                                <nav>
                                        <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                            <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ border: 'none', background: 'none' }}>
                                                    <i className="la la-angle-left" />
                                                </button>
                                            </li>
                                            {Array.from({ length: totalPages }, (_, index) => {
                                                const pageNumber = index + 1;
                                                if (
                                                    pageNumber === 1 ||
                                                    pageNumber === totalPages ||
                                                    (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                                                ) {
                                                    return (
                                                        <li key={pageNumber} className={`page-item ${currentPage === pageNumber ? 'active' : ''}`}>
                                                            <button type="button" className="page-link" onClick={() => setCurrentPage(pageNumber)} style={{ border: 'none' }}>
                                                                {pageNumber}
                                                            </button>
                                                        </li>
                                                    );
                                                } else if (
                                                    pageNumber === currentPage - 2 ||
                                                    pageNumber === currentPage + 2
                                                ) {
                                                    return (
                                                        <li key={pageNumber} className="page-item disabled">
                                                            <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                                        </li>
                                                    );
                                                }
                                                return null;
                                            })}
                                            <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                                <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} style={{ border: 'none', background: 'none' }}>
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

            <Modal show={showModal} onHide={() => setShowModal(false)} dialogClassName="prefix-custom-modal modal-md" centered>
                <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown} onFocus={handleFocus}>
                    <div className="modal-header-custom">
                        <div className="d-flex align-items-center gap-3">
                            <div className="modal-icon-circle">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" fill="white"/>
                                </svg>
                            </div>
                            <div>
                                <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                    {editMode ? 'Edit Voucher Type' : 'Add Voucher Type'}
                                </h4>
                            </div>
                        </div>
                        <button type="button" className="modal-close-x" onClick={() => setShowModal(false)}>&times;</button>
                    </div>
                    <div className="modal-body-custom">
                        <div className="form-group mb-3">
                            <Form.Label className="form-label-custom">Type Name <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                type="text"
                                className="form-control-custom"
                                name="type_name"
                                value={formData.type_name}
                                onChange={handleInputChange}
                                placeholder="Enter voucher type name"
                                required
                            />
                        </div>
                        <div className="form-group mb-3">
                            <Form.Label className="form-label-custom">Voucher Type (Subtype)</Form.Label>
                            <div className="input-group-custom">
                                <Select
                                    classNamePrefix="react-select"
                                    options={voucherTypeOptions}
                                    value={voucherTypeValue}
                                    onChange={(opt) => handleSelectChange(opt, 'subtype')}
                                    onFocus={handleSelectFocus}
                                    onKeyDown={handleSelectKeyDown}
                                    openMenuOnFocus={true}
                                    menuPortalTarget={document.body}
                                    styles={selectStyles}
                                    placeholder="Select a voucher type..."
                                />
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={() => setShowModal(false)}>
                            Close
                        </Button>
                        <Button type="submit" className="btn-save-custom">
                            {editMode ? 'Save Changes' : 'Save'}
                        </Button>
                    </div>
                </Form>
            </Modal>
        </div>
    );
};

export default ManagePrefixType;
