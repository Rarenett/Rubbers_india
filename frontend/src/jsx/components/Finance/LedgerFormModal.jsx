import React, { useState, useEffect, useRef, useContext } from 'react';
import { Button, Modal, Form, Row, Col, Tabs, Tab } from 'react-bootstrap';
import Swal from 'sweetalert2';
import Select from 'react-select';
import { ThemeContext } from '../../../context/ThemeContext';
import { createLedger, updateLedger } from '../../../services/FinanceService';
import { Country, State } from 'country-state-city';

const LedgerFormModal = ({ show, onHide, ledgerToEdit, accountGroups, onSave }) => {
    const nameInputRef = useRef(null);
    const stateSelectRef = useRef(null);
    const [activeTab, setActiveTab] = useState('general');
    const [saveAndNext, setSaveAndNext] = useState(false);

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
    
    const defaultLedger = { 
        id: null, 
        name: '', 
        accountGroup: '', 
        maintain_biilwise_details: false, 
        mailing_name: '',
        address1: '', address2: '', address3: '', address: '',
        state: 'Kerala', country: 'India', pincode: '',
        phone: '', email: '',
        gst_number: '', pan_number: '',
        credit_limit: 0.00, opening_balance: 0.00, opening_balance_type: 'Dr',
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
    
    const [currentLedger, setCurrentLedger] = useState(defaultLedger);
    const [formErrors, setFormErrors] = useState({});

    const editMode = !!(ledgerToEdit && ledgerToEdit.id);

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
        if (!phone || !phone.trim()) return '';
        const clean = phone.replace(/[\s\-\(\)\+]/g, '');
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
        if (!accNo || !accNo.trim()) return '';
        const regex = /^[0-9]{9,18}$/;
        return regex.test(accNo.trim()) ? '' : 'Invalid Bank Account No (9-18 digits)';
    };

    const isDebtorOrCreditorGroup = (groupId) => {
        if (!groupId) return true; // Show by default if no group selected yet
        const group = accountGroups.find(g => String(g.id) === String(groupId));
        if (!group) return true;
        const gName = (group.name || '').toLowerCase();
        const pName = (group.parent_name || '').toLowerCase();
        return gName.includes('debtor') || 
               gName.includes('creditor') || 
               gName.includes('customer') || 
               gName.includes('vendor') || 
               gName.includes('supplier') || 
               pName.includes('debtor') || 
               pName.includes('creditor');
    };

    const isExpenseOrIncomeGroup = (groupId) => {
        if (!groupId) return true; // Show GST tab by default if no group selected yet
        const group = accountGroups.find(g => String(g.id) === String(groupId));
        if (!group) return true;
        const gName = (group.name || '').toLowerCase();
        const pName = (group.parent_name || '').toLowerCase();
        return gName.includes('expense') || 
               gName.includes('income') || 
               gName.includes('sales') || 
               gName.includes('purchase') || 
               pName.includes('expense') || 
               pName.includes('income') || 
               pName.includes('sales') || 
               pName.includes('purchase');
    };

    const showAddressFields = isDebtorOrCreditorGroup(currentLedger.accountGroup);
    const showExpenseGstFields = isExpenseOrIncomeGroup(currentLedger.accountGroup);
    const showGstTab = showAddressFields || showExpenseGstFields;

    useEffect(() => {
        if (show) {
            setActiveTab('general');
            setSaveAndNext(false);
            setFormErrors({});
            if (ledgerToEdit) {
                const rawGroup = ledgerToEdit.accountGroup ?? ledgerToEdit.account_group;
                const editGroupId = (rawGroup && typeof rawGroup === 'object') ? rawGroup.id : rawGroup;
                const groupObj = accountGroups.find(g => String(g.id) === String(editGroupId));
                const defaultOpType = groupObj?.nature === 'Liability' || groupObj?.nature === 'Income' ? 'Cr' : 'Dr';
                const editCountry = getCountryName(ledgerToEdit.country) || defaultLedger.country;
                const editState = getStateName(ledgerToEdit.state, editCountry) || (editCountry !== 'India' ? '' : defaultLedger.state);
                const editPlaceOfSupply = getStateName(ledgerToEdit.placeofsupply, 'IN') || defaultLedger.placeofsupply;

                let sortedGstDetails = ledgerToEdit.gst_details?.length ? [...ledgerToEdit.gst_details] : defaultLedger.gst_details;
                if (sortedGstDetails && sortedGstDetails.length > 1) {
                    sortedGstDetails.sort((a, b) => {
                        const aScore = (parseFloat(a.gst_percentage) || 0) + (a.hsn_code ? 100 : 0);
                        const bScore = (parseFloat(b.gst_percentage) || 0) + (b.hsn_code ? 100 : 0);
                        return bScore - aScore;
                    });
                }
                const normalizedGstDetails = (sortedGstDetails || []).map(g => ({
                    ...g,
                    place_of_supply: getStateName(g.place_of_supply, 'IN') || editPlaceOfSupply
                }));

                setCurrentLedger({
                    ...defaultLedger,
                    ...ledgerToEdit,
                    accountGroup: (editGroupId !== undefined && editGroupId !== null) ? editGroupId : '',
                    country: editCountry,
                    state: editState,
                    placeofsupply: editPlaceOfSupply,
                    opening_balance_type: ledgerToEdit.opening_balance_type || defaultOpType,
                    gst_details: normalizedGstDetails,
                    contact_details: ledgerToEdit.contact_details?.length ? ledgerToEdit.contact_details : defaultLedger.contact_details,
                    bank_details: ledgerToEdit.bank_details?.length ? ledgerToEdit.bank_details : defaultLedger.bank_details,
                });
            } else {
                setCurrentLedger(defaultLedger);
            }
            const timer = setTimeout(() => {
                nameInputRef.current?.focus();
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [show, ledgerToEdit]);

    const handleKeyDown = (e) => {
        const target = e.target;
        const tagName = target.tagName.toLowerCase();
        const type = target.type ? target.type.toLowerCase() : '';

        if (e.key !== 'Enter') {
            if (tagName === 'select') {
                delete target.dataset.pickerOpen;
            }
            return;
        }
        
        // Allow default behavior for textareas and submit buttons
        if (tagName === 'textarea' || type === 'submit') {
            return;
        }
        
        e.preventDefault();
        
        // Check if the current element is a select dropdown and is NOT marked as open
        if (tagName === 'select' && target.dataset.pickerOpen !== 'true') {
            if (typeof target.showPicker === 'function') {
                target.showPicker();
                target.dataset.pickerOpen = 'true';
                return;
            }
        }
        
        // If it was open, or it's a regular input, delete flag and go to next
        if (tagName === 'select') {
            delete target.dataset.pickerOpen;
        }

        const form = e.currentTarget;
        const focusableElements = Array.from(
            form.querySelectorAll('input, select, textarea, button')
        ).filter(el => {
            return !el.disabled && 
                   el.tabIndex !== -1 && 
                   el.offsetParent !== null && 
                   !(el.tagName.toLowerCase() === 'button' && el.classList.contains('btn-secondary'));
        });
        
        const index = focusableElements.indexOf(target);
        if (index > -1 && index < focusableElements.length - 1) {
            focusableElements[index + 1].focus();
        }
    };

    const handleFormBlur = (e) => {
        if (e.target.tagName.toLowerCase() === 'select') {
            delete e.target.dataset.pickerOpen;
        }
    };

    const getNextTab = (currentTab) => {
        const tabs = ['general'];
        if (showGstTab) tabs.push('gst');
        if (showAddressFields) {
            tabs.push('contact');
            tabs.push('bank');
        }
        const curIdx = tabs.indexOf(currentTab);
        if (curIdx >= 0 && curIdx < tabs.length - 1) {
            return tabs[curIdx + 1];
        }
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const errors = {};

        // General Info tab
        if (!currentLedger.name || !currentLedger.name.trim()) {
            errors.name = 'Ledger Name is required';
        }

        // GST Details tab
        if (currentLedger.gst_details && currentLedger.gst_details[0]) {
            const tabGstErr = validateGSTIN(currentLedger.gst_details[0].gst_number);
            if (tabGstErr) errors.gst_tab_gst_number = tabGstErr;
        }

        if (showAddressFields) {
            const gstErr = validateGSTIN(currentLedger.gst_number);
            if (gstErr) errors.gst_number = gstErr;

            const panErr = validatePAN(currentLedger.pan_number);
            if (panErr) errors.pan_number = panErr;

            const phoneErr = validatePhone(currentLedger.phone);
            if (phoneErr) errors.phone = phoneErr;

            const emailErr = validateEmail(currentLedger.email);
            if (emailErr) errors.email = emailErr;

            const pinErr = validatePincode(currentLedger.pincode);
            if (pinErr) errors.pincode = pinErr;

            if (currentLedger.registration_type === 'registered' && !currentLedger.gst_number) {
                errors.gst_number = 'GST Number is required when Registration Type is Registered';
            }

            // Contact Details tab
            if (currentLedger.contact_details && currentLedger.contact_details[0]) {
                const c = currentLedger.contact_details[0];
                const cPhone = validatePhone(c.phone_no);
                if (cPhone) errors.contact_phone = cPhone;

                const cMobile = validatePhone(c.primary_mobile);
                if (cMobile) errors.contact_mobile = cMobile;

                const cWa = validatePhone(c.whatsapp_no);
                if (cWa) errors.contact_whatsapp = cWa;

                const cEmail = validateEmail(c.email);
                if (cEmail) errors.contact_email = cEmail;

                const cCc = validateEmail(c.cc);
                if (cCc) errors.contact_cc = cCc;
            }

            // Bank Details tab
            if (currentLedger.bank_details && currentLedger.bank_details[0]) {
                const b = currentLedger.bank_details[0];
                const bAcc = validateBankAccountNo(b.bank_account_no);
                if (bAcc) errors.bank_acc_no = bAcc;

                const bIfsc = validateIFSC(b.ifsc_code);
                if (bIfsc) errors.bank_ifsc = bIfsc;

                const bMicr = validateMICR(b.micr_code);
                if (bMicr) errors.bank_micr = bMicr;

                const bPhone = validatePhone(b.bank_phone_no);
                if (bPhone) errors.bank_phone = bPhone;
            }
        }

        setFormErrors(errors);

        if (Object.keys(errors).length > 0) {
            // Determine tab to switch to based on first error
            if (errors.name || errors.gst_number || errors.pan_number || errors.phone || errors.email || errors.pincode) {
                setActiveTab('general');
            } else if (errors.gst_tab_gst_number) {
                setActiveTab('gst');
            } else if (errors.contact_phone || errors.contact_mobile || errors.contact_whatsapp || errors.contact_email || errors.contact_cc) {
                setActiveTab('contact');
            } else if (errors.bank_acc_no || errors.bank_ifsc || errors.bank_micr || errors.bank_phone) {
                setActiveTab('bank');
            }

            const errorList = Object.values(errors).join('<br/>• ');
            Swal.fire({
                icon: 'warning',
                title: 'Validation Errors',
                html: `<div style="text-align:left; font-size: 14px;">Please correct the following fields before saving:<br/><br/>• ${errorList}</div>`
            });
            return;
        }

        try {
            const payload = { ...currentLedger };
            payload.country = getCountryName(payload.country);
            payload.state = getStateName(payload.state, payload.country);
            payload.placeofsupply = getStateName(payload.placeofsupply, 'IN');

            if (!payload.accountGroup) {
                payload.accountGroup = null; 
            }
            if (payload.opening_balance === '') payload.opening_balance = 0;
            if (payload.credit_limit === '') payload.credit_limit = 0;
            
            if (payload.gst_details) {
                payload.gst_details = payload.gst_details
                    .filter(g => g.applicable_date || (g.registration_type && g.registration_type !== 'unknown') || g.gst_number || (g.gst_percentage !== '' && g.gst_percentage !== null && g.gst_percentage !== undefined) || g.hsn_code)
                    .map(g => ({
                        ...g,
                        place_of_supply: getStateName(g.place_of_supply || payload.placeofsupply, 'IN'),
                        applicable_date: g.applicable_date === '' ? null : g.applicable_date,
                        gst_percentage: (g.gst_percentage === '' || g.gst_percentage === null || g.gst_percentage === undefined || isNaN(g.gst_percentage)) ? 0 : parseFloat(g.gst_percentage)
                    }));
            }
            
            if (payload.contact_details) {
                payload.contact_details = payload.contact_details.filter(c => 
                    c.contact_name || c.phone_no || c.primary_mobile || c.fax_no || c.email || c.cc || c.website || c.whatsapp_no
                );
            }

            if (payload.bank_details) {
                payload.bank_details = payload.bank_details.filter(b => 
                    b.bank_account_no || b.bank_name || b.branch || b.ifsc_code || b.micr_code || b.bank_phone_no
                );
            }

            let savedLedger = null;
            const isCreating = !currentLedger.id;

            if (isCreating) {
                savedLedger = await createLedger(payload);
            } else {
                savedLedger = await updateLedger(currentLedger.id, payload);
            }

            onSave(savedLedger);

            setCurrentLedger(prev => ({
                ...defaultLedger,
                ...savedLedger,
                opening_balance_type: savedLedger.opening_balance_type || prev.opening_balance_type || 'Dr',
                gst_details: savedLedger.gst_details?.length ? savedLedger.gst_details : defaultLedger.gst_details,
                contact_details: savedLedger.contact_details?.length ? savedLedger.contact_details : defaultLedger.contact_details,
                bank_details: savedLedger.bank_details?.length ? savedLedger.bank_details : defaultLedger.bank_details,
            }));

            const nextTab = saveAndNext ? getNextTab(activeTab) : null;

            if (nextTab) {
                setActiveTab(nextTab);
                const tabNames = {
                    gst: 'GST Details & HSN Code',
                    contact: 'Contact Details',
                    bank: 'Bank Details'
                };
                Swal.fire({ 
                    icon: 'success', 
                    title: 'Saved', 
                    text: `Ledger ${isCreating ? 'created' : 'updated'} successfully! Moving to ${tabNames[nextTab] || 'next tab'}...`, 
                    timer: 1500, 
                    showConfirmButton: false 
                });
            } else {
                Swal.fire({ 
                    icon: 'success', 
                    title: isCreating ? 'Created' : 'Updated', 
                    text: `Ledger ${isCreating ? 'created' : 'updated'} successfully`, 
                    timer: 1500,
                    showConfirmButton: false
                });
                onHide();
            }
        } catch (error) {
            console.error(error.response?.data);
            let errorMsg = 'Ensure the name is unique.';
            if (error.response && error.response.data) {
                if (typeof error.response.data === 'object') {
                    errorMsg = Object.entries(error.response.data)
                        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
                        .join(' | ');
                } else {
                    errorMsg = error.response.data;
                }
            }
            Swal.fire({ icon: 'error', title: 'Error', text: `Failed to ${editMode ? 'update' : 'create'} ledger. ${errorMsg}` });
        }
    };

    const handleInputChange = (field, value) => {
        let formattedValue = value;
        if (field === 'gst_number' || field === 'pan_number') {
            formattedValue = value.toUpperCase().trim();
        }

        setCurrentLedger(prev => {
            const next = { ...prev, [field]: formattedValue };

            if (field === 'accountGroup') {
                const groupObj = accountGroups.find(g => String(g.id) === String(formattedValue));
                if (groupObj && groupObj.nature) {
                    next.opening_balance_type = (groupObj.nature === 'Liability' || groupObj.nature === 'Income') ? 'Cr' : 'Dr';
                }
            }

            // Auto-extract PAN from GST Number if 15 chars and valid
            if (field === 'gst_number' && formattedValue.length === 15 && validateGSTIN(formattedValue) === '') {
                const derivedPAN = formattedValue.substring(2, 12);
                if (!prev.pan_number || prev.pan_number.length !== 10) {
                    next.pan_number = derivedPAN;
                }
                // Keep GST tab in sync
                if (next.gst_details && next.gst_details[0]) {
                    const updatedGst = [...next.gst_details];
                    updatedGst[0] = { ...updatedGst[0], gst_number: formattedValue };
                    next.gst_details = updatedGst;
                }
            }

            return next;
        });

        if (formErrors[field]) {
            setFormErrors(prev => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    };

    const handleNestedChange = (category, arg1, arg2, arg3) => {
        let index = 0;
        let field = '';
        let value = '';

        if (typeof arg1 === 'number') {
            index = arg1;
            field = arg2;
            value = arg3;
        } else {
            index = 0;
            field = arg1;
            value = arg2;
        }

        let formattedValue = value;
        if (field === 'gst_number' || field === 'ifsc_code') {
            formattedValue = (value || '').toUpperCase().trim();
        }

        setCurrentLedger(prev => {
            const updatedCategory = [...(prev[category] || [])];
            if (!updatedCategory[index]) {
                updatedCategory[index] = {};
            }
            updatedCategory[index] = { ...updatedCategory[index], [field]: formattedValue };

            let updatedMainGst = prev.gst_number;
            if (category === 'gst_details' && field === 'gst_number' && index === 0) {
                updatedMainGst = formattedValue;
            }

            return { ...prev, [category]: updatedCategory, gst_number: updatedMainGst };
        });

        const errKey = `${category}_${field}`;
        if (formErrors[errKey]) {
            setFormErrors(prev => {
                const next = { ...prev };
                delete next[errKey];
                return next;
            });
        }
    };

    const addGstRow = () => {
        setCurrentLedger(prev => ({
            ...prev,
            gst_details: [
                ...(prev.gst_details || []),
                {
                    applicable_date: new Date().toISOString().split('T')[0],
                    registration_type: prev.registration_type || '',
                    gst_number: prev.gst_number || '',
                    place_of_supply: getStateName(prev.placeofsupply, 'IN') || 'Kerala',
                    gst_percentage: '',
                    hsn_code: ''
                }
            ]
        }));
    };

    const removeGstRow = (index) => {
        setCurrentLedger(prev => {
            const list = [...(prev.gst_details || [])];
            if (list.length <= 1) return prev;
            list.splice(index, 1);
            return { ...prev, gst_details: list };
        });
    };

    const { background } = useContext(ThemeContext);
    const isDark = background?.value === 'dark';

    const customSelectStyles = {
        control: (provided, state) => ({
            ...provided,
            backgroundColor: isDark ? '#24292D' : '#ffffff',
            borderColor: state.isFocused 
                ? 'var(--cc-primary, #0a500f)' 
                : (isDark ? '#636363' : '#ececec'),
            color: isDark ? '#ffffff' : '#2f3f50',
            minHeight: '56px',
            height: '56px',
            borderRadius: '0.5rem',
            boxShadow: 'none',
            '&:hover': {
                borderColor: state.isFocused ? 'var(--cc-primary, #0a500f)' : (isDark ? '#636363' : '#ececec'),
            }
        }),
        valueContainer: (provided) => ({
            ...provided,
            padding: '0.3125rem 1.25rem',
        }),
        singleValue: (provided) => ({
            ...provided,
            color: isDark ? '#ffffff' : '#2f3f50',
            fontSize: '14px',
        }),
        placeholder: (provided) => ({
            ...provided,
            color: isDark ? '#888888' : '#7e7e7e',
            fontSize: '14px',
        }),
        menu: (provided) => ({
            ...provided,
            backgroundColor: isDark ? '#2F363E' : '#ffffff',
            borderColor: isDark ? '#636363' : '#ececec',
            zIndex: 9999
        }),
        option: (provided, state) => ({
            ...provided,
            backgroundColor: state.isSelected
                ? 'var(--cc-primary, #0a500f)'
                : state.isFocused
                    ? (isDark ? '#24292D' : '#f8f9fa')
                    : 'transparent',
            color: state.isSelected
                ? '#ffffff'
                : (isDark ? '#ffffff' : '#2f3f50'),
            cursor: 'pointer',
            '&:active': {
                backgroundColor: 'var(--cc-primary, #0a500f)',
                color: '#ffffff'
            }
        }),
        input: (provided) => ({
            ...provided,
            color: isDark ? '#ffffff' : '#2f3f50',
        }),
        indicatorSeparator: () => ({
            display: 'none',
        }),
        dropdownIndicator: (provided) => ({
            ...provided,
            color: isDark ? '#636363' : '#ececec',
            '&:hover': {
                color: isDark ? '#ffffff' : '#7e7e7e'
            }
        })
    };

    const accountGroupOptions = React.useMemo(() => {
        return (accountGroups || []).map(group => ({
            value: group.id,
            label: group.name
        }));
    }, [accountGroups]);

    const countryOptions = React.useMemo(() => {
        return Country.getAllCountries().map((c) => ({
            value: c.name,
            label: c.name
        }));
    }, []);

    const stateOptions = React.useMemo(() => {
        if (!currentLedger.country) return [];
        return State.getStatesOfCountry(getCountryCode(currentLedger.country)).map((s) => ({
            value: s.name,
            label: s.name
        }));
    }, [currentLedger.country]);

    const placeOfSupplyOptions = React.useMemo(() => {
        return State.getStatesOfCountry('IN').map((s) => ({
            value: s.name,
            label: s.name
        }));
    }, []);

    const registrationTypeOptions = [
        { value: 'unknown', label: 'Unknown' },
        { value: 'registered', label: 'Registered' },
        { value: 'unregistered', label: 'Unregistered' },
        { value: 'composition', label: 'Composition' }
    ];

    return (
        <Modal show={show} onHide={onHide} size="xl">
            <Modal.Header closeButton>
                <Modal.Title className="w-100">
                    <div className="d-flex align-items-center">
                        <div
                            className="d-flex align-items-center justify-content-center rounded-circle me-3 form-icon-circle"
                            style={{ width: '48px', height: '48px' }}
                        >
                            <i className="fa fa-book text-white fs-4"></i>
                        </div>
                        <div>
                            <h4 className="mb-1">{editMode ? 'Edit Ledger' : 'Add Ledger'}</h4>
                            <p className="mb-0 text-muted" style={{ fontSize: '13px', fontWeight: 'normal' }}>
                                {editMode
                                    ? 'Update the configurations and details of your ledger account'
                                    : 'Enter details to create a new ledger account'}
                            </p>
                        </div>
                    </div>
                </Modal.Title>
            </Modal.Header>
            <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown} onBlur={handleFormBlur}>
                <Modal.Body className="ledger-modal-body">
                    <style>{`
                        .ledger-modal-body .nav-tabs {
                            border-bottom: 2px solid #e2e8f0;
                        }
                        .ledger-modal-body .nav-link {
                            text-decoration: none !important;
                            color: #64748b;
                            font-weight: 500;
                            border: none !important;
                            border-bottom: 2px solid transparent !important;
                            padding: 8px 16px;
                            transition: color 0.15s ease, border-color 0.15s ease;
                        }
                        .ledger-modal-body .nav-link:hover {
                            text-decoration: none !important;
                            color: var(--cc-primary, #0a500f) !important;
                        }
                        .ledger-modal-body .nav-link.active {
                            text-decoration: none !important;
                            color: var(--cc-primary, #0a500f) !important;
                            font-weight: 600;
                            background-color: transparent !important;
                            border: none !important;
                            border-bottom: 2px solid var(--cc-primary, #0a500f) !important;
                        }
                        .ledger-modal-body input, .ledger-modal-body select, .ledger-modal-body textarea, .ledger-modal-body a {
                            text-decoration: none !important;
                        }
                    `}</style>
                    <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-3">
                        <Tab eventKey="general" title="General Info">
                            <Row>
                                 <Col md={4}>
                                     <Form.Group className="mb-3">
                                         <Form.Label>Name <span className="text-danger">*</span></Form.Label>
                                         <Form.Control 
                                             ref={nameInputRef}
                                             type="text" 
                                             value={currentLedger.name} 
                                             onChange={(e) => handleInputChange('name', e.target.value)} 
                                             isInvalid={!!formErrors.name}
                                             spellCheck={false}
                                             required 
                                         />
                                         <Form.Control.Feedback type="invalid">{formErrors.name}</Form.Control.Feedback>
                                     </Form.Group>
                                 </Col>
                                 <Col md={4}>
                                     <Form.Group className="mb-3">
                                         <Form.Label>Account Group</Form.Label>
                                         <Select
                                             classNamePrefix="react-select"
                                             options={accountGroupOptions}
                                             value={accountGroupOptions.find(g => String(g.value) === String(currentLedger.accountGroup)) || null}
                                             onChange={(selected) => handleInputChange('accountGroup', selected ? selected.value : '')}
                                             placeholder="Select Group..."
                                             isSearchable
                                             isClearable
                                             tabSelectsValue={false}
                                             styles={customSelectStyles}
                                         />
                                     </Form.Group>
                                 </Col>
                                 <Col md={4}>
                                     <Form.Group className="mb-3 mt-4">
                                         <Form.Check type="checkbox" label="Maintain Billwise Details" checked={currentLedger.maintain_biilwise_details} onChange={(e) => handleInputChange('maintain_biilwise_details', e.target.checked)} />
                                     </Form.Group>
                                 </Col>
                             </Row>
                            <Row>
                                <Col md={3}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Opening Balance</Form.Label>
                                        <div className="d-flex align-items-center gap-1">
                                            <Form.Control 
                                                type="number" 
                                                step="0.01" 
                                                value={currentLedger.opening_balance} 
                                                onChange={(e) => handleInputChange('opening_balance', e.target.value)} 
                                                style={{ flex: 1 }}
                                               
                                            />
                                            <Form.Select 
                                                value={currentLedger.opening_balance_type || 'Dr'} 
                                                onChange={(e) => handleInputChange('opening_balance_type', e.target.value)}
                                               
                                                style={{ 
                                                    width: '75px', 
                                                    fontWeight: 'bold', 
                                                    color: (currentLedger.opening_balance_type || 'Dr') === 'Cr' ? '#dc3545' : '#198754',
                                                    borderColor: isDark ? '#636363' : '#ececec',
                                                    backgroundColor: isDark ? '#24292D' : '#ffffff'
                                                }}
                                            >
                                                <option value="Dr">Dr</option>
                                                <option value="Cr">Cr</option>
                                            </Form.Select>
                                        </div>
                                    </Form.Group>
                                </Col>
                                <Col md={3}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Credit Limit</Form.Label>
                                        <Form.Control type="number" step="0.01" value={currentLedger.credit_limit} onChange={(e) => handleInputChange('credit_limit', e.target.value)} />
                                    </Form.Group>
                                </Col>
                                <Col md={3}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Mailing Name</Form.Label>
                                        <Form.Control type="text" value={currentLedger.mailing_name} onChange={(e) => handleInputChange('mailing_name', e.target.value)} />
                                    </Form.Group>
                                </Col>
                                {showAddressFields && (
                                    <Col md={3}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>PAN Number</Form.Label>
                                            <Form.Control 
                                                type="text" 
                                                value={currentLedger.pan_number} 
                                                onChange={(e) => handleInputChange('pan_number', e.target.value)} 
                                                isInvalid={!!formErrors.pan_number}
                                                placeholder="e.g. ABCDE1234F"
                                               
                                            />
                                            <Form.Control.Feedback type="invalid">{formErrors.pan_number}</Form.Control.Feedback>
                                        </Form.Group>
                                    </Col>
                                )}
                            </Row>
                            {showAddressFields && (
                                <>
                                    <Row>
                                        <Col md={3}>
                                            <Form.Group className="mb-3"><Form.Label>Address 1</Form.Label><Form.Control type="text" value={currentLedger.address1} onChange={(e) => handleInputChange('address1', e.target.value)} /></Form.Group>
                                        </Col>
                                        <Col md={3}>
                                            <Form.Group className="mb-3"><Form.Label>Address 2</Form.Label><Form.Control type="text" value={currentLedger.address2} onChange={(e) => handleInputChange('address2', e.target.value)} /></Form.Group>
                                        </Col>
                                        <Col md={3}>
                                            <Form.Group className="mb-3"><Form.Label>Address 3</Form.Label><Form.Control type="text" value={currentLedger.address3} onChange={(e) => handleInputChange('address3', e.target.value)} /></Form.Group>
                                        </Col>
                                        <Col md={3}>
                                            <Form.Group className="mb-3">
                                                <Form.Label>Pin Code</Form.Label>
                                                <Form.Control 
                                                    type="text" 
                                                    value={currentLedger.pincode} 
                                                    onChange={(e) => handleInputChange('pincode', e.target.value)} 
                                                    isInvalid={!!formErrors.pincode}
                                                    placeholder="e.g. 682001"
                                                   
                                                />
                                                <Form.Control.Feedback type="invalid">{formErrors.pincode}</Form.Control.Feedback>
                                            </Form.Group>
                                        </Col>
                                    </Row>
                                    <Row>
                                        <Col md={3}>
                                            <Form.Group className="mb-3">
                                                <Form.Label>Country</Form.Label>
                                                <Select
                                                     classNamePrefix="react-select"
                                                     options={countryOptions}
                                                     value={countryOptions.find(c => c.value.toLowerCase() === getCountryName(currentLedger.country).toLowerCase()) || null}
                                                     onChange={(selected) => {
                                                         const val = selected ? selected.value : '';
                                                         handleInputChange('country', val);
                                                         handleInputChange('state', '');
                                                         if (val) {
                                                             setTimeout(() => {
                                                                 stateSelectRef.current?.focus();
                                                             }, 50);
                                                         }
                                                     }}
                                                     placeholder="Select Country"
                                                     isSearchable
                                                     isClearable
                                                     tabSelectsValue={false}
                                                     styles={customSelectStyles}
                                                 />
                                            </Form.Group>
                                        </Col>
                                        <Col md={3}>
                                            <Form.Group className="mb-3">
                                                <Form.Label>State</Form.Label>
                                                <Select
                                                     ref={stateSelectRef}
                                                     classNamePrefix="react-select"
                                                     options={stateOptions}
                                                     value={stateOptions.find(s => s.value.toLowerCase() === getStateName(currentLedger.state, currentLedger.country).toLowerCase()) || null}
                                                     onChange={(selected) => handleInputChange('state', selected ? selected.value : '')}
                                                     placeholder="Select State"
                                                     isSearchable
                                                     isClearable
                                                     isDisabled={!currentLedger.country}
                                                     tabSelectsValue={false}
                                                     styles={customSelectStyles}
                                                 />
                                            </Form.Group>
                                        </Col>
                                        <Col md={3}>
                                            <Form.Group className="mb-3">
                                                <Form.Label>Place of Supply</Form.Label>
                                                <Select
                                                     classNamePrefix="react-select"
                                                     options={placeOfSupplyOptions}
                                                     value={placeOfSupplyOptions.find(s => s.value.toLowerCase() === getStateName(currentLedger.placeofsupply, 'IN').toLowerCase()) || null}
                                                     onChange={(selected) => handleInputChange('placeofsupply', selected ? selected.value : '')}
                                                     placeholder="Select State"
                                                     isSearchable
                                                     isClearable
                                                     tabSelectsValue={false}
                                                     styles={customSelectStyles}
                                                 />
                                            </Form.Group>
                                        </Col>
                                        <Col md={3}>
                                            <Form.Group className="mb-3">
                                                <Form.Label>Registration Type</Form.Label>
                                                <Select
                                                     classNamePrefix="react-select"
                                                     options={registrationTypeOptions}
                                                     value={registrationTypeOptions.find(o => o.value === (currentLedger.registration_type || 'unknown')) || registrationTypeOptions[0]}
                                                     onChange={(selected) => handleInputChange('registration_type', selected ? selected.value : 'unknown')}
                                                     placeholder="Select Type..."
                                                     isSearchable
                                                     tabSelectsValue={false}
                                                     styles={customSelectStyles}
                                                 />
                                            </Form.Group>
                                        </Col>
                                    </Row>
                                    <Row>
                                        <Col md={3}>
                                            <Form.Group className="mb-3">
                                                <Form.Label>Phone</Form.Label>
                                                <Form.Control 
                                                    type="text" 
                                                    value={currentLedger.phone} 
                                                    onChange={(e) => handleInputChange('phone', e.target.value)} 
                                                    isInvalid={!!formErrors.phone}
                                                    placeholder="e.g. 9876543210"
                                                   
                                                />
                                                <Form.Control.Feedback type="invalid">{formErrors.phone}</Form.Control.Feedback>
                                            </Form.Group>
                                        </Col>
                                        <Col md={3}>
                                            <Form.Group className="mb-3">
                                                <Form.Label>Email</Form.Label>
                                                <Form.Control 
                                                    type="email" 
                                                    value={currentLedger.email} 
                                                    onChange={(e) => handleInputChange('email', e.target.value)} 
                                                    isInvalid={!!formErrors.email}
                                                    placeholder="e.g. info@company.com"
                                                   
                                                />
                                                <Form.Control.Feedback type="invalid">{formErrors.email}</Form.Control.Feedback>
                                            </Form.Group>
                                        </Col>
                                        <Col md={3}>
                                            <Form.Group className="mb-3">
                                                <Form.Label>GST Number</Form.Label>
                                                <Form.Control 
                                                    type="text" 
                                                    value={currentLedger.gst_number} 
                                                    onChange={(e) => handleInputChange('gst_number', e.target.value)} 
                                                    isInvalid={!!formErrors.gst_number}
                                                    placeholder="e.g. 32ABCDE1234F1Z5"
                                                   
                                                />
                                                <Form.Control.Feedback type="invalid">{formErrors.gst_number}</Form.Control.Feedback>
                                            </Form.Group>
                                        </Col>
                                    </Row>
                                </>
                            )}
                         </Tab>

                         {showGstTab && (
                             <Tab eventKey="gst" title="GST Details & HSN Code">
                                 <div className="d-flex justify-content-between align-items-center mb-3">
                                     <div>
                                         <h6 className="fw-bold mb-1 text-primary">
                                             <i className="fa fa-percent me-2"></i>
                                             GST Rates & Applicable Dates
                                         </h6>
                                         <p className="text-muted mb-0 small">
                                             Add multiple GST rate revisions along with their effective applicable dates
                                         </p>
                                     </div>
                                     <Button variant="outline-primary" size="sm" onClick={addGstRow} className="fw-semibold">
                                         <i className="fa fa-plus me-1"></i> Add GST Rate Revision
                                     </Button>
                                 </div>

                                 <div className="table-responsive border rounded mb-3">
                                     <table className="table table-bordered table-sm align-middle mb-0" style={{ fontSize: '13px' }}>
                                         <thead style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc' }}>
                                             <tr>
                                                 <th style={{ width: '180px' }}>Applicable From Date</th>
                                                 <th style={{ width: '150px' }}>GST Rate (%)</th>
                                                 <th style={{ width: '160px' }}>HSN / SAC Code</th>
                                                 <th>Place of Supply</th>
                                                 {showAddressFields && <th>Registration Type & GSTIN</th>}
                                                 <th style={{ width: '60px' }} className="text-center">Action</th>
                                             </tr>
                                         </thead>
                                         <tbody>
                                             {(currentLedger.gst_details || []).map((gstRow, idx) => (
                                                 <tr key={idx} style={{ backgroundColor: isDark ? '#24292D' : '#ffffff' }}>
                                                     <td>
                                                         <Form.Control
                                                             type="date"
                                                             size="sm"
                                                             value={gstRow.applicable_date || ''}
                                                             onChange={(e) => handleNestedChange('gst_details', idx, 'applicable_date', e.target.value)}
                                                         />
                                                     </td>
                                                     <td>
                                                         <Form.Control
                                                             type="number"
                                                             step="0.01"
                                                             size="sm"
                                                             value={gstRow.gst_percentage !== undefined && gstRow.gst_percentage !== null ? gstRow.gst_percentage : ''}
                                                             onChange={(e) => handleNestedChange('gst_details', idx, 'gst_percentage', e.target.value)}
                                                             placeholder="e.g. 18.00"
                                                         />
                                                     </td>
                                                     <td>
                                                         <Form.Control
                                                             type="text"
                                                             size="sm"
                                                             value={gstRow.hsn_code || ''}
                                                             onChange={(e) => handleNestedChange('gst_details', idx, 'hsn_code', e.target.value)}
                                                             placeholder="e.g. 9965"
                                                         />
                                                     </td>
                                                     <td>
                                                         <Select
                                                              classNamePrefix="react-select"
                                                              options={placeOfSupplyOptions}
                                                              value={
                                                                  gstRow.place_of_supply
                                                                      ? (placeOfSupplyOptions.find(s => s.value.toLowerCase() === getStateName(gstRow.place_of_supply, 'IN').toLowerCase()) || null)
                                                                      : null
                                                              }
                                                              onChange={(selected) => handleNestedChange('gst_details', idx, 'place_of_supply', selected ? selected.value : '')}
                                                              placeholder="Select State"
                                                              isSearchable
                                                              isClearable
                                                              tabSelectsValue={false}
                                                              styles={customSelectStyles}
                                                          />
                                                     </td>
                                                     {showAddressFields && (
                                                         <td>
                                                             <div className="d-flex gap-1">
                                                                 <Form.Control
                                                                     type="text"
                                                                     size="sm"
                                                                     value={gstRow.registration_type || ''}
                                                                     onChange={(e) => handleNestedChange('gst_details', idx, 'registration_type', e.target.value)}
                                                                     placeholder="Reg Type"
                                                                 />
                                                                 <Form.Control
                                                                     type="text"
                                                                     size="sm"
                                                                     value={gstRow.gst_number || ''}
                                                                     onChange={(e) => handleNestedChange('gst_details', idx, 'gst_number', e.target.value)}
                                                                     placeholder="GSTIN"
                                                                 />
                                                             </div>
                                                         </td>
                                                     )}
                                                     <td className="text-center">
                                                         {currentLedger.gst_details.length > 1 && (
                                                             <Button
                                                                 variant="outline-danger"
                                                                 size="sm"
                                                                 className="py-0 px-2"
                                                                 onClick={() => removeGstRow(idx)}
                                                                 title="Delete GST Row"
                                                             >
                                                                 <i className="fa fa-trash"></i>
                                                             </Button>
                                                         )}
                                                     </td>
                                                 </tr>
                                             ))}
                                         </tbody>
                                     </table>
                                 </div>
                             </Tab>
                         )}

                         {showAddressFields && (
                             <Tab eventKey="contact" title="Contact Details">
                                 <Row>
                                     <Col md={3}>
                                         <Form.Group className="mb-3"><Form.Label>Contact Name</Form.Label><Form.Control type="text" value={currentLedger.contact_details[0].contact_name || ''} onChange={(e) => handleNestedChange('contact_details', 'contact_name', e.target.value)} /></Form.Group>
                                     </Col>
                                     <Col md={3}>
                                         <Form.Group className="mb-3">
                                             <Form.Label>Phone No</Form.Label>
                                             <Form.Control 
                                                 type="text" 
                                                 value={currentLedger.contact_details[0].phone_no || ''} 
                                                 onChange={(e) => handleNestedChange('contact_details', 'phone_no', e.target.value)} 
                                                 isInvalid={!!formErrors.contact_phone}
                                                 placeholder="e.g. 9876543210"
                                                
                                             />
                                             <Form.Control.Feedback type="invalid">{formErrors.contact_phone}</Form.Control.Feedback>
                                         </Form.Group>
                                     </Col>
                                     <Col md={3}>
                                         <Form.Group className="mb-3">
                                             <Form.Label>Primary Mobile</Form.Label>
                                             <Form.Control 
                                                 type="text" 
                                                 value={currentLedger.contact_details[0].primary_mobile || ''} 
                                                 onChange={(e) => handleNestedChange('contact_details', 'primary_mobile', e.target.value)} 
                                                 isInvalid={!!formErrors.contact_mobile}
                                                 placeholder="e.g. 9876543210"
                                                
                                             />
                                             <Form.Control.Feedback type="invalid">{formErrors.contact_mobile}</Form.Control.Feedback>
                                         </Form.Group>
                                     </Col>
                                     <Col md={3}>
                                         <Form.Group className="mb-3"><Form.Label>Fax No</Form.Label><Form.Control type="text" value={currentLedger.contact_details[0].fax_no || ''} onChange={(e) => handleNestedChange('contact_details', 'fax_no', e.target.value)} /></Form.Group>
                                     </Col>
                                 </Row>
                                 <Row>
                                     <Col md={3}>
                                         <Form.Group className="mb-3">
                                             <Form.Label>Email</Form.Label>
                                             <Form.Control 
                                                 type="email" 
                                                 value={currentLedger.contact_details[0].email || ''} 
                                                 onChange={(e) => handleNestedChange('contact_details', 'email', e.target.value)} 
                                                 isInvalid={!!formErrors.contact_email}
                                                 placeholder="e.g. contact@domain.com"
                                                
                                             />
                                             <Form.Control.Feedback type="invalid">{formErrors.contact_email}</Form.Control.Feedback>
                                         </Form.Group>
                                     </Col>
                                     <Col md={3}>
                                         <Form.Group className="mb-3">
                                             <Form.Label>CC</Form.Label>
                                             <Form.Control 
                                                 type="email" 
                                                 value={currentLedger.contact_details[0].cc || ''} 
                                                 onChange={(e) => handleNestedChange('contact_details', 'cc', e.target.value)} 
                                                 isInvalid={!!formErrors.contact_cc}
                                                 placeholder="e.g. cc@domain.com"
                                                
                                             />
                                             <Form.Control.Feedback type="invalid">{formErrors.contact_cc}</Form.Control.Feedback>
                                         </Form.Group>
                                     </Col>
                                     <Col md={3}>
                                         <Form.Group className="mb-3"><Form.Label>Website</Form.Label><Form.Control type="text" value={currentLedger.contact_details[0].website || ''} onChange={(e) => handleNestedChange('contact_details', 'website', e.target.value)} /></Form.Group>
                                     </Col>
                                     <Col md={3}>
                                         <Form.Group className="mb-3">
                                             <Form.Label>WhatsApp No</Form.Label>
                                             <Form.Control 
                                                 type="text" 
                                                 value={currentLedger.contact_details[0].whatsapp_no || ''} 
                                                 onChange={(e) => handleNestedChange('contact_details', 'whatsapp_no', e.target.value)} 
                                                 isInvalid={!!formErrors.contact_whatsapp}
                                                 placeholder="e.g. 9876543210"
                                                
                                             />
                                             <Form.Control.Feedback type="invalid">{formErrors.contact_whatsapp}</Form.Control.Feedback>
                                         </Form.Group>
                                     </Col>
                                 </Row>
                                 <Row>
                                     <Col md={3}>
                                         <Form.Group className="mb-3 mt-4">
                                             <Form.Check type="checkbox" label="WhatsApp Marketing" checked={currentLedger.contact_details[0].whatsapp_marketing || false} onChange={(e) => handleNestedChange('contact_details', 'whatsapp_marketing', e.target.checked)} />
                                         </Form.Group>
                                     </Col>
                                 </Row>
                             </Tab>
                         )}

                         {showAddressFields && (
                             <Tab eventKey="bank" title="Bank Details">
                                 <Row>
                                     <Col md={3}>
                                         <Form.Group className="mb-3">
                                             <Form.Label>Bank A/C No</Form.Label>
                                             <Form.Control 
                                                 type="text" 
                                                 value={currentLedger.bank_details[0].bank_account_no || ''} 
                                                 onChange={(e) => handleNestedChange('bank_details', 'bank_account_no', e.target.value)} 
                                                 isInvalid={!!formErrors.bank_acc_no}
                                                 placeholder="e.g. 123456789012"
                                             />
                                             <Form.Control.Feedback type="invalid">{formErrors.bank_acc_no}</Form.Control.Feedback>
                                         </Form.Group>
                                     </Col>
                                     <Col md={3}>
                                         <Form.Group className="mb-3"><Form.Label>Bank Name</Form.Label><Form.Control type="text" value={currentLedger.bank_details[0].bank_name || ''} onChange={(e) => handleNestedChange('bank_details', 'bank_name', e.target.value)} /></Form.Group>
                                     </Col>
                                     <Col md={3}>
                                         <Form.Group className="mb-3"><Form.Label>Branch</Form.Label><Form.Control type="text" value={currentLedger.bank_details[0].branch || ''} onChange={(e) => handleNestedChange('bank_details', 'branch', e.target.value)} /></Form.Group>
                                     </Col>
                                     <Col md={3}>
                                         <Form.Group className="mb-3">
                                             <Form.Label>IFSC Code</Form.Label>
                                             <Form.Control 
                                                 type="text" 
                                                 value={currentLedger.bank_details[0].ifsc_code || ''} 
                                                 onChange={(e) => handleNestedChange('bank_details', 'ifsc_code', e.target.value)} 
                                                 isInvalid={!!formErrors.bank_ifsc}
                                                 placeholder="e.g. SBIN0001234"
                                             />
                                             <Form.Control.Feedback type="invalid">{formErrors.bank_ifsc}</Form.Control.Feedback>
                                         </Form.Group>
                                     </Col>
                                 </Row>
                                 <Row>
                                     <Col md={3}>
                                         <Form.Group className="mb-3">
                                             <Form.Label>MICR Code</Form.Label>
                                             <Form.Control 
                                                 type="text" 
                                                 value={currentLedger.bank_details[0].micr_code || ''} 
                                                 onChange={(e) => handleNestedChange('bank_details', 'micr_code', e.target.value)} 
                                                 isInvalid={!!formErrors.bank_micr}
                                                 placeholder="e.g. 682002001"
                                             />
                                             <Form.Control.Feedback type="invalid">{formErrors.bank_micr}</Form.Control.Feedback>
                                         </Form.Group>
                                     </Col>
                                     <Col md={3}>
                                         <Form.Group className="mb-3">
                                             <Form.Label>Bank Phone No</Form.Label>
                                             <Form.Control 
                                                 type="text" 
                                                 value={currentLedger.bank_details[0].bank_phone_no || ''} 
                                                 onChange={(e) => handleNestedChange('bank_details', 'bank_phone_no', e.target.value)} 
                                                 isInvalid={!!formErrors.bank_phone}
                                                 placeholder="e.g. 04842345678"
                                             />
                                             <Form.Control.Feedback type="invalid">{formErrors.bank_phone}</Form.Control.Feedback>
                                         </Form.Group>
                                     </Col>
                                     <Col md={3}>
                                         <Form.Group className="mb-3">
                                             <Form.Label>Attachments</Form.Label>
                                             <Form.Control type="file" />
                                         </Form.Group>
                                     </Col>
                                 </Row>
                             </Tab>
                         )}
                    </Tabs>
                </Modal.Body>
                <Modal.Footer>
                    <Button 
                        className="btn-universal-close btn-cancel-custom"
                        style={{ backgroundColor: "var(--cancel-btn-color, #dc3545)", borderColor: "var(--cancel-btn-color, #dc3545)", color: "#ffffff" }}
                        onClick={onHide}
                    >
                        Close
                    </Button>
                    {getNextTab(activeTab) && (
                        <Button 
                            variant="info" 
                            type="submit" 
                            className="text-white border-0"
                            onClick={() => setSaveAndNext(true)}
                            style={{ height: '42px', padding: '0 24px', borderRadius: '10px', fontSize: '14px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <i className="fa fa-arrow-right me-1"></i> Save & Continue
                        </Button>
                    )}
                    <Button 
                        className="btn-universal-save"
                        type="submit"
                        onClick={() => setSaveAndNext(false)}
                    >
                        <i className="fa fa-check me-1"></i> {editMode ? 'Update' : 'Save'}
                    </Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
};

export default LedgerFormModal;
