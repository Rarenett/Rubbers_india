import React, { useState, useEffect, useRef, Fragment } from 'react';
import { Modal, Table, Card, Form, Button } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import {
    fetchPrefixConfigurations,
    createPrefixConfiguration,
    updatePrefixConfiguration,
    deletePrefixConfiguration,
    fetchPrefixTypes,
    fetchPrefixSubTypes,
    formatError
} from '../../services/PrefixService';
import { fetchBranches } from '../../services/CompanyService';
import { getVoucherTypes, getLedgers, fetchVoucherSubTypes } from '../../services/FinanceService';
import CreateButton from '../../components/permissions/CreateButton';
import EditButton from '../../components/permissions/EditButton';
import DeleteButton from '../../components/permissions/DeleteButton';
import { usePageTitle } from '../../context/TitleContext';

const ManagePrefixConfiguration = () => {
    usePageTitle("Voucher Configurations");
    const [configurations, setConfigurations] = useState([]);
    const [prefixTypes, setPrefixTypes] = useState([]);
    const [voucherTypes, setVoucherTypes] = useState([]);
    const [ledgers, setLedgers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [availableJournalSubtypes, setAvailableJournalSubtypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [currentId, setCurrentId] = useState(null);
    const [formData, setFormData] = useState({
        voucher_type: '',
        subvoucher_type: '',
        sub_type: '',
        applicable_date: '',
        prefix: '',
        number_padding: 4,
        starting_number: 1,
        branch: '',
        postfix: '',
        ledger: '',
        gst_ledger: []
    });
    const currentSelectControlRef = useRef(null);

    
    // Reset pagination on search change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    // Fetch journal subtypes if voucher type is Stock Journal or Manufacture Journal
    useEffect(() => {
        const fetchSubTypes = async () => {
            const selectedVoucherType = voucherTypes.find(vt => String(vt.id) === String(formData.voucher_type));
            if (selectedVoucherType) {
                const nameLower = selectedVoucherType.name.toLowerCase();
                if (nameLower.includes('stock journal') || nameLower.includes('manufacture journal') || nameLower.includes('manufactural journal') || nameLower.includes('manufacturing journal')) {
                    try {
                        const subtypes = await fetchVoucherSubTypes(formData.voucher_type);
                        setAvailableJournalSubtypes(subtypes || []);
                    } catch (error) {
                        console.error('Failed to fetch voucher subtypes', error);
                        setAvailableJournalSubtypes([]);
                    }
                    return;
                }
            }
            setAvailableJournalSubtypes([]);
        };
        fetchSubTypes();
    }, [formData.voucher_type, voucherTypes]);




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
                '.form-control-custom, .react-select__control, button[type="submit"]:not([disabled])'
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

    const module = 'company';

    useEffect(() => {
        loadData();
    }, []);

    

    const loadData = async () => {
        try {
            setLoading(true);
            const [configRes, typesRes, branchesRes, vTypesRes, ledgersRes] = await Promise.all([
                fetchPrefixConfigurations(),
                fetchPrefixTypes(),
                fetchBranches(),
                getVoucherTypes(),
                getLedgers()
            ]);
            
            const configs = Array.isArray(configRes.data) ? configRes.data : (configRes.data?.results || []);
            const types = Array.isArray(typesRes.data) ? typesRes.data : (typesRes.data?.results || []);
            const branchesData = Array.isArray(branchesRes.data) ? branchesRes.data : (branchesRes.data?.results || []);
            const vTypesData = Array.isArray(vTypesRes) ? vTypesRes : (vTypesRes?.results || vTypesRes?.data || []);
            const ledgersData = Array.isArray(ledgersRes) ? ledgersRes : (ledgersRes?.results || ledgersRes?.data || []);

            setConfigurations(configs);
            setPrefixTypes(types);
            setBranches(branchesData);
            setVoucherTypes(vTypesData);
            setLedgers(ledgersData);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: formatError(error), timer: 2000, showConfirmButton: false });
        } finally {
            setLoading(false);
        }
    };

    const handleShowModal = (config = null) => {
        if (config) {
            setEditMode(true);
            setCurrentId(config.id);
            setFormData({
                voucher_type: config.voucher_type || '',
                subvoucher_type: config.subvoucher_type || '',
                sub_type: config.sub_type || '',
                applicable_date: config.applicable_date || '',
                prefix: config.prefix || '',
                number_padding: config.number_padding || 4,
                starting_number: config.starting_number || 1,
                branch: config.branch || '',
                postfix: config.postfix || '',
                ledger: config.ledger || '',
                gst_ledger: config.gst_ledger || []
            });
        } else {
            setEditMode(false);
            setCurrentId(null);
            setFormData({
                voucher_type: '',
                subvoucher_type: '',
                sub_type: '',
                applicable_date: '',
                prefix: '',
                number_padding: 4,
                starting_number: 1,
                branch: '',
                postfix: '',
                ledger: '',
                gst_ledger: []
            });
        }
        setShowModal(true);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        const newValue = value === '' ? '' : value;

        setFormData(prev => {
            const updated = { ...prev, [name]: newValue };
            if (name === 'voucher_type') {
                updated.subvoucher_type = '';
                updated.sub_type = '';
                updated.ledger = '';
                updated.gst_ledger = [];
            }
            return updated;
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.voucher_type) {
            Swal.fire({ icon: 'warning', title: 'Warning', text: 'Voucher Type is required', timer: 2000, showConfirmButton: false });
            return;
        }
        const totalLen = (formData.prefix || '').length + parseInt(formData.number_padding || 0) + (formData.postfix || '').length;
        if (totalLen > 15) {
            Swal.fire({ icon: 'warning', title: 'Warning', text: 'Total configured length (prefix + padding + postfix) cannot exceed 15 characters.', timer: 2000, showConfirmButton: false });
            return;
        }
        try {
            if (editMode) {
                await updatePrefixConfiguration(currentId, formData);
                Swal.fire({ icon: 'success', title: 'Updated', text: 'Configuration updated successfully.', timer: 2000, showConfirmButton: false });
            } else {
                await createPrefixConfiguration(formData);
                Swal.fire({ icon: 'success', title: 'Created', text: 'Configuration created successfully.', timer: 2000, showConfirmButton: false });
            }
            setShowModal(false);
            loadData();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: formatError(error), timer: 2000, showConfirmButton: false });
        }
    };

    const handleDelete = (id) => {
        Swal.fire({
            title: 'Are you sure?',
            text: "Once deleted, you will not be able to recover this configuration!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deletePrefixConfiguration(id);
                    Swal.fire({ icon: 'success', title: 'Deleted!', text: 'Configuration has been deleted.', timer: 2000, showConfirmButton: false });
                    loadData();
                } catch (error) {
                    Swal.fire({ icon: 'error', title: 'Error', text: formatError(error), timer: 2000, showConfirmButton: false });
                }
            }
        });
    };

    const branchOptions = [
        { value: '', label: 'All Branches' },
        ...branches.map(b => ({ value: b.id, label: b.name }))
    ];
    const branchValue = branchOptions.find(opt => String(opt.value) === String(formData.branch)) || { value: '', label: 'All Branches' };

    const voucherTypeOptions = [
        { value: '', label: 'Select Voucher Type' },
        ...voucherTypes.map(vt => ({ value: vt.id, label: vt.name }))
    ];
    const voucherTypeValue = voucherTypeOptions.find(opt => String(opt.value) === String(formData.voucher_type)) || null;

    const prefixTypeOptions = [
        { value: '', label: 'Select Subvoucher Type' },
        ...prefixTypes
            .filter(t => !formData.voucher_type || String(t.subtype) === String(formData.voucher_type))
            .map(t => ({ value: t.id, label: t.type_name }))
    ];
    const prefixTypeValue = prefixTypeOptions.find(opt => String(opt.value) === String(formData.subvoucher_type)) || null;

    const selectedVoucherType = voucherTypes.find(vt => String(vt.id) === String(formData.voucher_type));
    const vtName = selectedVoucherType ? selectedVoucherType.name.toLowerCase() : '';
    const isLedgerApplicable = selectedVoucherType && [
        'sales',
        'purchase',
        'sales order',
        'purchase order gst',
        'credit note',
        'debit note',
        'quotation'
    ].includes(vtName);
    
    const isJournalType = selectedVoucherType && (
        vtName.includes('stock journal') ||
        vtName.includes('manufacture journal') ||
        vtName.includes('manufactural journal') ||
        vtName.includes('manufacturing journal')
    );

    const journalSubTypeOptions = [
        { value: '', label: 'Select Sub Type' },
        ...availableJournalSubtypes.map(st => ({ value: st, label: st }))
    ];
    const journalSubTypeValue = journalSubTypeOptions.find(opt => opt.value === formData.sub_type) || null;


    const ledgerOptions = [
        { value: '', label: 'Select Ledger' },
        ...ledgers
            .filter(l => {
                if (vtName.includes('sales') || vtName === 'credit note') return l.account_group_name === 'Sales Accounts';
                if (vtName.includes('purchase') || vtName === 'debit note') return l.account_group_name === 'Purchase Accounts';
                return true;
            })
            .map(l => ({ value: l.id, label: l.name }))
    ];
    const ledgerValue = ledgerOptions.find(opt => String(opt.value) === String(formData.ledger)) || null;

    const gstLedgerOptions = ledgers
        .filter(l => l.account_group_name === 'Duties & Taxes')
        .map(l => ({ value: l.id, label: l.name }));
    const gstLedgerValue = gstLedgerOptions.filter(opt => formData.gst_ledger && formData.gst_ledger.includes(opt.value));

    const filteredConfigurations = configurations.filter(config => {
        const query = searchTerm.toLowerCase();
        return (
            (config.prefix || '').toLowerCase().includes(query) ||
            (config.postfix || '').toLowerCase().includes(query) ||
            (config.voucher_type_name || '').toLowerCase().includes(query) ||
            (config.subvoucher_type_name || '').toLowerCase().includes(query) ||
            (config.branch_name || 'all').toLowerCase().includes(query)
        );
    });

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentConfigurations = filteredConfigurations.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredConfigurations.length / itemsPerPage);

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
                    background-color: #0a500f;
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
                    background-color: #dc3545 !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .prefix-custom-modal .btn-close-custom:hover { background-color: #bb2d3b !important; }
                .prefix-custom-modal .btn-save-custom {
                    background-color: #0a500f !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .prefix-custom-modal .btn-save-custom:hover { background-color: #073d0b !important; }
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
                            <Card.Title className="mb-0">Voucher Configurations</Card.Title>
                            <div className="d-flex gap-2 align-items-center">
                                <div style={{ width: '300px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search voucher configurations..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="search-input-custom"
                                    />
                                </div>
                                <CreateButton module='prefix-config' onClick={() => handleShowModal()}>
                                    Add Configuration
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
                                                <th>SL No</th>
                                                <th>Voucher Type</th>
                                                <th>Sub Type / Subvoucher Type</th>
                                                <th>Previewed Code</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredConfigurations.length === 0 ? (
                                                <tr>
                                                    <td colSpan="5" className="text-center py-4 text-muted">No entries</td>
                                                </tr>
                                            ) : (
                                                currentConfigurations.map((config, index) => (
                                                    <tr key={config.id}>
                                                        <td>{indexOfFirstItem + index + 1}</td>
                                                        <td>{config.voucher_type_name}</td>
                                                        <td>{config.sub_type || config.subvoucher_type_name || '-'}</td>
                                                        <td className="text-dark fw-bold" style={{ letterSpacing: '0.5px' }}>
                                                            {(() => {
                                                                const selectedBranch = branches.find(b => b.id === config.branch);
                                                                const branchCode = selectedBranch ? selectedBranch.branch_code : '';
                                                                const number = (config.starting_number || '').toString().padStart(parseInt(config.number_padding || 0), '0');
                                                                let code = '';
                                                                if (branchCode) code += branchCode + '-';
                                                                code += (config.prefix || '');
                                                                if (number) code += '-' + number;
                                                                if (config.postfix) code += '/' + config.postfix;
                                                                return code;
                                                            })()}
                                                        </td>
                                                        <td>
                                                            <EditButton
                                                                module='prefix-config'
                                                                onClick={() => handleShowModal(config)}
                                                                className="me-1"
                                                            />
                                                            <DeleteButton
                                                                module='prefix-config'
                                                                onClick={() => handleDelete(config.id)}
                                                            />
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </Table>
                                </div>
                            )}

                            {filteredConfigurations.length > 0 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredConfigurations.length)} of {filteredConfigurations.length} entries
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

            <Modal show={showModal} onHide={() => setShowModal(false)} dialogClassName="prefix-custom-modal modal-lg" centered>
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
                                    {editMode ? 'Edit Configuration' : 'Add Configuration'}
                                </h4>
                                <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                    Define branch & voucher type specific numbering rules
                                </p>
                            </div>
                        </div>
                        <button type="button" className="modal-close-x" onClick={() => setShowModal(false)}>&times;</button>
                    </div>
                    <div className="modal-body-custom">
                        
                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Branch</Form.Label>
                                <Select
                                    classNamePrefix="react-select"
                                    options={branchOptions}
                                    value={branchValue}
                                    onChange={(opt) => handleSelectChange(opt, 'branch')}
                                    onFocus={handleSelectFocus}
                                    onKeyDown={handleSelectKeyDown}
                                    openMenuOnFocus={true}
                                    menuPortalTarget={document.body}
                                    styles={selectStyles}
                                    placeholder="Select Branch"
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Applicable Date <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="date"
                                    className="form-control-custom"
                                    name="applicable_date"
                                    value={formData.applicable_date || ''}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Voucher Type <span className="text-danger">*</span></Form.Label>
                                <Select
                                    classNamePrefix="react-select"
                                    options={voucherTypeOptions}
                                    value={voucherTypeValue}
                                    onChange={(opt) => handleSelectChange(opt, 'voucher_type')}
                                    onFocus={handleSelectFocus}
                                    onKeyDown={handleSelectKeyDown}
                                    openMenuOnFocus={true}
                                    menuPortalTarget={document.body}
                                    styles={selectStyles}
                                    placeholder="Select Voucher Type"
                                    required
                                />
                            </div>
                                                        <div className="col-md-6 mb-3">
                                {isJournalType ? (
                                    <>
                                        <Form.Label className="form-label-custom">Sub Type</Form.Label>
                                        <Select
                                            classNamePrefix="react-select"
                                            options={journalSubTypeOptions}
                                            value={journalSubTypeValue}
                                            onChange={(opt) => handleSelectChange(opt, 'sub_type')}
                                            onFocus={handleSelectFocus}
                                            onKeyDown={handleSelectKeyDown}
                                            openMenuOnFocus={true}
                                            menuPortalTarget={document.body}
                                            styles={selectStyles}
                                            placeholder="Select Sub Type"
                                        />
                                    </>
                                ) : (
                                    <>
                                        <Form.Label className="form-label-custom">Subvoucher Type</Form.Label>
                                        <Select
                                            classNamePrefix="react-select"
                                            options={prefixTypeOptions}
                                            value={prefixTypeValue}
                                            onChange={(opt) => handleSelectChange(opt, 'subvoucher_type')}
                                            onFocus={handleSelectFocus}
                                            onKeyDown={handleSelectKeyDown}
                                            openMenuOnFocus={true}
                                            menuPortalTarget={document.body}
                                            styles={selectStyles}
                                            placeholder="Select Subvoucher Type"
                                        />
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="row">
                            <div className="col-md-3 mb-3">
                                <Form.Label className="form-label-custom">Starting No <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="number"
                                    className="form-control-custom"
                                    name="starting_number"
                                    value={formData.starting_number}
                                    onChange={handleInputChange}
                                    required
                                    min="1"
                                />
                            </div>
                            <div className="col-md-3 mb-3">
                                <Form.Label className="form-label-custom">Voucher Type<span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    name="prefix"
                                    value={formData.prefix}
                                    onChange={handleInputChange}
                                    required
                                    maxLength="3"
                                    placeholder="e.g. INV"
                                />
                            </div>
                            <div className="col-md-3 mb-3">
                                <Form.Label className="form-label-custom">Number Padding <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="number"
                                    className="form-control-custom"
                                    name="number_padding"
                                    value={formData.number_padding}
                                    onChange={handleInputChange}
                                    required
                                    min="1"
                                    max="10"
                                />
                            </div>
                            <div className="col-md-3 mb-3">
                                <Form.Label className="form-label-custom">Postfix</Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    name="postfix"
                                    value={formData.postfix}
                                    onChange={handleInputChange}
                                    placeholder="e.g. 25-26"
                                />
                            </div>
                        </div>
                        {isLedgerApplicable && (
                            <div className="row">
                                <div className="col-md-6 mb-3">
                                    <Form.Label className="form-label-custom">Ledger</Form.Label>
                                    <Select
                                        classNamePrefix="react-select"
                                        options={ledgerOptions}
                                        value={ledgerValue}
                                        onChange={(opt) => handleSelectChange(opt, 'ledger')}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        openMenuOnFocus={true}
                                        menuPortalTarget={document.body}
                                        styles={selectStyles}
                                        placeholder="Select Ledger"
                                    />
                                </div>
                                <div className="col-md-6 mb-3">
                                    <Form.Label className="form-label-custom">GST Ledger</Form.Label>
                                    <Select
                                        isMulti
                                        classNamePrefix="react-select"
                                        options={gstLedgerOptions}
                                        value={gstLedgerValue}
                                        onChange={(opts) => {
                                            const values = opts ? opts.map(opt => opt.value) : [];
                                            setFormData(prev => ({ ...prev, gst_ledger: values }));
                                        }}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        openMenuOnFocus={true}
                                        menuPortalTarget={document.body}
                                        styles={selectStyles}
                                        placeholder="Select GST Ledgers"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="row mt-2">
                            <div className="col-12 mb-3">
                                <div
                                    className="p-3 border rounded bg-light d-flex justify-content-between align-items-center"
                                    style={{ borderStyle: 'dashed !important' }}
                                >
                                    <div>
                                        <h6 className="mb-0 text-primary">Preview Code:</h6>
                                        <small className="text-muted">This is how your generated numbers will look.</small>
                                    </div>
                                    <div className="h4 mb-0 fw-bold text-dark" style={{ letterSpacing: '0.5px' }}>
                                        {(() => {
                                            const selectedBranch = branches.find(b => b.id === parseInt(formData.branch));
                                            const branchCode = selectedBranch ? selectedBranch.branch_code : '';
                                            const number = (formData.starting_number || '').toString().padStart(parseInt(formData.number_padding || 0), '0');

                                            let code = '';
                                            if (branchCode) code += branchCode + '-';
                                            code += (formData.prefix || '');
                                            if (number) code += '-' + number;
                                            if (formData.postfix) code += '/' + formData.postfix;
                                            return code;
                                        })()}
                                    </div>
                                </div>
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

export default ManagePrefixConfiguration;
