
import React, { useState, useEffect, Fragment, useContext, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Modal, Button, Tab, Nav, Form } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import { ThemeContext } from '../../context/ThemeContext';
import {
    fetchCompany,
    createCompany,
    updateCompany,
    fetchCompanyAddresses,
    createCompanyAddress,
    updateCompanyAddress,
    deleteCompanyAddress,
    fetchCompanyContacts,
    createCompanyContact,
    updateCompanyContact,
    deleteCompanyContact,
    fetchCompanyFinancialYears,
    createCompanyFinancialYear,
    updateCompanyFinancialYear,
    deleteCompanyFinancialYear,
    fetchBranches,
    createBranch,
    updateBranch,
    deleteBranch,
    deleteBranchAddress,
    deleteBranchContact,
    deleteBranchBankAccount,
    fetchFactories,
    createFactory,
    updateFactory,
    deleteFactory,
    fetchFactoryAddresses,
    createFactoryAddress,
    updateFactoryAddress,
    deleteFactoryAddress,
    fetchFactoryContacts,
    createFactoryContact,
    updateFactoryContact,
    deleteFactoryContact,
    fetchWarehouses,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
    fetchWarehouseAddresses,
    createWarehouseAddress,
    updateWarehouseAddress,
    deleteWarehouseAddress,
    fetchWarehouseContacts,
    createWarehouseContact,
    updateWarehouseContact,
    deleteWarehouseContact,
    formatCompanyError
} from '../../services/CompanyService';
import { fetchCurrencies } from '../../services/CurrencyService';
import { fetchLanguages } from '../../services/LanguageService';
import { countries } from '../../utils/countries';
import { commonTimezones } from '../../utils/timezones';
import { countryToTimezones } from '../../utils/timezoneMapping';
import { formatDate } from '../../utils/dateUtils';
import CreateButton from '../../components/permissions/CreateButton';
import EditButton from '../../components/permissions/EditButton';
import DeleteButton from '../../components/permissions/DeleteButton';
import ManageCurrency from './ManageCurrency';
import ManageLanguage from './ManageLanguage';

const getImageUrl = (url) => {
    if (!url) return null;
    if (typeof url !== 'string') return null;
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    const backendHost = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/api\/?$/, '');
    return `${backendHost}${url.startsWith('/') ? '' : '/'}${url}`;
};

