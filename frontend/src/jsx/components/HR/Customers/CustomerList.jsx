import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Button, Form, Modal } from 'react-bootstrap';
import Swal from 'sweetalert2';
import Select from 'react-select';
import { Country, State } from 'country-state-city';
import { useEnterTraversal } from '../../../../hooks/useEnterTraversal';
import { usePageTitle } from '../../../../context/TitleContext';
import axiosInstance from '../../../../services/AxiosInstance';
import {
    getCustomerTypes,
    createCustomerType,
    createHrCustomer,
    updateHrCustomer,
    deleteHrCustomer,
    getHrDistributors,
    getHrVendors,
    getHrOtherCustomers,
    getRoles,
} from '../../../../services/HRManagementService';

const INITIAL_CUSTOMER = {
    name: '',
    address: '',
    pincode: '',
    city: '',
    district: '',
    state: 'KL',
    country: 'IN',
    contact_person: '',
    contact_number: '',
    email: '',
    customer_type: null,
    remarks: '',
    login_required: false
};

const CustomerList = () => {
    usePageTitle("Associates List");
    const [allCustomers, setAllCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // customer modal
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [editEndpoint, setEditEndpoint] = useState(null);
    const [typeOptions, setTypeOptions] = useState([]);
    const [customerForm, setCustomerForm] = useState(INITIAL_CUSTOMER);
    const [submitting, setSubmitting] = useState(false);

    // quick-add customer type modal
    const [showQuickTypeModal, setShowQuickTypeModal] = useState(false);
    const [quickTypeName, setQuickTypeName] = useState('');
    const [quickDetailsNeeded, setQuickDetailsNeeded] = useState(false);
    const [quickTypeSubmitting, setQuickTypeSubmitting] = useState(false);

    // Login Access Modal State
    const [showLoginAccessModal, setShowLoginAccessModal] = useState(false);
    const [selectedCustomerForLogin, setSelectedCustomerForLogin] = useState(null);
    const [loginRequired, setLoginRequired] = useState(false);
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginRole, setLoginRole] = useState('');
    const [rolesList, setRolesList] = useState([]);
    const [loginSubmitting, setLoginSubmitting] = useState(false);
    const [emailCopied, setEmailCopied] = useState(false);
    const [passCopied, setPassCopied] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const { handleFormKeyDown, handleSelectKeyDown, handleSelectFocus } = useEnterTraversal('.cl-custom-modal');
    const { handleFormKeyDown: handleQuickTypeKeyDown } = useEnterTraversal('.cl-quick-type-modal');

    const saveBtnRef = useRef(null);
    const cancelBtnRef = useRef(null);
    const quickAddBtnRef = useRef(null);
    const loginRequiredRef = useRef(null);

    const quickCancelBtnRef = useRef(null);
    const quickSaveBtnRef = useRef(null);

    const countrySelectRef = useRef(null);

    const customSelectStyles = {
        control: (provided, state) => ({
            ...provided,
            borderRadius: '10px',
            borderColor: state.isFocused ? '#0a500f' : '#cbd5e1',
            minHeight: '42px',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 80, 15, 0.15)' : 'none',
            '&:hover': {
                borderColor: state.isFocused ? '#0a500f' : '#cbd5e1'
            }
        }),
        option: (provided, state) => ({
            ...provided,
            backgroundColor: state.isSelected ? '#0a500f' : state.isFocused ? '#f8f9fa' : 'white',
            color: state.isSelected ? 'white' : '#334155',
        }),
        menu: (provided) => ({
            ...provided,
            zIndex: 9999
        })
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const [distributors, vendors, others, types, rolesRes] = await Promise.all([
                getHrDistributors(),
                getHrVendors(),
                getHrOtherCustomers(),
                getCustomerTypes(),
                getRoles(),
            ]);

            const typesArr = Array.isArray(types) ? types : (types.results || []);
            const typeMap = {};
            typesArr.forEach(t => { typeMap[t.id] = t.name; });

            const tag = (arr, category, endpoint) =>
                arr.map(item => ({ ...item, _category: category, _endpoint: endpoint, _type_name: typeMap[item.customer_type] || category }));

            setAllCustomers([
                ...tag(distributors, 'Distributor', 'hr-distributors'),
                ...tag(vendors, 'Vendor', 'hr-vendors'),
                ...tag(others, 'Others', 'hr-other-customers'),
            ]);

            setTypeOptions([
                { value: '', label: '-- Select Type --', name: '' },
                ...typesArr.map(t => ({ value: t.id, label: t.name, name: t.name }))
            ]);

            const rolesArr = Array.isArray(rolesRes) ? rolesRes : (rolesRes.results || []);
            setRolesList(rolesArr);
        } catch (error) {
            console.error('Error fetching customers:', error);
        } finally {
            setLoading(false);
        }
    };

    const refreshTypeOptions = async () => {
        try {
            const types = await getCustomerTypes();
            const typesArr = Array.isArray(types) ? types : (types.results || []);
            const opts = [
                { value: '', label: '-- Select Type --', name: '' },
                ...typesArr.map(t => ({ value: t.id, label: t.name, name: t.name }))
            ];
            setTypeOptions(opts);
            return typesArr;
        } catch {
            return [];
        }
    };

    const filtered = useMemo(() => {
        return allCustomers.filter(c => {
            const matchesSearch =
                !searchTerm ||
                c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.contact_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c._category?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesType =
                filterType === 'all' ||
                c._category.toLowerCase() === filterType.toLowerCase();
            return matchesSearch && matchesType;
        });
    }, [allCustomers, searchTerm, filterType]);

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentCustomers = filtered.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filtered.length / itemsPerPage);

    const countryOptions = useMemo(() => {
        return [
            { value: '', label: 'Select Country' },
            ...Country.getAllCountries().map((c) => ({
                value: c.isoCode,
                label: c.name
            }))
        ];
    }, []);

    const stateOptions = useMemo(() => {
        if (!customerForm.country) return [{ value: '', label: 'Select State' }];
        return [
            { value: '', label: 'Select State' },
            ...State.getStatesOfCountry(customerForm.country).map((s) => ({
                value: s.isoCode,
                label: s.name
            }))
        ];
    }, [customerForm.country]);

    const handleQuickTypeCancel = () => {
        setShowQuickTypeModal(false);
        setQuickTypeName('');
        setQuickDetailsNeeded(false);
        setTimeout(() => {
            if (quickAddBtnRef.current) quickAddBtnRef.current.focus();
        }, 50);
    };

    const copyToClipboard = (text, setFn) => {
        navigator.clipboard.writeText(text).then(() => {
            setFn(true);
            setTimeout(() => setFn(false), 2000);
        });
    };

    const getCompanyEmailDomain = () => {
        try {
            const settings = JSON.parse(localStorage.getItem('companySettings') || '{}');
            const rawName = settings.displayName || settings.display_name || settings.name || '';
            const cleanName = rawName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanName ? `@${cleanName}.com` : '@glenda.com';
        } catch {
            return '@glenda.com';
        }
    };

    const generateEmail = () => {
        if (!selectedCustomerForLogin) return;
        const nameStr = selectedCustomerForLogin.contact_person || selectedCustomerForLogin.name || 'user';
        const emailStr = nameStr.trim().toLowerCase().replace(/[^a-z0-9]/g, '') + getCompanyEmailDomain();
        setLoginEmail(emailStr);
    };

    const generatePassword = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        let pass = '';
        for (let i = 0; i < 8; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setLoginPassword(pass);
    };

    const handleLoginAccessSubmit = async (e) => {
        e.preventDefault();
        if (!loginEmail || !loginPassword || !loginRole) {
            Swal.fire({ icon: 'warning', title: 'Validation', text: 'Email, Password, and Role are required.' });
            return;
        }
        setLoginSubmitting(true);
        try {
            const payload = {
                name: selectedCustomerForLogin.contact_person || selectedCustomerForLogin.name,
                email: loginEmail,
                password: loginPassword,
                password2: loginPassword,
                phone: selectedCustomerForLogin.contact_number || '',
                customer_id: selectedCustomerForLogin.id,
                customer_category: selectedCustomerForLogin._category,
                role_id: loginRole
            };
            await axiosInstance.post('/api/auth/setup-customer-login/', payload);
            Swal.fire({ icon: 'success', title: 'Success', text: 'Login access configured successfully!' });
            setShowLoginAccessModal(false);
            setLoginEmail('');
            setLoginPassword('');
            setLoginRole('');
            setLoginRequired(false);
        } catch (error) {
            console.error('Error creating user:', error);
            const errMsg = error.response?.data?.email?.[0] || error.response?.data?.message || 'Failed to setup login access.';
            Swal.fire({ icon: 'error', title: 'Error', text: errMsg });
        } finally {
            setLoginSubmitting(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setCustomerForm(prev => ({ ...prev, [name]: value }));
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setCustomerForm(INITIAL_CUSTOMER);
        setEditId(null);
        setEditEndpoint(null);
    };

    const handleEditCustomer = (customer) => {
        const typeOpt = typeOptions.find(t => t.value === customer.customer_type) || null;
        setCustomerForm({ ...customer, customer_type: typeOpt });
        setEditId(customer.id);
        setEditEndpoint(customer._endpoint);
        setShowModal(true);
    };

    const handleDeleteCustomer = async (customer) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: `Delete customer: ${customer.name}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });
        if (result.isConfirmed) {
            try {
                await deleteHrCustomer(customer._endpoint, customer.id);
                Swal.fire('Deleted!', 'Customer deleted.', 'success');
                fetchAllData();
            } catch {
                Swal.fire('Error', 'Failed to delete customer', 'error');
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!customerForm.customer_type || customerForm.customer_type.value === '') {
            Swal.fire({ icon: 'warning', title: 'Validation', text: 'Please select a Associate Type.' });
            return;
        }

        if (customerForm.contact_number && !/^\d{10}$/.test(customerForm.contact_number.trim())) {
            await Swal.fire({ icon: 'warning', title: 'Validation', text: 'Please enter a valid 10-digit contact number.', confirmButtonColor: 'var(--primary)', returnFocus: false });
            const contactNumberInput = document.querySelector('input[name="contact_number"]');
            if (contactNumberInput) contactNumberInput.focus();
            return;
        }

        if (customerForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerForm.email.trim())) {
            await Swal.fire({ icon: 'warning', title: 'Validation', text: 'Please enter a valid email address.', confirmButtonColor: 'var(--primary)', returnFocus: false });
            const emailInput = document.querySelector('input[name="email"]');
            if (emailInput) emailInput.focus();
            return;
        }

        setSubmitting(true);
        try {
            const selectedName = customerForm.customer_type.name.toLowerCase();
            let endpoint = editEndpoint;
            if (!editId) {
                endpoint = 'hr-other-customers';
                if (selectedName === 'distributor') endpoint = 'hr-distributors';
                else if (selectedName === 'vendor') endpoint = 'hr-vendors';
            }

            const payload = { ...customerForm, customer_type: customerForm.customer_type.value };
            delete payload._category;
            delete payload._endpoint;
            delete payload._type_name;

            if (editId) {
                await updateHrCustomer(endpoint, editId, payload);
                await Swal.fire({ icon: 'success', title: 'Updated', text: 'Associate updated successfully!', confirmButtonColor: 'var(--primary)' });
            } else {
                await createHrCustomer(endpoint, payload);
                await Swal.fire({ icon: 'success', title: 'Created', text: 'Associate created successfully!', confirmButtonColor: 'var(--primary)' });
            }
            handleCloseModal();
            fetchAllData();
        } catch {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to save associate.' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleQuickTypeSubmit = async (e) => {
        e.preventDefault();
        setQuickTypeSubmitting(true);
        try {
            const created = await createCustomerType({ name: quickTypeName, details_needed: quickDetailsNeeded });
            Swal.fire({ icon: 'success', title: 'Created', text: 'Associate type created.', confirmButtonColor: 'var(--primary)', timer: 1500, showConfirmButton: false });
            setShowQuickTypeModal(false);
            setQuickTypeName('');
            setQuickDetailsNeeded(false);
            const updatedTypes = await refreshTypeOptions();
            const newType = updatedTypes.find(t => t.id === created.id);
            if (newType) {
                setCustomerForm(prev => ({ ...prev, customer_type: { value: newType.id, label: newType.name, name: newType.name } }));
                setTimeout(() => {
                    const contactPersonInput = document.querySelector('input[name="contact_person"]');
                    if (contactPersonInput) contactPersonInput.focus();
                }, 100);
            }
        } catch {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to create associate type.' });
        } finally {
            setQuickTypeSubmitting(false);
        }
    };

    const categoryBadge = (category) => {
        const map = {
            'Distributor': 'badge-primary',
            'Vendor': 'badge-info',
            'Others': 'badge-warning',
        };
        return map[category] || 'badge-secondary';
    };

    const onAddressKeyDown = (e) => {
        if (e.key === 'Enter') {
            if (!e.shiftKey) {
                e.preventDefault();
                const formControls = Array.from(document.querySelectorAll('.cl-custom-modal .form-control-custom, .cl-custom-modal .btn-save-custom, .cl-custom-modal .react-select__control input'));
                const index = formControls.findIndex(el => el.name === 'address');
                if (index > -1 && index < formControls.length - 1) {
                    formControls[index + 1].focus();
                }
            }
        }
    };

    const onSelectKeyDownExtended = (e) => {
        if (e.key === 'Enter') { e.stopPropagation(); }
        handleSelectKeyDown(e);
        if (e.key === 'ArrowRight') { if (quickAddBtnRef.current) quickAddBtnRef.current.focus(); }
    };

    const onNormalSelectKeyDown = (e) => {
        if (e.key === 'Enter') { e.stopPropagation(); }
        handleSelectKeyDown(e);
    };

    const onQuickAddBtnKeyDown = (e) => {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const selectControl = document.querySelector('.cl-custom-modal .react-select__control input');
            if (selectControl) selectControl.focus();
        }
    };

    const onCancelBtnKeyDown = (e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); if (saveBtnRef.current) saveBtnRef.current.focus(); }
    };

    const onSaveBtnKeyDown = (e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); if (cancelBtnRef.current) cancelBtnRef.current.focus(); }
    };

    const onQuickCancelBtnKeyDown = (e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); if (quickSaveBtnRef.current) quickSaveBtnRef.current.focus(); }
    };

    const onQuickSaveBtnKeyDown = (e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); if (quickCancelBtnRef.current) quickCancelBtnRef.current.focus(); }
    };

    return (
        <>
            <style>{`
                .cl-custom-modal .modal-content,
                .cl-quick-type-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .cl-custom-modal .modal-header-custom,
                .cl-quick-type-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .cl-custom-modal .modal-icon-circle,
                .cl-quick-type-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: var(--form-icon-color, #0a500f);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .cl-custom-modal .modal-close-x,
                .cl-quick-type-modal .modal-close-x {
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
                .cl-custom-modal .modal-close-x:hover,
                .cl-quick-type-modal .modal-close-x:hover { color: #555; }
                .cl-custom-modal .modal-body-custom,
                .cl-quick-type-modal .modal-body-custom {
                    padding: 24px 28px;
                    max-height: 70vh;
                    overflow-y: auto;
                }
                .cl-custom-modal .modal-footer-custom,
                .cl-quick-type-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .cl-custom-modal .form-label-custom,
                .cl-quick-type-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .cl-custom-modal .form-control-custom,
                .cl-quick-type-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .cl-custom-modal .form-control-custom:focus,
                .cl-quick-type-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .cl-custom-modal .form-control-custom::placeholder,
                .cl-quick-type-modal .form-control-custom::placeholder { color: #94a3b8; }
                .cl-custom-modal .form-check-input:checked,
                .cl-quick-type-modal .form-check-input:checked {
                    background-color: #0a500f;
                    border-color: #0a500f;
                }
                .cl-custom-modal .btn-close-custom,
                .cl-quick-type-modal .btn-close-custom {
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
                .cl-custom-modal .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .cl-custom-modal .btn-close-custom:focus,
                .cl-quick-type-modal .btn-close-custom:focus { 
                    outline: none !important;
                    box-shadow: 0 0 0 4px rgba(122, 112, 186, 0.3) !important;
                }
                .cl-custom-modal .btn-save-custom,
                .cl-quick-type-modal .btn-save-custom {
                    background-color: var(--save-btn-color, #0a500f) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, box-shadow 0.2s;
                }
                .cl-custom-modal .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }
                .cl-custom-modal .btn-save-custom:focus,
                .cl-quick-type-modal .btn-save-custom:focus {
                    outline: none !important;
                    box-shadow: 0 0 0 4px rgba(10, 80, 15, 0.3) !important;
                }
                .quick-add-btn {
                    width: 38px;
                    height: 38px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 10px;
                    border: none;
                    background-color: #0a500f;
                    color: white;
                    font-size: 16px;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s;
                    flex-shrink: 0;
                }
                .quick-add-btn:focus {
                    outline: none;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.3);
                }
                .quick-add-btn:hover {
                    background-color: #073d0b;
                    transform: scale(1.05);
                }
            `}</style>

            <div className="container-fluid">

                <div className="row">
                    <div className="col-lg-12">
                        <Card>
                            <Card.Header className="d-flex justify-content-between align-items-center">
                                <Card.Title className="mb-0">Associates</Card.Title>
                                <div className="d-flex align-items-center gap-2">
                                    <div style={{ width: '300px', position: 'relative' }}>
                                        <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                        <Form.Control
                                            type="text"
                                            placeholder="Search associates..."
                                            value={searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                            style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                        />
                                    </div>
                                    <Form.Select
                                        value={filterType}
                                        onChange={(e) => {
                                            setFilterType(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        style={{ height: '38px', borderRadius: '6px', fontSize: '13px', width: 'auto' }}
                                    >
                                        <option value="all">All Types</option>
                                        <option value="distributor">Distributor</option>
                                        <option value="vendor">Vendor</option>
                                        <option value="others">Others</option>
                                    </Form.Select>
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => { setEditId(null); setEditEndpoint(null); setCustomerForm(INITIAL_CUSTOMER); setShowModal(true); }}
                                        className="d-flex align-items-center justify-content-center"
                                        style={{
                                            height: '38px', borderRadius: '6px', whiteSpace: 'nowrap', padding: '0 16px',
                                            backgroundColor: '#0a500f', borderColor: '#0a500f', fontSize: '13px'
                                        }}
                                    >
                                        <i className="fa fa-plus me-2"></i> Create Associate
                                    </Button>
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
                                                    <th>SL No</th>
                                                    <th><strong>NAME</strong></th>
                                                    <th><strong>TYPE</strong></th>
                                                    <th><strong>CONTACT PERSON</strong></th>
                                                    <th><strong>CONTACT NUMBER</strong></th>
                                                    <th><strong>EMAIL</strong></th>
                                                    <th><strong>CITY</strong></th>
                                                    <th className="text-end"><strong>ACTIONS</strong></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {currentCustomers.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="8" className="text-center py-4 text-muted">
                                                            {searchTerm || filterType !== 'all' ? 'No matching associates found' : 'No associates found. Click "Create Associate" to create one.'}
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    currentCustomers.map((c, index) => (
                                                        <tr key={`${c._category}-${c.id}`}>
                                                            <td>{indexOfFirstItem + index + 1}</td>
                                                            <td><strong>{c.name}</strong></td>
                                                            <td>
                                                                <span className={`badge ${categoryBadge(c._category)} light`}>
                                                                    {c._category}
                                                                </span>
                                                            </td>
                                                            <td>{c.contact_person || '-'}</td>
                                                            <td>{c.contact_number || '-'}</td>
                                                            <td>{c.email || '-'}</td>
                                                            <td>{c.city || '-'}</td>
                                                            <td className="text-end">
                                                                <div className="d-flex justify-content-end">
                                                                    {c.login_required && (
                                                                        <Button variant="outline-success" size="sm" className="shadow me-1"
                                                                            style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontSize: '12px', borderRadius: '6px' }}
                                                                            onClick={() => {
                                                                                setSelectedCustomerForLogin(c);
                                                                                
                                                                                if (c._category === 'Distributor' || c._category === 'Vendor') {
                                                                                    setLoginEmail(c.email || '');
                                                                                } else {
                                                                                    const nameStr = c.contact_person || c.name || 'us';
                                                                                    const cleanName = nameStr.trim().toLowerCase().replace(/[^a-z]/g, '');
                                                                                    const prefix = cleanName.substring(0, 2) || 'us';
                                                                                    const phoneStr = (c.contact_number || '').replace(/[^0-9]/g, '') || '0000000000';
                                                                                    const emailStr = prefix + phoneStr + getCompanyEmailDomain();
                                                                                    setLoginEmail(emailStr);
                                                                                }

                                                                                setLoginPassword('');
                                                                                setLoginRequired(false);
                                                                                setShowPassword(false);
                                                                                setShowLoginAccessModal(true);
                                                                            }}>
                                                                            <i className="fa fa-key"></i>
                                                                        </Button>
                                                                    )}
                                                                    <Button variant="outline-primary" size="sm" className="shadow me-1"
                                                                        style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontSize: '12px', borderRadius: '6px' }}
                                                                        onClick={() => handleEditCustomer(c)}>
                                                                        <i className="fa fa-pencil-alt"></i>
                                                                    </Button>
                                                                    <Button variant="outline-danger" size="sm" className="shadow"
                                                                        style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontSize: '12px', borderRadius: '6px' }}
                                                                        onClick={() => handleDeleteCustomer(c)}>
                                                                        <i className="fa fa-trash"></i>
                                                                    </Button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                        {!loading && totalPages > 1 && (
                                            <div className="d-flex justify-content-between align-items-center mt-3">
                                                <div className="text-muted" style={{ fontSize: '13px' }}>
                                                    Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filtered.length)} of {filtered.length} entries
                                                </div>
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
                                            </div>
                                        )}
                                    </div>
                                )}
                            </Card.Body>
                        </Card>
                    </div>
                </div>
            </div>

            {/* ===== Customer Creation Modal ===== */}
            <Modal show={showModal} onHide={handleCloseModal} dialogClassName="cl-custom-modal" backdrop="static" keyboard={false} enforceFocus={false} size="lg" centered>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="white" />
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editId ? 'Edit Associate' : 'Create Associate'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter associate details below
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={handleCloseModal}>&times;</button>
                </div>

                <Form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown}>
                    <div className="modal-body-custom">
                        <div className="row mb-3">
                            <div className="col-md-6">
                                <Form.Label className="form-label-custom">Name <span className="text-danger">*</span></Form.Label>
                                <Form.Control type="text" className="form-control-custom" name="name" value={customerForm.name} onChange={handleChange} placeholder="Enter name" required autoFocus />
                            </div>
                            <div className="col-md-6">
                                <Form.Label className="form-label-custom">Associate Type <span className="text-danger">*</span></Form.Label>
                                <div className="d-flex align-items-end gap-2">
                                    <div style={{ flex: 1 }}>
                                        <Select
                                            classNamePrefix="react-select"
                                            styles={customSelectStyles}
                                            options={typeOptions}
                                            value={customerForm.customer_type}
                                            onChange={(opt) => {
                                                setCustomerForm(prev => ({ ...prev, customer_type: opt }));
                                                if (opt && opt.value === '') {
                                                    if (quickAddBtnRef.current) quickAddBtnRef.current.focus();
                                                } else {
                                                    const contactPersonInput = document.querySelector('input[name="contact_person"]');
                                                    if (contactPersonInput) setTimeout(() => contactPersonInput.focus(), 10);
                                                }
                                            }}
                                            onFocus={handleSelectFocus}
                                            onKeyDown={onSelectKeyDownExtended}
                                            openMenuOnFocus={true}
                                            placeholder="Select Type..."
                                            classNamePrefix="react-select"
                                            styles={{
                                                control: (base) => ({ ...base, borderRadius: '10px', borderColor: '#cbd5e1', minHeight: '42px', fontSize: '13px' }),
                                                placeholder: (base) => ({ ...base, color: '#94a3b8' }),
                                            }}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        className="quick-add-btn"
                                        title="Quick add associate type"
                                        onClick={() => setShowQuickTypeModal(true)}
                                        ref={quickAddBtnRef}
                                        onKeyDown={onQuickAddBtnKeyDown}
                                    >
                                        <i className="fa fa-plus"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="row mb-3">
                            <div className="col-md-4">
                                <Form.Label className="form-label-custom">Contact Person</Form.Label>
                                <Form.Control type="text" className="form-control-custom" name="contact_person" value={customerForm.contact_person} onChange={handleChange} placeholder="Enter Contact Person" />
                            </div>
                            <div className="col-md-4">
                                <Form.Label className="form-label-custom">Contact Number <span className="text-danger">*</span></Form.Label>
                                <Form.Control 
                                    type="tel" 
                                    className="form-control-custom" 
                                    name="contact_number" 
                                    value={customerForm.contact_number} 
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                        setCustomerForm(prev => ({ ...prev, contact_number: val }));
                                    }} 
                                    placeholder="Enter Contact Number" 
                                    maxLength={10}
                                    minLength={10}
                                    pattern="[0-9]{10}"
                                    required 
                                />
                            </div>
                            <div className="col-md-4">
                                <Form.Label className="form-label-custom">Email <span className="text-danger">*</span></Form.Label>
                                <Form.Control type="email" className="form-control-custom" name="email" value={customerForm.email} onChange={handleChange} placeholder="Enter email address" required />
                            </div>
                        </div>
                        <div className="row mb-3">
                            <div className="col-md-12">
                                <Form.Label className="form-label-custom">Address <span className="text-danger">*</span></Form.Label>
                                <Form.Control 
                                    as="textarea" 
                                    rows={2} 
                                    className="form-control-custom" 
                                    name="address" 
                                    value={customerForm.address} 
                                    onChange={handleChange} 
                                    placeholder="Enter address"
                                    onKeyDown={onAddressKeyDown}
                                    required
                                />
                            </div>
                        </div>
                        <div className="row mb-3">
                            <div className="col-md-3">
                                <Form.Label className="form-label-custom">Pin Code</Form.Label>
                                <Form.Control type="text" className="form-control-custom" name="pincode" value={customerForm.pincode} onChange={handleChange} placeholder="Pin Code" />
                            </div>
                            <div className="col-md-3">
                                <Form.Label className="form-label-custom">City <span className="text-danger">*</span></Form.Label>
                                <Form.Control type="text" className="form-control-custom" name="city" value={customerForm.city} onChange={handleChange} placeholder="City" required />
                            </div>
                            <div className="col-md-3">
                                <Form.Label className="form-label-custom">District <span className="text-danger">*</span></Form.Label>
                                <Form.Control type="text" className="form-control-custom" name="district" value={customerForm.district} onChange={handleChange} placeholder="District" required />
                            </div>
                            <div className="col-md-3">
                                <Form.Label className="form-label-custom">State <span className="text-danger">*</span></Form.Label>
                                <Select
                                            classNamePrefix="react-select"
                                            styles={customSelectStyles}
                                            options={stateOptions}
                                            value={stateOptions.find(o => o.value === customerForm.state) || { value: '', label: 'Select State' }}
                                            onChange={(selected) => {
                                                setCustomerForm(prev => ({ ...prev, state: selected ? selected.value : '' }));
                                                setTimeout(() => {
                                                    if (countrySelectRef.current) countrySelectRef.current.focus();
                                                }, 10);
                                            }}
                                            placeholder="Select State"
                                            isSearchable
                                            isDisabled={!customerForm.country}
                                            openMenuOnFocus={true}
                                            onFocus={handleSelectFocus}
                                            onKeyDown={onNormalSelectKeyDown}
                                        />
                            </div>
                        </div>
                        <div className="row mb-3">
                            <div className="col-md-6">
                                <Form.Label className="form-label-custom">Country <span className="text-danger">*</span></Form.Label>
                                <Select
                                            ref={countrySelectRef}
                                            classNamePrefix="react-select"
                                            styles={customSelectStyles}
                                            options={countryOptions}
                                            value={countryOptions.find(o => o.value === customerForm.country) || { value: '', label: 'Select Country' }}
                                            onChange={(selected) => {
                                                const val = selected ? selected.value : '';
                                                setCustomerForm(prev => {
                                                    if (prev.country !== val) {
                                                        return { ...prev, country: val, state: '' };
                                                    }
                                                    return prev;
                                                });
                                                setTimeout(() => {
                                                    const remarksInput = document.querySelector('input[name="remarks"]');
                                                    if (remarksInput) remarksInput.focus();
                                                }, 10);
                                            }}
                                            placeholder="Select Country"
                                            isSearchable
                                            openMenuOnFocus={true}
                                            onFocus={handleSelectFocus}
                                            onKeyDown={onNormalSelectKeyDown}
                                        />
                            </div>
                            <div className="col-md-6">
                                <Form.Label className="form-label-custom">Remarks</Form.Label>
                                <Form.Control 
                                    type="text" 
                                    className="form-control-custom" 
                                    name="remarks" 
                                    value={customerForm.remarks} 
                                    onChange={handleChange} 
                                    placeholder="Enter remarks" 
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (loginRequiredRef.current) loginRequiredRef.current.focus();
                                        }
                                    }}
                                />
                            </div>
                        </div>
                        <div className="row mb-3 mt-1">
                            <div className="col-md-12">
                                <Form.Check
                                    type="checkbox"
                                    id="login-required-checkbox"
                                    label={<span className="form-label-custom mb-0" style={{cursor: 'pointer'}}>Login Required</span>}
                                    checked={!!customerForm.login_required}
                                    onChange={(e) => setCustomerForm(prev => ({...prev, login_required: e.target.checked}))}
                                    style={{ userSelect: 'none' }}
                                    ref={loginRequiredRef}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (saveBtnRef.current) saveBtnRef.current.focus();
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer-custom">
                        <Button 
                            type="button" 
                            className="btn-close-custom" 
                            onClick={handleCloseModal}
                            ref={cancelBtnRef}
                            onKeyDown={onCancelBtnKeyDown}
                        >
                            Close
                        </Button>
                        <Button 
                            type="submit" 
                            className="btn-save-custom" 
                            disabled={submitting}
                            ref={saveBtnRef}
                            onKeyDown={onSaveBtnKeyDown}
                        >
                            {submitting ? 'Saving...' : 'Save'}
                        </Button>
                    </div>
                </Form>
            </Modal>

            {/* ===== Quick-Add Customer Type Modal ===== */}
            <Modal show={showQuickTypeModal} onHide={handleQuickTypeCancel} dialogClassName="cl-quick-type-modal" backdrop="static" keyboard={false} enforceFocus={false} restoreFocus={false} centered>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <i className="fa fa-plus text-white" style={{ fontSize: '16px' }}></i>
                        </div>
                        <div>
                            <Modal.Title className="mb-1" style={{ fontSize: '16px', fontWeight: '600' }}>Add Associate Type</Modal.Title>
                            <div className="text-muted" style={{ fontSize: '13px' }}>Quickly create a new associate type</div>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={handleQuickTypeCancel} aria-label="Close">
                        <i className="fa fa-times"></i>
                    </button>
                </div>
                <Form onSubmit={handleQuickTypeSubmit}>
                    <div className="modal-body-custom">
                        <Form.Group className="mb-4">
                            <Form.Label className="form-label-custom">Name <span className="text-danger">*</span></Form.Label>
                            <Form.Control type="text" className="form-control-custom" value={quickTypeName} onChange={(e) => setQuickTypeName(e.target.value)} placeholder="Enter Associate Type Name" required />
                        </Form.Group>
                        <Form.Group>
                            <Form.Check type="checkbox" id="quick-details-needed" label="Details Needed" checked={quickDetailsNeeded} onChange={(e) => setQuickDetailsNeeded(e.target.checked)} className="form-check-custom" />
                        </Form.Group>
                    </div>
                    <div className="modal-footer-custom">
                        <Button 
                            type="button" 
                            className="btn-close-custom" 
                            onClick={handleQuickTypeCancel}
                            ref={quickCancelBtnRef}
                            onKeyDown={onQuickCancelBtnKeyDown}
                        >
                            Close
                        </Button>
                        <Button 
                            type="submit" 
                            className="btn-save-custom" 
                            disabled={quickTypeSubmitting}
                            ref={quickSaveBtnRef}
                            onKeyDown={onQuickSaveBtnKeyDown}
                        >
                            {quickTypeSubmitting ? 'Creating...' : 'Create'}
                        </Button>
                    </div>
                </Form>
            </Modal>

            {/* ===== Setup Login Access Modal ===== */}
            <Modal show={showLoginAccessModal} onHide={() => setShowLoginAccessModal(false)} dialogClassName="cl-quick-type-modal" backdrop="static" keyboard={false} enforceFocus={false} centered>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <i className="fa fa-key text-white" style={{ fontSize: '18px' }}></i>
                        </div>
                        <div>
                            <Modal.Title className="mb-1" style={{ fontSize: '16px', fontWeight: '600' }}>Setup Login Access</Modal.Title>
                            <div className="text-muted" style={{ fontSize: '13px' }}>Configure login credentials for this associate.</div>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowLoginAccessModal(false)} aria-label="Close">
                        <i className="fa fa-times"></i>
                    </button>
                </div>
                <Form onSubmit={handleLoginAccessSubmit}>
                    <div className="modal-body-custom">
                        {selectedCustomerForLogin && (
                            <div className="p-3 mb-4 rounded d-flex align-items-center gap-3" style={{ border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                                <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px', backgroundColor: '#e0e7ff', color: '#4f46e5' }}>
                                    <i className="fa fa-user"></i>
                                </div>
                                <div>
                                    <div style={{ fontWeight: '600', color: '#1e293b' }}>{selectedCustomerForLogin.contact_person || selectedCustomerForLogin.name}</div>
                                    <div style={{ fontSize: '13px', color: '#64748b' }}>{selectedCustomerForLogin.email || 'No email provided'}</div>
                                </div>
                            </div>
                        )}
                        
                        <Form.Group className="mb-4">
                            <Form.Label className="form-label-custom">Role <span className="text-danger">*</span></Form.Label>
                            <Select
                                classNamePrefix="react-select"
                                styles={customSelectStyles}
                                options={rolesList.map(r => ({ value: r.id, label: r.name }))}
                                value={loginRole ? { value: loginRole, label: rolesList.find(r => r.id === loginRole)?.name } : null}
                                onChange={(selected) => setLoginRole(selected ? selected.value : '')}
                                placeholder="Select a role"
                                isSearchable
                                menuPlacement="auto"
                                menuPosition="fixed"
                            />
                        </Form.Group>

                        <Form.Group className="mb-4">
                                    <Form.Label className="form-label-custom">Email <span className="text-danger">*</span></Form.Label>
                                    <div style={{ position: 'relative' }}>
                                        <input 
                                            type="email" 
                                            className="form-control-custom" 
                                            value={loginEmail} 
                                            onChange={(e) => setLoginEmail(e.target.value)} 
                                            placeholder="Email" 
                                            style={{ paddingRight: '40px', backgroundColor: '#f1f5f9' }}
                                            readOnly={true}
                                            required 
                                        />
                                        <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <button
                                                type="button"
                                                onClick={() => copyToClipboard(loginEmail, setEmailCopied)}
                                                disabled={!loginEmail}
                                                title={emailCopied ? 'Copied!' : 'Copy'}
                                                style={{ border: 'none', background: 'none', padding: '0', lineHeight: 1, cursor: loginEmail ? 'pointer' : 'default', color: emailCopied ? '#22c55e' : '#b0b8c5', fontSize: '15px', transition: 'color 0.2s', opacity: loginEmail ? 1 : 0.35 }}
                                            >
                                                <i className={`fa ${emailCopied ? 'fa-check' : 'fa-copy'}`}></i>
                                            </button>
                                        </div>
                                    </div>
                                </Form.Group>
                                
                                <Form.Group className="mb-4">
                                    <Form.Label className="form-label-custom">Password <span className="text-danger">*</span></Form.Label>
                                    <div style={{ position: 'relative' }}>
                                        <input 
                                            type={showPassword ? "text" : "password"}
                                            className="form-control-custom" 
                                            value={loginPassword} 
                                            onChange={(e) => setLoginPassword(e.target.value)} 
                                            placeholder="Enter or generate password" 
                                            style={{ paddingRight: '110px' }}
                                            required 
                                        />
                                        <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                title={showPassword ? 'Hide password' : 'Show password'}
                                                style={{ border: 'none', background: 'none', padding: '0', lineHeight: 1, cursor: 'pointer', color: '#b0b8c5', fontSize: '15px', transition: 'color 0.2s' }}
                                            >
                                                <i className={`fa ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                            </button>
                                            <div style={{ width: '1px', height: '16px', background: '#e2e8f0' }}></div>
                                            <button
                                                type="button"
                                                onClick={() => copyToClipboard(loginPassword, setPassCopied)}
                                                disabled={!loginPassword}
                                                title={passCopied ? 'Copied!' : 'Copy'}
                                                style={{ border: 'none', background: 'none', padding: '0', lineHeight: 1, cursor: loginPassword ? 'pointer' : 'default', color: passCopied ? '#22c55e' : '#b0b8c5', fontSize: '15px', transition: 'color 0.2s', opacity: loginPassword ? 1 : 0.35 }}
                                            >
                                                <i className={`fa ${passCopied ? 'fa-check' : 'fa-copy'}`}></i>
                                            </button>
                                            <div style={{ width: '1px', height: '16px', background: '#e2e8f0' }}></div>
                                            <button
                                                type="button"
                                                onClick={generatePassword}
                                                title="Generate"
                                                style={{ border: 'none', background: 'none', padding: '0', lineHeight: 1, cursor: 'pointer', color: '#b0b8c5', fontSize: '14px', transition: 'color 0.2s' }}
                                                onMouseEnter={e => e.currentTarget.style.color = '#0a500f'}
                                                onMouseLeave={e => e.currentTarget.style.color = '#b0b8c5'}
                                            >
                                                <i className="fa fa-magic"></i>
                                            </button>
                                        </div>
                                    </div>
                                </Form.Group>
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={() => setShowLoginAccessModal(false)}>Cancel</Button>
                        <Button type="submit" className="btn-save-custom" disabled={loginSubmitting}>
                            {loginSubmitting ? 'Saving...' : 'Save Configuration'}
                        </Button>
                    </div>
                </Form>
            </Modal>
        </>
    );
};

export default CustomerList;
