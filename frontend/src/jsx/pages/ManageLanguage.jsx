import React, { useState, useEffect, Fragment, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Card, Modal, Form, Button } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import {
    fetchLanguages,
    createLanguage,
    updateLanguage,
    deleteLanguage,
    formatLanguageError
} from '../../services/LanguageService';
import { countries } from '../../utils/countries';
import CreateButton from '../../components/permissions/CreateButton';
import EditButton from '../../components/permissions/EditButton';
import DeleteButton from '../../components/permissions/DeleteButton';

const ManageLanguage = () => {
    const [languages, setLanguages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const [addFormData, setAddFormData] = useState({
        code: '',
        name: '',
        country: '',
        is_active: true
    });

    const [editFormData, setEditFormData] = useState({
        id: '',
        code: '',
        name: '',
        country: '',
        is_active: true
    });

    const currentSelectControlRef = useRef(null);

    useEffect(() => {
        loadLanguages();
    }, []);

    const loadLanguages = async () => {
        try {
            setLoading(true);
            const response = await fetchLanguages();
            setLanguages(response.data);
        } catch (error) {
            console.error('Failed to fetch languages:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to load languages'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleAddFormChange = (event) => {
        const { name, value, type, checked } = event.target;
        setAddFormData({
            ...addFormData,
            [name]: type === 'checkbox' ? checked : value
        });
    };

    const handleCountryChange = (selectedOption) => {
        setAddFormData({
            ...addFormData,
            country: selectedOption ? selectedOption.value : ''
        });
    };

    const handleEditFormChange = (event) => {
        const { name, value, type, checked } = event.target;
        setEditFormData({
            ...editFormData,
            [name]: type === 'checkbox' ? checked : value
        });
    };

    const handleEditCountryChange = (selectedOption) => {
        setEditFormData({
            ...editFormData,
            country: selectedOption ? selectedOption.value : ''
        });
    };

    const handleAddSubmit = async (event) => {
        event.preventDefault();
        try {
            await createLanguage(addFormData);
            setShowAddModal(false);
            setAddFormData({ code: '', name: '', country: '', is_active: true });
            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: 'Language added successfully',
                timer: 1500,
                showConfirmButton: false
            });
            loadLanguages();
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: formatLanguageError(error)
            });
        }
    };

    const handleEditClick = (event, language) => {
        event.preventDefault();
        setEditFormData({
            id: language.id,
            code: language.code || '',
            name: language.name || '',
            country: language.country || '',
            is_active: language.is_active
        });
        setShowEditModal(true);
    };

    const handleEditSubmit = async (event) => {
        event.preventDefault();
        try {
            await updateLanguage(editFormData.id, editFormData);
            setShowEditModal(false);
            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: 'Language updated successfully',
                timer: 1500,
                showConfirmButton: false
            });
            loadLanguages();
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: formatLanguageError(error)
            });
        }
    };

    const handleDeleteClick = (id) => {
        Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteLanguage(id);
                    Swal.fire({
                        icon: 'success',
                        title: 'Deleted!',
                        text: 'Language has been deleted.',
                        timer: 1500,
                        showConfirmButton: false
                    });
                    loadLanguages();
                } catch (error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: formatLanguageError(error)
                    });
                }
            }
        });
    };

    // Enter key navigation
    const getFocusable = () =>
        Array.from(
            document.querySelectorAll('.form-control-custom, .react-select__control, input[type="checkbox"]:not([disabled]), button[type="submit"]:not([disabled])')
        ).filter(el => el.offsetParent !== null && !el.disabled);

    const focusNextFromControl = (control) => {
        const all = getFocusable();
        const index = all.indexOf(control);
        if (index > -1 && index < all.length - 1) {
            if (index === all.length - 2) {
                all[all.length - 1].click();
            } else {
                const next = all[index + 1];
                if (next.classList.contains('react-select__control')) {
                    next.querySelector('input')?.focus();
                } else {
                    next.focus();
                }
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        
        const menuOpen = !!document.querySelector('.react-select__menu');
        if (menuOpen) return;

        const activeEl = document.activeElement;
        const reactSelectInput = activeEl.closest('.react-select__control');
        if (reactSelectInput) {
            e.preventDefault();
            focusNextFromControl(reactSelectInput);
            return;
        }

        const all = getFocusable();
        const index = all.indexOf(activeEl);
        if (index > -1 && index < all.length - 1) {
            e.preventDefault();
            const next = all[index + 1];
            if (index === all.length - 2) {
                all[all.length - 1].click();
            } else if (next.classList.contains('react-select__control')) {
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

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '38px',
            borderColor: state.isFocused ? '#2ece8a' : '#cbd5e1',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(46,206,138,0.15)' : 'none',
            '&:hover': { borderColor: '#2ece8a' },
            borderRadius: '10px',
            fontSize: '13px',
        }),
        menu: base => ({ ...base, zIndex: 9999, fontSize: '13px' }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#2ece8a' : state.isFocused ? '#eefdf6' : 'white',
            color: state.isSelected ? 'white' : '#333',
            cursor: 'pointer',
        }),
    };

    const countryOptions = countries.map(c => ({ value: c.code, label: c.name }));
    const countryValue = countryOptions.find(opt => opt.value === addFormData.country) || null;
    const editCountryValue = countryOptions.find(opt => opt.value === editFormData.country) || null;

    const filteredLanguages = languages.filter(l =>
        (l.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.country || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentLanguages = filteredLanguages.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredLanguages.length / itemsPerPage);

    return (
        <div className="container-fluid">
            <style>{`
                .language-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .language-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .language-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #38bdf8;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(56, 189, 248, 0.2);
                }
                .language-custom-modal .modal-close-x {
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
                .language-custom-modal .modal-close-x:hover { color: #555; }
                .language-custom-modal .modal-body-custom {
                    padding: 28px;
                    max-height: 70vh;
                    overflow-y: auto;
                }
                .language-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .language-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .language-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .language-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                }
                .language-custom-modal .form-control-custom::placeholder { color: #94a3b8; }
                .language-custom-modal .form-check-input:checked {
                    background-color: #2ece8a;
                    border-color: #2ece8a;
                }
                .language-custom-modal .btn-close-custom {
                    background-color: #7A70BA !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .language-custom-modal .btn-close-custom:hover { background-color: #6357a7 !important; }
                .language-custom-modal .btn-save-custom {
                    background-color: #2ece8a !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .language-custom-modal .btn-save-custom:hover { background-color: #26b277 !important; }
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
                        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                            <Card.Title className="mb-0">Language Management</Card.Title>
                            <div className="d-flex flex-wrap gap-2 align-items-center">
                                <div style={{ minWidth: '180px', flex: '1 1 200px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search languages..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="search-input-custom"
                                    />
                                </div>
                                <CreateButton module="languages" onClick={() => setShowAddModal(true)}>
                                    Language
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
                                    <table className='table table-responsive-md'>
                                        <thead>
                                            <tr>
                                                <th><strong>SL No</strong></th>
                                                <th><strong>CODE</strong></th>
                                                <th><strong>NAME</strong></th>
                                                <th><strong>COUNTRY</strong></th>
                                                <th><strong>STATUS</strong></th>
                                                <th className="text-end"><strong>ACTION</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredLanguages.length === 0 ? (
                                                <tr>
                                                    <td colSpan="6" className="text-center py-4 text-muted">No entries</td>
                                                </tr>
                                            ) : (
                                                currentLanguages.map((language, index) => (
                                                    <tr key={language.id}>
                                                        <td>{indexOfFirstItem + index + 1}</td>
                                                        <td><strong>{language.code}</strong></td>
                                                        <td>{language.name}</td>
                                                        <td>{language.country || '-'}</td>
                                                        <td>
                                                            {language.is_active ? (
                                                                <span className="badge light badge-success">Active</span>
                                                            ) : (
                                                                <span className="badge light badge-danger">Inactive</span>
                                                            )}
                                                        </td>
                                                        <td className="text-end">
                                                            <div className="d-flex justify-content-end gap-1">
                                                                <EditButton module="languages" onClick={(event) => handleEditClick(event, language)} />
                                                                <DeleteButton module="languages" onClick={() => handleDeleteClick(language.id)} />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {filteredLanguages.length > 0 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredLanguages.length)} of {filteredLanguages.length} entries
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

            {/* Add Language Modal */}
            <Modal show={showAddModal} onHide={() => setShowAddModal(false)} dialogClassName="language-custom-modal modal-md" centered>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" fill="white"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                Add New Language
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to register a new language
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowAddModal(false)}>&times;</button>
                </div>
                <Form onSubmit={handleAddSubmit} onKeyDown={handleKeyDown}>
                    <div className="modal-body-custom">
                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Language Name <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    name="name"
                                    required
                                    placeholder="e.g., French"
                                    value={addFormData.name}
                                    onChange={handleAddFormChange}
                                    autoFocus
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Language Code <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    name="code"
                                    required
                                    placeholder="e.g., fr"
                                    value={addFormData.code}
                                    onChange={handleAddFormChange}
                                />
                            </div>
                            <div className="col-md-12 mb-3">
                                <Form.Label className="form-label-custom">Country</Form.Label>
                                <Select
                                    classNamePrefix="react-select"
                                    options={countryOptions}
                                    value={countryValue}
                                    onChange={handleCountryChange}
                                    onKeyDown={handleSelectKeyDown}
                                    onFocus={handleSelectFocus}
                                    styles={selectStyles}
                                    placeholder="Select Country"
                                    openMenuOnFocus={true}
                                />
                            </div>
                            <div className="col-md-12 mb-3">
                                <Form.Check
                                    type="checkbox"
                                    id="add_is_active_check"
                                    name="is_active"
                                    label="Active"
                                    checked={addFormData.is_active}
                                    onChange={handleAddFormChange}
                                    className="form-check-input-custom"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={() => setShowAddModal(false)}>Close</Button>
                        <Button type="submit" className="btn-save-custom">Save</Button>
                    </div>
                </Form>
            </Modal>

            {/* Edit Language Modal */}
            <Modal show={showEditModal} onHide={() => setShowEditModal(false)} dialogClassName="language-custom-modal modal-md" centered>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="white"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                Edit Language
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Modify details to update language
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowEditModal(false)}>&times;</button>
                </div>
                <Form onSubmit={handleEditSubmit} onKeyDown={handleKeyDown}>
                    <div className="modal-body-custom">
                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Language Name <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    name="name"
                                    required
                                    placeholder="e.g., French"
                                    value={editFormData.name}
                                    onChange={handleEditFormChange}
                                    autoFocus
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Language Code <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    name="code"
                                    required
                                    placeholder="e.g., fr"
                                    value={editFormData.code}
                                    onChange={handleEditFormChange}
                                />
                            </div>
                            <div className="col-md-12 mb-3">
                                <Form.Label className="form-label-custom">Country</Form.Label>
                                <Select
                                    classNamePrefix="react-select"
                                    options={countryOptions}
                                    value={editCountryValue}
                                    onChange={handleEditCountryChange}
                                    onKeyDown={handleSelectKeyDown}
                                    onFocus={handleSelectFocus}
                                    styles={selectStyles}
                                    placeholder="Select Country"
                                    openMenuOnFocus={true}
                                />
                            </div>
                            <div className="col-md-12 mb-3">
                                <Form.Check
                                    type="checkbox"
                                    id="edit_is_active_check"
                                    name="is_active"
                                    label="Active"
                                    checked={editFormData.is_active}
                                    onChange={handleEditFormChange}
                                    className="form-check-input-custom"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={() => setShowEditModal(false)}>Close</Button>
                        <Button type="submit" className="btn-save-custom">Save</Button>
                    </div>
                </Form>
            </Modal>
        </div>
    );
};

export default ManageLanguage;
