import React, { useState, useEffect, useRef, useContext } from 'react';
import { Button, Modal, Form, Row, Col, Tabs, Tab } from 'react-bootstrap';
import Swal from 'sweetalert2';
import Select from 'react-select';
import { ThemeContext } from '../../../context/ThemeContext';
import axiosInstance from '../../../services/AxiosInstance';
import { Country, State } from 'country-state-city';
import * as FinanceService from '../../../services/FinanceService';

const OpportunityAccountModal = ({
    show,
    onHide,
    handleClose,
    accountToEdit,
    initialData,
    accountGroups: propAccountGroups = [],
    classification = 'Distributor',
    onSave,
    onSaved,
    readOnly = false
}) => {
    const targetAccount = accountToEdit || initialData;
    const closeModal = onHide || handleClose || (() => {});
    const triggerSaveCallback = onSave || onSaved;

    const [fetchedGroups, setFetchedGroups] = useState([]);

    useEffect(() => {
        if ((!propAccountGroups || propAccountGroups.length === 0) && show) {
            FinanceService.getAccountGroups()
                .then(res => {
                    const groups = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : (res?.results || []));
                    setFetchedGroups(groups);
                })
                .catch(err => console.error('Error fetching account groups in OpportunityAccountModal:', err));
        }
    }, [show, propAccountGroups]);

    const effectiveAccountGroups = (propAccountGroups && propAccountGroups.length > 0) ? propAccountGroups : fetchedGroups;

    const nameInputRef = useRef(null);
    const stateSelectRef = useRef(null);
    const [activeTab, setActiveTab] = useState('general');
    const [saving, setSaving] = useState(false);

    const tabOrder = ['general', 'gst', 'contact', 'bank'];

    const getNextTab = (currentTab) => {
        const idx = tabOrder.indexOf(currentTab);
        if (idx >= 0 && idx < tabOrder.length - 1) {
            return tabOrder[idx + 1];
        }
        return null;
    };

    const getPrevTab = (currentTab) => {
        const idx = tabOrder.indexOf(currentTab);
        if (idx > 0) {
            return tabOrder[idx - 1];
        }
        return null;
    };

    const handleNextTab = (e) => {
        if (e) e.preventDefault();
        const next = getNextTab(activeTab);
        if (next) {
            setActiveTab(next);
        }
    };

    const handlePrevTab = (e) => {
        if (e) e.preventDefault();
        const prev = getPrevTab(activeTab);
        if (prev) {
            setActiveTab(prev);
        }
    };

    const getCountryName = (val) => {
        if (!val) return '';
        const trimmed = String(val).trim();
        const country = Country.getAllCountries().find(
            c => c.isoCode.toLowerCase() === trimmed.toLowerCase() || c.name.toLowerCase() === trimmed.toLowerCase()
        );
        return country ? country.name : trimmed;
    };

    const getCountryCode = (val) => {
        if (!val) return 'IN';
        const trimmed = String(val).trim();
        const country = Country.getAllCountries().find(
            c => c.isoCode.toLowerCase() === trimmed.toLowerCase() || c.name.toLowerCase() === trimmed.toLowerCase()
        );
        return country ? country.isoCode : 'IN';
    };

    const getStateName = (val, countryVal = 'IN') => {
        if (!val) return '';
        const trimmed = String(val).trim();
        const cCode = getCountryCode(countryVal);
        const states = State.getStatesOfCountry(cCode);
        const state = states.find(
            s => s.isoCode.toLowerCase() === trimmed.toLowerCase() || s.name.toLowerCase() === trimmed.toLowerCase()
        );
        if (state) return state.name;
        if (cCode !== 'IN') {
            const inState = State.getStatesOfCountry('IN').find(
                s => s.isoCode.toLowerCase() === trimmed.toLowerCase() || s.name.toLowerCase() === trimmed.toLowerCase()
            );
            if (inState) return inState.name;
        }
        return trimmed;
    };

    const defaultAccount = {
        id: null,
        lead: null,
        assignment: null,
        name: '',
        accountGroup: '',
        account_group_name: '',
        classification: classification || 'Distributor',
        maintain_biilwise_details: true,
        mailing_name: '',
        address1: '',
        address2: '',
        address3: '',
        address: '',
        city: '',
        state: 'Kerala',
        country: 'India',
        pincode: '',
        phone: '',
        email: '',
        gst_number: '',
        pan_number: '',
        credit_limit: 0.00,
        opening_balance: 0.00,
        opening_balance_type: classification === 'Vendor' ? 'Cr' : 'Dr',
        placeofsupply: 'Kerala',
        registration_type: 'unknown',
        gst_details: [{
            applicable_date: '',
            registration_type: '',
            gst_number: '',
            place_of_supply: 'Kerala',
            gst_percentage: '',
            hsn_code: ''
        }],
        contact_details: [{
            contact_name: '',
            phone_no: '',
            primary_mobile: '',
            fax_no: '',
            email: '',
            cc: '',
            website: '',
            whatsapp_no: '',
            whatsapp_marketing: false
        }],
        bank_details: [{
            bank_account_no: '',
            bank_name: '',
            branch: '',
            ifsc_code: '',
            micr_code: '',
            bank_phone_no: '',
        }]
    };

    const [currentAccount, setCurrentAccount] = useState(defaultAccount);
    const [formErrors, setFormErrors] = useState({});

    const editMode = !!(targetAccount && targetAccount.id);

    // Validation helpers
    const validateGSTIN = (gst) => {
        if (!gst || !gst.trim()) return '';
        const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
        return regex.test(gst.trim().toUpperCase()) ? '' : 'Invalid GSTIN format (e.g. 32ABCDE1234F1Z5)';
    };

    const validatePAN = (pan) => {
        if (!pan || !pan.trim()) return '';
        const regex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
        return regex.test(pan.trim().toUpperCase()) ? '' : 'Invalid PAN format (e.g. ABCDE1234F)';
    };

    const validatePhone = (phone) => {
        if (!phone || !String(phone).trim()) return '';
        const clean = String(phone).replace(/[\s\-\(\)\+]/g, '');
        const regex = /^[0-9]{10,12}$/;
        return regex.test(clean) ? '' : 'Invalid phone number (10-12 digits required)';
    };

    const validateEmail = (email) => {
        if (!email || !email.trim()) return '';
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email.trim()) ? '' : 'Invalid email address format';
    };

    const validatePincode = (pincode) => {
        if (!pincode || !pincode.trim()) return '';
        const regex = /^[1-9][0-9]{5}$/;
        return regex.test(pincode.trim()) ? '' : 'Invalid 6-digit pincode';
    };

    const validateIFSC = (ifsc) => {
        if (!ifsc || !ifsc.trim()) return '';
        const regex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
        return regex.test(ifsc.trim().toUpperCase()) ? '' : 'Invalid IFSC code (e.g. SBIN0001234)';
    };

    const validateMICR = (micr) => {
        if (!micr || !micr.trim()) return '';
        const regex = /^[0-9]{9}$/;
        return regex.test(micr.trim()) ? '' : 'Invalid 9-digit MICR code';
    };

    const validateBankAccountNo = (accNo) => {
        if (!accNo || !String(accNo).trim()) return '';
        const regex = /^[0-9]{9,18}$/;
        return regex.test(String(accNo).trim()) ? '' : 'Invalid Bank Account No (9-18 digits)';
    };

    useEffect(() => {
        if (show) {
            setActiveTab('general');
            setFormErrors({});
            const acc = targetAccount;
            if (acc) {
                const rawGroup = acc.accountGroup ?? acc.account_group;
                const editGroupId = (rawGroup && typeof rawGroup === 'object') ? rawGroup.id : rawGroup;
                const editCountry = getCountryName(acc.country) || defaultAccount.country;
                const editState = getStateName(acc.state, editCountry) || (editCountry !== 'India' ? '' : defaultAccount.state);
                const editPlaceOfSupply = getStateName(acc.placeofsupply, 'IN') || defaultAccount.placeofsupply;

                setCurrentAccount({
                    ...defaultAccount,
                    ...acc,
                    classification: acc.classification || classification || 'Distributor',
                    country: editCountry,
                    state: editState,
                    placeofsupply: editPlaceOfSupply,
                    accountGroup: (editGroupId !== undefined && editGroupId !== null) ? editGroupId : defaultAccount.accountGroup,
                    opening_balance_type: acc.opening_balance_type || ((acc.classification || classification) === 'Vendor' ? 'Cr' : 'Dr'),
                    gst_details: acc.gst_details && acc.gst_details.length > 0
                        ? acc.gst_details.map(g => ({
                            ...g,
                            place_of_supply: getStateName(g.place_of_supply || editPlaceOfSupply, 'IN')
                        }))
                        : defaultAccount.gst_details,
                    contact_details: acc.contact_details && acc.contact_details.length > 0
                        ? acc.contact_details
                        : defaultAccount.contact_details,
                    bank_details: acc.bank_details && acc.bank_details.length > 0
                        ? acc.bank_details
                        : defaultAccount.bank_details
                });
            } else {
                setCurrentAccount({
                    ...defaultAccount,
                    classification: classification || 'Distributor',
                    opening_balance_type: classification === 'Vendor' ? 'Cr' : 'Dr'
                });
            }
            setTimeout(() => {
                if (nameInputRef.current) {
                    nameInputRef.current.focus();
                }
            }, 300);
        }
    }, [show, targetAccount, classification]);

    const handleInputChange = (field, value) => {
        let formattedValue = value;
        if (field === 'pan_number' || field === 'gst_number') {
            formattedValue = String(value || '').toUpperCase();
        }

        setCurrentAccount(prev => {
            const updated = { ...prev, [field]: formattedValue };
            if (field === 'name' && (!prev.mailing_name || prev.mailing_name === prev.name)) {
                updated.mailing_name = formattedValue;
            }
            if (field === 'gst_number') {
                const autoPan = formattedValue.slice(2, 12);
                if (formattedValue.length >= 12 && /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(autoPan)) {
                    updated.pan_number = autoPan;
                }
            }
            return updated;
        });

        // Clear error on edit
        if (formErrors[field]) {
            setFormErrors(prev => ({ ...prev, [field]: null }));
        }
    };

    const handleClassificationChange = (newCls) => {
        setCurrentAccount(prev => {
            let targetGroupId = prev.accountGroup;
            const matched = (effectiveAccountGroups || []).find(g => {
                const gName = (g.name || '').toLowerCase();
                if (newCls === 'Vendor') {
                    return String(g.id) === '12' || gName.includes('creditor') || gName.includes('vendor') || gName.includes('supplier');
                }
                return String(g.id) === '3' || gName.includes('debtor') || gName.includes('customer');
            });
            if (matched) {
                targetGroupId = matched.id;
            }

            return {
                ...prev,
                classification: newCls,
                accountGroup: targetGroupId,
                opening_balance_type: newCls === 'Vendor' ? 'Cr' : 'Dr'
            };
        });
    };

    const handleAddressFieldChange = (field, value) => {
        setCurrentAccount(prev => {
            const updated = { ...prev, [field]: value };
            const parts = [
                field === 'address1' ? value : prev.address1,
                field === 'address2' ? value : prev.address2,
                field === 'address3' ? value : prev.address3
            ].filter(Boolean);
            updated.address = parts.join(', ');
            return updated;
        });
    };

    const handleArrayChange = (arrayName, index, field, value) => {
        setCurrentAccount(prev => {
            const arr = [...(prev[arrayName] || [])];
            let formattedValue = value;
            if (field === 'gst_number' || field === 'ifsc_code') {
                formattedValue = String(value || '').toUpperCase();
            }
            arr[index] = { ...arr[index], [field]: formattedValue };
            return { ...prev, [arrayName]: arr };
        });
    };

    const addArrayItem = (arrayName, defaultItem) => {
        setCurrentAccount(prev => ({
            ...prev,
            [arrayName]: [...(prev[arrayName] || []), defaultItem]
        }));
    };

    const removeArrayItem = (arrayName, index) => {
        setCurrentAccount(prev => {
            const arr = [...(prev[arrayName] || [])];
            arr.splice(index, 1);
            return { ...prev, [arrayName]: arr };
        });
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        const errors = {};

        if (!currentAccount.name || !currentAccount.name.trim()) {
            errors.name = 'Account / Company Name is required';
        }

        // Validate PAN & GST if provided
        if (currentAccount.pan_number) {
            const pErr = validatePAN(currentAccount.pan_number);
            if (pErr) errors.pan_number = pErr;
        }
        if (currentAccount.gst_number) {
            const gErr = validateGSTIN(currentAccount.gst_number);
            if (gErr) errors.gst_number = gErr;
        }
        if (currentAccount.phone) {
            const phErr = validatePhone(currentAccount.phone);
            if (phErr) errors.phone = phErr;
        }
        if (currentAccount.email) {
            const emErr = validateEmail(currentAccount.email);
            if (emErr) errors.email = emErr;
        }
        if (currentAccount.pincode) {
            const pinErr = validatePincode(currentAccount.pincode);
            if (pinErr) errors.pincode = pinErr;
        }

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            const errorList = Object.values(errors).join('<br/>• ');
            Swal.fire({
                icon: 'warning',
                title: 'Validation Errors',
                html: `<div style="text-align:left; font-size: 14px;">Please review the highlighted fields:<br/><br/>• ${errorList}</div>`,
                confirmButtonColor: '#2563eb'
            });
            return;
        }

        setSaving(true);
        try {
            const payload = { ...currentAccount };
            payload.country = getCountryName(payload.country);
            payload.state = getStateName(payload.state, payload.country);
            payload.placeofsupply = getStateName(payload.placeofsupply, 'IN');

            // Find group name
            const groupObj = (effectiveAccountGroups || []).find(g => String(g.id) === String(payload.accountGroup));
            if (groupObj) {
                payload.account_group_name = groupObj.name;
            }

            if (payload.opening_balance === '') payload.opening_balance = 0;
            if (payload.credit_limit === '') payload.credit_limit = 0;

            // Clean empty rows
            if (payload.gst_details) {
                payload.gst_details = payload.gst_details.filter(g =>
                    g.applicable_date || g.registration_type || g.gst_number || g.gst_percentage || g.hsn_code
                );
            }
            if (payload.contact_details) {
                payload.contact_details = payload.contact_details.filter(c =>
                    c.contact_name || c.phone_no || c.primary_mobile || c.email || c.whatsapp_no
                );
            }
            if (payload.bank_details) {
                payload.bank_details = payload.bank_details.filter(b =>
                    b.bank_account_no || b.bank_name || b.branch || b.ifsc_code
                );
            }

            let savedData = null;
            if (payload.id) {
                const res = await axiosInstance.put(`/api/crm_new/opportunity-accounts/${payload.id}/`, payload);
                savedData = res.data;
            } else {
                const res = await axiosInstance.post('/api/crm_new/opportunity-accounts/', payload);
                savedData = res.data;
            }

            if (triggerSaveCallback) {
                triggerSaveCallback(savedData);
            }
            closeModal();
        } catch (err) {
            console.error('Error saving opportunity account:', err);
            const errData = err.response?.data;
            let msg = 'Failed to save opportunity account profile.';
            if (errData && typeof errData === 'object') {
                msg = Object.entries(errData).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('<br/>');
            }
            Swal.fire({
                icon: 'error',
                title: 'Save Failed',
                html: `<div style="text-align:left; font-size: 13.5px;">${msg}</div>`,
                confirmButtonColor: '#2563eb'
            });
        } finally {
            setSaving(false);
        }
    };

    // React-select custom styles
    const selectStyles = {
        control: (provided, state) => ({
            ...provided,
            backgroundColor: '#ffffff',
            borderColor: state.isFocused ? '#2563eb' : '#e2e8f0',
            minHeight: '44px',
            borderRadius: '8px',
            boxShadow: state.isFocused ? '0 0 0 1px #2563eb' : 'none',
            fontSize: '13.5px',
        }),
        menu: (provided) => ({ ...provided, zIndex: 9999, fontSize: '13.5px' })
    };

    const accountGroupOptions = React.useMemo(() => {
        return (effectiveAccountGroups || []).map(group => ({
            value: group.id,
            label: group.name
        }));
    }, [effectiveAccountGroups]);

    const selectedAccountGroup = accountGroupOptions.find(g => String(g.value) === String(currentAccount.accountGroup));
    const accountGroupDisplay = selectedAccountGroup?.label || currentAccount.account_group_name || currentAccount.accountGroup || '—';

    const countryOptions = React.useMemo(() => {
        return Country.getAllCountries().map((c) => ({
            value: c.name,
            label: c.name
        }));
    }, []);

    const stateOptions = React.useMemo(() => {
        const cCode = getCountryCode(currentAccount.country || 'India');
        const states = State.getStatesOfCountry(cCode);
        return states.map((s) => ({
            value: s.name,
            label: s.name
        }));
    }, [currentAccount.country]);

    const placeOfSupplyOptions = React.useMemo(() => {
        return State.getStatesOfCountry('IN').map((s) => ({
            value: s.name,
            label: s.name
        }));
    }, []);

    const renderReadOnlyGeneralInfo = () => (
        <div className="py-1">
            <Row className="g-3">
                {/* Account & Opportunity Identity */}
                <Col md={6}>
                    <div className="card shadow-none border mb-0 h-100" style={{ borderRadius: '10px' }}>
                        <div className="card-header bg-light py-2 px-3 border-bottom d-flex align-items-center">
                            <span className="fw-bold text-dark font-w600" style={{ fontSize: '13px' }}>
                                <i className="fa fa-building-o text-primary me-2"></i>Account & Identity
                            </span>
                        </div>
                        <div className="card-body p-0">
                            <ul className="list-group list-group-flush" style={{ fontSize: '13px' }}>
                                <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                                    <span className="text-muted">Opportunity Name</span>
                                    <span className="fw-bold text-dark">{currentAccount.name || '—'}</span>
                                </li>
                                <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                                    <span className="text-muted">Opportunity Type</span>
                                    <span className={`badge ${currentAccount.classification === 'Vendor' ? 'bg-purple text-white' : 'bg-primary text-white'}`} style={{ fontSize: '12px' }}>
                                        {currentAccount.classification ? `${currentAccount.classification} Lead` : 'Distributor Lead'}
                                    </span>
                                </li>
                                <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                                    <span className="text-muted">Account Group</span>
                                    <span className="fw-semibold text-dark">{accountGroupDisplay}</span>
                                </li>
                                <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                                    <span className="text-muted">Mailing Name</span>
                                    <span className="text-dark">{currentAccount.mailing_name || currentAccount.name || '—'}</span>
                                </li>
                                <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                                    <span className="text-muted">Maintain Billwise</span>
                                    <span className={`badge ${currentAccount.maintain_biilwise_details ? 'bg-success text-white' : 'bg-secondary text-white'}`}>
                                        {currentAccount.maintain_biilwise_details ? '✓ Enabled' : 'Disabled'}
                                    </span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </Col>

                {/* Financial & Tax Details */}
                <Col md={6}>
                    <div className="card shadow-none border mb-0 h-100" style={{ borderRadius: '10px' }}>
                        <div className="card-header bg-light py-2 px-3 border-bottom d-flex align-items-center">
                            <span className="fw-bold text-dark font-w600" style={{ fontSize: '13px' }}>
                                <i className="fa fa-money text-success me-2"></i>Financial & Tax Details
                            </span>
                        </div>
                        <div className="card-body p-0">
                            <ul className="list-group list-group-flush" style={{ fontSize: '13px' }}>
                                <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                                    <span className="text-muted">Opening Balance</span>
                                    <span className="fw-bold text-dark">
                                        ₹{Number(currentAccount.opening_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {currentAccount.opening_balance_type || 'Cr'}
                                    </span>
                                </li>
                                <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                                    <span className="text-muted">Credit Limit</span>
                                    <span className="fw-bold text-dark">
                                        ₹{Number(currentAccount.credit_limit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                </li>
                                <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                                    <span className="text-muted">PAN Number</span>
                                    <span className="fw-bold text-dark font-monospace">{currentAccount.pan_number || '—'}</span>
                                </li>
                                <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                                    <span className="text-muted">GST Number</span>
                                    <span className="fw-bold text-dark font-monospace">{currentAccount.gst_number || '—'}</span>
                                </li>
                                <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                                    <span className="text-muted">Place of Supply</span>
                                    <span className="text-dark">{currentAccount.place_of_supply || currentAccount.placeofsupply || 'Kerala'}</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </Col>

                {/* Communication */}
                <Col md={6}>
                    <div className="card shadow-none border mb-0 h-100" style={{ borderRadius: '10px' }}>
                        <div className="card-header bg-light py-2 px-3 border-bottom d-flex align-items-center">
                            <span className="fw-bold text-dark font-w600" style={{ fontSize: '13px' }}>
                                <i className="fa fa-phone text-info me-2"></i>Communication
                            </span>
                        </div>
                        <div className="card-body p-0">
                            <ul className="list-group list-group-flush" style={{ fontSize: '13px' }}>
                                <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                                    <span className="text-muted">Phone Number</span>
                                    <span className="fw-semibold text-dark">
                                        {currentAccount.phone ? (
                                            <a href={`tel:${currentAccount.phone}`} className="text-dark text-decoration-none">
                                                <i className="fa fa-phone text-primary me-1"></i>{currentAccount.phone}
                                            </a>
                                        ) : '—'}
                                    </span>
                                </li>
                                <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                                    <span className="text-muted">Email Address</span>
                                    <span className="text-dark">
                                        {currentAccount.email ? (
                                            <a href={`mailto:${currentAccount.email}`} className="text-primary text-decoration-none">
                                                <i className="fa fa-envelope me-1"></i>{currentAccount.email}
                                            </a>
                                        ) : '—'}
                                    </span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </Col>

                {/* Address & Location */}
                <Col md={6}>
                    <div className="card shadow-none border mb-0 h-100" style={{ borderRadius: '10px' }}>
                        <div className="card-header bg-light py-2 px-3 border-bottom d-flex align-items-center">
                            <span className="fw-bold text-dark font-w600" style={{ fontSize: '13px' }}>
                                <i className="fa fa-map-marker text-danger me-2"></i>Address & Location
                            </span>
                        </div>
                        <div className="card-body p-0">
                            <ul className="list-group list-group-flush" style={{ fontSize: '13px' }}>
                                <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                                    <span className="text-muted">Street Address</span>
                                    <span className="text-dark text-end" style={{ maxWidth: '65%' }}>
                                        {[currentAccount.address1, currentAccount.address2, currentAccount.address3].filter(Boolean).join(', ') || '—'}
                                    </span>
                                </li>
                                <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                                    <span className="text-muted">State & PIN</span>
                                    <span className="text-dark">
                                        {[currentAccount.state, currentAccount.pincode].filter(Boolean).join(' - ') || '—'}
                                    </span>
                                </li>
                                <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                                    <span className="text-muted">Country</span>
                                    <span className="text-dark">{currentAccount.country || 'India'}</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </Col>
            </Row>
        </div>
    );

    const renderReadOnlyGstDetails = () => {
        const gstRows = (currentAccount.gst_details || []).filter(r => r.gst_number || r.applicable_date || r.hsn_code || r.registration_type);
        if (gstRows.length === 0) {
            return (
                <div className="text-center py-4 text-muted border rounded-3 bg-light">
                    <i className="fa fa-file-text-o fa-2x mb-2 d-block text-secondary"></i>
                    <p className="mb-0 fw-semibold" style={{ fontSize: '13.5px' }}>No GST details registered for this opportunity.</p>
                </div>
            );
        }
        return (
            <div className="table-responsive">
                <table className="table table-bordered table-hover align-middle mb-0" style={{ fontSize: '13px' }}>
                    <thead className="bg-light">
                        <tr style={{ fontSize: '12px' }}>
                            <th>Applicable Date</th>
                            <th>Registration Type</th>
                            <th>GST Number</th>
                            <th>Place of Supply</th>
                            <th>GST %</th>
                            <th>HSN Code</th>
                        </tr>
                    </thead>
                    <tbody>
                        {gstRows.map((row, idx) => (
                            <tr key={idx}>
                                <td>{row.applicable_date || '—'}</td>
                                <td>
                                    <span className="badge bg-light text-dark border text-capitalize">
                                        {row.registration_type || '—'}
                                    </span>
                                </td>
                                <td className="font-monospace fw-bold">{row.gst_number || '—'}</td>
                                <td>{row.place_of_supply || '—'}</td>
                                <td>{row.gst_percentage ? `${row.gst_percentage}%` : '—'}</td>
                                <td className="font-monospace">{row.hsn_code || '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderReadOnlyContactDetails = () => {
        const contactRows = (currentAccount.contact_details || []).filter(c => c.contact_name || c.phone_no || c.primary_mobile || c.email || c.whatsapp_no);
        if (contactRows.length === 0) {
            return (
                <div className="text-center py-4 text-muted border rounded-3 bg-light">
                    <i className="fa fa-address-book-o fa-2x mb-2 d-block text-secondary"></i>
                    <p className="mb-0 fw-semibold" style={{ fontSize: '13.5px' }}>No additional contact details registered.</p>
                </div>
            );
        }
        return (
            <Row className="g-3">
                {contactRows.map((row, idx) => (
                    <Col md={6} key={idx}>
                        <div className="card shadow-none border mb-0 h-100" style={{ borderRadius: '10px' }}>
                            <div className="card-header bg-light py-2 px-3 border-bottom d-flex justify-content-between align-items-center">
                                <span className="fw-bold text-dark font-w600" style={{ fontSize: '13px' }}>
                                    <i className="fa fa-user text-primary me-2"></i>
                                    {row.contact_name || `Contact Person #${idx + 1}`}
                                </span>
                                {row.whatsapp_marketing && (
                                    <span className="badge bg-success" style={{ fontSize: '11px' }}>
                                        <i className="fa fa-whatsapp me-1"></i>Marketing
                                    </span>
                                )}
                            </div>
                            <div className="card-body p-0">
                                <ul className="list-group list-group-flush" style={{ fontSize: '13px' }}>
                                    <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                                        <span className="text-muted">Phone</span>
                                        <span className="fw-semibold text-dark">{row.phone_no || '—'}</span>
                                    </li>
                                    <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                                        <span className="text-muted">Primary Mobile</span>
                                        <span className="fw-semibold text-dark">{row.primary_mobile || '—'}</span>
                                    </li>
                                    <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                                        <span className="text-muted">WhatsApp</span>
                                        <span className="fw-semibold text-dark">{row.whatsapp_no || '—'}</span>
                                    </li>
                                    <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                                        <span className="text-muted">Email</span>
                                        <span className="text-dark">{row.email || '—'}</span>
                                    </li>
                                    {row.website && (
                                        <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                                            <span className="text-muted">Website</span>
                                            <span className="text-dark">{row.website}</span>
                                        </li>
                                    )}
                                </ul>
                            </div>
                        </div>
                    </Col>
                ))}
            </Row>
        );
    };

    const renderReadOnlyBankDetails = () => {
        const bankRows = (currentAccount.bank_details || []).filter(b => b.bank_account_no || b.bank_name || b.branch || b.ifsc_code);
        if (bankRows.length === 0) {
            return (
                <div className="text-center py-4 text-muted border rounded-3 bg-light">
                    <i className="fa fa-university fa-2x mb-2 d-block text-secondary"></i>
                    <p className="mb-0 fw-semibold" style={{ fontSize: '13.5px' }}>No bank account details registered.</p>
                </div>
            );
        }
        return (
            <Row className="g-3">
                {bankRows.map((row, idx) => (
                    <Col md={6} key={idx}>
                        <div className="card shadow-none border mb-0 h-100" style={{ borderRadius: '10px' }}>
                            <div className="card-header bg-light py-2 px-3 border-bottom d-flex align-items-center">
                                <span className="fw-bold text-dark font-w600" style={{ fontSize: '13px' }}>
                                    <i className="fa fa-university text-primary me-2"></i>
                                    {row.bank_name || `Bank Account #${idx + 1}`}
                                </span>
                            </div>
                            <div className="card-body p-0">
                                <ul className="list-group list-group-flush" style={{ fontSize: '13px' }}>
                                    <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                                        <span className="text-muted">Account Number</span>
                                        <span className="fw-bold text-dark font-monospace">{row.bank_account_no || '—'}</span>
                                    </li>
                                    <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                                        <span className="text-muted">Branch</span>
                                        <span className="text-dark">{row.branch || '—'}</span>
                                    </li>
                                    <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                                        <span className="text-muted">IFSC Code</span>
                                        <span className="fw-bold text-dark font-monospace">{row.ifsc_code || '—'}</span>
                                    </li>
                                    <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                                        <span className="text-muted">MICR Code</span>
                                        <span className="font-monospace text-dark">{row.micr_code || '—'}</span>
                                    </li>
                                    <li className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                                        <span className="text-muted">Bank Phone</span>
                                        <span className="text-dark">{row.bank_phone_no || '—'}</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </Col>
                ))}
            </Row>
        );
    };

    const isVendor = (currentAccount.classification || classification) === 'Vendor';

    return (
        <Modal show={show} onHide={closeModal} size="xl" centered backdrop="static">
            <Modal.Header closeButton style={{ borderBottom: '1px solid #f1f5f9', padding: '16px 24px' }}>
                <div className="d-flex align-items-center gap-3">
                    <div style={{
                        width: '42px', height: '42px', borderRadius: '10px',
                        background: isVendor ? 'rgba(124, 58, 237, 0.1)' : 'rgba(37, 99, 235, 0.1)',
                        color: isVendor ? '#7c3aed' : '#2563eb',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
                    }}>
                        <i className={`fa ${readOnly ? 'fa-id-card' : (isVendor ? 'fa-truck' : 'fa-id-card-o')}`}></i>
                    </div>
                    <div>
                        <Modal.Title style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                            {readOnly ? 'Opportunity Details' : (editMode ? 'Edit Opportunity Account' : `Create ${isVendor ? 'Vendor' : 'Distributor'} Opportunity Profile`)}
                        </Modal.Title>
                        <p className="text-muted mb-0" style={{ fontSize: '12px' }}>
                            {readOnly ? 'Review converted telecalling opportunity profile and account details' : 'Converted CRM telecalling lead data will be securely stored in the Opportunity Account database'}
                        </p>
                    </div>
                </div>
            </Modal.Header>

            <Modal.Body className="p-4">
                <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-4">
                    <Tab eventKey="general" title="General Info">
                        {readOnly ? renderReadOnlyGeneralInfo() : (
                        <Row className="g-3">
                            {/* Name */}
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="font-w600" style={{ fontSize: '13px' }}>
                                        Name <span className="text-danger">*</span>
                                    </Form.Label>
                                    <Form.Control
                                        type="text"
                                        ref={nameInputRef}
                                        value={currentAccount.name}
                                        onChange={(e) => handleInputChange('name', e.target.value)}
                                        isInvalid={!!formErrors.name}
                                        placeholder="Company or Opportunity Name"
                                        style={{ height: '44px', borderRadius: '8px', fontSize: '13.5px' }}
                                    />
                                    <Form.Control.Feedback type="invalid">
                                        {formErrors.name}
                                    </Form.Control.Feedback>
                                </Form.Group>
                            </Col>

                            {/* Opportunity Type / Classification */}
                            <Col md={3}>
                                <Form.Group>
                                    <Form.Label className="font-w600" style={{ fontSize: '13px' }}>
                                        Opportunity Type <span className="text-danger">*</span>
                                    </Form.Label>
                                    <Form.Select
                                        value={currentAccount.classification || 'Distributor'}
                                        onChange={(e) => handleClassificationChange(e.target.value)}
                                        style={{ height: '44px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 500 }}
                                    >
                                        <option value="Vendor">Vendor Lead</option>
                                        <option value="Distributor">Distributor Lead</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>

                            {/* Account Group */}
                            <Col md={3}>
                                <Form.Group>
                                    <Form.Label className="font-w600" style={{ fontSize: '13px' }}>
                                        Account Group
                                    </Form.Label>
                                    <Select
                                        styles={selectStyles}
                                        options={accountGroupOptions}
                                        value={accountGroupOptions.find(g => String(g.value) === String(currentAccount.accountGroup)) || null}
                                        onChange={(selected) => handleInputChange('accountGroup', selected ? selected.value : '')}
                                        placeholder="Select Group..."
                                        isClearable
                                    />
                                </Form.Group>
                            </Col>

                            {/* Maintain Billwise Details */}
                            <Col md={2} className="d-flex align-items-end pb-2">
                                <Form.Check
                                    type="checkbox"
                                    id="opp-maintain-billwise"
                                    label="Maintain Billwise Details"
                                    checked={currentAccount.maintain_biilwise_details}
                                    onChange={(e) => handleInputChange('maintain_biilwise_details', e.target.checked)}
                                    style={{ fontSize: '12.5px', fontWeight: 600 }}
                                />
                            </Col>

                            {/* Opening Balance */}
                            <Col md={3}>
                                <Form.Group>
                                    <Form.Label className="font-w600" style={{ fontSize: '13px' }}>
                                        Opening Balance
                                    </Form.Label>
                                    <div className="input-group">
                                        <Form.Control
                                            type="number"
                                            step="0.01"
                                            value={currentAccount.opening_balance}
                                            onChange={(e) => handleInputChange('opening_balance', e.target.value)}
                                            style={{ height: '44px', borderRadius: '8px 0 0 8px', fontSize: '13.5px' }}
                                        />
                                        <Form.Select
                                            value={currentAccount.opening_balance_type}
                                            onChange={(e) => handleInputChange('opening_balance_type', e.target.value)}
                                            style={{ maxWidth: '80px', height: '44px', borderRadius: '0 8px 8px 0', fontSize: '13.5px' }}
                                        >
                                            <option value="Dr">Dr</option>
                                            <option value="Cr">Cr</option>
                                        </Form.Select>
                                    </div>
                                </Form.Group>
                            </Col>

                            {/* Credit Limit */}
                            <Col md={3}>
                                <Form.Group>
                                    <Form.Label className="font-w600" style={{ fontSize: '13px' }}>
                                        Credit Limit
                                    </Form.Label>
                                    <Form.Control
                                        type="number"
                                        step="0.01"
                                        value={currentAccount.credit_limit}
                                        onChange={(e) => handleInputChange('credit_limit', e.target.value)}
                                        style={{ height: '44px', borderRadius: '8px', fontSize: '13.5px' }}
                                    />
                                </Form.Group>
                            </Col>

                            {/* Mailing Name */}
                            <Col md={3}>
                                <Form.Group>
                                    <Form.Label className="font-w600" style={{ fontSize: '13px' }}>
                                        Mailing Name
                                    </Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={currentAccount.mailing_name}
                                        onChange={(e) => handleInputChange('mailing_name', e.target.value)}
                                        style={{ height: '44px', borderRadius: '8px', fontSize: '13.5px' }}
                                    />
                                </Form.Group>
                            </Col>

                            {/* PAN Number */}
                            <Col md={3}>
                                <Form.Group>
                                    <Form.Label className="font-w600" style={{ fontSize: '13px' }}>
                                        PAN Number
                                    </Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={currentAccount.pan_number}
                                        onChange={(e) => handleInputChange('pan_number', e.target.value)}
                                        isInvalid={!!formErrors.pan_number}
                                        placeholder="e.g. ABCDE1234F"
                                        maxLength={10}
                                        style={{ height: '44px', borderRadius: '8px', fontSize: '13.5px' }}
                                    />
                                    <Form.Control.Feedback type="invalid">
                                        {formErrors.pan_number}
                                    </Form.Control.Feedback>
                                </Form.Group>
                            </Col>

                            {/* Address 1 */}
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="font-w600" style={{ fontSize: '13px' }}>Address 1</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={currentAccount.address1}
                                        onChange={(e) => handleAddressFieldChange('address1', e.target.value)}
                                        style={{ height: '44px', borderRadius: '8px', fontSize: '13.5px' }}
                                    />
                                </Form.Group>
                            </Col>

                            {/* Address 2 */}
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="font-w600" style={{ fontSize: '13px' }}>Address 2</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={currentAccount.address2}
                                        onChange={(e) => handleAddressFieldChange('address2', e.target.value)}
                                        style={{ height: '44px', borderRadius: '8px', fontSize: '13.5px' }}
                                    />
                                </Form.Group>
                            </Col>

                            {/* Address 3 */}
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="font-w600" style={{ fontSize: '13px' }}>Address 3</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={currentAccount.address3}
                                        onChange={(e) => handleAddressFieldChange('address3', e.target.value)}
                                        style={{ height: '44px', borderRadius: '8px', fontSize: '13.5px' }}
                                    />
                                </Form.Group>
                            </Col>

                            {/* Country */}
                            <Col md={3}>
                                <Form.Group>
                                    <Form.Label className="font-w600" style={{ fontSize: '13px' }}>Country</Form.Label>
                                    <Select
                                        styles={selectStyles}
                                        options={countryOptions}
                                        value={countryOptions.find(c => c.value === currentAccount.country) || null}
                                        onChange={(selected) => handleInputChange('country', selected ? selected.value : '')}
                                        placeholder="Select Country..."
                                    />
                                </Form.Group>
                            </Col>

                            {/* State */}
                            <Col md={3}>
                                <Form.Group>
                                    <Form.Label className="font-w600" style={{ fontSize: '13px' }}>State</Form.Label>
                                    <Select
                                        ref={stateSelectRef}
                                        styles={selectStyles}
                                        options={stateOptions}
                                        value={stateOptions.find(s => s.value === currentAccount.state) || null}
                                        onChange={(selected) => handleInputChange('state', selected ? selected.value : '')}
                                        placeholder="Select State..."
                                    />
                                </Form.Group>
                            </Col>

                            {/* Place of Supply */}
                            <Col md={3}>
                                <Form.Group>
                                    <Form.Label className="font-w600" style={{ fontSize: '13px' }}>Place of Supply</Form.Label>
                                    <Select
                                        styles={selectStyles}
                                        options={placeOfSupplyOptions}
                                        value={placeOfSupplyOptions.find(s => s.value === currentAccount.placeofsupply) || null}
                                        onChange={(selected) => handleInputChange('placeofsupply', selected ? selected.value : '')}
                                        placeholder="Select State..."
                                    />
                                </Form.Group>
                            </Col>

                            {/* Pin Code */}
                            <Col md={3}>
                                <Form.Group>
                                    <Form.Label className="font-w600" style={{ fontSize: '13px' }}>Pin Code</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={currentAccount.pincode}
                                        onChange={(e) => handleInputChange('pincode', e.target.value)}
                                        isInvalid={!!formErrors.pincode}
                                        maxLength={6}
                                        placeholder="682001"
                                        style={{ height: '44px', borderRadius: '8px', fontSize: '13.5px' }}
                                    />
                                    <Form.Control.Feedback type="invalid">
                                        {formErrors.pincode}
                                    </Form.Control.Feedback>
                                </Form.Group>
                            </Col>

                            {/* Phone */}
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="font-w600" style={{ fontSize: '13px' }}>Phone</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={currentAccount.phone}
                                        onChange={(e) => handleInputChange('phone', e.target.value)}
                                        isInvalid={!!formErrors.phone}
                                        style={{ height: '44px', borderRadius: '8px', fontSize: '13.5px' }}
                                    />
                                    <Form.Control.Feedback type="invalid">
                                        {formErrors.phone}
                                    </Form.Control.Feedback>
                                </Form.Group>
                            </Col>

                            {/* Email */}
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="font-w600" style={{ fontSize: '13px' }}>Email</Form.Label>
                                    <Form.Control
                                        type="email"
                                        value={currentAccount.email}
                                        onChange={(e) => handleInputChange('email', e.target.value)}
                                        isInvalid={!!formErrors.email}
                                        style={{ height: '44px', borderRadius: '8px', fontSize: '13.5px' }}
                                    />
                                    <Form.Control.Feedback type="invalid">
                                        {formErrors.email}
                                    </Form.Control.Feedback>
                                </Form.Group>
                            </Col>

                            {/* GST Number */}
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="font-w600" style={{ fontSize: '13px' }}>GST Number</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={currentAccount.gst_number}
                                        onChange={(e) => handleInputChange('gst_number', e.target.value)}
                                        isInvalid={!!formErrors.gst_number}
                                        maxLength={15}
                                        placeholder="e.g. 32ABCDE1234F1Z5"
                                        style={{ height: '44px', borderRadius: '8px', fontSize: '13.5px' }}
                                    />
                                    <Form.Control.Feedback type="invalid">
                                        {formErrors.gst_number}
                                    </Form.Control.Feedback>
                                </Form.Group>
                            </Col>
                        </Row>
                        )}
                    </Tab>

                    {/* GST Details & HSN Code Tab */}
                    <Tab eventKey="gst" title="GST Details & HSN Code">
                        {readOnly ? renderReadOnlyGstDetails() : (
                        <div className="table-responsive">
                            <table className="table table-bordered align-middle">
                                <thead className="bg-light">
                                    <tr style={{ fontSize: '12px' }}>
                                        <th>Applicable Date</th>
                                        <th>Registration Type</th>
                                        <th>GST Number</th>
                                        <th>Place of Supply</th>
                                        <th>GST %</th>
                                        <th>HSN Code</th>
                                        <th style={{ width: '50px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(currentAccount.gst_details || []).map((row, idx) => (
                                        <tr key={idx}>
                                            <td>
                                                <Form.Control
                                                    type="date"
                                                    size="sm"
                                                    value={row.applicable_date || ''}
                                                    onChange={(e) => handleArrayChange('gst_details', idx, 'applicable_date', e.target.value)}
                                                />
                                            </td>
                                            <td>
                                                <Form.Select
                                                    size="sm"
                                                    value={row.registration_type || ''}
                                                    onChange={(e) => handleArrayChange('gst_details', idx, 'registration_type', e.target.value)}
                                                >
                                                    <option value="">Select...</option>
                                                    <option value="registered">Registered</option>
                                                    <option value="unregistered">Unregistered</option>
                                                    <option value="composition">Composition</option>
                                                </Form.Select>
                                            </td>
                                            <td>
                                                <Form.Control
                                                    type="text"
                                                    size="sm"
                                                    value={row.gst_number || ''}
                                                    onChange={(e) => handleArrayChange('gst_details', idx, 'gst_number', e.target.value)}
                                                    maxLength={15}
                                                />
                                            </td>
                                            <td>
                                                <Form.Control
                                                    type="text"
                                                    size="sm"
                                                    value={row.place_of_supply || ''}
                                                    onChange={(e) => handleArrayChange('gst_details', idx, 'place_of_supply', e.target.value)}
                                                />
                                            </td>
                                            <td>
                                                <Form.Control
                                                    type="number"
                                                    size="sm"
                                                    value={row.gst_percentage || ''}
                                                    onChange={(e) => handleArrayChange('gst_details', idx, 'gst_percentage', e.target.value)}
                                                />
                                            </td>
                                            <td>
                                                <Form.Control
                                                    type="text"
                                                    size="sm"
                                                    value={row.hsn_code || ''}
                                                    onChange={(e) => handleArrayChange('gst_details', idx, 'hsn_code', e.target.value)}
                                                />
                                            </td>
                                            <td className="text-center">
                                                <button
                                                    type="button"
                                                    className="btn btn-xs btn-outline-danger"
                                                    onClick={() => removeArrayItem('gst_details', idx)}
                                                    disabled={(currentAccount.gst_details || []).length <= 1}
                                                >
                                                    <i className="fa fa-trash"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => addArrayItem('gst_details', {
                                    applicable_date: '', registration_type: '', gst_number: '', place_of_supply: 'Kerala', gst_percentage: '', hsn_code: ''
                                })}
                            >
                                <i className="fa fa-plus me-1"></i> Add Row
                            </button>
                        </div>
                        )}
                    </Tab>

                    {/* Contact Details Tab */}
                    <Tab eventKey="contact" title="Contact Details">
                        {readOnly ? renderReadOnlyContactDetails() : (
                        <div className="py-2">
                            {(currentAccount.contact_details || []).map((row, idx) => (
                                <div
                                    key={idx}
                                    className="p-4 mb-3 rounded-3"
                                    style={{
                                        backgroundColor: '#f8fafc',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '10px'
                                    }}
                                >
                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                        <h6 className="font-w700 text-dark mb-0" style={{ fontSize: '14px' }}>
                                            <i className="fa fa-id-badge text-primary me-2"></i>
                                            {(currentAccount.contact_details || []).length > 1
                                                ? `Contact Person #${idx + 1}`
                                                : 'Primary Contact Person'}
                                        </h6>
                                        {(currentAccount.contact_details || []).length > 1 && (
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"
                                                onClick={() => removeArrayItem('contact_details', idx)}
                                                style={{ borderRadius: '6px', fontSize: '12px', padding: '4px 10px' }}
                                            >
                                                <i className="fa fa-trash"></i> Remove
                                            </button>
                                        )}
                                    </div>

                                    <Row className="g-3">
                                        <Col md={4}>
                                            <Form.Group>
                                                <Form.Label className="font-w600" style={{ fontSize: '13px' }}>
                                                    Contact Person Name
                                                </Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    placeholder="e.g. John Doe"
                                                    value={row.contact_name || ''}
                                                    onChange={(e) => handleArrayChange('contact_details', idx, 'contact_name', e.target.value)}
                                                    style={{ height: '44px', borderRadius: '8px', fontSize: '13.5px' }}
                                                />
                                            </Form.Group>
                                        </Col>

                                        <Col md={4}>
                                            <Form.Group>
                                                <Form.Label className="font-w600" style={{ fontSize: '13px' }}>
                                                    Phone
                                                </Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    placeholder="e.g. 0484 2345678"
                                                    value={row.phone_no || ''}
                                                    onChange={(e) => handleArrayChange('contact_details', idx, 'phone_no', e.target.value)}
                                                    style={{ height: '44px', borderRadius: '8px', fontSize: '13.5px' }}
                                                />
                                            </Form.Group>
                                        </Col>

                                        <Col md={4}>
                                            <Form.Group>
                                                <Form.Label className="font-w600" style={{ fontSize: '13px' }}>
                                                    Primary Mobile
                                                </Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    placeholder="e.g. 9876543210"
                                                    value={row.primary_mobile || ''}
                                                    onChange={(e) => handleArrayChange('contact_details', idx, 'primary_mobile', e.target.value)}
                                                    style={{ height: '44px', borderRadius: '8px', fontSize: '13.5px' }}
                                                />
                                            </Form.Group>
                                        </Col>

                                        <Col md={4}>
                                            <Form.Group>
                                                <Form.Label className="font-w600" style={{ fontSize: '13px' }}>
                                                    Email Address
                                                </Form.Label>
                                                <Form.Control
                                                    type="email"
                                                    placeholder="e.g. contact@company.com"
                                                    value={row.email || ''}
                                                    onChange={(e) => handleArrayChange('contact_details', idx, 'email', e.target.value)}
                                                    style={{ height: '44px', borderRadius: '8px', fontSize: '13.5px' }}
                                                />
                                            </Form.Group>
                                        </Col>

                                        <Col md={4}>
                                            <Form.Group>
                                                <Form.Label className="font-w600" style={{ fontSize: '13px' }}>
                                                    WhatsApp Number
                                                </Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    placeholder="e.g. 9876543210"
                                                    value={row.whatsapp_no || ''}
                                                    onChange={(e) => handleArrayChange('contact_details', idx, 'whatsapp_no', e.target.value)}
                                                    style={{ height: '44px', borderRadius: '8px', fontSize: '13.5px' }}
                                                />
                                            </Form.Group>
                                        </Col>

                                        <Col md={4}>
                                            <Form.Group>
                                                <Form.Label className="font-w600" style={{ fontSize: '13px' }}>
                                                    Website
                                                </Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    placeholder="e.g. https://example.com"
                                                    value={row.website || ''}
                                                    onChange={(e) => handleArrayChange('contact_details', idx, 'website', e.target.value)}
                                                    style={{ height: '44px', borderRadius: '8px', fontSize: '13.5px' }}
                                                />
                                            </Form.Group>
                                        </Col>
                                    </Row>
                                </div>
                            ))}

                            <button
                                type="button"
                                className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                                onClick={() => addArrayItem('contact_details', {
                                    contact_name: '', phone_no: '', primary_mobile: '', fax_no: '', email: '', cc: '', website: '', whatsapp_no: '', whatsapp_marketing: false
                                })}
                                style={{ borderRadius: '6px', fontSize: '12.5px', padding: '6px 14px' }}
                            >
                                <i className="fa fa-plus"></i> Add Another Contact Person
                            </button>
                        </div>
                        )}
                    </Tab>

                    {/* Bank Details Tab */}
                    <Tab eventKey="bank" title="Bank Details">
                        {readOnly ? renderReadOnlyBankDetails() : (
                        <div className="py-2">
                            {(currentAccount.bank_details || []).map((row, idx) => (
                                <div
                                    key={idx}
                                    className="p-4 mb-3 rounded-3"
                                    style={{
                                        backgroundColor: '#f8fafc',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '10px'
                                    }}
                                >
                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                        <h6 className="font-w700 text-dark mb-0" style={{ fontSize: '14px' }}>
                                            <i className="fa fa-university text-primary me-2"></i>
                                            {(currentAccount.bank_details || []).length > 1
                                                ? `Bank Account #${idx + 1}`
                                                : 'Primary Bank Account'}
                                        </h6>
                                        {(currentAccount.bank_details || []).length > 1 && (
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"
                                                onClick={() => removeArrayItem('bank_details', idx)}
                                                style={{ borderRadius: '6px', fontSize: '12px', padding: '4px 10px' }}
                                            >
                                                <i className="fa fa-trash"></i> Remove
                                            </button>
                                        )}
                                    </div>

                                    <Row className="g-3">
                                        <Col md={4}>
                                            <Form.Group>
                                                <Form.Label className="font-w600" style={{ fontSize: '13px' }}>
                                                    Bank Account Number
                                                </Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    placeholder="Enter bank account number"
                                                    value={row.bank_account_no || ''}
                                                    onChange={(e) => handleArrayChange('bank_details', idx, 'bank_account_no', e.target.value)}
                                                    style={{ height: '44px', borderRadius: '8px', fontSize: '13.5px' }}
                                                />
                                            </Form.Group>
                                        </Col>

                                        <Col md={4}>
                                            <Form.Group>
                                                <Form.Label className="font-w600" style={{ fontSize: '13px' }}>
                                                    Bank Name
                                                </Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    placeholder="e.g. State Bank of India, HDFC"
                                                    value={row.bank_name || ''}
                                                    onChange={(e) => handleArrayChange('bank_details', idx, 'bank_name', e.target.value)}
                                                    style={{ height: '44px', borderRadius: '8px', fontSize: '13.5px' }}
                                                />
                                            </Form.Group>
                                        </Col>

                                        <Col md={4}>
                                            <Form.Group>
                                                <Form.Label className="font-w600" style={{ fontSize: '13px' }}>
                                                    Branch Name
                                                </Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    placeholder="e.g. Kochi Branch"
                                                    value={row.branch || ''}
                                                    onChange={(e) => handleArrayChange('bank_details', idx, 'branch', e.target.value)}
                                                    style={{ height: '44px', borderRadius: '8px', fontSize: '13.5px' }}
                                                />
                                            </Form.Group>
                                        </Col>

                                        <Col md={4}>
                                            <Form.Group>
                                                <Form.Label className="font-w600" style={{ fontSize: '13px' }}>
                                                    IFSC Code
                                                </Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    placeholder="e.g. SBIN0001234"
                                                    maxLength={11}
                                                    value={row.ifsc_code || ''}
                                                    onChange={(e) => handleArrayChange('bank_details', idx, 'ifsc_code', e.target.value.toUpperCase())}
                                                    style={{ height: '44px', borderRadius: '8px', fontSize: '13.5px' }}
                                                />
                                            </Form.Group>
                                        </Col>

                                        <Col md={4}>
                                            <Form.Group>
                                                <Form.Label className="font-w600" style={{ fontSize: '13px' }}>
                                                    MICR Code
                                                </Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    placeholder="9-digit MICR code"
                                                    maxLength={9}
                                                    value={row.micr_code || ''}
                                                    onChange={(e) => handleArrayChange('bank_details', idx, 'micr_code', e.target.value)}
                                                    style={{ height: '44px', borderRadius: '8px', fontSize: '13.5px' }}
                                                />
                                            </Form.Group>
                                        </Col>

                                        <Col md={4}>
                                            <Form.Group>
                                                <Form.Label className="font-w600" style={{ fontSize: '13px' }}>
                                                    Bank Phone / Helpdesk
                                                </Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    placeholder="e.g. 1800 123 4567"
                                                    value={row.bank_phone_no || ''}
                                                    onChange={(e) => handleArrayChange('bank_details', idx, 'bank_phone_no', e.target.value)}
                                                    style={{ height: '44px', borderRadius: '8px', fontSize: '13.5px' }}
                                                />
                                            </Form.Group>
                                        </Col>
                                    </Row>
                                </div>
                            ))}

                            <button
                                type="button"
                                className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                                onClick={() => addArrayItem('bank_details', {
                                    bank_account_no: '', bank_name: '', branch: '', ifsc_code: '', micr_code: '', bank_phone_no: ''
                                })}
                                style={{ borderRadius: '6px', fontSize: '12.5px', padding: '6px 14px' }}
                            >
                                <i className="fa fa-plus"></i> Add Another Bank Account
                            </button>
                        </div>
                        )}
                    </Tab>
                </Tabs>
            </Modal.Body>

            <Modal.Footer style={{ borderTop: '1px solid #f1f5f9', padding: '14px 24px', display: 'flex', justifyContent: readOnly ? 'flex-end' : 'space-between', alignItems: 'center' }}>
                {!readOnly && (
                    <div>
                        {getPrevTab(activeTab) && (
                            <Button
                                variant="outline-secondary"
                                onClick={handlePrevTab}
                                disabled={saving}
                                style={{ borderRadius: '8px', fontSize: '13px' }}
                            >
                                <i className="fa fa-arrow-left me-1"></i> Previous
                            </Button>
                        )}
                    </div>
                )}
                <div className="d-flex align-items-center gap-2">
                    <Button
                        variant="secondary"
                        onClick={closeModal}
                        disabled={saving}
                        style={{ borderRadius: '8px', fontSize: '13px', minWidth: '90px' }}
                    >
                        Close
                    </Button>
                    {!readOnly && getNextTab(activeTab) && (
                        <Button
                            variant="info"
                            className="text-white"
                            onClick={handleNextTab}
                            disabled={saving}
                            style={{ borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}
                            title="Go to next tab"
                        >
                            Save & Next <i className="fa fa-arrow-right ms-1"></i>
                        </Button>
                    )}
                    {!readOnly && (
                        <Button
                            variant="success"
                            onClick={handleSave}
                            disabled={saving}
                            style={{ borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}
                        >
                            {saving ? 'Saving...' : (editMode ? '✓ Update' : '✓ Save')}
                        </Button>
                    )}
                </div>
            </Modal.Footer>
        </Modal>
    );
};

export default OpportunityAccountModal;