const ManageCompany = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState('profile');
    const { 
        formIconColor, changeFormIconColor,
        customPrimaryColor, changeCustomPrimaryColor,
        customNavHeaderColor, changeCustomNavHeaderColor,
        customHeaderColor, changeCustomHeaderColor,
        customSidebarColor, changeCustomSidebarColor,
        customSidebarFontColor, changeCustomSidebarFontColor,
        customBgColor, changeCustomBgColor,
        customFontColor, changeCustomFontColor,
        background, changeBackground,
        resetToDefault
    } = useContext(ThemeContext);


    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        if (tab && tab !== activeTab) {
            setActiveTab(tab);
        }
    }, [location.search]);

    const [company, setCompany] = useState(null);
    const [currencies, setCurrencies] = useState([]);
    const [languages, setLanguages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    // Related Data
    const [addresses, setAddresses] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [financialYears, setFinancialYears] = useState([]);
    const [branches, setBranches] = useState([]);
    const [factories, setFactories] = useState([]);

    const [factoryAddresses, setFactoryAddresses] = useState([]);
    const [factoryContacts, setFactoryContacts] = useState([]);
    const [selectedFactory, setSelectedFactory] = useState(null);

    // Profile Form State
    const [formData, setFormData] = useState({
        name: '',
        display_name: '',
        company_code: '',
        registration_no: '',
        gst_no: '',
        pan_no: '',
        website: '',
        default_currency: '',
        default_language: '',
        country: '',
        timezone: 'UTC',
        date_format: 'DD/MM/YYYY',
        description: '',
        vision: '',
        mission: '',
        is_active: true,
        has_branches: true
    });

    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);
    const [letterheadFile, setLetterheadFile] = useState(null);
    const [letterheadPreview, setLetterheadPreview] = useState(null);
    const [titleLogoFile, setTitleLogoFile] = useState(null);
    const [titleLogoPreview, setTitleLogoPreview] = useState(null);
    const [loginPanelColor, setLoginPanelColor] = useState('#1a3a72');

    useEffect(() => {
        const syncColors = () => {
            const settings = JSON.parse(localStorage.getItem('companySettings') || '{}');
            if (settings.loginPanelColor) {
                setLoginPanelColor(settings.loginPanelColor);
            }
        };
        window.addEventListener('companySettingsUpdate', syncColors);
        return () => window.removeEventListener('companySettingsUpdate', syncColors);
    }, []);


    // Modal States
    const [showAddressModal, setShowAddressModal] = useState(false);
    const [showContactModal, setShowContactModal] = useState(false);
    const [showFYModal, setShowFYModal] = useState(false);
    const [showBranchModal, setShowBranchModal] = useState(false);
    const [fySearchTerm, setFYSearchTerm] = useState('');
    const [addressSearchTerm, setAddressSearchTerm] = useState('');
    const [contactSearchTerm, setContactSearchTerm] = useState('');
    const [branchSearchTerm, setBranchSearchTerm] = useState('');
    const [factorySearchTerm, setFactorySearchTerm] = useState('');
    const [warehouseSearchTerm, setWarehouseSearchTerm] = useState('');

    const [addressPage, setAddressPage] = useState(1);
    const [contactPage, setContactPage] = useState(1);
    const [fyPage, setFyPage] = useState(1);
    const [branchPage, setBranchPage] = useState(1);
    const [factoryPage, setFactoryPage] = useState(1);
    const [warehousePage, setWarehousePage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => { setAddressPage(1); }, [addressSearchTerm]);
    useEffect(() => { setContactPage(1); }, [contactSearchTerm]);
    useEffect(() => { setFyPage(1); }, [fySearchTerm]);
    useEffect(() => { setBranchPage(1); }, [branchSearchTerm]);
    useEffect(() => { setFactoryPage(1); }, [factorySearchTerm]);
    useEffect(() => { setWarehousePage(1); }, [warehouseSearchTerm]);

    // Company Licenses Master State (Name, Validity Months, Active Status)
    const [companyLicenses, setCompanyLicenses] = useState([
        { id: 1, license_name: 'GSTIN Registration', months_to_expiry: 3, status: 'Active' },
        { id: 2, license_name: 'FSSAI License', months_to_expiry: 6, status: 'Active' },
        { id: 3, license_name: 'Trade License', months_to_expiry: 1, status: 'Active' },
        { id: 4, license_name: 'Import Export Code (IEC)', months_to_expiry: 12, status: 'Active' }
    ]);
    const [licenseSearchTerm, setLicenseSearchTerm] = useState('');
    const [licensePage, setLicensePage] = useState(1);
    const [showLicenseModal, setShowLicenseModal] = useState(false);
    const [licenseForm, setLicenseForm] = useState({
        license_name: '',
        months_to_expiry: 3,
        status: 'Active'
    });

    useEffect(() => { setLicensePage(1); }, [licenseSearchTerm]);

    const filteredLicenses = companyLicenses.filter(l => 
        (l.license_name || '').toLowerCase().includes(licenseSearchTerm.toLowerCase()) ||
        String(l.months_to_expiry || '').includes(licenseSearchTerm)
    );
    const licenseTotalPages = Math.ceil(filteredLicenses.length / itemsPerPage) || 1;
    const licenseIndexOfLastItem = licensePage * itemsPerPage;
    const licenseIndexOfFirstItem = licenseIndexOfLastItem - itemsPerPage;
    const slicedLicenses = filteredLicenses.slice(licenseIndexOfFirstItem, licenseIndexOfLastItem);

    const handleLicenseSubmit = (e) => {
        e.preventDefault();
        if (!licenseForm.license_name || !licenseForm.license_name.trim()) {
            Swal.fire('Error', 'License Name is required', 'error');
            return;
        }
        if (editItemId) {
            setCompanyLicenses(prev => prev.map(item => item.id === editItemId ? { ...licenseForm, id: editItemId } : item));
            Swal.fire({ title: 'Updated!', text: 'Company license updated successfully.', icon: 'success', timer: 1500, showConfirmButton: false });
        } else {
            const newItem = { ...licenseForm, id: Date.now() };
            setCompanyLicenses(prev => [newItem, ...prev]);
            Swal.fire({ title: 'Added!', text: 'New company license added successfully.', icon: 'success', timer: 1500, showConfirmButton: false });
        }
        setShowLicenseModal(false);
    };

    const handleDeleteLicense = (id) => {
        Swal.fire({
            title: 'Are you sure?',
            text: "Do you want to delete this license record?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        }).then((result) => {
            if (result.isConfirmed) {
                setCompanyLicenses(prev => prev.filter(item => item.id !== id));
                Swal.fire('Deleted!', 'License record has been removed.', 'success');
            }
        });
    };

    const [validationAlert, setValidationAlert] = useState({ show: false, title: '', message: '' });

    // Factory Modals
    const [showFactoryModal, setShowFactoryModal] = useState(false);
    const [showFactoryAddressModal, setShowFactoryAddressModal] = useState(false);
    const [showFactoryContactModal, setShowFactoryContactModal] = useState(false);
    const [showFactoryDetailsModal, setShowFactoryDetailsModal] = useState(false);

    const [editItemId, setEditItemId] = useState(null);

    // Sub-item Form States
    const [addressForm, setAddressForm] = useState({
        address_type: 'corporate',
        address_line_1: '',
        address_line_2: '',
        city: '',
        state: '',
        country: '',
        pincode: '',
        is_default: false
    });

    const [contactForm, setContactForm] = useState({
        email: '',
        phone: '',
        mobile: '',
        support_email: '',
        is_primary: false
    });

    const [fyForm, setFYForm] = useState({
        start_date: '',
        end_date: '',
        is_active: false
    });

    const [branchForm, setBranchForm] = useState({
        name: '',
        branch_code: '',
        gst_number: '',
        country: '',
        default_currency: '',
        timezone: 'Asia/Kolkata',
        is_active: true
    });

    const [factoryForm, setFactoryForm] = useState({
        name: '',
        factory_code: '',
        license_number: '',
        timezone: 'Asia/Kolkata',
        is_active: true,
        branch: null
    });

    const [factoryAddressForm, setFactoryAddressForm] = useState({
        address_line_1: '',
        address_line_2: '',
        city: '',
        state: '',
        country: '',
        pincode: '',
        is_default: true
    });

    const [factoryContactForm, setFactoryContactForm] = useState({
        email: '',
        phone: '',
        manager_name: '',
        is_primary: true
    });

    // --- WAREHOUSE STATE ---
    const [warehouses, setWarehouses] = useState([]);
    const [showWarehouseModal, setShowWarehouseModal] = useState(false);
    const [warehouseForm, setWarehouseForm] = useState({
        name: '',
        code: '',
        total_capacity: '',
        capacity_unit: 'units',
        is_active: true,
        is_default: false,
        branch: null,
        factory: null
    });

    const [warehouseAddresses, setWarehouseAddresses] = useState([]);
    const [showWarehouseAddressModal, setShowWarehouseAddressModal] = useState(false);
    const [warehouseAddressForm, setWarehouseAddressForm] = useState({
        address_line_1: '',
        address_line_2: '',
        city: '',
        state: '',
        country: '',
        pincode: ''
    });

    const [warehouseContacts, setWarehouseContacts] = useState([]);
    const [showWarehouseContactModal, setShowWarehouseContactModal] = useState(false);
    const [warehouseContactForm, setWarehouseContactForm] = useState({
        email: '',
        phone: '',
        contact_person: '',
        is_primary: true
    });

    const [selectedWarehouse, setSelectedWarehouse] = useState(null);
    const [showWarehouseDetailsModal, setShowWarehouseDetailsModal] = useState(false);

    const filteredCurrencies = formData.country && Array.isArray(currencies) ? currencies.filter(c => c.country === formData.country) : [];
    const filteredLanguages = formData.country && Array.isArray(languages) ? languages.filter(l => l.country === formData.country) : [];
    const filteredTimezones = formData.country ? (countryToTimezones[formData.country] || commonTimezones) : commonTimezones;

    useEffect(() => {
        loadBaseData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadBaseData = async () => {
        try {
            setLoading(true);
            const [companyRes, currencyRes, languageRes] = await Promise.all([
                fetchCompany(),
                fetchCurrencies(),
                fetchLanguages()
            ]);

            setCurrencies(Array.isArray(currencyRes?.data) ? currencyRes.data : []);
            setLanguages(Array.isArray(languageRes?.data) ? languageRes.data : []);

            if (companyRes.data && companyRes.data.length > 0) {
                const companyData = companyRes.data[0];
                setCompany(companyData);
                setIsEditMode(true);
                setFormData({
                    name: companyData.name || '',
                    display_name: companyData.display_name || '',
                    company_code: companyData.company_code || '',
                    registration_no: companyData.registration_no || '',
                    gst_no: companyData.gst_no || '',
                    pan_no: companyData.pan_no || '',
                    website: companyData.website || '',
                    default_currency: companyData.default_currency || '',
                    default_language: companyData.default_language || '',
                    country: companyData.country || '',
                    timezone: companyData.timezone || 'UTC',
                    date_format: companyData.date_format || 'DD/MM/YYYY',
                    description: companyData.description || '',
                    vision: companyData.vision || '',
                    mission: companyData.mission || '',
                    is_active: companyData.is_active,
                    has_branches: companyData.has_branches !== undefined ? companyData.has_branches : true
                });
                if (companyData.logo) setLogoPreview(companyData.logo);
                if (companyData.letterhead) setLetterheadPreview(companyData.letterhead);
                if (companyData.title_logo) setTitleLogoPreview(companyData.title_logo);

                // Store settings for global use — prefer DB value, fall back to localStorage
                const dbColor = companyData.login_panel_color || '#1a3a72';
                setLoginPanelColor(dbColor);
                localStorage.setItem('companySettings', JSON.stringify({
                    dateFormat: companyData.date_format || 'DD/MM/YYYY',
                    date_format: companyData.date_format || 'DD/MM/YYYY',
                    displayName: companyData.display_name || '',
                    logo: companyData.logo || '',
                    currencySymbol: companyData.default_currency_symbol || '₹',
                    loginPanelColor: dbColor,
                    description: companyData.description || '',
                    vision: companyData.vision || '',
                    mission: companyData.mission || ''
                }));
                window.dispatchEvent(new Event('companySettingsUpdate'));

                // Load related data
                loadRelatedData(companyData.id);
            }
        } catch (error) {
            console.error('Failed to load base data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadRelatedData = async (companyId) => {
        try {
            const [addrRes, contactRes, fyRes] = await Promise.all([
                fetchCompanyAddresses(companyId),
                fetchCompanyContacts(companyId),
                fetchCompanyFinancialYears(companyId)
            ]);
            setAddresses(addrRes.data);
            setContacts(contactRes.data);
            setFinancialYears(fyRes.data);
            const branchRes = await fetchBranches(companyId);
            setBranches(branchRes.data);
            const factoryRes = await fetchFactories({ company: companyId });
            setFactories(factoryRes.data); // All factories for the company

            const warehouseRes = await fetchWarehouses({ company: companyId });
            setWarehouses(warehouseRes.data.filter(w => !w.branch && !w.factory)); // Only direct warehouses
        } catch (error) {
            console.error('Failed to load related data:', error);
        }
    };

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        const data = new FormData();
        for (const key in formData) data.append(key, formData[key]);
        if (logoFile) data.append('logo', logoFile);
        if (letterheadFile) data.append('letterhead', letterheadFile);
        if (titleLogoFile) data.append('title_logo', titleLogoFile);
        data.append('login_panel_color', loginPanelColor);

        try {
            const res = isEditMode ? await updateCompany(company.id, data) : await createCompany(data);
            const savedCompany = res.data;
            setCompany(savedCompany);
            setIsEditMode(true);

            // Update local settings
            localStorage.setItem('companySettings', JSON.stringify({
                dateFormat: savedCompany.date_format || 'DD/MM/YYYY',
                date_format: savedCompany.date_format || 'DD/MM/YYYY',
                displayName: savedCompany.display_name || '',
                logo: savedCompany.logo || '',
                titleLogo: savedCompany.title_logo || '',
                currencySymbol: savedCompany.default_currency_symbol || '₹',
                loginPanelColor,
                description: savedCompany.description || '',
                vision: savedCompany.vision || '',
                mission: savedCompany.mission || ''
            }));
            window.dispatchEvent(new Event('companySettingsUpdate'));

            Swal.fire('Success', 'Profile saved successfully', 'success');
            loadRelatedData(savedCompany.id);
        } catch (error) {
            Swal.fire('Error', formatCompanyError(error), 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // Generic Handlers
    const handleDelete = async (type, id) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "This action cannot be undone.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                if (type === 'address') await deleteCompanyAddress(id);
                else if (type === 'contact') await deleteCompanyContact(id);
                else if (type === 'fy') await deleteCompanyFinancialYear(id);
                else if (type === 'branch') await deleteBranch(id);
                else if (type === 'branchAddress') await deleteBranchAddress(id);
                else if (type === 'branchContact') await deleteBranchContact(id);
                else if (type === 'branchBank') await deleteBranchBankAccount(id);
                else if (type === 'factory') await deleteFactory(id);
                else if (type === 'factoryAddress') await deleteFactoryAddress(id);
                else if (type === 'factoryContact') await deleteFactoryContact(id);
                else if (type === 'warehouse') await deleteWarehouse(id);
                else if (type === 'warehouseAddress') await deleteWarehouseAddress(id);
                else if (type === 'warehouseContact') await deleteWarehouseContact(id);

                Swal.fire('Deleted!', 'Item has been deleted.', 'success');
                if (type.startsWith('branch')) {
                    if (type === 'branch') loadRelatedData(company.id);
                } else if (type.startsWith('factory')) {
                    if (type === 'factory') {
                        loadRelatedData(company.id);
                    } else loadFactoryDetails(selectedFactory.id);
                } else if (type.startsWith('warehouse')) {
                    if (type === 'warehouse') {
                        loadRelatedData(company.id);
                        if (selectedFactory) loadFactoryDetails(selectedFactory.id);
                    } else loadWarehouseDetails(selectedWarehouse.id);
                } else {
                    loadRelatedData(company.id);
                }
            } catch (error) {
                Swal.fire('Error', formatCompanyError(error), 'error');
            }
        }
    };

    // --- ADDRESS LOGIC ---
    const handleAddressSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...addressForm, company: company.id };
            if (editItemId) await updateCompanyAddress(editItemId, payload);
            else await createCompanyAddress(payload);
            setShowAddressModal(false);
            loadRelatedData(company.id);
        } catch (error) {
            Swal.fire('Error', formatCompanyError(error), 'error');
        }
    };

    // Enter key navigation for Address form
    const addressTypeSelectRef = useRef(null);

    const addressTypeOptions = [
        { value: 'registered',   label: 'Registered' },
        { value: 'corporate',    label: 'Corporate' },
        { value: 'billing',      label: 'Billing' },
        { value: 'shipping',     label: 'Shipping' },
        { value: 'headquarters', label: 'HeadQuarters' },
    ];

    const isDarkMode = background?.value === 'dark';

    const addrSelectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '40px',
            backgroundColor: isDarkMode ? '#24292D' : '#fff',
            borderColor: state.isFocused ? '#2ece8a' : (isDarkMode ? '#4a5568' : '#cbd5e1'),
            boxShadow: state.isFocused ? '0 0 0 3px rgba(46,206,138,0.15)' : 'none',
            '&:hover': { borderColor: '#2ece8a' },
            borderRadius: '10px',
            fontSize: '13px',
        }),
        singleValue: base => ({
            ...base,
            color: isDarkMode ? '#fff' : '#334155',
        }),
        input: base => ({
            ...base,
            color: isDarkMode ? '#fff' : '#334155',
        }),
        menu: base => ({
            ...base,
            zIndex: 9999,
            fontSize: '13px',
            backgroundColor: isDarkMode ? '#2F363E' : '#fff',
            border: isDarkMode ? '1px solid #4a5568' : '1px solid #cbd5e1',
        }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected
                ? '#2ece8a'
                : state.isFocused
                    ? (isDarkMode ? '#3d464e' : '#eefdf6')
                    : (isDarkMode ? '#2F363E' : 'white'),
            color: state.isSelected ? 'white' : (isDarkMode ? '#f1f5f9' : '#333'),
            cursor: 'pointer',
        }),
    };

    const getAddrFocusable = () =>
        Array.from(
            document.querySelectorAll('.addr-custom-modal .react-select__control, .addr-custom-modal .form-control-custom, .addr-custom-modal input[type="checkbox"]:not([disabled]), .addr-custom-modal button[type="submit"]:not([disabled])')
        ).filter(el => el.offsetParent !== null && !el.disabled);

    const handleAddrKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        const menuOpen = !!document.querySelector('.addr-custom-modal .react-select__menu');
        if (menuOpen) return;

        const activeEl = document.activeElement;
        const reactSelectInput = activeEl.closest('.react-select__control');
        if (reactSelectInput) {
            e.preventDefault();
            const all = getAddrFocusable();
            const index = all.indexOf(reactSelectInput);
            if (index > -1 && index < all.length - 1) {
                const next = all[index + 1];
                if (next.classList.contains('react-select__control')) {
                    next.querySelector('input')?.focus();
                } else {
                    next.focus();
                }
            }
            return;
        }

        const all = getAddrFocusable();
        const index = all.indexOf(activeEl);
        if (index > -1 && index < all.length - 1) {
            e.preventDefault();
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

    // --- CONTACT LOGIC ---
    const handleContactSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...contactForm, company: company.id };
            if (editItemId) await updateCompanyContact(editItemId, payload);
            else await createCompanyContact(payload);
            setShowContactModal(false);
            loadRelatedData(company.id);
        } catch (error) {
            Swal.fire('Error', formatCompanyError(error), 'error');
        }
    };

    const getContactFocusable = () =>
        Array.from(
            document.querySelectorAll('.contact-custom-modal .form-control-custom, .contact-custom-modal input[type="checkbox"]:not([disabled]), .contact-custom-modal button[type="submit"]:not([disabled])')
        ).filter(el => el.offsetParent !== null && !el.disabled);

    const handleContactKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        const activeEl = document.activeElement;
        const all = getContactFocusable();
        const index = all.indexOf(activeEl);
        if (index > -1 && index < all.length - 1) {
            e.preventDefault();
            if (index === all.length - 2) {
                all[all.length - 1].click();
            } else {
                all[index + 1].focus();
            }
        }
    };

    const getBranchFocusable = () =>
        Array.from(
            document.querySelectorAll('.branch-custom-modal .form-control-custom, .branch-custom-modal input[type="checkbox"]:not([disabled]), .branch-custom-modal button[type="submit"]:not([disabled])')
        ).filter(el => el.offsetParent !== null && !el.disabled);

    const handleBranchKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        const activeEl = document.activeElement;
        const all = getBranchFocusable();
        const index = all.indexOf(activeEl);
        if (index > -1 && index < all.length - 1) {
            e.preventDefault();
            if (index === all.length - 2) {
                all[all.length - 1].click();
            } else {
                const next = all[index + 1];
                next.focus();
                if (next.tagName === 'SELECT' && typeof next.showPicker === 'function') {
                    try { next.showPicker(); } catch (err) {}
                }
            }
        }
    };

    const getFactoryFocusable = () =>
        Array.from(
            document.querySelectorAll('.factory-custom-modal .form-control-custom, .factory-custom-modal input[type="checkbox"]:not([disabled]), .factory-custom-modal button[type="submit"]:not([disabled])')
        ).filter(el => el.offsetParent !== null && !el.disabled);

    const handleFactoryKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        const activeEl = document.activeElement;
        const all = getFactoryFocusable();
        const index = all.indexOf(activeEl);
        if (index > -1 && index < all.length - 1) {
            e.preventDefault();
            if (index === all.length - 2) {
                all[all.length - 1].click();
            } else {
                const next = all[index + 1];
                next.focus();
                if (next.tagName === 'SELECT' && typeof next.showPicker === 'function') {
                    try { next.showPicker(); } catch (err) {}
                }
            }
        }
    };

    const getWarehouseFocusable = () =>
        Array.from(
            document.querySelectorAll('.warehouse-custom-modal .form-control-custom, .warehouse-custom-modal input[type="checkbox"]:not([disabled]), .warehouse-custom-modal button[type="submit"]:not([disabled])')
        ).filter(el => el.offsetParent !== null && !el.disabled);

    const handleWarehouseKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        const activeEl = document.activeElement;
        const all = getWarehouseFocusable();
        const index = all.indexOf(activeEl);
        if (index > -1 && index < all.length - 1) {
            e.preventDefault();
            if (index === all.length - 2) {
                all[all.length - 1].click();
            } else {
                const next = all[index + 1];
                next.focus();
                if (next.tagName === 'SELECT' && typeof next.showPicker === 'function') {
                    try { next.showPicker(); } catch (err) {}
                }
            }
        }
    };

    // --- FY LOGIC ---
    const calculateAutoEndDate = (startDateStr) => {
        if (!startDateStr) return '';
        const parts = startDateStr.split('-');
        if (parts.length !== 3) return '';
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        if (isNaN(y) || isNaN(m) || isNaN(d)) return '';

        // End date is 1 year from start minus 1 day
        const end = new Date(y + 1, m, d - 1);
        if (isNaN(end.getTime())) return '';

        const endY = end.getFullYear();
        const endM = String(end.getMonth() + 1).padStart(2, '0');
        const endD = String(end.getDate()).padStart(2, '0');
        return `${endY}-${endM}-${endD}`;
    };

    const handleFYStartDateChange = (val) => {
        const autoEnd = calculateAutoEndDate(val);
        setFYForm(prev => ({
            ...prev,
            start_date: val,
            end_date: autoEnd || prev.end_date
        }));
    };

    const handleFYSubmit = async (e) => {
        e.preventDefault();

        const startYear = parseInt(fyForm.start_date.split('-')[0], 10);
        const endYear = parseInt(fyForm.end_date.split('-')[0], 10);

        if (isNaN(startYear) || startYear < 1000 || startYear > 9999) {
            setValidationAlert({ show: true, title: 'Invalid Date', message: 'Start Date must have a valid 4-digit year (e.g. 2026).' });
            return;
        }
        if (isNaN(endYear) || endYear < 1000 || endYear > 9999) {
            setValidationAlert({ show: true, title: 'Invalid Date', message: 'End Date must have a valid 4-digit year (e.g. 2027).' });
            return;
        }

        const startDateObj = new Date(fyForm.start_date);
        const endDateObj = new Date(fyForm.end_date);

        if (startDateObj >= endDateObj) {
            setValidationAlert({ show: true, title: 'Invalid Date Range', message: 'Start Date must be earlier than End Date.' });
            return;
        }

        const diffTime = endDateObj - startDateObj;
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 366) {
            setValidationAlert({ show: true, title: 'Invalid Financial Year Duration', message: 'A financial year duration cannot exceed 1 full year (365/366 days).' });
            return;
        }

        try {
            const payload = { ...fyForm, company: company.id };
            if (editItemId) await updateCompanyFinancialYear(editItemId, payload);
            else await createCompanyFinancialYear(payload);
            setShowFYModal(false);
            loadRelatedData(company.id);
        } catch (error) {
            Swal.fire('Error', formatCompanyError(error), 'error');
        }
    };

    const handleActivateFY = async (fyItem) => {
        try {
            await updateCompanyFinancialYear(fyItem.id, {
                ...fyItem,
                company: company.id,
                is_active: true
            });
            Swal.fire({
                icon: 'success',
                title: 'Active Financial Year Updated',
                text: 'Selected Financial Year is now active. All other financial years are set to inactive.',
                timer: 2000,
                showConfirmButton: false
            });
            loadRelatedData(company.id);
        } catch (error) {
            Swal.fire('Error', formatCompanyError(error), 'error');
        }
    };

    // Enter key navigation for Financial Year form
    const getFYFocusable = () =>
        Array.from(
            document.querySelectorAll('.fy-custom-modal .form-control-custom, .fy-custom-modal input[type="checkbox"]:not([disabled]), .fy-custom-modal button[type="submit"]:not([disabled])')
        ).filter(el => el.offsetParent !== null && !el.disabled);

    const handleFYKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        const all = getFYFocusable();
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

    // --- BRANCH LOGIC ---

    const loadFactoryDetails = async (factoryId) => {
        try {
            const [addrRes, contactRes, whRes] = await Promise.all([
                fetchFactoryAddresses(factoryId),
                fetchFactoryContacts(factoryId),
                fetchWarehouses({ factory: factoryId })
            ]);
            setFactoryAddresses(addrRes.data);
            setFactoryContacts(contactRes.data);
            setSelectedFactory(prev => ({ ...prev, factoryWarehouses: whRes.data }));
        } catch (error) {
            console.error('Failed to load factory details:', error);
        }
    };

    const loadWarehouseDetails = async (warehouseId) => {
        try {
            const [addrRes, contactRes] = await Promise.all([
                fetchWarehouseAddresses(warehouseId),
                fetchWarehouseContacts(warehouseId)
            ]);
            setWarehouseAddresses(addrRes.data);
            setWarehouseContacts(contactRes.data);
        } catch (error) {
            console.error('Failed to load warehouse details:', error);
        }
    };

    const handleBranchSubmit = async (e) => {
        e.preventDefault();

        if (!branchForm.gst_number) {
            Swal.fire('Validation Error', 'GST Number is required.', 'warning');
            return;
        }
        const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
        if (!gstRegex.test(branchForm.gst_number.toUpperCase())) {
            Swal.fire('Validation Error', 'Please enter a valid 15-character GST Number (e.g. 22AAAAA0000A1Z5)', 'warning');
            return;
        }

        try {
            const payload = { 
                ...branchForm, 
                name: (branchForm.name || '').toUpperCase(),
                branch_code: (branchForm.branch_code || '').toUpperCase(),
                gst_number: (branchForm.gst_number || '').toUpperCase(),
                company: company.id 
            };
            if (editItemId) await updateBranch(editItemId, payload);
            else await createBranch(payload);
            setShowBranchModal(false);
            loadRelatedData(company.id);
        } catch (error) {
            Swal.fire('Error', formatCompanyError(error), 'error');
        }
    };


    // --- FACTORY LOGIC ---
    const handleFactorySubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...factoryForm, company: company.id };
            if (editItemId) await updateFactory(editItemId, payload);
            else await createFactory(payload);
            setShowFactoryModal(false);
            loadRelatedData(company.id);
        } catch (error) {
            Swal.fire('Error', formatCompanyError(error), 'error');
        }
    };

    const handleFactoryAddressSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...factoryAddressForm, factory: selectedFactory.id };
            if (editItemId) await updateFactoryAddress(editItemId, payload);
            else await createFactoryAddress(payload);
            setShowFactoryAddressModal(false);
            loadFactoryDetails(selectedFactory.id);
        } catch (error) {
            Swal.fire('Error', formatCompanyError(error), 'error');
        }
    };

    const handleFactoryContactSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...factoryContactForm, factory: selectedFactory.id };
            if (editItemId) await updateFactoryContact(editItemId, payload);
            else await createFactoryContact(payload);
            setShowFactoryContactModal(false);
            loadFactoryDetails(selectedFactory.id);
        } catch (error) {
            Swal.fire('Error', formatCompanyError(error), 'error');
        }
    };

    // --- WAREHOUSE LOGIC ---
    const handleWarehouseSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...warehouseForm, company: company.id };
            if (editItemId) await updateWarehouse(editItemId, payload);
            else await createWarehouse(payload);
            setShowWarehouseModal(false);
            loadRelatedData(company.id);
            if (selectedFactory) loadFactoryDetails(selectedFactory.id);
        } catch (error) {
            Swal.fire('Error', formatCompanyError(error), 'error');
        }
    };

    const handleWarehouseAddressSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...warehouseAddressForm, warehouse: selectedWarehouse.id };
            if (editItemId) await updateWarehouseAddress(editItemId, payload);
            else await createWarehouseAddress(payload);
            setShowWarehouseAddressModal(false);
            loadWarehouseDetails(selectedWarehouse.id);
        } catch (error) {
            Swal.fire('Error', formatCompanyError(error), 'error');
        }
    };

    const handleWarehouseContactSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...warehouseContactForm, warehouse: selectedWarehouse.id };
            if (editItemId) await updateWarehouseContact(editItemId, payload);
            else await createWarehouseContact(payload);
            setShowWarehouseContactModal(false);
            loadWarehouseDetails(selectedWarehouse.id);
        } catch (error) {
            Swal.fire('Error', formatCompanyError(error), 'error');
        }
    };

    const filteredAddresses = addresses.filter(a =>
        (a.address_type || '').toLowerCase().includes(addressSearchTerm.toLowerCase()) ||
        (a.address_line_1 || '').toLowerCase().includes(addressSearchTerm.toLowerCase()) ||
        (a.city || '').toLowerCase().includes(addressSearchTerm.toLowerCase()) ||
        (a.state || '').toLowerCase().includes(addressSearchTerm.toLowerCase())
    );
    const slicedAddresses = filteredAddresses.slice((addressPage - 1) * itemsPerPage, addressPage * itemsPerPage);
    const addressTotalPages = Math.ceil(filteredAddresses.length / itemsPerPage);

    const filteredContacts = contacts.filter(c =>
        (c.email || '').toLowerCase().includes(contactSearchTerm.toLowerCase()) ||
        (c.phone || '').toLowerCase().includes(contactSearchTerm.toLowerCase()) ||
        (c.mobile || '').toLowerCase().includes(contactSearchTerm.toLowerCase()) ||
        (c.support_email || '').toLowerCase().includes(contactSearchTerm.toLowerCase())
    );
    const slicedContacts = filteredContacts.slice((contactPage - 1) * itemsPerPage, contactPage * itemsPerPage);
    const contactTotalPages = Math.ceil(filteredContacts.length / itemsPerPage);

    const filteredFYs = financialYears.filter(fy =>
        (fy.start_date || '').includes(fySearchTerm) ||
        (fy.end_date || '').includes(fySearchTerm)
    );
    const slicedFYs = filteredFYs.slice((fyPage - 1) * itemsPerPage, fyPage * itemsPerPage);
    const fyTotalPages = Math.ceil(filteredFYs.length / itemsPerPage);

    const filteredBranches = branches.filter(b =>
        (b.name || '').toLowerCase().includes(branchSearchTerm.toLowerCase()) ||
        (b.branch_code || '').toLowerCase().includes(branchSearchTerm.toLowerCase()) ||
        (b.gst_number || '').toLowerCase().includes(branchSearchTerm.toLowerCase())
    );
    const slicedBranches = filteredBranches.slice((branchPage - 1) * itemsPerPage, branchPage * itemsPerPage);
    const branchTotalPages = Math.ceil(filteredBranches.length / itemsPerPage);

    const filteredFactories = factories.filter(f =>
        (f.name || '').toLowerCase().includes(factorySearchTerm.toLowerCase()) ||
        (f.factory_code || '').toLowerCase().includes(factorySearchTerm.toLowerCase()) ||
        (f.license_number || '').toLowerCase().includes(factorySearchTerm.toLowerCase())
    );
    const slicedFactories = filteredFactories.slice((factoryPage - 1) * itemsPerPage, factoryPage * itemsPerPage);
    const factoryTotalPages = Math.ceil(filteredFactories.length / itemsPerPage);

    const filteredWarehouses = warehouses.filter(w =>
        (w.name || '').toLowerCase().includes(warehouseSearchTerm.toLowerCase()) ||
        (w.code || '').toLowerCase().includes(warehouseSearchTerm.toLowerCase())
    );
    const slicedWarehouses = filteredWarehouses.slice((warehousePage - 1) * itemsPerPage, warehousePage * itemsPerPage);
    const warehouseTotalPages = Math.ceil(filteredWarehouses.length / itemsPerPage);

    const addressIndexOfLastItem = addressPage * itemsPerPage;
    const addressIndexOfFirstItem = addressIndexOfLastItem - itemsPerPage;
    const contactIndexOfLastItem = contactPage * itemsPerPage;
    const contactIndexOfFirstItem = contactIndexOfLastItem - itemsPerPage;
    const fyIndexOfLastItem = fyPage * itemsPerPage;
    const fyIndexOfFirstItem = fyIndexOfLastItem - itemsPerPage;
    const branchIndexOfLastItem = branchPage * itemsPerPage;
    const branchIndexOfFirstItem = branchIndexOfLastItem - itemsPerPage;
    const factoryIndexOfLastItem = factoryPage * itemsPerPage;
    const factoryIndexOfFirstItem = factoryIndexOfLastItem - itemsPerPage;
    const warehouseIndexOfLastItem = warehousePage * itemsPerPage;
    const warehouseIndexOfFirstItem = warehouseIndexOfLastItem - itemsPerPage;

    if (loading) return <div className="text-center p-5"><div className="spinner-border text-primary"></div></div>;


    return (
        <div className="container-fluid">
            <style>{`
                .fy-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .fy-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .fy-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #c084fc;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(192, 132, 252, 0.2);
                }
                .fy-custom-modal .modal-close-x {
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
                .fy-custom-modal .modal-close-x:hover { color: #555; }
                .fy-custom-modal .modal-body-custom {
                    padding: 28px;
                    max-height: 70vh;
                    overflow-y: auto;
                }
                .fy-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .fy-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .fy-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .fy-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                }
                .fy-custom-modal .form-control-custom::placeholder { color: #94a3b8; }
                .fy-custom-modal .form-check-input:checked {
                    background-color: #2ece8a;
                    border-color: #2ece8a;
                }
                .fy-custom-modal .btn-close-custom {
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
                .fy-custom-modal .btn-close-custom:hover { background-color: #6357a7 !important; }
                .fy-custom-modal .btn-save-custom {
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
                .fy-custom-modal .btn-save-custom:hover { background-color: #26b277 !important; }
                .search-input-custom {
                    height: 38px !important;
                    border-radius: 6px !important;
                    padding-left: 35px !important;
                    font-size: 13px !important;
                    border: 1px solid #cbd5e1 !important;
                    background-color: #fff !important;
                    color: #334155 !important;
                    transition: border-color 0.2s, box-shadow 0.2s !important;
                }
                .search-input-custom:focus {
                    outline: none !important;
                    border-color: #2ece8a !important;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15) !important;
                }
                .search-input-custom::placeholder {
                    color: #94a3b8 !important;
                }
                .fy-validation-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.45);
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: fadeInOverlay 0.18s ease;
                }
                @keyframes fadeInOverlay {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                .fy-validation-box {
                    background: #fff;
                    border-radius: 16px;
                    padding: 40px 36px 32px 36px;
                    max-width: 420px;
                    width: 90%;
                    text-align: center;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.18);
                    animation: popIn 0.22s cubic-bezier(0.34,1.56,0.64,1);
                }
                @keyframes popIn {
                    from { transform: scale(0.82); opacity: 0; }
                    to   { transform: scale(1);    opacity: 1; }
                }
                .fy-validation-icon-ring {
                    width: 72px;
                    height: 72px;
                    border-radius: 50%;
                    border: 3px solid #fb923c;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 20px auto;
                    background: transparent;
                }
                .fy-validation-icon-ring span {
                    font-size: 38px;
                    color: #fb923c;
                    line-height: 1;
                    font-weight: 700;
                }
                .fy-validation-title {
                    font-size: 22px;
                    font-weight: 700;
                    color: #1e293b;
                    margin-bottom: 10px;
                }
                .fy-validation-message {
                    font-size: 14px;
                    color: #64748b;
                    margin-bottom: 28px;
                    line-height: 1.55;
                }
                .fy-validation-ok-btn {
                    background-color: #7A70BA;
                    color: #fff;
                    border: none;
                    border-radius: 8px;
                    padding: 10px 40px;
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s;
                }
                .fy-validation-ok-btn:hover {
                    background-color: #6357a7;
                    transform: translateY(-1px);
                }
                .fy-validation-ok-btn:active { transform: translateY(0); }
                /* ===== ADDRESS MODAL ===== */
                .addr-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .addr-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .addr-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #3b82f6;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(59,130,246,0.25);
                }
                .addr-custom-modal .modal-close-x {
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
                .addr-custom-modal .modal-close-x:hover { color: #555; }
                .addr-custom-modal .modal-body-custom {
                    padding: 28px;
                    max-height: 70vh;
                    overflow-y: auto;
                }
                .addr-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .addr-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .addr-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .addr-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                }
                .addr-custom-modal .form-control-custom::placeholder { color: #94a3b8; }
                .addr-custom-modal .form-check-input:checked {
                    background-color: #2ece8a;
                    border-color: #2ece8a;
                }
                .addr-custom-modal .btn-close-custom {
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
                .addr-custom-modal .btn-close-custom:hover { background-color: #6357a7 !important; }
                .addr-custom-modal .btn-save-custom {
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
                .addr-custom-modal .btn-save-custom:hover { background-color: #26b277 !important; }

                /* ===== CONTACT MODAL ===== */
                .contact-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .contact-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .contact-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #10b981;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(16,185,129,0.25);
                }
                .contact-custom-modal .modal-close-x {
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
                .contact-custom-modal .modal-close-x:hover { color: #555; }
                .contact-custom-modal .modal-body-custom {
                    padding: 28px;
                    max-height: 70vh;
                    overflow-y: auto;
                }
                .contact-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .contact-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .contact-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .contact-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                }
                .contact-custom-modal .form-control-custom::placeholder { color: #94a3b8; }
                .contact-custom-modal .form-check-input:checked {
                    background-color: #2ece8a;
                    border-color: #2ece8a;
                }
                .contact-custom-modal .btn-close-custom {
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
                .contact-custom-modal .btn-close-custom:hover { background-color: #6357a7 !important; }
                .contact-custom-modal .btn-save-custom {
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
                .contact-custom-modal .btn-save-custom:hover { background-color: #26b277 !important; }

                /* ===== BRANCH MODAL ===== */
                .branch-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .branch-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .branch-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #6366f1;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(99,102,241,0.25);
                }
                .branch-custom-modal .modal-close-x {
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
                .branch-custom-modal .modal-close-x:hover { color: #555; }
                .branch-custom-modal .modal-body-custom {
                    padding: 28px;
                    max-height: 70vh;
                    overflow-y: auto;
                }
                .branch-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .branch-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .branch-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .branch-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                }
                .branch-custom-modal .form-control-custom::placeholder { color: #94a3b8; }
                .branch-custom-modal .form-check-input:checked {
                    background-color: #2ece8a;
                    border-color: #2ece8a;
                }
                .branch-custom-modal .btn-close-custom {
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
                .branch-custom-modal .btn-close-custom:hover { background-color: #6357a7 !important; }
                .branch-custom-modal .btn-save-custom {
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
                .branch-custom-modal .btn-save-custom:hover { background-color: #26b277 !important; }

                /* ===== FACTORY MODAL ===== */
                .factory-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .factory-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .factory-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #f97316;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(249,115,22,0.25);
                }
                .factory-custom-modal .modal-close-x {
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
                .factory-custom-modal .modal-close-x:hover { color: #555; }
                .factory-custom-modal .modal-body-custom {
                    padding: 28px;
                    max-height: 70vh;
                    overflow-y: auto;
                }
                .factory-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .factory-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .factory-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .factory-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                }
                .factory-custom-modal .form-control-custom::placeholder { color: #94a3b8; }
                .factory-custom-modal .form-check-input:checked {
                    background-color: #2ece8a;
                    border-color: #2ece8a;
                }
                .factory-custom-modal .btn-close-custom {
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
                .factory-custom-modal .btn-close-custom:hover { background-color: #6357a7 !important; }
                .factory-custom-modal .btn-save-custom {
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
                .factory-custom-modal .btn-save-custom:hover { background-color: #26b277 !important; }

                /* ===== WAREHOUSE MODAL ===== */
                .warehouse-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .warehouse-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .warehouse-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #8b5cf6;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(139,92,246,0.25);
                }
                .warehouse-custom-modal .modal-close-x {
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
                .warehouse-custom-modal .modal-close-x:hover { color: #555; }
                .warehouse-custom-modal .modal-body-custom {
                    padding: 28px;
                    max-height: 70vh;
                    overflow-y: auto;
                }
                .warehouse-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .warehouse-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .warehouse-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .warehouse-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                }
                .warehouse-custom-modal .form-control-custom::placeholder { color: #94a3b8; }
                .warehouse-custom-modal .form-check-input:checked {
                    background-color: #2ece8a;
                    border-color: #2ece8a;
                }
                .warehouse-custom-modal .btn-close-custom {
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
                .warehouse-custom-modal .btn-close-custom:hover { background-color: #6357a7 !important; }
                .warehouse-custom-modal .btn-save-custom {
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
                .warehouse-custom-modal .btn-save-custom:hover { background-color: #26b277 !important; }

                /* Responsive enhancements for ManageCompany */
                .manage-company-tabs.nav-tabs {
                    display: flex;
                    flex-wrap: nowrap;
                    overflow-x: auto;
                    overflow-y: hidden;
                    -webkit-overflow-scrolling: touch;
                    white-space: nowrap;
                    padding-bottom: 4px;
                    border-bottom: 2px solid #e2e8f0;
                }
                .manage-company-tabs.nav-tabs::-webkit-scrollbar {
                    height: 4px;
                }
                .manage-company-tabs.nav-tabs::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 4px;
                }
                .manage-company-tabs.nav-tabs .nav-item {
                    flex-shrink: 0;
                }
                .manage-company-tabs.nav-tabs .nav-link {
                    white-space: nowrap;
                    padding: 10px 16px;
                    font-size: 14px;
                }

                @media (max-width: 768px) {
                    .modal-header-custom {
                        padding: 16px 18px 12px 18px !important;
                    }
                    .modal-body-custom {
                        padding: 16px 18px !important;
                    }
                    .modal-footer-custom {
                        padding: 14px 18px 18px 18px !important;
                    }
                }

                /* ===== DARK MODE COMPATIBILITY FOR ALL FORMS & MODALS IN MANAGECOMPANY ===== */
                [data-theme-version="dark"] .addr-custom-modal .modal-content,
                [data-theme-version="dark"] .contact-custom-modal .modal-content,
                [data-theme-version="dark"] .fy-custom-modal .modal-content,
                [data-theme-version="dark"] .branch-custom-modal .modal-content,
                [data-theme-version="dark"] .factory-custom-modal .modal-content,
                [data-theme-version="dark"] .warehouse-custom-modal .modal-content,
                [data-theme-version="dark"] .modal-content {
                    background-color: #2F363E !important;
                    color: #f1f5f9 !important;
                    border-color: #3d464e !important;
                }

                [data-theme-version="dark"] .modal-header-custom,
                [data-theme-version="dark"] .modal-header {
                    border-bottom: 1px solid #3d464e !important;
                    background-color: transparent !important;
                }

                [data-theme-version="dark"] .modal-header-custom .modal-title,
                [data-theme-version="dark"] .modal-header .modal-title,
                [data-theme-version="dark"] .modal-title {
                    color: #fff !important;
                }

                [data-theme-version="dark"] .modal-header-custom p.text-muted,
                [data-theme-version="dark"] .modal-header p.text-muted {
                    color: #94a3b8 !important;
                }

                [data-theme-version="dark"] .modal-body-custom,
                [data-theme-version="dark"] .modal-body {
                    background-color: #2F363E !important;
                    color: #f1f5f9 !important;
                }

                [data-theme-version="dark"] .modal-footer-custom,
                [data-theme-version="dark"] .modal-footer,
                [data-theme-version="dark"] .modal-footer.bg-light,
                [data-theme-version="dark"] .modal-footer.bg-white {
                    background-color: #24292D !important;
                    border-top: 1px solid #3d464e !important;
                }

                [data-theme-version="dark"] .form-label-custom,
                [data-theme-version="dark"] .modal-body label {
                    color: #cbd5e1 !important;
                }

                [data-theme-version="dark"] .form-control-custom,
                [data-theme-version="dark"] .modal-body .form-control,
                [data-theme-version="dark"] .modal-body select {
                    background-color: #24292D !important;
                    border-color: #4a5568 !important;
                    color: #fff !important;
                }

                [data-theme-version="dark"] .form-control-custom:focus,
                [data-theme-version="dark"] .modal-body .form-control:focus,
                [data-theme-version="dark"] .modal-body select:focus {
                    border-color: #2ece8a !important;
                    background-color: #24292D !important;
                    color: #fff !important;
                }

                [data-theme-version="dark"] .form-control-custom::placeholder,
                [data-theme-version="dark"] .modal-body .form-control::placeholder {
                    color: #64748b !important;
                }

                [data-theme-version="dark"] .modal-close-x {
                    color: #94a3b8 !important;
                }

                [data-theme-version="dark"] .modal-close-x:hover {
                    color: #fff !important;
                }

                [data-theme-version="dark"] .fy-validation-box {
                    background: #2F363E !important;
                    color: #fff !important;
                    border: 1px solid #3d464e;
                }

                [data-theme-version="dark"] .fy-validation-title {
                    color: #fff !important;
                }

                [data-theme-version="dark"] .fy-validation-message {
                    color: #94a3b8 !important;
                }
            `}</style>

            <div className="row">
                <div className="col-xl-12">
                    <div className="card">
                        <div className="card-body">
                            <Tab.Container activeKey={activeTab} onSelect={(k) => { setActiveTab(k); navigate(`?tab=${k}`, { replace: true }); }}>
                                <Nav className="nav nav-tabs mb-4 manage-company-tabs">
                                    <Nav.Item><Nav.Link eventKey="currency" style={{ cursor: 'pointer' }}>Currency</Nav.Link></Nav.Item>
                                    <Nav.Item><Nav.Link eventKey="language" style={{ cursor: 'pointer' }}>Languages</Nav.Link></Nav.Item>
                                    <Nav.Item><Nav.Link eventKey="profile" style={{ cursor: 'pointer' }}>Company Profile</Nav.Link></Nav.Item>
                                    <Nav.Item><Nav.Link eventKey="addresses" style={{ cursor: 'pointer' }}>Addresses</Nav.Link></Nav.Item>
                                    <Nav.Item><Nav.Link eventKey="contacts" style={{ cursor: 'pointer' }}>Contacts</Nav.Link></Nav.Item>
                                    <Nav.Item><Nav.Link eventKey="fy" style={{ cursor: 'pointer' }}>Financial Years</Nav.Link></Nav.Item>
                                    <Nav.Item><Nav.Link eventKey="factories" style={{ cursor: 'pointer' }}>Factories</Nav.Link></Nav.Item>
                                    <Nav.Item><Nav.Link eventKey="warehouses" style={{ cursor: 'pointer' }}>Warehouses</Nav.Link></Nav.Item>
                                    <Nav.Item><Nav.Link eventKey="licenses" style={{ cursor: 'pointer' }}>Licenses</Nav.Link></Nav.Item>
                                    <Nav.Item><Nav.Link eventKey="branches" style={{ cursor: 'pointer' }}>Branches</Nav.Link></Nav.Item>
                                    <Nav.Item><Nav.Link eventKey="theme" style={{ cursor: 'pointer' }}>Theme Settings</Nav.Link></Nav.Item>
                                </Nav>

                                <Tab.Content>
                                    <Tab.Pane eventKey="currency">
                                        <ManageCurrency />
                                    </Tab.Pane>
                                    <Tab.Pane eventKey="language">
                                        <ManageLanguage />
                                    </Tab.Pane>
                                    {/* PROFILE TAB */}
                                    <Tab.Pane eventKey="profile">
                                        <form onSubmit={handleProfileSubmit}>
                                            <div className="row">
                                                <div className="col-12 mb-5">
                                                    <div className="d-flex flex-wrap align-items-flex-start gap-4 gap-md-5 justify-content-center">
                                                        {/* Logo Upload */}
                                                        <div className="text-center">
                                                            <div
                                                                className="mb-3 rounded-circle border shadow-sm d-flex align-items-center justify-content-center overflow-hidden mx-auto"
                                                                style={{ width: '120px', height: '120px', backgroundColor: '#f8f9fa', cursor: 'pointer' }}
                                                                onClick={() => document.getElementById('logoUpload').click()}
                                                            >
                                                                {logoPreview ? (
                                                                    <img
                                                                        src={getImageUrl(logoPreview)}
                                                                        alt="Logo"
                                                                        onError={() => setLogoPreview(null)}
                                                                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                                    />
                                                                ) : (
                                                                    <div className="text-center p-3">
                                                                        <i className="fa fa-camera fs-24 text-muted mb-1"></i>
                                                                        <div className="small text-muted">Upload Logo</div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <input
                                                                id="logoUpload"
                                                                type="file"
                                                                className="d-none"
                                                                onChange={(e) => {
                                                                    const file = e.target.files[0];
                                                                    if (file) {
                                                                        setLogoFile(file);
                                                                        const r = new FileReader(); r.onloadend = () => setLogoPreview(r.result); r.readAsDataURL(file);
                                                                    }
                                                                }}
                                                                accept="image/png, image/jpeg, image/jpg, image/webp"
                                                            />
                                                            <div className="d-flex justify-content-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    className="btn-image-change"
                                                                    onClick={() => document.getElementById('logoUpload').click()}
                                                                >
                                                                    <i className="fa fa-camera"></i>
                                                                    <span>Change Logo</span>
                                                                </button>
                                                                {logoPreview && (
                                                                    <button
                                                                        type="button"
                                                                        className="btn-image-remove"
                                                                        onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                                                                    >
                                                                        <i className="fa fa-trash-o"></i>
                                                                        <span>Remove</span>
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <div className="small text-muted mt-2">Format: PNG, JPG, JPEG (Max 2MB)</div>
                                                        </div>

                                                        {/* Letterhead Upload */}
                                                        <div className="text-center">
                                                            <div
                                                                className="mb-3 border rounded d-flex align-items-center justify-content-center overflow-hidden mx-auto shadow-sm"
                                                                style={{ width: '220px', height: '120px', backgroundColor: '#f8f9fa', cursor: 'pointer' }}
                                                                onClick={() => document.getElementById('letterheadUpload').click()}
                                                            >
                                                                {letterheadPreview ? (
                                                                    <img
                                                                        src={getImageUrl(letterheadPreview)}
                                                                        alt="Letterhead"
                                                                        onError={() => setLetterheadPreview(null)}
                                                                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                                    />
                                                                ) : (
                                                                    <div className="text-center p-3">
                                                                        <i className="fa fa-file-image-o fs-24 text-muted mb-1"></i>
                                                                        <div className="small text-muted">Upload Letterhead</div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <input
                                                                id="letterheadUpload"
                                                                type="file"
                                                                className="d-none"
                                                                onChange={(e) => {
                                                                    const file = e.target.files[0];
                                                                    if (file) {
                                                                        setLetterheadFile(file);
                                                                        const r = new FileReader(); r.onloadend = () => setLetterheadPreview(r.result); r.readAsDataURL(file);
                                                                    }
                                                                }}
                                                                accept="image/png, image/jpeg, image/jpg, image/webp"
                                                            />
                                                            <div className="d-flex justify-content-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    className="btn-image-change"
                                                                    onClick={() => document.getElementById('letterheadUpload').click()}
                                                                >
                                                                    <i className="fa fa-file-image-o"></i>
                                                                    <span>Change Letterhead</span>
                                                                </button>
                                                                {letterheadPreview && (
                                                                    <button
                                                                        type="button"
                                                                        className="btn-image-remove"
                                                                        onClick={() => { setLetterheadFile(null); setLetterheadPreview(null); }}
                                                                    >
                                                                        <i className="fa fa-trash-o"></i>
                                                                        <span>Remove</span>
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <div className="small text-muted mt-2">Format: PNG, JPG, JPEG (Document exports)</div>
                                                        </div>

                                                        {/* Title Logo Upload */}
                                                        <div className="text-center">
                                                            <div
                                                                className="mb-3 border rounded d-flex align-items-center justify-content-center overflow-hidden mx-auto shadow-sm"
                                                                style={{ width: '220px', height: '120px', backgroundColor: '#f8f9fa', cursor: 'pointer' }}
                                                                onClick={() => document.getElementById('titleLogoUpload').click()}
                                                            >
                                                                {titleLogoPreview ? (
                                                                    <img
                                                                        src={getImageUrl(titleLogoPreview)}
                                                                        alt="Title Logo"
                                                                        onError={() => setTitleLogoPreview(null)}
                                                                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                                    />
                                                                ) : (
                                                                    <div className="text-center p-3">
                                                                        <i className="fa fa-picture-o fs-24 text-muted mb-1"></i>
                                                                        <div className="small text-muted">Upload Title Logo</div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <input
                                                                id="titleLogoUpload"
                                                                type="file"
                                                                className="d-none"
                                                                onChange={(e) => {
                                                                    const file = e.target.files[0];
                                                                    if (file) {
                                                                        setTitleLogoFile(file);
                                                                        const r = new FileReader(); r.onloadend = () => setTitleLogoPreview(r.result); r.readAsDataURL(file);
                                                                    }
                                                                }}
                                                                accept="image/png, image/jpeg, image/jpg, image/webp"
                                                            />
                                                            <div className="d-flex justify-content-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    className="btn-image-change"
                                                                    onClick={() => document.getElementById('titleLogoUpload').click()}
                                                                >
                                                                    <i className="fa fa-picture-o"></i>
                                                                    <span>Change Title Logo</span>
                                                                </button>
                                                                {titleLogoPreview && (
                                                                    <button
                                                                        type="button"
                                                                        className="btn-image-remove"
                                                                        onClick={() => { setTitleLogoFile(null); setTitleLogoPreview(null); }}
                                                                    >
                                                                        <i className="fa fa-trash-o"></i>
                                                                        <span>Remove</span>
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <div className="small text-muted mt-2">Format: PNG, JPG, JPEG</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="col-md-6 mb-3"><label className="font-w600">Company Name <span className="text-danger">*</span></label><input type="text" className="form-control" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                                                <div className="col-md-6 mb-3"><label className="font-w600">Display Name <span className="text-danger">*</span></label><input type="text" className="form-control" value={formData.display_name} onChange={(e) => setFormData({ ...formData, display_name: e.target.value })} /></div>
                                                <div className="col-md-6 mb-3"><label className="font-w600">Code <span className="text-danger">*</span></label><input type="text" className="form-control" required value={formData.company_code} onChange={(e) => setFormData({ ...formData, company_code: e.target.value })} /></div>
                                                <div className="col-md-6 mb-3"><label className="font-w600">Website <span className="text-danger">*</span></label><input type="url" className="form-control" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} placeholder="https://example.com" /></div>

                                                <div className="col-md-4 mb-3"><label className="font-w600">CIN No <span className="text-danger">*</span></label><input type="text" className={`form-control ${formData.registration_no && formData.registration_no.length !== 21 ? 'is-invalid' : ''}`} value={formData.registration_no} onChange={(e) => setFormData({ ...formData, registration_no: e.target.value.toUpperCase() })} maxLength={21} minLength={21} pattern="[a-zA-Z0-9]{21}" title="CIN Number must be exactly 21 alphanumeric characters" required />
                                                    {formData.registration_no && formData.registration_no.length !== 21 && <small className="text-danger">CIN Number must be exactly 21 characters</small>}
                                                </div>
                                                <div className="col-md-4 mb-3"><label className="font-w600">GST No <span className="text-danger">*</span></label><input type="text" className={`form-control ${formData.gst_no && formData.gst_no.length !== 15 ? 'is-invalid' : ''}`} value={formData.gst_no} onChange={(e) => setFormData({ ...formData, gst_no: e.target.value.toUpperCase() })} maxLength={15} minLength={15} pattern="[a-zA-Z0-9]{15}" title="GST Number must be exactly 15 alphanumeric characters" required />
                                                    {formData.gst_no && formData.gst_no.length !== 15 && <small className="text-danger">GST Number must be exactly 15 characters</small>}
                                                </div>
                                                <div className="col-md-4 mb-3"><label className="font-w600">PAN No <span className="text-danger">*</span></label><input type="text" className={`form-control ${formData.pan_no && formData.pan_no.length !== 10 ? 'is-invalid' : ''}`} value={formData.pan_no} onChange={(e) => setFormData({ ...formData, pan_no: e.target.value.toUpperCase() })} maxLength={10} minLength={10} pattern="[a-zA-Z0-9]{10}" title="PAN Number must be exactly 10 alphanumeric characters" required />
                                                    {formData.pan_no && formData.pan_no.length !== 10 && <small className="text-danger">PAN Number must be exactly 10 characters</small>}
                                                </div>

                                                <div className="col-md-6 mb-3">
                                                    <label className="font-w600">Country <span className="text-danger">*</span></label>
                                                    <select className="form-control" required value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })}>
                                                        <option value="">Select Country</option>
                                                        {countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                                                    </select>
                                                </div>
                                                <div className="col-md-6 mb-3">
                                                    <label className="font-w600">Currency <span className="text-danger">*</span></label>
                                                    <select className="form-control" value={formData.default_currency} onChange={(e) => setFormData({ ...formData, default_currency: e.target.value })} disabled={!formData.country}>
                                                        <option value="">Select Currency</option>
                                                        {filteredCurrencies.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
                                                    </select>
                                                </div>

                                                <div className="col-md-6 mb-3">
                                                    <label className="font-w600">Language <span className="text-danger">*</span></label>
                                                    <select className="form-control" value={formData.default_language} onChange={(e) => setFormData({ ...formData, default_language: e.target.value })} disabled={!formData.country}>
                                                        <option value="">Select Language</option>
                                                        {filteredLanguages.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                                    </select>
                                                </div>
                                                <div className="col-md-6 mb-3">
                                                    <label className="font-w600">Timezone <span className="text-danger">*</span></label>
                                                    <select className="form-control" value={formData.timezone} onChange={(e) => setFormData({ ...formData, timezone: e.target.value })} disabled={!formData.country}>
                                                        {filteredTimezones.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                                                    </select>
                                                </div>
                                                <div className="col-md-6 mb-3">
                                                    <label className="font-w600">Date Format <span className="text-danger">*</span></label>
                                                    <select className="form-control" value={formData.date_format} onChange={(e) => setFormData({ ...formData, date_format: e.target.value })}>
                                                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                                                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                                                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                                                        <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                                                        <option value="DD MMM YYYY">DD MMM YYYY</option>
                                                    </select>
                                                </div>
                                                <div className="col-md-12 mb-3">
                                                    <label className="font-w600">Company Description <span className="text-danger">*</span></label>
                                                    <textarea
                                                        id="company_description"
                                                        name="description"
                                                        className="form-control company-description-textarea no-capitalize"
                                                        style={{ textTransform: 'none' }}
                                                        rows={4}
                                                        value={formData.description}
                                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                        placeholder="Enter company description..."
                                                    />
                                                </div>
                                                <div className="col-md-6 mb-3">
                                                    <label className="font-w600">Vision</label>
                                                    <textarea
                                                        className="form-control"
                                                        rows={3}
                                                        value={formData.vision}
                                                        onChange={(e) => setFormData({ ...formData, vision: e.target.value })}
                                                        placeholder="Enter company vision..."
                                                    />
                                                </div>
                                                <div className="col-md-6 mb-3">
                                                    <label className="font-w600">Mission</label>
                                                    <textarea
                                                        className="form-control"
                                                        rows={3}
                                                        value={formData.mission}
                                                        onChange={(e) => setFormData({ ...formData, mission: e.target.value })}
                                                        placeholder="Enter company mission..."
                                                    />
                                                </div>
                                                <div className="col-md-12 mb-4">
                                                    <div
                                                        className={`branch-toggle-card ${formData.has_branches ? 'active' : ''}`}
                                                        onClick={() => setFormData(prev => ({ ...prev, has_branches: !prev.has_branches }))}
                                                        role="button"
                                                        tabIndex={0}
                                                        onKeyDown={(e) => {
                                                            if (e.key === ' ' || e.key === 'Enter') {
                                                                e.preventDefault();
                                                                setFormData(prev => ({ ...prev, has_branches: !prev.has_branches }));
                                                            }
                                                        }}
                                                    >
                                                        <div className="d-flex align-items-center gap-3">
                                                            <div className="branch-toggle-icon">
                                                                <i className={formData.has_branches ? "fa fa-sitemap" : "fa fa-building-o"}></i>
                                                            </div>
                                                            <div>
                                                                <div className="branch-toggle-title">
                                                                    <span>This company has branches</span>
                                                                    {formData.has_branches ? (
                                                                        <span className="badge badge-success light" style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px' }}>Enabled</span>
                                                                    ) : (
                                                                        <span className="badge badge-secondary light" style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px' }}>Single Unit</span>
                                                                    )}
                                                                </div>
                                                                <div className="branch-toggle-desc">
                                                                    {formData.has_branches
                                                                        ? 'Branches and factories will be managed separately in their respective tabs.'
                                                                        : 'A default Branch and Factory named after the company will be auto-created.'}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="branch-toggle-switch">
                                                            <div className="branch-toggle-thumb"></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mb-4">
                                                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save Profile'}</button>
                                            </div>
                                        </form>
                                    </Tab.Pane>

                                    

                                    {/* ADDRESSES TAB */}
                                    <Tab.Pane eventKey="addresses">
                                        <div className="d-flex flex-column flex-sm-row justify-content-between mb-3 align-items-start align-items-sm-center gap-2">
                                            <h5 className="mb-0 text-nowrap">Company Addresses</h5>
                                            <div className="d-flex flex-wrap flex-sm-nowrap gap-2 align-items-center w-100 w-sm-auto justify-content-between justify-content-sm-end">
                                                <div style={{ width: '100%', maxWidth: '280px', position: 'relative' }} className="flex-grow-1 flex-sm-grow-0">
                                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                                    <Form.Control
                                                        type="text"
                                                        placeholder="Search addresses..."
                                                        value={addressSearchTerm}
                                                        onChange={(e) => setAddressSearchTerm(e.target.value)}
                                                        className="search-input-custom"
                                                    />
                                                </div>
                                                <CreateButton
                                                    module="company"
                                                    onClick={() => { setEditItemId(null); setAddressForm({ address_type: 'corporate', address_line_1: '', address_line_2: '', city: '', state: '', country: formData.country, pincode: '', is_default: false }); setShowAddressModal(true); }}
                                                >
                                                    Address
                                                </CreateButton>
                                            </div>
                                        </div>
                                        <div className="table-responsive">
                                            <table className="table table-hover">
                                                <thead>
                                                    <tr>
                                                        <th><strong>SL No</strong></th>
                                                        <th><strong>TYPE</strong></th>
                                                        <th><strong>ADDRESS</strong></th>
                                                        <th><strong>CITY / STATE</strong></th>
                                                        <th><strong>DEFAULT</strong></th>
                                                        <th className="text-end"><strong>ACTIONS</strong></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredAddresses.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="6" className="text-center py-4 text-muted">No entries</td>
                                                        </tr>
                                                    ) : (
                                                        slicedAddresses.map((a, index) => (
                                                            <tr key={a.id}>
                                                                <td>{addressIndexOfFirstItem + index + 1}</td>
                                                                <td className="text-capitalize">{a.address_type}</td>
                                                                <td>{a.address_line_1}{a.address_line_2 ? `, ${a.address_line_2}` : ''}</td>
                                                                <td>{a.city}, {a.state}</td>
                                                                <td>{a.is_default ? <span className="badge badge-success">Yes</span> : 'No'}</td>
                                                                <td className="text-end">
                                                                    <div className="d-flex justify-content-end gap-1">
                                                                        <EditButton module="company" onClick={() => { setEditItemId(a.id); setAddressForm(a); setShowAddressModal(true); }} />
                                                                        <DeleteButton module="company" onClick={() => handleDelete('address', a.id)} />
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {filteredAddresses.length > 0 && (
                                        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-center gap-2 mt-3 mb-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                                    Showing {addressIndexOfFirstItem + 1} to {Math.min(addressIndexOfLastItem, filteredAddresses.length)} of {filteredAddresses.length} entries
                                                </div>
                                            {addressTotalPages > 1 && (
                                                <nav>
                                                    <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                        <li className={`page-item page-indicator ${addressPage === 1 ? 'disabled' : ''}`}>
                                                            <button type="button" className="page-link" onClick={() => setAddressPage(prev => Math.max(prev - 1, 1))} disabled={addressPage === 1} style={{ border: 'none', background: 'none' }}>
                                                                <i className="la la-angle-left" />
                                                            </button>
                                                        </li>
                                                        {Array.from({ length: addressTotalPages }, (_, index) => {
                                                            const pageNumber = index + 1;
                                                            if (
                                                                pageNumber === 1 ||
                                                                pageNumber === addressTotalPages ||
                                                                (pageNumber >= addressPage - 1 && pageNumber <= addressPage + 1)
                                                            ) {
                                                                return (
                                                                    <li key={pageNumber} className={`page-item ${addressPage === pageNumber ? 'active' : ''}`}>
                                                                        <button type="button" className="page-link" onClick={() => setAddressPage(pageNumber)} style={{ border: 'none' }}>
                                                                            {pageNumber}
                                                                        </button>
                                                                    </li>
                                                                );
                                                            } else if (
                                                                pageNumber === addressPage - 2 ||
                                                                pageNumber === addressPage + 2
                                                            ) {
                                                                return (
                                                                    <li key={pageNumber} className="page-item disabled">
                                                                        <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                                                    </li>
                                                                );
                                                            }
                                                            return null;
                                                        })}
                                                        <li className={`page-item page-indicator ${addressPage === addressTotalPages ? 'disabled' : ''}`}>
                                                            <button type="button" className="page-link" onClick={() => setAddressPage(prev => Math.min(prev + 1, addressTotalPages))} disabled={addressPage === addressTotalPages} style={{ border: 'none', background: 'none' }}>
                                                                <i className="la la-angle-right" />
                                                            </button>
                                                        </li>
                                                    </ul>
                                                </nav>
                                            )}
                                        </div>
                                    )}
                                    </Tab.Pane>

                                    {/* CONTACTS TAB */}
                                    <Tab.Pane eventKey="contacts">
                                        <div className="d-flex flex-column flex-sm-row justify-content-between mb-3 align-items-start align-items-sm-center gap-2">
                                            <h5 className="mb-0 text-nowrap">Company Contacts</h5>
                                            <div className="d-flex flex-wrap flex-sm-nowrap gap-2 align-items-center w-100 w-sm-auto justify-content-between justify-content-sm-end">
                                                <div style={{ width: '100%', maxWidth: '280px', position: 'relative' }} className="flex-grow-1 flex-sm-grow-0">
                                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                                    <Form.Control
                                                        type="text"
                                                        placeholder="Search contacts..."
                                                        value={contactSearchTerm}
                                                        onChange={(e) => setContactSearchTerm(e.target.value)}
                                                        className="search-input-custom"
                                                    />
                                                </div>
                                                <CreateButton
                                                    module="company"
                                                    onClick={() => { setEditItemId(null); setContactForm({ email: '', phone: '', mobile: '', support_email: '', is_primary: false }); setShowContactModal(true); }}
                                                >
                                                    Contact
                                                </CreateButton>
                                            </div>
                                        </div>
                                        <div className="table-responsive">
                                            <table className="table table-hover">
                                                <thead>
                                                    <tr>
                                                        <th><strong>SL No</strong></th>
                                                        <th><strong>EMAIL</strong></th>
                                                        <th><strong>PHONE</strong></th>
                                                        <th><strong>MOBILE</strong></th>
                                                        <th><strong>PRIMARY</strong></th>
                                                        <th className="text-end"><strong>ACTIONS</strong></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredContacts.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="6" className="text-center py-4 text-muted">No entries</td>
                                                        </tr>
                                                    ) : (
                                                        slicedContacts.map((c, index) => (
                                                            <tr key={c.id}>
                                                                <td>{contactIndexOfFirstItem + index + 1}</td>
                                                                <td>{c.email}</td>
                                                                <td>{c.phone}</td>
                                                                <td>{c.mobile || '-'}</td>
                                                                <td>{c.is_primary ? <span className="badge badge-success">Yes</span> : 'No'}</td>
                                                                <td className="text-end">
                                                                    <div className="d-flex justify-content-end gap-1">
                                                                        <EditButton module="company" onClick={() => { setEditItemId(c.id); setContactForm(c); setShowContactModal(true); }} />
                                                                        <DeleteButton module="company" onClick={() => handleDelete('contact', c.id)} />
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {filteredContacts.length > 0 && (
                                        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-center gap-2 mt-3 mb-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                                    Showing {contactIndexOfFirstItem + 1} to {Math.min(contactIndexOfLastItem, filteredContacts.length)} of {filteredContacts.length} entries
                                                </div>
                                            {contactTotalPages > 1 && (
                                                <nav>
                                                    <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                        <li className={`page-item page-indicator ${contactPage === 1 ? 'disabled' : ''}`}>
                                                            <button type="button" className="page-link" onClick={() => setContactPage(prev => Math.max(prev - 1, 1))} disabled={contactPage === 1} style={{ border: 'none', background: 'none' }}>
                                                                <i className="la la-angle-left" />
                                                            </button>
                                                        </li>
                                                        {Array.from({ length: contactTotalPages }, (_, index) => {
                                                            const pageNumber = index + 1;
                                                            if (
                                                                pageNumber === 1 ||
                                                                pageNumber === contactTotalPages ||
                                                                (pageNumber >= contactPage - 1 && pageNumber <= contactPage + 1)
                                                            ) {
                                                                return (
                                                                    <li key={pageNumber} className={`page-item ${contactPage === pageNumber ? 'active' : ''}`}>
                                                                        <button type="button" className="page-link" onClick={() => setContactPage(pageNumber)} style={{ border: 'none' }}>
                                                                            {pageNumber}
                                                                        </button>
                                                                    </li>
                                                                );
                                                            } else if (
                                                                pageNumber === contactPage - 2 ||
                                                                pageNumber === contactPage + 2
                                                            ) {
                                                                return (
                                                                    <li key={pageNumber} className="page-item disabled">
                                                                        <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                                                    </li>
                                                                );
                                                            }
                                                            return null;
                                                        })}
                                                        <li className={`page-item page-indicator ${contactPage === contactTotalPages ? 'disabled' : ''}`}>
                                                            <button type="button" className="page-link" onClick={() => setContactPage(prev => Math.min(prev + 1, contactTotalPages))} disabled={contactPage === contactTotalPages} style={{ border: 'none', background: 'none' }}>
                                                                <i className="la la-angle-right" />
                                                            </button>
                                                        </li>
                                                    </ul>
                                                </nav>
                                            )}
                                        </div>
                                    )}
                                    </Tab.Pane>

                                    {/* FINANCIAL YEARS TAB */}
                                    <Tab.Pane eventKey="fy">
                                        <div className="d-flex flex-column flex-sm-row justify-content-between mb-3 align-items-start align-items-sm-center gap-2">
                                            <h5 className="mb-0 text-nowrap">Financial Years</h5>
                                            <div className="d-flex flex-wrap flex-sm-nowrap gap-2 align-items-center w-100 w-sm-auto justify-content-between justify-content-sm-end">
                                                <div style={{ width: '100%', maxWidth: '280px', position: 'relative' }} className="flex-grow-1 flex-sm-grow-0">
                                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                                    <Form.Control
                                                        type="text"
                                                        placeholder="Search financial years..."
                                                        value={fySearchTerm}
                                                        onChange={(e) => setFYSearchTerm(e.target.value)}
                                                        className="search-input-custom"
                                                    />
                                                </div>
                                                <CreateButton
                                                    module="company"
                                                    onClick={() => {
                                                        setEditItemId(null);
                                                        setFYForm({ start_date: '', end_date: '', is_active: !financialYears.some(f => f.is_active) });
                                                        setShowFYModal(true);
                                                    }}
                                                >
                                                    Financial Year
                                                </CreateButton>
                                            </div>
                                        </div>
                                        <div className="table-responsive">
                                            <table className="table">
                                                <thead><tr><th>SL No</th><th>Start Date</th><th>End Date</th><th>Active</th><th>Actions</th></tr></thead>
                                                <tbody>
                                                    {filteredFYs.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="5" className="text-center py-4 text-muted">No entries</td>
                                                        </tr>
                                                    ) : (
                                                        slicedFYs.map((fy, index) => (
                                                            <tr key={fy.id}>
                                                                <td>{fyIndexOfFirstItem + index + 1}</td>
                                                                <td>{formatDate(fy.start_date)}</td><td>{formatDate(fy.end_date)}</td>
                                                                <td>
                                                                    {fy.is_active ? (
                                                                        <span className="badge badge-success" style={{ padding: '6px 12px', fontSize: '12px' }}>
                                                                            <i className="fa fa-check-circle me-1"></i> Active
                                                                        </span>
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-outline-primary btn-xs"
                                                                            onClick={() => handleActivateFY(fy)}
                                                                            title="Set as Active Financial Year"
                                                                        >
                                                                            Set Active
                                                                        </button>
                                                                    )}
                                                                </td>
                                                                <td>
                                                                    <div className="d-flex">
                                                                        <EditButton module="company" className="me-1" onClick={() => { setEditItemId(fy.id); setFYForm(fy); setShowFYModal(true); }} />
                                                                        <DeleteButton module="company" onClick={() => handleDelete('fy', fy.id)} />
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {filteredFYs.length > 0 && (
                                        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-center gap-2 mt-3 mb-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                                    Showing {fyIndexOfFirstItem + 1} to {Math.min(fyIndexOfLastItem, filteredFYs.length)} of {filteredFYs.length} entries
                                                </div>
                                            {fyTotalPages > 1 && (
                                                <nav>
                                                    <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                        <li className={`page-item page-indicator ${fyPage === 1 ? 'disabled' : ''}`}>
                                                            <button type="button" className="page-link" onClick={() => setFyPage(prev => Math.max(prev - 1, 1))} disabled={fyPage === 1} style={{ border: 'none', background: 'none' }}>
                                                                <i className="la la-angle-left" />
                                                            </button>
                                                        </li>
                                                        {Array.from({ length: fyTotalPages }, (_, index) => {
                                                            const pageNumber = index + 1;
                                                            if (
                                                                pageNumber === 1 ||
                                                                pageNumber === fyTotalPages ||
                                                                (pageNumber >= fyPage - 1 && pageNumber <= fyPage + 1)
                                                            ) {
                                                                return (
                                                                    <li key={pageNumber} className={`page-item ${fyPage === pageNumber ? 'active' : ''}`}>
                                                                        <button type="button" className="page-link" onClick={() => setFyPage(pageNumber)} style={{ border: 'none' }}>
                                                                            {pageNumber}
                                                                        </button>
                                                                    </li>
                                                                );
                                                            } else if (
                                                                pageNumber === fyPage - 2 ||
                                                                pageNumber === fyPage + 2
                                                            ) {
                                                                return (
                                                                    <li key={pageNumber} className="page-item disabled">
                                                                        <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                                                    </li>
                                                                );
                                                            }
                                                            return null;
                                                        })}
                                                        <li className={`page-item page-indicator ${fyPage === fyTotalPages ? 'disabled' : ''}`}>
                                                            <button type="button" className="page-link" onClick={() => setFyPage(prev => Math.min(prev + 1, fyTotalPages))} disabled={fyPage === fyTotalPages} style={{ border: 'none', background: 'none' }}>
                                                                <i className="la la-angle-right" />
                                                            </button>
                                                        </li>
                                                    </ul>
                                                </nav>
                                            )}
                                        </div>
                                    )}
                                    </Tab.Pane>
                                </Tab.Content>
                                <Tab.Content>
                                    {/* FACTORIES TAB (Direct to Company) */}
                                    <Tab.Pane eventKey="factories">
                                        <div className="d-flex flex-column flex-sm-row justify-content-between mb-3 align-items-start align-items-sm-center gap-2">
                                            <h5 className="mb-0 text-nowrap">Company Factories</h5>
                                            <div className="d-flex flex-wrap flex-sm-nowrap gap-2 align-items-center w-100 w-sm-auto justify-content-between justify-content-sm-end">
                                                <div style={{ width: '100%', maxWidth: '280px', position: 'relative' }} className="flex-grow-1 flex-sm-grow-0">
                                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                                    <Form.Control
                                                        type="text"
                                                        placeholder="Search factories..."
                                                        value={factorySearchTerm}
                                                        onChange={(e) => setFactorySearchTerm(e.target.value)}
                                                        className="search-input-custom"
                                                    />
                                                </div>
                                                <CreateButton
                                                    module="company"
                                                    onClick={() => { setEditItemId(null); setFactoryForm({ name: '', factory_code: '', license_number: '', timezone: 'Asia/Kolkata', is_active: true, branch: null }); setShowFactoryModal(true); }}
                                                >
                                                    Factory
                                                </CreateButton>
                                            </div>
                                        </div>
                                        <div className="table-responsive">
                                            <table className="table table-hover">
                                                <thead>
                                                    <tr>
                                                        <th><strong>SL No</strong></th>
                                                        <th><strong>NAME</strong></th>
                                                        <th><strong>CODE</strong></th>
                                                        <th><strong>STATUS</strong></th>
                                                        <th className="text-end"><strong>ACTIONS</strong></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredFactories.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="6" className="text-center py-4 text-muted">No entries</td>
                                                        </tr>
                                                    ) : (
                                                        slicedFactories.map((f, index) => (
                                                            <tr key={f.id}>
                                                                <td>{factoryIndexOfFirstItem + index + 1}</td>
                                                                <td>{f.name}</td>
                                                                <td>{f.factory_code}</td>
                                                                <td>{f.is_active ? <span className="badge badge-success">Active</span> : 'No'}</td>
                                                                <td className="text-end">
                                                                    <div className="d-flex justify-content-end gap-1">
                                                                        <button className="btn btn-info shadow btn-xs sharp" title="Manage Details" onClick={() => navigate(`/factory-details/${f.id}`)}><i className="fa fa-list"></i></button>
                                                                        <EditButton module="company" onClick={() => { setEditItemId(f.id); setFactoryForm(f); setShowFactoryModal(true); }} />
                                                                        <DeleteButton module="company" onClick={() => handleDelete('factory', f.id)} />
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {filteredFactories.length > 0 && (
                                        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-center gap-2 mt-3 mb-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                                    Showing {factoryIndexOfFirstItem + 1} to {Math.min(factoryIndexOfLastItem, filteredFactories.length)} of {filteredFactories.length} entries
                                                </div>
                                            {factoryTotalPages > 1 && (
                                                <nav>
                                                    <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                        <li className={`page-item page-indicator ${factoryPage === 1 ? 'disabled' : ''}`}>
                                                            <button type="button" className="page-link" onClick={() => setFactoryPage(prev => Math.max(prev - 1, 1))} disabled={factoryPage === 1} style={{ border: 'none', background: 'none' }}>
                                                                <i className="la la-angle-left" />
                                                            </button>
                                                        </li>
                                                        {Array.from({ length: factoryTotalPages }, (_, index) => {
                                                            const pageNumber = index + 1;
                                                            if (
                                                                pageNumber === 1 ||
                                                                pageNumber === factoryTotalPages ||
                                                                (pageNumber >= factoryPage - 1 && pageNumber <= factoryPage + 1)
                                                            ) {
                                                                return (
                                                                    <li key={pageNumber} className={`page-item ${factoryPage === pageNumber ? 'active' : ''}`}>
                                                                        <button type="button" className="page-link" onClick={() => setFactoryPage(pageNumber)} style={{ border: 'none' }}>
                                                                            {pageNumber}
                                                                        </button>
                                                                    </li>
                                                                );
                                                            } else if (
                                                                pageNumber === factoryPage - 2 ||
                                                                pageNumber === factoryPage + 2
                                                            ) {
                                                                return (
                                                                    <li key={pageNumber} className="page-item disabled">
                                                                        <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                                                    </li>
                                                                );
                                                            }
                                                            return null;
                                                        })}
                                                        <li className={`page-item page-indicator ${factoryPage === factoryTotalPages ? 'disabled' : ''}`}>
                                                            <button type="button" className="page-link" onClick={() => setFactoryPage(prev => Math.min(prev + 1, factoryTotalPages))} disabled={factoryPage === factoryTotalPages} style={{ border: 'none', background: 'none' }}>
                                                                <i className="la la-angle-right" />
                                                            </button>
                                                        </li>
                                                    </ul>
                                                </nav>
                                            )}
                                        </div>
                                    )}
                                    </Tab.Pane>
                                    {/* WAREHOUSES TAB (Direct to Company) */}
                                    <Tab.Pane eventKey="warehouses">
                                        <div className="d-flex flex-column flex-sm-row justify-content-between mb-3 align-items-start align-items-sm-center gap-2">
                                            <h5 className="mb-0 text-nowrap">Company Warehouses</h5>
                                            <div className="d-flex flex-wrap flex-sm-nowrap gap-2 align-items-center w-100 w-sm-auto justify-content-between justify-content-sm-end">
                                                <div style={{ width: '100%', maxWidth: '280px', position: 'relative' }} className="flex-grow-1 flex-sm-grow-0">
                                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                                    <Form.Control
                                                        type="text"
                                                        placeholder="Search warehouses..."
                                                        value={warehouseSearchTerm}
                                                        onChange={(e) => setWarehouseSearchTerm(e.target.value)}
                                                        className="search-input-custom"
                                                    />
                                                </div>
                                                <CreateButton
                                                    module="company"
                                                    onClick={() => { setEditItemId(null); setWarehouseForm({ name: '', code: '', total_capacity: '', capacity_unit: 'units', is_active: true, is_default: false, branch: null, factory: null }); setShowWarehouseModal(true); }}
                                                >
                                                    Warehouse
                                                </CreateButton>
                                            </div>
                                        </div>
                                        <div className="table-responsive">
                                            <table className="table table-hover">
                                                <thead>
                                                    <tr>
                                                        <th><strong>SL No</strong></th>
                                                        <th><strong>NAME</strong></th>
                                                        <th><strong>CODE</strong></th>
                                                        <th><strong>CAPACITY</strong></th>
                                                        <th><strong>STATUS</strong></th>
                                                        <th className="text-end"><strong>ACTIONS</strong></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredWarehouses.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="6" className="text-center py-4 text-muted">No entries</td>
                                                        </tr>
                                                    ) : (
                                                        slicedWarehouses.map((w, index) => (
                                                            <tr key={w.id}>
                                                                <td>{warehouseIndexOfFirstItem + index + 1}</td>
                                                                <td>{w.name}</td>
                                                                <td>{w.code}</td>
                                                                <td>{w.total_capacity} {w.capacity_unit}</td>
                                                                <td>{w.is_active ? <span className="badge badge-success">Active</span> : 'No'}</td>
                                                                <td className="text-end">
                                                                    <div className="d-flex justify-content-end gap-1">
                                                                        <button className="btn btn-info shadow btn-xs sharp" title="Manage Details" onClick={() => navigate(`/warehouse-details/${w.id}`)}><i className="fa fa-list"></i></button>
                                                                        <EditButton module="company" onClick={() => { setEditItemId(w.id); setWarehouseForm(w); setShowWarehouseModal(true); }} />
                                                                        <DeleteButton module="company" onClick={() => handleDelete('warehouse', w.id)} />
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {filteredWarehouses.length > 0 && (
                                        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-center gap-2 mt-3 mb-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                                    Showing {warehouseIndexOfFirstItem + 1} to {Math.min(warehouseIndexOfLastItem, filteredWarehouses.length)} of {filteredWarehouses.length} entries
                                                </div>
                                            {warehouseTotalPages > 1 && (
                                                <nav>
                                                    <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                        <li className={`page-item page-indicator ${warehousePage === 1 ? 'disabled' : ''}`}>
                                                            <button type="button" className="page-link" onClick={() => setWarehousePage(prev => Math.max(prev - 1, 1))} disabled={warehousePage === 1} style={{ border: 'none', background: 'none' }}>
                                                                <i className="la la-angle-left" />
                                                            </button>
                                                        </li>
                                                        {Array.from({ length: warehouseTotalPages }, (_, index) => {
                                                            const pageNumber = index + 1;
                                                            if (
                                                                pageNumber === 1 ||
                                                                pageNumber === warehouseTotalPages ||
                                                                (pageNumber >= warehousePage - 1 && pageNumber <= warehousePage + 1)
                                                            ) {
                                                                return (
                                                                    <li key={pageNumber} className={`page-item ${warehousePage === pageNumber ? 'active' : ''}`}>
                                                                        <button type="button" className="page-link" onClick={() => setWarehousePage(pageNumber)} style={{ border: 'none' }}>
                                                                            {pageNumber}
                                                                        </button>
                                                                    </li>
                                                                );
                                                            } else if (
                                                                pageNumber === warehousePage - 2 ||
                                                                pageNumber === warehousePage + 2
                                                            ) {
                                                                return (
                                                                    <li key={pageNumber} className="page-item disabled">
                                                                        <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                                                    </li>
                                                                );
                                                            }
                                                            return null;
                                                        })}
                                                        <li className={`page-item page-indicator ${warehousePage === warehouseTotalPages ? 'disabled' : ''}`}>
                                                            <button type="button" className="page-link" onClick={() => setWarehousePage(prev => Math.min(prev + 1, warehouseTotalPages))} disabled={warehousePage === warehouseTotalPages} style={{ border: 'none', background: 'none' }}>
                                                                <i className="la la-angle-right" />
                                                            </button>
                                                        </li>
                                                    </ul>
                                                </nav>
                                            )}
                                        </div>
                                    )}
                                    </Tab.Pane>
                                    {/* BRANCHES TAB */}
                                    <Tab.Pane eventKey="branches">
                                        <div className="d-flex flex-column flex-sm-row justify-content-between mb-3 align-items-start align-items-sm-center gap-2">
                                            <h5 className="mb-0 text-nowrap">Company Branches</h5>
                                            <div className="d-flex flex-wrap flex-sm-nowrap gap-2 align-items-center w-100 w-sm-auto justify-content-between justify-content-sm-end">
                                                <div style={{ width: '100%', maxWidth: '280px', position: 'relative' }} className="flex-grow-1 flex-sm-grow-0">
                                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                                    <Form.Control
                                                        type="text"
                                                        placeholder="Search branches..."
                                                        value={branchSearchTerm}
                                                        onChange={(e) => setBranchSearchTerm(e.target.value)}
                                                        className="search-input-custom"
                                                    />
                                                </div>
                                                <CreateButton
                                                    module="company"
                                                    onClick={() => { setEditItemId(null); setBranchForm({ name: '', branch_code: '', gst_number: '', country: formData.country, default_currency: formData.default_currency, timezone: 'Asia/Kolkata', is_active: true }); setShowBranchModal(true); }}
                                                >
                                                    Branch
                                                </CreateButton>
                                            </div>
                                        </div>
                                        <div className="table-responsive">
                                            <table className="table table-hover">
                                                <thead>
                                                    <tr>
                                                        <th><strong>SL No</strong></th>
                                                        <th><strong>NAME</strong></th>
                                                        <th><strong>CODE</strong></th>
                                                        <th><strong>GST</strong></th>
                                                        <th><strong>STATUS</strong></th>
                                                        <th className="text-end"><strong>ACTIONS</strong></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredBranches.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="6" className="text-center py-4 text-muted">No entries</td>
                                                        </tr>
                                                    ) : (
                                                        slicedBranches.map((b, index) => (
                                                            <tr key={b.id}>
                                                                <td>{branchIndexOfFirstItem + index + 1}</td>
                                                                <td>{b.name}</td>
                                                                <td>{b.branch_code}</td>
                                                                <td>{b.gst_number || '-'}</td>
                                                                <td>{b.is_active ? <span className="badge badge-success">Active</span> : 'No'}</td>
                                                                <td className="text-end">
                                                                    <div className="d-flex justify-content-end gap-1">
                                                                        <button className="btn btn-info shadow btn-xs sharp" title="Manage Details" onClick={() => navigate(`/branch-details/${b.id}`)}><i className="fa fa-list"></i></button>
                                                                        <EditButton module="company" onClick={() => { setEditItemId(b.id); setBranchForm(b); setShowBranchModal(true); }} />
                                                                        <DeleteButton module="company" onClick={() => handleDelete('branch', b.id)} />
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {filteredBranches.length > 0 && (
                                        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-center gap-2 mt-3 mb-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                                    Showing {branchIndexOfFirstItem + 1} to {Math.min(branchIndexOfLastItem, filteredBranches.length)} of {filteredBranches.length} entries
                                                </div>
                                            {branchTotalPages > 1 && (
                                                <nav>
                                                    <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                        <li className={`page-item page-indicator ${branchPage === 1 ? 'disabled' : ''}`}>
                                                            <button type="button" className="page-link" onClick={() => setBranchPage(prev => Math.max(prev - 1, 1))} disabled={branchPage === 1} style={{ border: 'none', background: 'none' }}>
                                                                <i className="la la-angle-left" />
                                                            </button>
                                                        </li>
                                                        {Array.from({ length: branchTotalPages }, (_, index) => {
                                                            const pageNumber = index + 1;
                                                            if (
                                                                pageNumber === 1 ||
                                                                pageNumber === branchTotalPages ||
                                                                (pageNumber >= branchPage - 1 && pageNumber <= branchPage + 1)
                                                            ) {
                                                                return (
                                                                    <li key={pageNumber} className={`page-item ${branchPage === pageNumber ? 'active' : ''}`}>
                                                                        <button type="button" className="page-link" onClick={() => setBranchPage(pageNumber)} style={{ border: 'none' }}>
                                                                            {pageNumber}
                                                                        </button>
                                                                    </li>
                                                                );
                                                            } else if (
                                                                pageNumber === branchPage - 2 ||
                                                                pageNumber === branchPage + 2
                                                            ) {
                                                                return (
                                                                    <li key={pageNumber} className="page-item disabled">
                                                                        <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                                                    </li>
                                                                );
                                                            }
                                                            return null;
                                                        })}
                                                        <li className={`page-item page-indicator ${branchPage === branchTotalPages ? 'disabled' : ''}`}>
                                                            <button type="button" className="page-link" onClick={() => setBranchPage(prev => Math.min(prev + 1, branchTotalPages))} disabled={branchPage === branchTotalPages} style={{ border: 'none', background: 'none' }}>
                                                                <i className="la la-angle-right" />
                                                            </button>
                                                        </li>
                                                    </ul>
                                                </nav>
                                            )}
                                        </div>
                                    )}
                                    </Tab.Pane>

                                    {/* LICENSES TAB */}
                                    <Tab.Pane eventKey="licenses">
                                        <div className="d-flex flex-column flex-sm-row justify-content-between mb-3 align-items-start align-items-sm-center gap-2">
                                            <h5 className="mb-0 text-nowrap">Licenses & Statutory Registrations</h5>
                                            <div className="d-flex flex-wrap flex-sm-nowrap gap-2 align-items-center w-100 w-sm-auto justify-content-between justify-content-sm-end">
                                                <div style={{ width: '100%', maxWidth: '280px', position: 'relative' }} className="flex-grow-1 flex-sm-grow-0">
                                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                                    <Form.Control
                                                        type="text"
                                                        placeholder="Search licenses..."
                                                        value={licenseSearchTerm}
                                                        onChange={(e) => setLicenseSearchTerm(e.target.value)}
                                                        className="search-input-custom"
                                                    />
                                                </div>
                                                <CreateButton
                                                    module="company"
                                                    onClick={() => {
                                                        setEditItemId(null);
                                                        setLicenseForm({
                                                            license_name: '',
                                                            months_to_expiry: 3,
                                                            status: 'Active'
                                                        });
                                                        setShowLicenseModal(true);
                                                    }}
                                                >
                                                    License
                                                </CreateButton>
                                            </div>
                                        </div>

                                        <div className="table-responsive">
                                            <table className="table table-hover">
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: '80px' }}><strong>SL NO</strong></th>
                                                        <th><strong>LICENSE NAME</strong></th>
                                                        <th><strong>VALIDITY (MONTH)</strong></th>
                                                        <th><strong>STATUS</strong></th>
                                                        <th className="text-end"><strong>ACTIONS</strong></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredLicenses.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="5" className="text-center py-4 text-muted">No license records found</td>
                                                        </tr>
                                                    ) : (
                                                        slicedLicenses.map((l, index) => (
                                                            <tr key={l.id}>
                                                                <td>{licenseIndexOfFirstItem + index + 1}</td>
                                                                <td><span className="fw-bold">{l.license_name}</span></td>
                                                                <td><span className="badge badge-info light px-3">{l.months_to_expiry} {l.months_to_expiry === 1 ? 'Month' : 'Months'}</span></td>
                                                                <td>
                                                                    {l.status === 'Active' ? (
                                                                        <span className="badge badge-success">Active</span>
                                                                    ) : (
                                                                        <span className="badge badge-danger">Inactive</span>
                                                                    )}
                                                                </td>
                                                                <td className="text-end">
                                                                    <div className="d-flex justify-content-end gap-1">
                                                                        <EditButton module="company" onClick={() => { setEditItemId(l.id); setLicenseForm(l); setShowLicenseModal(true); }} />
                                                                        <DeleteButton module="company" onClick={() => handleDeleteLicense(l.id)} />
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {filteredLicenses.length > 0 && (
                                        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-center gap-2 mt-3 mb-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                                    Showing {licenseIndexOfFirstItem + 1} to {Math.min(licenseIndexOfLastItem, filteredLicenses.length)} of {filteredLicenses.length} entries
                                                </div>
                                            {licenseTotalPages > 1 && (
                                                <nav>
                                                    <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                        <li className={`page-item page-indicator ${licensePage === 1 ? 'disabled' : ''}`}>
                                                            <button type="button" className="page-link" onClick={() => setLicensePage(prev => Math.max(prev - 1, 1))} disabled={licensePage === 1} style={{ border: 'none', background: 'none' }}>
                                                                <i className="la la-angle-left" />
                                                            </button>
                                                        </li>
                                                        {Array.from({ length: licenseTotalPages }, (_, index) => {
                                                            const pageNumber = index + 1;
                                                            return (
                                                                <li key={pageNumber} className={`page-item ${licensePage === pageNumber ? 'active' : ''}`}>
                                                                    <button type="button" className="page-link" onClick={() => setLicensePage(pageNumber)} style={{ border: 'none' }}>
                                                                        {pageNumber}
                                                                    </button>
                                                                </li>
                                                            );
                                                        })}
                                                        <li className={`page-item page-indicator ${licensePage === licenseTotalPages ? 'disabled' : ''}`}>
                                                            <button type="button" className="page-link" onClick={() => setLicensePage(prev => Math.min(prev + 1, licenseTotalPages))} disabled={licensePage === licenseTotalPages} style={{ border: 'none', background: 'none' }}>
                                                                <i className="la la-angle-right" />
                                                            </button>
                                                        </li>
                                                    </ul>
                                                </nav>
                                            )}
                                        </div>
                                    )}
                                    </Tab.Pane>

                                    {/* THEME SETTINGS TAB */}
                                    <Tab.Pane eventKey="theme">
                                        <div className="d-flex justify-content-between mb-3 align-items-center flex-wrap gap-2">
                                            <h5 className="mb-0 text-nowrap">Theme Settings</h5>
                                            <div className="d-flex gap-2">
                                                <button 
                                                    type="button" 
                                                    className={`btn btn-sm px-3 ${background?.value === 'light' ? 'btn-primary' : 'btn-outline-primary'}`}
                                                    onClick={() => resetToDefault('light')}
                                                >
                                                    ☀️ Default Light
                                                </button>
                                                <button 
                                                    type="button" 
                                                    className={`btn btn-sm px-3 ${background?.value === 'dark' ? 'btn-primary' : 'btn-outline-primary'}`}
                                                    onClick={() => resetToDefault('dark')}
                                                >
                                                    🌙 Default Dark
                                                </button>
                                            </div>
                                        </div>
                                        <div className="row mt-4">

                                            {/* Navigation Header Background */}
                                            <div className="col-md-6 mb-4">
                                                <label className="font-w600">Navigation Header Background <span className="text-danger">*</span></label>
                                                <div className="d-flex align-items-center gap-3 mt-2">
                                                    <input 
                                                        type="color" 
                                                        className="form-control form-control-color border-0 p-0"
                                                        value={customNavHeaderColor} 
                                                        onChange={(e) => changeCustomNavHeaderColor(e.target.value)}
                                                        style={{ cursor: 'pointer', width: '60px', height: '45px', borderRadius: '8px' }}
                                                    />
                                                    <div>
                                                        <div className="font-w700 fs-16 mb-0" style={{ textTransform: 'uppercase' }}>{customNavHeaderColor}</div>
                                                        <span className="text-muted small">Pick a color for the brand logo section background.</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Header Background */}
                                            <div className="col-md-6 mb-4">
                                                <label className="font-w600">Top Header Background <span className="text-danger">*</span></label>
                                                <div className="d-flex align-items-center gap-3 mt-2">
                                                    <input 
                                                        type="color" 
                                                        className="form-control form-control-color border-0 p-0"
                                                        value={customHeaderColor} 
                                                        onChange={(e) => changeCustomHeaderColor(e.target.value)}
                                                        style={{ cursor: 'pointer', width: '60px', height: '45px', borderRadius: '8px' }}
                                                    />
                                                    <div>
                                                        <div className="font-w700 fs-16 mb-0" style={{ textTransform: 'uppercase' }}>{customHeaderColor}</div>
                                                        <span className="text-muted small">Pick a color for the top header navigation bar.</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Sidebar Background */}
                                            <div className="col-md-6 mb-4">
                                                <label className="font-w600">Sidebar Background <span className="text-danger">*</span></label>
                                                <div className="d-flex align-items-center gap-3 mt-2">
                                                    <input 
                                                        type="color" 
                                                        className="form-control form-control-color border-0 p-0"
                                                        value={customSidebarColor} 
                                                        onChange={(e) => changeCustomSidebarColor(e.target.value)}
                                                        style={{ cursor: 'pointer', width: '60px', height: '45px', borderRadius: '8px' }}
                                                    />
                                                    <div>
                                                        <div className="d-flex align-items-center gap-2">
                                                            <div className="font-w700 fs-16 mb-0" style={{ textTransform: 'uppercase' }}>{customSidebarColor}</div>
                                                            {customSidebarColor && customSidebarColor !== '#2bc155' && (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-link btn-xs p-0 text-muted"
                                                                    style={{ fontSize: '11px', textDecoration: 'underline' }}
                                                                    onClick={() => changeCustomSidebarColor('#2bc155')}
                                                                    title="Reset sidebar background to default"
                                                                >
                                                                    Reset
                                                                </button>
                                                            )}
                                                        </div>
                                                        <span className="text-muted small">Pick a color for the left sidebar navigation background.</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Sidebar Font Color */}
                                            <div className="col-md-6 mb-4">
                                                <label className="font-w600">Sidebar Font Color <span className="text-danger">*</span></label>
                                                <div className="d-flex align-items-center gap-3 mt-2">
                                                    <input 
                                                        type="color" 
                                                        className="form-control form-control-color border-0 p-0"
                                                        value={customSidebarFontColor || (background?.value === 'dark' ? '#FFFFFF' : '#7e7e7e')} 
                                                        onChange={(e) => changeCustomSidebarFontColor(e.target.value)}
                                                        style={{ cursor: 'pointer', width: '60px', height: '45px', borderRadius: '8px' }}
                                                    />
                                                    <div>
                                                        <div className="d-flex align-items-center gap-2">
                                                            <div className="font-w700 fs-16 mb-0" style={{ textTransform: 'uppercase' }}>
                                                                {customSidebarFontColor || (background?.value === 'dark' ? '#FFFFFF' : '#7e7e7e')}
                                                            </div>
                                                            {customSidebarFontColor && (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-link btn-xs p-0 text-muted"
                                                                    style={{ fontSize: '11px', textDecoration: 'underline' }}
                                                                    onClick={() => changeCustomSidebarFontColor('')}
                                                                    title="Reset sidebar font color to default"
                                                                >
                                                                    Reset
                                                                </button>
                                                            )}
                                                        </div>
                                                        <span className="text-muted small">Pick a color for left sidebar menu links and text.</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Theme Background */}
                                            <div className="col-md-6 mb-4">
                                                <label className="font-w600">Dashboard Background <span className="text-danger">*</span></label>
                                                <div className="d-flex align-items-center gap-3 mt-2">
                                                    <input 
                                                        type="color" 
                                                        className="form-control form-control-color border-0 p-0"
                                                        value={customBgColor || (background?.value === 'dark' ? '#24292D' : '#F9F9F9')} 
                                                        onChange={(e) => changeCustomBgColor(e.target.value)}
                                                        style={{ cursor: 'pointer', width: '60px', height: '45px', borderRadius: '8px' }}
                                                    />
                                                    <div>
                                                        <div className="d-flex align-items-center gap-2">
                                                            <div className="font-w700 fs-16 mb-0" style={{ textTransform: 'uppercase' }}>
                                                                {customBgColor || (background?.value === 'dark' ? '#24292D' : '#F9F9F9')}
                                                            </div>
                                                            {customBgColor && (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-link btn-xs p-0 text-muted"
                                                                    style={{ fontSize: '11px', textDecoration: 'underline' }}
                                                                    onClick={() => changeCustomBgColor('')}
                                                                    title="Reset dashboard background to default"
                                                                >
                                                                    Reset
                                                                </button>
                                                            )}
                                                        </div>
                                                        <span className="text-muted small">Pick a custom overall background color for the dashboard.</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Font Color */}
                                            <div className="col-md-6 mb-4">
                                                <label className="font-w600">Font Color <span className="text-danger">*</span></label>
                                                <div className="d-flex align-items-center gap-3 mt-2">
                                                    <input 
                                                        type="color" 
                                                        className="form-control form-control-color border-0 p-0"
                                                        value={customFontColor || (background?.value === 'dark' ? '#FFFFFF' : '#333333')} 
                                                        onChange={(e) => changeCustomFontColor(e.target.value)}
                                                        style={{ cursor: 'pointer', width: '60px', height: '45px', borderRadius: '8px' }}
                                                    />
                                                    <div>
                                                        <div className="d-flex align-items-center gap-2">
                                                            <div className="font-w700 fs-16 mb-0" style={{ textTransform: 'uppercase' }}>
                                                                {customFontColor || (background?.value === 'dark' ? '#FFFFFF' : '#333333')}
                                                            </div>
                                                            {customFontColor && (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-link btn-xs p-0 text-muted"
                                                                    style={{ fontSize: '11px', textDecoration: 'underline' }}
                                                                    onClick={() => changeCustomFontColor('')}
                                                                    title="Reset font color to default"
                                                                >
                                                                    Reset
                                                                </button>
                                                            )}
                                                        </div>
                                                        <span className="text-muted small">Pick a custom font color for dashboard text and headings.</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Form & Modal Icon Color */}
                                            <div className="col-md-6 mb-4">
                                                <label className="font-w600">Form & Modal Icon Color <span className="text-danger">*</span></label>
                                                <div className="d-flex align-items-center gap-3 mt-2">
                                                    <input 
                                                        type="color" 
                                                        className="form-control form-control-color border-0 p-0"
                                                        value={formIconColor} 
                                                        onChange={(e) => changeFormIconColor(e.target.value)}
                                                        style={{ cursor: 'pointer', width: '60px', height: '45px', borderRadius: '8px' }}
                                                    />
                                                    <div>
                                                        <div className="font-w700 fs-16 mb-0" style={{ textTransform: 'uppercase' }}>{formIconColor}</div>
                                                        <span className="text-muted small">Pick a color to globally customize form and modal header icons.</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Login Page Panel Color */}
                                            <div className="col-md-6 mb-4">
                                                <label className="font-w600">Login Page Panel Color <span className="text-danger">*</span></label>
                                                <div className="d-flex align-items-center gap-3 mt-2">
                                                    <input
                                                        type="color"
                                                        className="form-control form-control-color border-0 p-0"
                                                        value={loginPanelColor}
                                                        onChange={(e) => setLoginPanelColor(e.target.value)}
                                                        style={{ cursor: 'pointer', width: '60px', height: '45px', borderRadius: '8px' }}
                                                    />
                                                    <div>
                                                        <div className="font-w700 fs-16 mb-0" style={{ textTransform: 'uppercase' }}>{loginPanelColor}</div>
                                                        <span className="text-muted small">Pick a color for the login page left panel background overlay.</span>
                                                    </div>
                                                </div>
                                                <div className="mt-2 d-flex gap-2">
                                                    <button
                                                        type="button"
                                                        className="btn btn-primary btn-xs px-3"
                                                        onClick={() => {
                                                            // Save to backend + localStorage
                                                            const settings = JSON.parse(localStorage.getItem('companySettings') || '{}');
                                                            localStorage.setItem('companySettings', JSON.stringify({ ...settings, loginPanelColor }));
                                                            window.dispatchEvent(new Event('companySettingsUpdate'));
                                                            // PATCH backend
                                                            try {
                                                                const userDetails = localStorage.getItem('userDetails');
                                                                if (userDetails) {
                                                                    const { access } = JSON.parse(userDetails);
                                                                    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';
                                                                    fetch(`${backendUrl}/api/settings/company/`, { headers: { Authorization: `Bearer ${access}` } })
                                                                        .then(r => r.ok ? r.json() : null)
                                                                        .then(list => {
                                                                            if (!list || !list.length) return;
                                                                            fetch(`${backendUrl}/api/settings/company/${list[0].id}/`, {
                                                                                method: 'PATCH',
                                                                                headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
                                                                                body: JSON.stringify({ login_panel_color: loginPanelColor })
                                                                            });
                                                                        });
                                                                }
                                                            } catch {}
                                                        }}
                                                    >
                                                        Apply
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-secondary btn-xs px-3"
                                                        onClick={() => setLoginPanelColor('#1a3a72')}
                                                    >
                                                        Reset
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </Tab.Pane>
                                </Tab.Content>
                            </Tab.Container>
                        </div>
                    </div>
                </div>
            </div>

            {/* ADDRESS MODAL */}
            <Modal show={showAddressModal} onHide={() => setShowAddressModal(false)} dialogClassName="addr-custom-modal" centered>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle form-icon-circle">
                            <i className="fa fa-map-marker-alt text-white fs-4"></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editItemId ? 'Edit Address' : 'Add Address'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                {editItemId ? 'Update the address details below' : 'Enter the company address details'}
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowAddressModal(false)}>&times;</button>
                </div>
                <Form onSubmit={handleAddressSubmit} onKeyDown={handleAddrKeyDown}>
                    <div className="modal-body-custom">
                        <div className="row">
                            <div className="col-md-12 mb-3">
                                <Form.Label className="form-label-custom">Address Type <span className="text-danger">*</span></Form.Label>
                                <Select
                                    ref={addressTypeSelectRef}
                                    classNamePrefix="react-select"
                                    options={addressTypeOptions}
                                    value={addressTypeOptions.find(o => o.value === addressForm.address_type) || null}
                                    onChange={opt => setAddressForm({ ...addressForm, address_type: opt ? opt.value : 'corporate' })}
                                    styles={addrSelectStyles}
                                    placeholder="Select address type..."
                                    autoFocus
                                    defaultMenuIsOpen
                                    isSearchable
                                    openMenuOnFocus={true}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const menuOpen = !!document.querySelector('.addr-custom-modal .react-select__menu');
                                            if (!menuOpen) {
                                                e.preventDefault();
                                                const all = getAddrFocusable();
                                                const ctrl = e.target.closest('.react-select__control');
                                                const index = all.indexOf(ctrl);
                                                if (index > -1 && index < all.length - 1) {
                                                    const next = all[index + 1];
                                                    if (next.classList.contains('react-select__control')) {
                                                        next.querySelector('input')?.focus();
                                                    } else {
                                                        next.focus();
                                                        if (next.tagName === 'SELECT' && typeof next.showPicker === 'function') {
                                                            try { next.showPicker(); } catch (err) {}
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }}
                                />
                            </div>
                            <div className="col-md-12 mb-3">
                                <Form.Label className="form-label-custom">Address Line 1  <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    required
                                    placeholder="e.g., 123 Main Street"
                                    value={addressForm.address_line_1}
                                    onChange={e => setAddressForm({ ...addressForm, address_line_1: e.target.value })}
                                />
                            </div>
                            <div className="col-md-12 mb-3">
                                <Form.Label className="form-label-custom">Address Line 2 <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    placeholder="Apt, Suite, Floor (optional)"
                                    value={addressForm.address_line_2 || ''}
                                    onChange={e => setAddressForm({ ...addressForm, address_line_2: e.target.value })}
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">City  <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    required
                                    placeholder="e.g., Mumbai"
                                    value={addressForm.city}
                                    onChange={e => setAddressForm({ ...addressForm, city: e.target.value })}
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">State  <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    required
                                    placeholder="e.g., Maharashtra"
                                    value={addressForm.state}
                                    onChange={e => setAddressForm({ ...addressForm, state: e.target.value })}
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Pincode  <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    required
                                    placeholder="e.g., 400001"
                                    value={addressForm.pincode}
                                    onChange={e => setAddressForm({ ...addressForm, pincode: e.target.value })}
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Country  <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    required
                                    placeholder="e.g., India"
                                    value={addressForm.country}
                                    onChange={e => setAddressForm({ ...addressForm, country: e.target.value })}
                                />
                            </div>
                            <div className="col-md-12 mb-3">
                                <Form.Check
                                    type="checkbox"
                                    id="def-addr-check"
                                    label="Set as Default"
                                    checked={addressForm.is_default}
                                    onChange={e => setAddressForm({ ...addressForm, is_default: e.target.checked })}
                                    className="form-check-input-custom"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={() => setShowAddressModal(false)}>Cancel</Button>
                        <Button type="submit" className="btn-save-custom">{editItemId ? 'Save Changes' : 'Save'}</Button>
                    </div>
                </Form>
            </Modal>

            {/* CONTACT MODAL */}
            <Modal show={showContactModal} onHide={() => setShowContactModal(false)} dialogClassName="contact-custom-modal" centered>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle form-icon-circle">
                            <i className="fa fa-phone text-white fs-4"></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editItemId ? 'Edit Contact' : 'Add Contact'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Specify contact email, phone, and support email details
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowContactModal(false)}>&times;</button>
                </div>
                <Form onSubmit={handleContactSubmit} onKeyDown={handleContactKeyDown}>
                    <div className="modal-body-custom">
                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Email  <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="email"
                                    className="form-control-custom"
                                    required
                                    placeholder="e.g., info@company.com"
                                    value={contactForm.email}
                                    onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
                                    autoFocus
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Phone  <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    required
                                    placeholder="e.g., +1234567890"
                                    value={contactForm.phone}
                                    onChange={e => setContactForm({ ...contactForm, phone: e.target.value })}
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Mobile <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    placeholder="e.g., +1234567890 (optional)"
                                    value={contactForm.mobile || ''}
                                    onChange={e => setContactForm({ ...contactForm, mobile: e.target.value })}
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Support Email <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="email"
                                    className="form-control-custom"
                                    placeholder="e.g., support@company.com (optional)"
                                    value={contactForm.support_email || ''}
                                    onChange={e => setContactForm({ ...contactForm, support_email: e.target.value })}
                                />
                            </div>
                            <div className="col-md-12 mb-3">
                                <Form.Check
                                    type="checkbox"
                                    id="pri-con-check"
                                    label="Set as Primary"
                                    checked={contactForm.is_primary}
                                    onChange={e => setContactForm({ ...contactForm, is_primary: e.target.checked })}
                                    className="form-check-input-custom"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={() => setShowContactModal(false)}>Cancel</Button>
                        <Button type="submit" className="btn-save-custom">{editItemId ? 'Save Changes' : 'Save'}</Button>
                    </div>
                </Form>
            </Modal>

            {/* FINANCIAL YEAR MODAL */}
            <Modal show={showFYModal} onHide={() => setShowFYModal(false)} dialogClassName="fy-custom-modal" centered>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle form-icon-circle">
                            <i className="fa fa-calendar-alt text-white fs-4"></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editItemId ? 'Edit Financial Year' : 'Add Financial Year'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Set accounting start and end dates
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowFYModal(false)}>&times;</button>
                </div>
                <Form onSubmit={handleFYSubmit} onKeyDown={handleFYKeyDown}>
                    <div className="modal-body-custom">
                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Start Date  <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="date"
                                    className="form-control-custom"
                                    required
                                    value={fyForm.start_date}
                                    onChange={e => handleFYStartDateChange(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">End Date  <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="date"
                                    className="form-control-custom"
                                    required
                                    value={fyForm.end_date}
                                    onChange={e => setFYForm({ ...fyForm, end_date: e.target.value })}
                                />
                            </div>
                            <div className="col-md-12 mb-3">
                                <Form.Check
                                    type="checkbox"
                                    id="act-fy-check"
                                    label="Set as Active Financial Year"
                                    checked={fyForm.is_active}
                                    onChange={e => setFYForm({ ...fyForm, is_active: e.target.checked })}
                                    className="form-check-input-custom"
                                />
                                <small className="text-muted d-block mt-1">
                                    Only one financial year can be active at a time. Activating this will automatically set other financial years to inactive.
                                </small>
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={() => setShowFYModal(false)}>Close</Button>
                        <Button type="submit" className="btn-save-custom">{editItemId ? 'Save Changes' : 'Save'}</Button>
                    </div>
                </Form>
            </Modal>

            {/* DATE VALIDATION ALERT */}
            {validationAlert.show && (
                <div className="fy-validation-overlay" onClick={() => setValidationAlert({ ...validationAlert, show: false })}>
                    <div className="fy-validation-box" onClick={e => e.stopPropagation()}>
                        <div className="fy-validation-icon-ring">
                            <span>!</span>
                        </div>
                        <div className="fy-validation-title">{validationAlert.title}</div>
                        <div className="fy-validation-message">{validationAlert.message}</div>
                        <button
                            className="fy-validation-ok-btn"
                            onClick={() => setValidationAlert({ ...validationAlert, show: false })}
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}

            {/* BRANCH MODAL */}
            <Modal show={showBranchModal} onHide={() => setShowBranchModal(false)} dialogClassName="branch-custom-modal" centered>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle form-icon-circle">
                            <i className="fa fa-code-branch text-white fs-4"></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editItemId ? 'Edit Branch' : 'Add Branch'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Define company office or retail branches
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowBranchModal(false)}>&times;</button>
                </div>
                <Form onSubmit={handleBranchSubmit} onKeyDown={handleBranchKeyDown}>
                    <div className="modal-body-custom">
                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Name  <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    required
                                    placeholder="e.g., DOWNTOWN BRANCH"
                                    value={branchForm.name}
                                    onChange={e => setBranchForm({ ...branchForm, name: e.target.value.toUpperCase() })}
                                    style={{ textTransform: 'uppercase' }}
                                    autoFocus
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Branch Code  <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    required
                                    placeholder="e.g., DWT"
                                    maxLength="3"
                                    value={branchForm.branch_code}
                                    onChange={e => setBranchForm({ ...branchForm, branch_code: e.target.value.toUpperCase() })}
                                    style={{ textTransform: 'uppercase' }}
                                />
                            </div>
                            <div className="col-md-12 mb-3">
                                <Form.Label className="form-label-custom">GST Number <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className={`form-control-custom ${branchForm.gst_number ? (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(branchForm.gst_number) ? 'is-valid' : 'is-invalid') : ''}`}
                                    placeholder="e.g., 22AAAAA0000A1Z5"
                                    value={branchForm.gst_number || ''}
                                    onChange={e => setBranchForm({ ...branchForm, gst_number: e.target.value.toUpperCase() })}
                                    style={{ textTransform: 'uppercase' }}
                                    maxLength="15"
                                />
                                {branchForm.gst_number && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(branchForm.gst_number) && (
                                    <div className="invalid-feedback d-block" style={{ fontSize: '12.5px' }}>
                                        Invalid GST Number format. Must be 15 characters (e.g. 22AAAAA0000A1Z5)
                                    </div>
                                )}
                                {branchForm.gst_number && /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(branchForm.gst_number) && (
                                    <div className="valid-feedback d-block" style={{ fontSize: '12.5px', color: '#2ece8a' }}>
                                        <i className="fa fa-check-circle me-1"></i> Valid GST format
                                    </div>
                                )}
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Country <span className="text-danger">*</span></Form.Label>
                                <select className="form-control-custom" value={branchForm.country} onChange={e => setBranchForm({ ...branchForm, country: e.target.value })}>
                                    <option value="">Select Country</option>
                                    {countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Default Currency <span className="text-danger">*</span></Form.Label>
                                <select className="form-control-custom" value={branchForm.default_currency} onChange={e => setBranchForm({ ...branchForm, default_currency: e.target.value })}>
                                    <option value="">Select Currency</option>
                                    {currencies.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
                                </select>
                            </div>
                            <div className="col-md-12 mb-3">
                                <Form.Label className="form-label-custom">Timezone <span className="text-danger">*</span></Form.Label>
                                <select className="form-control-custom" value={branchForm.timezone} onChange={e => setBranchForm({ ...branchForm, timezone: e.target.value })}>
                                    {commonTimezones.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                                </select>
                            </div>
                            <div className="col-md-12 mb-3">
                                <Form.Check
                                    type="checkbox"
                                    id="act-branch-check"
                                    label="Set as Active"
                                    checked={branchForm.is_active}
                                    onChange={e => setBranchForm({ ...branchForm, is_active: e.target.checked })}
                                    className="form-check-input-custom"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={() => setShowBranchModal(false)}>Cancel</Button>
                        <Button type="submit" className="btn-save-custom">{editItemId ? 'Save Changes' : 'Save'}</Button>
                    </div>
                </Form>
            </Modal>


            {/* FACTORY MODAL */}
            <Modal show={showFactoryModal} onHide={() => setShowFactoryModal(false)} dialogClassName="factory-custom-modal" centered>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle form-icon-circle">
                            <i className="fa fa-industry text-white fs-4"></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editItemId ? 'Edit Factory' : 'Add Factory'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Manage manufacturing unit details and license
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowFactoryModal(false)}>&times;</button>
                </div>
                <Form onSubmit={handleFactorySubmit} onKeyDown={handleFactoryKeyDown}>
                    <div className="modal-body-custom">
                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Name  <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    required
                                    placeholder="e.g., Primary Plant"
                                    value={factoryForm.name}
                                    onChange={e => setFactoryForm({ ...factoryForm, name: e.target.value })}
                                    autoFocus
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Factory Code  <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    required
                                    placeholder="e.g., FCT01"
                                    value={factoryForm.factory_code}
                                    onChange={e => setFactoryForm({ ...factoryForm, factory_code: e.target.value })}
                                />
                            </div>

                            <div className="col-md-12 mb-3">
                                <Form.Label className="form-label-custom">Timezone <span className="text-danger">*</span></Form.Label>
                                <select className="form-control-custom" value={factoryForm.timezone} onChange={e => setFactoryForm({ ...factoryForm, timezone: e.target.value })}>
                                    {commonTimezones.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                                </select>
                            </div>
                            <div className="col-md-12 mb-3">
                                <Form.Check
                                    type="checkbox"
                                    id="act-factory-check"
                                    label="Set as Active"
                                    checked={factoryForm.is_active}
                                    onChange={e => setFactoryForm({ ...factoryForm, is_active: e.target.checked })}
                                    className="form-check-input-custom"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={() => setShowFactoryModal(false)}>Cancel</Button>
                        <Button type="submit" className="btn-save-custom">{editItemId ? 'Save Changes' : 'Save'}</Button>
                    </div>
                </Form>
            </Modal>

            {/* FACTORY DETAILS MODAL */}
            <Modal show={showFactoryDetailsModal} onHide={() => setShowFactoryDetailsModal(false)} size="lg">
                <Modal.Header closeButton><Modal.Title>Factory Details: {selectedFactory?.name}</Modal.Title></Modal.Header>
                <Modal.Body>
                    <Tab.Container defaultActiveKey="fa-addresses">
                        <Nav className="nav nav-pills mb-3">
                            <Nav.Item><Nav.Link eventKey="fa-addresses">Addresses</Nav.Link></Nav.Item>
                            <Nav.Item><Nav.Link eventKey="fa-contacts">Contacts</Nav.Link></Nav.Item>
                            <Nav.Item><Nav.Link eventKey="fa-warehouses">Warehouses</Nav.Link></Nav.Item>
                        </Nav>
                        <Tab.Content>
                            <Tab.Pane eventKey="fa-addresses">
                                <Button variant="primary" size="sm" className="mb-3" onClick={() => { setEditItemId(null); setFactoryAddressForm({ address_line_1: '', address_line_2: '', city: '', state: '', country: formData.country, pincode: '', is_default: true }); setShowFactoryAddressModal(true); }}>+ Add Address</Button>
                                <div className="table-responsive">
                                    <table className="table table-sm">
                                        <thead><tr><th>City/State</th><th>Default</th><th>Actions</th></tr></thead>
                                        <tbody>
                                            {factoryAddresses.map(a => (
                                                <tr key={a.id}>
                                                    <td>{a.city}, {a.state}</td>
                                                    <td>{a.is_default ? 'Yes' : 'No'}</td>
                                                    <td>
                                                        <button className="btn btn-primary btn-xxs sharp me-1" onClick={() => { setEditItemId(a.id); setFactoryAddressForm(a); setShowFactoryAddressModal(true); }}><i className="fa fa-edit"></i></button>
                                                        <button className="btn btn-danger btn-xxs sharp" onClick={() => handleDelete('factoryAddress', a.id)}><i className="fa fa-trash"></i></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Tab.Pane>
                            <Tab.Pane eventKey="fa-contacts">
                                <Button variant="primary" size="sm" className="mb-3" onClick={() => { setEditItemId(null); setFactoryContactForm({ email: '', phone: '', manager_name: '', is_primary: true }); setShowFactoryContactModal(true); }}>+ Add Contact</Button>
                                <div className="table-responsive">
                                    <table className="table table-sm">
                                        <thead><tr><th>Manager</th><th>Email</th><th>Phone</th><th>Primary</th><th>Actions</th></tr></thead>
                                        <tbody>
                                            {factoryContacts.map(c => (
                                                <tr key={c.id}>
                                                    <td>{c.manager_name}</td><td>{c.email}</td><td>{c.phone}</td>
                                                    <td>{c.is_primary ? 'Yes' : 'No'}</td>
                                                    <td>
                                                        <button className="btn btn-primary btn-xxs sharp me-1" onClick={() => { setEditItemId(c.id); setFactoryContactForm(c); setShowFactoryContactModal(true); }}><i className="fa fa-edit"></i></button>
                                                        <button className="btn btn-danger btn-xxs sharp" onClick={() => handleDelete('factoryContact', c.id)}><i className="fa fa-trash"></i></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Tab.Pane>
                            {/* FA-WAREHOUSES */}
                            <Tab.Pane eventKey="fa-warehouses">
                                <Button variant="primary" size="sm" className="mb-3" onClick={() => { setEditItemId(null); setWarehouseForm({ name: '', code: '', total_capacity: '', capacity_unit: 'units', is_active: true, branch: selectedFactory?.branch || null, factory: selectedFactory?.id }); setShowWarehouseModal(true); }}>+ Add Warehouse</Button>
                                <div className="table-responsive">
                                    <table className="table table-sm">
                                        <thead><tr><th>Name</th><th>Code</th><th>Capacity</th><th>Status</th><th>Actions</th></tr></thead>
                                        <tbody>
                                            {selectedFactory?.factoryWarehouses?.map(w => (
                                                <tr key={w.id}>
                                                    <td>{w.name}</td><td>{w.code}</td>
                                                    <td>{w.total_capacity} {w.capacity_unit}</td>
                                                    <td>{w.is_active ? 'Yes' : 'No'}</td>
                                                    <td>
                                                        <button className="btn btn-info btn-xxs sharp me-1" title="Manage Details" onClick={() => { setSelectedWarehouse(w); loadWarehouseDetails(w.id); setShowWarehouseDetailsModal(true); }}><i className="fa fa-list"></i></button>
                                                        <button className="btn btn-primary btn-xxs sharp me-1" onClick={() => { setEditItemId(w.id); setWarehouseForm(w); setShowWarehouseModal(true); }}><i className="fa fa-edit"></i></button>
                                                        <button className="btn btn-danger btn-xxs sharp" onClick={() => handleDelete('warehouse', w.id)}><i className="fa fa-trash"></i></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Tab.Pane>
                        </Tab.Content>
                    </Tab.Container>
                </Modal.Body>
                <Modal.Footer><Button variant="secondary" onClick={() => setShowFactoryDetailsModal(false)}>Close</Button></Modal.Footer>
            </Modal>

            {/* FACTORY ADDRESS MODAL */}
            <Modal show={showFactoryAddressModal} onHide={() => setShowFactoryAddressModal(false)}>
                <Modal.Header closeButton><Modal.Title>{editItemId ? 'Edit' : 'Add'} Factory Address</Modal.Title></Modal.Header>
                <form onSubmit={handleFactoryAddressSubmit}>
                    <Modal.Body>
                        <div className="mb-3"><label>Address Line 1 <span className="text-danger">*</span></label><input type="text" className="form-control" required value={factoryAddressForm.address_line_1} onChange={e => setFactoryAddressForm({ ...factoryAddressForm, address_line_1: e.target.value })} /></div>
                        <div className="mb-3"><label>Line 2 <span className="text-danger">*</span></label><input type="text" className="form-control" value={factoryAddressForm.address_line_2} onChange={e => setFactoryAddressForm({ ...factoryAddressForm, address_line_2: e.target.value })} /></div>
                        <div className="row">
                            <div className="col-6 mb-3"><label>City <span className="text-danger">*</span></label><input type="text" className="form-control" required value={factoryAddressForm.city} onChange={e => setFactoryAddressForm({ ...factoryAddressForm, city: e.target.value })} /></div>
                            <div className="col-6 mb-3"><label>State <span className="text-danger">*</span></label><input type="text" className="form-control" required value={factoryAddressForm.state} onChange={e => setFactoryAddressForm({ ...factoryAddressForm, state: e.target.value })} /></div>
                            <div className="col-6 mb-3"><label>Pincode <span className="text-danger">*</span></label><input type="text" className="form-control" required value={factoryAddressForm.pincode} onChange={e => setFactoryAddressForm({ ...factoryAddressForm, pincode: e.target.value })} /></div>
                            <div className="col-6 mb-3"><label>Country <span className="text-danger">*</span></label><input type="text" className="form-control" required value={factoryAddressForm.country} onChange={e => setFactoryAddressForm({ ...factoryAddressForm, country: e.target.value })} /></div>
                        </div>
                        <div className="form-check custom-checkbox"><input type="checkbox" className="form-check-input" checked={factoryAddressForm.is_default} onChange={e => setFactoryAddressForm({ ...factoryAddressForm, is_default: e.target.checked })} id="fact-def-addr" /> <label className="form-check-label" htmlFor="fact-def-addr">Set as Default <span className="text-danger">*</span></label></div>
                    </Modal.Body>
                    <Modal.Footer><Button variant="secondary" onClick={() => setShowFactoryAddressModal(false)}>Close</Button><Button variant="primary" type="submit">Save</Button></Modal.Footer>
                </form>
            </Modal>

            {/* FACTORY CONTACT MODAL */}
            <Modal show={showFactoryContactModal} onHide={() => setShowFactoryContactModal(false)}>
                <Modal.Header closeButton><Modal.Title>{editItemId ? 'Edit' : 'Add'} Factory Contact</Modal.Title></Modal.Header>
                <form onSubmit={handleFactoryContactSubmit}>
                    <Modal.Body>
                        <div className="mb-3"><label>Manager Name <span className="text-danger">*</span></label><input type="text" className="form-control" required value={factoryContactForm.manager_name} onChange={e => setFactoryContactForm({ ...factoryContactForm, manager_name: e.target.value })} /></div>
                        <div className="mb-3"><label>Email <span className="text-danger">*</span></label><input type="email" className="form-control" required value={factoryContactForm.email} onChange={e => setFactoryContactForm({ ...factoryContactForm, email: e.target.value })} /></div>
                        <div className="mb-3"><label>Phone <span className="text-danger">*</span></label><input type="text" className="form-control" required value={factoryContactForm.phone} onChange={e => setFactoryContactForm({ ...factoryContactForm, phone: e.target.value })} /></div>
                        <div className="form-check custom-checkbox"><input type="checkbox" className="form-check-input" checked={factoryContactForm.is_primary} onChange={e => setFactoryContactForm({ ...factoryContactForm, is_primary: e.target.checked })} id="fact-pri-con" /> <label className="form-check-label" htmlFor="fact-pri-con">Set as Primary <span className="text-danger">*</span></label></div>
                    </Modal.Body>
                    <Modal.Footer><Button variant="secondary" onClick={() => setShowFactoryContactModal(false)}>Close</Button><Button variant="primary" type="submit">Save</Button></Modal.Footer>
                </form>
            </Modal>

            {/* WAREHOUSE FORM MODAL */}
            <Modal show={showWarehouseModal} onHide={() => setShowWarehouseModal(false)} dialogClassName="warehouse-custom-modal" centered>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle form-icon-circle">
                            <i className="fa fa-cubes text-white fs-4"></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editItemId ? 'Edit Warehouse' : 'Add Warehouse'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Manage warehouse storage units and overall capacity
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowWarehouseModal(false)}>&times;</button>
                </div>
                <Form onSubmit={handleWarehouseSubmit} onKeyDown={handleWarehouseKeyDown}>
                    <div className="modal-body-custom">
                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Name  <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    required
                                    placeholder="e.g., Central Depot"
                                    value={warehouseForm.name}
                                    onChange={e => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                                    autoFocus
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Warehouse Code  <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    required
                                    placeholder="e.g., WH01"
                                    value={warehouseForm.code}
                                    onChange={e => setWarehouseForm({ ...warehouseForm, code: e.target.value })}
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Total Capacity  <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="number"
                                    className="form-control-custom"
                                    required
                                    placeholder="e.g., 5000"
                                    value={warehouseForm.total_capacity}
                                    onChange={e => setWarehouseForm({ ...warehouseForm, total_capacity: e.target.value })}
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Unit  <span className="text-danger">*</span></Form.Label>
                                <select className="form-control-custom" value={warehouseForm.capacity_unit} onChange={e => setWarehouseForm({ ...warehouseForm, capacity_unit: e.target.value })}>
                                    <option value="kg">Kilograms (kg)</option>
                                    <option value="ton">Tons</option>
                                    <option value="litre">Litres</option>
                                    <option value="m3">Cubic Meter (m³)</option>
                                    <option value="units">Units</option>
                                </select>
                            </div>
                            <div className="col-md-12 mb-3 d-flex gap-4">
                                <Form.Check
                                    type="checkbox"
                                    id="act-warehouse-check"
                                    label="Set as Active"
                                    checked={!!warehouseForm.is_active}
                                    onChange={e => setWarehouseForm({ ...warehouseForm, is_active: e.target.checked })}
                                    className="form-check-input-custom"
                                />
                                <Form.Check
                                    type="checkbox"
                                    id="default-warehouse-check"
                                    label="Set as Default"
                                    checked={!!warehouseForm.is_default}
                                    onChange={e => setWarehouseForm({ ...warehouseForm, is_default: e.target.checked })}
                                    className="form-check-input-custom"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={() => setShowWarehouseModal(false)}>Cancel</Button>
                        <Button type="submit" className="btn-save-custom">{editItemId ? 'Save Changes' : 'Save'}</Button>
                    </div>
                </Form>
            </Modal>

            {/* WAREHOUSE DETAILS MODAL */}
            <Modal show={showWarehouseDetailsModal} onHide={() => setShowWarehouseDetailsModal(false)} size="lg">
                <Modal.Header closeButton><Modal.Title>Warehouse Details: {selectedWarehouse?.name}</Modal.Title></Modal.Header>
                <Modal.Body>
                    <Tab.Container defaultActiveKey={selectedWarehouse && !selectedWarehouse.branch && !selectedWarehouse.factory ? 'wh-addresses' : 'wh-contacts'}>
                        <Nav className="nav nav-pills mb-3">
                            {selectedWarehouse && !selectedWarehouse.branch && !selectedWarehouse.factory && (
                                <Nav.Item><Nav.Link eventKey="wh-addresses">Address</Nav.Link></Nav.Item>
                            )}
                            <Nav.Item><Nav.Link eventKey="wh-contacts">Contacts</Nav.Link></Nav.Item>
                        </Nav>
                        <Tab.Content>
                            {selectedWarehouse && !selectedWarehouse.branch && !selectedWarehouse.factory && (
                                <Tab.Pane eventKey="wh-addresses">
                                    {warehouseAddresses.length === 0 ? (
                                        <Button variant="primary" size="sm" className="mb-3" onClick={() => { setEditItemId(null); setWarehouseAddressForm({ address_line_1: '', address_line_2: '', city: '', state: '', country: formData.country, pincode: '' }); setShowWarehouseAddressModal(true); }}>+ Add Address</Button>
                                    ) : null}
                                    <div className="table-responsive">
                                        <table className="table table-sm">
                                            <thead><tr><th>Address</th><th>City</th><th>Actions</th></tr></thead>
                                            <tbody>
                                                {warehouseAddresses.map(a => (
                                                    <tr key={a.id}>
                                                        <td>{a.address_line_1}</td><td>{a.city}, {a.state}</td>
                                                        <td>
                                                            <button className="btn btn-primary btn-xxs sharp me-1" onClick={() => { setEditItemId(a.id); setWarehouseAddressForm(a); setShowWarehouseAddressModal(true); }}><i className="fa fa-edit"></i></button>
                                                            <button className="btn btn-danger btn-xxs sharp" onClick={() => handleDelete('warehouseAddress', a.id)}><i className="fa fa-trash"></i></button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Tab.Pane>
                            )}
                            <Tab.Pane eventKey="wh-contacts">
                                <Button variant="primary" size="sm" className="mb-3" onClick={() => { setEditItemId(null); setWarehouseContactForm({ email: '', phone: '', contact_person: '', is_primary: true }); setShowWarehouseContactModal(true); }}>+ Add Contact</Button>
                                <div className="table-responsive">
                                    <table className="table table-sm">
                                        <thead><tr><th>Contact Person</th><th>Email</th><th>Phone</th><th>Primary</th><th>Actions</th></tr></thead>
                                        <tbody>
                                            {warehouseContacts.map(c => (
                                                <tr key={c.id}>
                                                    <td>{c.contact_person}</td><td>{c.email}</td><td>{c.phone}</td>
                                                    <td>{c.is_primary ? 'Yes' : 'No'}</td>
                                                    <td>
                                                        <button className="btn btn-primary btn-xxs sharp me-1" onClick={() => { setEditItemId(c.id); setWarehouseContactForm(c); setShowWarehouseContactModal(true); }}><i className="fa fa-edit"></i></button>
                                                        <button className="btn btn-danger btn-xxs sharp" onClick={() => handleDelete('warehouseContact', c.id)}><i className="fa fa-trash"></i></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Tab.Pane>
                        </Tab.Content>
                    </Tab.Container>
                </Modal.Body>
                <Modal.Footer><Button variant="secondary" onClick={() => setShowWarehouseDetailsModal(false)}>Close</Button></Modal.Footer>
            </Modal>

            {/* WAREHOUSE ADDRESS MODAL */}
            <Modal show={showWarehouseAddressModal} onHide={() => setShowWarehouseAddressModal(false)}>
                <Modal.Header closeButton><Modal.Title>{editItemId ? 'Edit' : 'Add'} Warehouse Address</Modal.Title></Modal.Header>
                <form onSubmit={handleWarehouseAddressSubmit}>
                    <Modal.Body>
                        <div className="mb-3"><label>Address Line 1 <span className="text-danger">*</span></label><input type="text" className="form-control" required value={warehouseAddressForm.address_line_1} onChange={e => setWarehouseAddressForm({ ...warehouseAddressForm, address_line_1: e.target.value })} /></div>
                        <div className="mb-3"><label>Line 2 <span className="text-danger">*</span></label><input type="text" className="form-control" value={warehouseAddressForm.address_line_2} onChange={e => setWarehouseAddressForm({ ...warehouseAddressForm, address_line_2: e.target.value })} /></div>
                        <div className="row">
                            <div className="col-6 mb-3"><label>City <span className="text-danger">*</span></label><input type="text" className="form-control" required value={warehouseAddressForm.city} onChange={e => setWarehouseAddressForm({ ...warehouseAddressForm, city: e.target.value })} /></div>
                            <div className="col-6 mb-3"><label>State <span className="text-danger">*</span></label><input type="text" className="form-control" required value={warehouseAddressForm.state} onChange={e => setWarehouseAddressForm({ ...warehouseAddressForm, state: e.target.value })} /></div>
                            <div className="col-6 mb-3"><label>Pincode <span className="text-danger">*</span></label><input type="text" className="form-control" required value={warehouseAddressForm.pincode} onChange={e => setWarehouseAddressForm({ ...warehouseAddressForm, pincode: e.target.value })} /></div>
                            <div className="col-6 mb-3"><label>Country <span className="text-danger">*</span></label><input type="text" className="form-control" required value={warehouseAddressForm.country} onChange={e => setWarehouseAddressForm({ ...warehouseAddressForm, country: e.target.value })} /></div>
                        </div>
                    </Modal.Body>
                    <Modal.Footer><Button variant="secondary" onClick={() => setShowWarehouseAddressModal(false)}>Close</Button><Button variant="primary" type="submit">Save</Button></Modal.Footer>
                </form>
            </Modal>

            {/* WAREHOUSE CONTACT MODAL */}
            <Modal show={showWarehouseContactModal} onHide={() => setShowWarehouseContactModal(false)}>
                <Modal.Header closeButton><Modal.Title>{editItemId ? 'Edit' : 'Add'} Warehouse Contact</Modal.Title></Modal.Header>
                <form onSubmit={handleWarehouseContactSubmit}>
                    <Modal.Body>
                        <div className="mb-3"><label>Contact Person <span className="text-danger">*</span></label><input type="text" className="form-control" value={warehouseContactForm.contact_person} onChange={e => setWarehouseContactForm({ ...warehouseContactForm, contact_person: e.target.value })} /></div>
                        <div className="mb-3"><label>Email <span className="text-danger">*</span></label><input type="email" className="form-control" value={warehouseContactForm.email} onChange={e => setWarehouseContactForm({ ...warehouseContactForm, email: e.target.value })} /></div>
                        <div className="mb-3"><label>Phone <span className="text-danger">*</span></label><input type="text" className="form-control" value={warehouseContactForm.phone} onChange={e => setWarehouseContactForm({ ...warehouseContactForm, phone: e.target.value })} /></div>
                        <div className="form-check custom-checkbox"><input type="checkbox" className="form-check-input" checked={warehouseContactForm.is_primary} onChange={e => setWarehouseContactForm({ ...warehouseContactForm, is_primary: e.target.checked })} id="wh-pri-con" /> <label className="form-check-label" htmlFor="wh-pri-con">Set as Primary <span className="text-danger">*</span></label></div>
                    </Modal.Body>
                    <Modal.Footer><Button variant="secondary" onClick={() => setShowWarehouseContactModal(false)}>Close</Button><Button variant="primary" type="submit">Save</Button></Modal.Footer>
                </form>
            </Modal>

            {/* COMPANY LICENSE MASTER MODAL */}
            <Modal show={showLicenseModal} onHide={() => setShowLicenseModal(false)} dialogClassName="branch-custom-modal" centered size="lg">
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle" style={{ backgroundColor: '#6c5ce7', width: '45px', height: '45px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <i className="fa fa-id-card text-white fs-4"></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editItemId ? 'Edit License' : 'Add License'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Define license name and validity alert threshold
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowLicenseModal(false)}>&times;</button>
                </div>
                <Form onSubmit={handleLicenseSubmit}>
                    <div className="modal-body-custom">
                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Name  <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    required
                                    placeholder="E.G., FSSAI License, Trade License"
                                    value={licenseForm.license_name}
                                    onChange={e => setLicenseForm({ ...licenseForm, license_name: e.target.value })}
                                    autoFocus
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Validity (Months)  <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="number"
                                    min="1"
                                    max="60"
                                    className="form-control-custom"
                                    required
                                    placeholder="E.G., 3"
                                    value={licenseForm.months_to_expiry || 3}
                                    onChange={e => setLicenseForm({ ...licenseForm, months_to_expiry: parseInt(e.target.value) || 1 })}
                                />
                            </div>
                            <div className="col-md-12 mb-3">
                                <Form.Check
                                    type="checkbox"
                                    id="lic-active-check"
                                    label="Set as Active"
                                    checked={licenseForm.status === 'Active'}
                                    onChange={e => setLicenseForm({ ...licenseForm, status: e.target.checked ? 'Active' : 'Inactive' })}
                                    className="form-check-input-custom"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={() => setShowLicenseModal(false)}>Cancel</Button>
                        <Button type="submit" className="btn-save-custom">{editItemId ? 'Save Changes' : 'Save'}</Button>
                    </div>
                </Form>
            </Modal>
        </div >
    );
};

export default ManageCompany;
