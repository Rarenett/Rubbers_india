import React, { useState, useEffect, Fragment, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Card, Modal, Form, Button } from 'react-bootstrap';
import Select from 'react-select';
import swal from 'sweetalert';
import {
    fetchCurrencies,
    createCurrency,
    updateCurrency,
    deleteCurrency,
    fetchExchangeRates,
    createExchangeRate,
    deleteExchangeRate,
    formatError
} from '../../services/CurrencyService';
import { formatDate } from '../../utils/dateUtils';
import { countries } from '../../utils/countries';
import CreateButton from '../../components/permissions/CreateButton';
import EditButton from '../../components/permissions/EditButton';
import DeleteButton from '../../components/permissions/DeleteButton';

const ManageCurrency = () => {
    // State
    const [currencies, setCurrencies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [addModal, setAddModal] = useState(false);
    const [editModal, setEditModal] = useState(false);

    // Exchange Rate Modal State
    const [rateModal, setRateModal] = useState(false);
    const [currentCurrency, setCurrentCurrency] = useState(null);
    const [exchangeRates, setExchangeRates] = useState([]);
    const [rateLoading, setRateLoading] = useState(false);
    const [rateFormData, setRateFormData] = useState({
        to_currency: '',
        rate: '',
        effective_date: new Date().toISOString().split('T')[0],
        is_active: true
    });

    // Form data for adding
    const [addFormData, setAddFormData] = useState({
        code: '',
        name: '',
        symbol: '',
        decimal_places: 2,
        country: '',
        is_active: true,
    });

    // Form data for editing
    const [editFormData, setEditFormData] = useState({
        code: '',
        name: '',
        symbol: '',
        decimal_places: 2,
        country: '',
        is_active: true,
    });
    const [editCurrencyId, setEditCurrencyId] = useState(null);

    const currentSelectControlRef = useRef(null);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    // Load data on component mount
    useEffect(() => {
        loadCurrencies();
    }, []);

    // Fetch currencies from API
    const loadCurrencies = async () => {
        try {
            setLoading(true);
            const response = await fetchCurrencies();
            setCurrencies(response.data);
        } catch (error) {
            swal('Error', formatError(error), 'error');
        } finally {
            setLoading(false);
        }
    };

    // Handle input changes for add form
    const handleAddFormChange = (event) => {
        const { name, value, type, checked } = event.target;
        setAddFormData({
            ...addFormData,
            [name]: type === 'checkbox' ? checked : value
        });
    };

    // Handle country select changes
    const handleCountryChange = (selectedOption) => {
        setAddFormData({
            ...addFormData,
            country: selectedOption ? selectedOption.value : ''
        });
    };

    // Handle add form submit
    const handleAddFormSubmit = async (event) => {
        event.preventDefault();
        try {
            await createCurrency(addFormData);
            swal('Success', 'Currency created successfully!', 'success');
            setAddModal(false);
            setAddFormData({ code: '', name: '', symbol: '', decimal_places: 2, country: '', is_active: true });
            loadCurrencies();
        } catch (error) {
            swal('Error', formatError(error), 'error');
        }
    };

    // Handle edit button click
    const handleEditClick = (event, currency) => {
        event.preventDefault();
        setEditCurrencyId(currency.id);
        setEditFormData({
            code: currency.code || '',
            name: currency.name || '',
            symbol: currency.symbol || '',
            decimal_places: currency.decimal_places !== null ? currency.decimal_places : 2,
            country: currency.country || '',
            is_active: currency.is_active,
        });
        setEditModal(true);
    };

    // Handle input changes for edit form
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

    // Handle edit form submit
    const handleEditFormSubmit = async (event) => {
        event.preventDefault();
        try {
            await updateCurrency(editCurrencyId, editFormData);
            swal('Success', 'Currency updated successfully!', 'success');
            setEditModal(false);
            setEditCurrencyId(null);
            loadCurrencies();
        } catch (error) {
            swal('Error', formatError(error), 'error');
        }
    };

    // Handle delete
    const handleDeleteClick = async (event, currencyId) => {
        event.preventDefault();
        event.stopPropagation();
        swal({
            title: 'Are you sure?',
            text: 'This will delete the currency and might affect related financial records!',
            icon: 'warning',
            buttons: true,
            dangerMode: true,
        }).then(async (willDelete) => {
            if (willDelete) {
                try {
                    await deleteCurrency(currencyId);
                    swal('Deleted!', 'Currency has been deleted.', 'success');
                    loadCurrencies();
                } catch (error) {
                    swal('Error', formatError(error), 'error');
                }
            }
        });
    };

    // ==================== EXCHANGE RATE LOGIC ====================

    // Open Rate Modal
    const handleRateClick = (currency) => {
        setCurrentCurrency(currency);
        setRateModal(true);
        loadExchangeRates(currency.id);
        setRateFormData({
            ...rateFormData,
            from_currency: currency.id,
            to_currency: '',
            rate: ''
        });
    };

    // Fetch Rates
    const loadExchangeRates = async (currencyId) => {
        try {
            setRateLoading(true);
            const response = await fetchExchangeRates({ from_currency: currencyId });
            setExchangeRates(response.data);
        } catch (error) {
            swal('Error', formatError(error), 'error');
        } finally {
            setRateLoading(false);
        }
    };

    // Handle Rate Form Change
    const handleRateFormChange = (event) => {
        const { name, value, type, checked } = event.target;
        setRateFormData({
            ...rateFormData,
            [name]: type === 'checkbox' ? checked : value
        });
    };

    const handleToCurrencyChange = (selectedOption) => {
        setRateFormData({
            ...rateFormData,
            to_currency: selectedOption ? selectedOption.value : ''
        });
    };

    // Handle Rate Form Submit
    const handleRateFormSubmit = async (event) => {
        event.preventDefault();
        try {
            const payload = {
                ...rateFormData,
                from_currency: currentCurrency.id
            };
            await createExchangeRate(payload);
            swal('Success', 'Exchange rate added successfully!', 'success');
            setRateFormData({ ...rateFormData, to_currency: '', rate: '' });
            loadExchangeRates(currentCurrency.id);
        } catch (error) {
            swal('Error', formatError(error), 'error');
        }
    };

    // Handle Rate Delete
    const handleRateDelete = async (rateId) => {
        try {
            await deleteExchangeRate(rateId);
            swal('Deleted!', 'Exchange rate deleted.', 'success');
            loadExchangeRates(currentCurrency.id);
        } catch (error) {
            swal('Error', formatError(error), 'error');
        }
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
            borderColor: state.isFocused ? '#0a500f' : '#cbd5e1',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 80, 15,0.15)' : 'none',
            '&:hover': { borderColor: '#0a500f' },
            borderRadius: '10px',
            fontSize: '13px',
        }),
        menu: base => ({ ...base, zIndex: 9999, fontSize: '13px' }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#0a500f' : state.isFocused ? '#eefdf6' : 'white',
            color: state.isSelected ? 'white' : '#333',
            cursor: 'pointer',
        }),
    };

    const countryOptions = countries.map(c => ({ value: c.code, label: c.name }));
    const countryValue = countryOptions.find(opt => opt.value === addFormData.country) || null;
    const editCountryValue = countryOptions.find(opt => opt.value === editFormData.country) || null;

    const safeCurrencies = Array.isArray(currencies) ? currencies : [];
    const toCurrencyOptions = safeCurrencies
        .filter(c => c.id !== currentCurrency?.id)
        .map(c => ({ value: c.id, label: `${c.code} - ${c.name}` }));
    const toCurrencyValue = toCurrencyOptions.find(opt => String(opt.value) === String(rateFormData.to_currency)) || null;

    const filteredCurrencies = safeCurrencies.filter(c =>
        (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.country || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentCurrencies = filteredCurrencies.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredCurrencies.length / itemsPerPage);

    return (
        <div className="container-fluid">
            <style>{`
                .currency-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .currency-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .currency-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: var(--form-icon-color, #f87171);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(248, 113, 113, 0.2);
                }
                .currency-custom-modal .modal-close-x {
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
                .currency-custom-modal .modal-close-x:hover { color: #555; }
                .currency-custom-modal .modal-body-custom {
                    padding: 28px;
                    max-height: 70vh;
                    overflow-y: auto;
                }
                .currency-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .currency-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .currency-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .currency-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .currency-custom-modal .form-control-custom::placeholder { color: #94a3b8; }
                .currency-custom-modal .form-check-input:checked {
                    background-color: #0a500f;
                    border-color: #0a500f;
                }
                .currency-custom-modal .btn-close-custom {
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
                .currency-custom-modal .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .currency-custom-modal .btn-save-custom {
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
                .currency-custom-modal .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }
                .search-input-custom {
                    height: 38px !important;
                    border-radius: 6px !important;
                    padding-left: 35px !important;
                    font-size: 13px !important;
                }
            `}</style>

            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                            <Card.Title className="mb-0">Currency Management</Card.Title>
                            <div className="d-flex flex-wrap gap-2 align-items-center">
                                <div style={{ minWidth: '180px', flex: '1 1 200px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search currencies..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="search-input-custom"
                                    />
                                </div>
                                <CreateButton module="currencies" onClick={() => setAddModal(true)}>
                                    Currency
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
                                                <th><strong>SL No</strong></th>
                                                <th><strong>CODE</strong></th>
                                                <th><strong>NAME</strong></th>
                                                <th><strong>SYMBOL</strong></th>
                                                <th><strong>DECIMALS</strong></th>
                                                <th><strong>COUNTRY CODE</strong></th>
                                                <th><strong>STATUS</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredCurrencies.length === 0 ? (
                                                <tr>
                                                    <td colSpan="8" className="text-center py-4 text-muted">No entries</td>
                                                </tr>
                                            ) : (
                                                currentCurrencies.map((currency, index) => (
                                                    <tr key={currency.id}>
                                                        <td>{indexOfFirstItem + index + 1}</td>
                                                        <td><strong>{currency.code}</strong></td>
                                                        <td>{currency.name}</td>
                                                        <td>{currency.symbol || '-'}</td>
                                                        <td>{currency.decimal_places !== null ? currency.decimal_places : 2}</td>
                                                        <td>{currency.country || '-'}</td>
                                                        <td>
                                                            {currency.is_active ? (
                                                                <span className="badge light badge-success">Active</span>
                                                            ) : (
                                                                <span className="badge light badge-danger">Inactive</span>
                                                            )}
                                                        </td>
                                                        <td className="text-end">
                                                            <div className="d-flex justify-content-end gap-1">
                                                                <Link to={"#"} className="btn btn-info shadow btn-xs sharp"
                                                                    title="Exchange Rates"
                                                                    onClick={() => handleRateClick(currency)}
                                                                >
                                                                    <i className="la la-exchange-alt"></i>
                                                                </Link>
                                                                <EditButton module="currencies" onClick={(event) => handleEditClick(event, currency)} />
                                                                <DeleteButton module="currencies" onClick={(event) => handleDeleteClick(event, currency.id)} />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {filteredCurrencies.length > 0 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredCurrencies.length)} of {filteredCurrencies.length} entries
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

            {/* Add Currency Modal */}
            <Modal show={addModal} onHide={() => setAddModal(false)} dialogClassName="currency-custom-modal modal-md" centered>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 16h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 11.9 13 12.5 13 14h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z" fill="white"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                Add Currency
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to add a new currency
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setAddModal(false)}>&times;</button>
                </div>
                <Form onSubmit={handleAddFormSubmit} onKeyDown={handleKeyDown}>
                    <div className="modal-body-custom">
                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Currency Code <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    name="code"
                                    required
                                    maxLength="3"
                                    placeholder="e.g., USD"
                                    value={addFormData.code}
                                    onChange={handleAddFormChange}
                                    autoFocus
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Name <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    name="name"
                                    required
                                    placeholder="e.g., US Dollar"
                                    value={addFormData.name}
                                    onChange={handleAddFormChange}
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Symbol</Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    name="symbol"
                                    placeholder="e.g., $"
                                    value={addFormData.symbol}
                                    onChange={handleAddFormChange}
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Decimal Places</Form.Label>
                                <Form.Control
                                    type="number"
                                    className="form-control-custom"
                                    name="decimal_places"
                                    min="0"
                                    max="4"
                                    value={addFormData.decimal_places}
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
                        <Button type="button" className="btn-close-custom" onClick={() => setAddModal(false)}>Cancel</Button>
                        <Button type="submit" className="btn-save-custom">Save</Button>
                    </div>
                </Form>
            </Modal>

            {/* Edit Currency Modal */}
            <Modal show={editModal} onHide={() => setEditModal(false)} dialogClassName="currency-custom-modal modal-md" centered>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="white"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                Edit Currency
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Modify details to update currency
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setEditModal(false)}>&times;</button>
                </div>
                <Form onSubmit={handleEditFormSubmit} onKeyDown={handleKeyDown}>
                    <div className="modal-body-custom">
                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Currency Code <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    name="code"
                                    required
                                    maxLength="3"
                                    placeholder="e.g., USD"
                                    value={editFormData.code}
                                    onChange={handleEditFormChange}
                                    autoFocus
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Name <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    name="name"
                                    required
                                    placeholder="e.g., US Dollar"
                                    value={editFormData.name}
                                    onChange={handleEditFormChange}
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Symbol</Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    name="symbol"
                                    placeholder="e.g., $"
                                    value={editFormData.symbol}
                                    onChange={handleEditFormChange}
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Decimal Places</Form.Label>
                                <Form.Control
                                    type="number"
                                    className="form-control-custom"
                                    name="decimal_places"
                                    min="0"
                                    max="4"
                                    value={editFormData.decimal_places}
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
                        <Button type="button" className="btn-close-custom" onClick={() => setEditModal(false)}>Discard</Button>
                        <Button type="submit" className="btn-save-custom">Save</Button>
                    </div>
                </Form>
            </Modal>

            {/* Exchange Rate Management Modal */}
            <Modal show={rateModal} onHide={() => setRateModal(false)} dialogClassName="currency-custom-modal modal-lg" centered>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z" fill="white"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                Manage Exchange Rates for {currentCurrency?.code}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Add and view exchange rates for currency conversions
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setRateModal(false)}>&times;</button>
                </div>
                <div className="modal-body-custom">
                    <div className="row">
                        <div className="col-md-5 border-end pr-4">
                            <h5 className="font-w600 mb-3" style={{ fontSize: '15px' }}>Add New Rate</h5>
                            <Form onSubmit={handleRateFormSubmit} onKeyDown={handleKeyDown}>
                                <div className="mb-3">
                                    <Form.Label className="form-label-custom">To Currency <span className="text-danger">*</span></Form.Label>
                                    <Select
                                        classNamePrefix="react-select"
                                        options={toCurrencyOptions}
                                        value={toCurrencyValue}
                                        onChange={handleToCurrencyChange}
                                        onKeyDown={handleSelectKeyDown}
                                        onFocus={handleSelectFocus}
                                        styles={selectStyles}
                                        placeholder="Select Currency"
                                        openMenuOnFocus={true}
                                    />
                                </div>
                                <div className="mb-3">
                                    <Form.Label className="form-label-custom">Rate (1 {currentCurrency?.code} = ?) <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="number"
                                        step="0.0001"
                                        className="form-control-custom"
                                        name="rate"
                                        required
                                        placeholder="0.0000"
                                        value={rateFormData.rate}
                                        onChange={handleRateFormChange}
                                    />
                                </div>
                                <div className="mb-3">
                                    <Form.Label className="form-label-custom">Effective Date <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="date"
                                        className="form-control-custom"
                                        name="effective_date"
                                        required
                                        value={rateFormData.effective_date}
                                        onChange={handleRateFormChange}
                                    />
                                </div>
                                <div className="mb-3">
                                    <Form.Check
                                        type="checkbox"
                                        name="is_active"
                                        id="rate_is_active_check"
                                        label="Is Active"
                                        checked={rateFormData.is_active}
                                        onChange={handleRateFormChange}
                                        className="form-check-input-custom"
                                    />
                                </div>
                                <Button type="submit" className="btn-save-custom w-100 mt-2">Add Rate</Button>
                            </Form>
                        </div>
                        <div className="col-md-7 pl-4">
                            <h5 className="font-w600 mb-3" style={{ fontSize: '15px' }}>Existing Rates</h5>
                            {rateLoading ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                    <table className="table table-sm">
                                        <thead>
                                            <tr>
                                                <th><strong>TO</strong></th>
                                                <th><strong>RATE</strong></th>
                                                <th><strong>DATE</strong></th>
                                                <th><strong>STATUS</strong></th>
                                                <th className="text-end"><strong>ACTION</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {exchangeRates.length === 0 ? (
                                                <tr>
                                                    <td colSpan="5" className="text-center py-4 text-muted">No rates found</td>
                                                </tr>
                                            ) : (
                                                exchangeRates.map(rate => (
                                                    <tr key={rate.id}>
                                                        <td><strong>{currencies.find(c => c.id === rate.to_currency)?.code}</strong></td>
                                                        <td>{rate.rate}</td>
                                                        <td>{formatDate(rate.effective_date)}</td>
                                                        <td>
                                                            <span className={`badge badge-xs light badge-${rate.is_active ? 'success' : 'primary'}`}>
                                                                {rate.is_active ? 'Active' : 'Inactive'}
                                                            </span>
                                                        </td>
                                                        <td className="text-end">
                                                            <button
                                                                type="button"
                                                                className="btn btn-danger shadow btn-xs sharp"
                                                                onClick={() => handleRateDelete(rate.id)}
                                                                title="Delete"
                                                            >
                                                                <i className="fa fa-trash"></i>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="modal-footer-custom">
                    <Button type="button" className="btn-close-custom" onClick={() => setRateModal(false)}>Close</Button>
                </div>
            </Modal>
        </div>
    );
};

export default ManageCurrency;
