import React, { useState, useEffect, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Modal, Button, Tab, Nav, Form, Badge } from 'react-bootstrap';
import Swal from 'sweetalert2';
import CreateButton from '../../components/permissions/CreateButton';
import EditButton from '../../components/permissions/EditButton';
import DeleteButton from '../../components/permissions/DeleteButton';
import {
    fetchBranchById,
    fetchBranchAddresses,
    createBranchAddress,
    updateBranchAddress,
    deleteBranchAddress,
    fetchBranchContacts,
    createBranchContact,
    updateBranchContact,
    deleteBranchContact,
    fetchBranchBankAccounts,
    createBranchBankAccount,
    updateBranchBankAccount,
    deleteBranchBankAccount,
    fetchFactories,
    createFactory,
    updateFactory,
    deleteFactory,
    fetchWarehouses,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
    updateBranchDepartments,
    formatCompanyError
} from '../../services/CompanyService';
import { getDepartments } from '../../services/HRManagementService';
import { commonTimezones } from '../../utils/timezones';

const styles = {
    breadcrumbItem: {
        fontSize: '16px',
        color: '#888',
    },
    activeBreadcrumb: {
        fontSize: '16px',
        color: '#58d68d',
        fontWeight: '500'
    },
    cardTitle: {
        fontSize: '28px',
        fontWeight: '700',
        color: '#333',
        marginBottom: '30px',
        letterSpacing: '-0.5px'
    },
    formLabel: {
        fontSize: '15px',
        color: '#666',
        fontWeight: '500',
        marginBottom: '8px'
    },
    formInput: {
        backgroundColor: '#f8f9fa',
        border: '1px solid #eee',
        borderRadius: '8px',
        height: '50px',
        fontSize: '16px'
    },
    navLink: {
        color: '#58d68d',
        fontSize: '17px',
        fontWeight: '500',
        border: 'none',
        background: 'none',
        padding: '10px 20px',
        marginRight: '10px'
    },
    activeNavLink: {
        backgroundColor: '#f0fdf9',
        borderRadius: '8px',
        color: '#58d68d'
    }
};

const BranchDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [branch, setBranch] = useState(null);
    const [loading, setLoading] = useState(true);
    const [allDepartments, setAllDepartments] = useState([]);
    const [selectedBranchDepts, setSelectedBranchDepts] = useState([]);
    const [branchAddresses, setBranchAddresses] = useState([]);
    const [branchContacts, setBranchContacts] = useState([]);
    const [branchBankAccounts, setBranchBankAccounts] = useState([]);
    const [branchFactories, setBranchFactories] = useState([]);
    const [branchWarehouses, setBranchWarehouses] = useState([]);

    // Master License list (choices for the dropdown)
    const [masterLicenses] = useState([
        { id: 1, license_name: 'GSTIN Registration', months_to_expiry: 3, status: 'Active' },
        { id: 2, license_name: 'FSSAI License', months_to_expiry: 6, status: 'Active' },
        { id: 3, license_name: 'Trade License', months_to_expiry: 1, status: 'Active' },
        { id: 4, license_name: 'Import Export Code (IEC)', months_to_expiry: 12, status: 'Active' },
        { id: 5, license_name: 'Drug License', months_to_expiry: 2, status: 'Active' },
        { id: 6, license_name: 'Factory License', months_to_expiry: 3, status: 'Active' }
    ]);

    // Branch Licenses list
    const [branchLicenses, setBranchLicenses] = useState([
        { id: 1, master_license_id: 1, license_name: 'GSTIN Registration', license_no: '32ABCDE1234F1Z5', issue_date: '2024-01-01', expiry_date: '2024-04-01', is_active: true },
        { id: 2, master_license_id: 2, license_name: 'FSSAI License', license_no: '10020042001234', issue_date: '2024-01-01', expiry_date: '2024-07-01', is_active: true }
    ]);

    const [licenseSearchTerm, setLicenseSearchTerm] = useState('');
    const [showLicenseModal, setShowLicenseModal] = useState(false);
    const [licenseRows, setLicenseRows] = useState([
        {
            master_license_id: 1,
            license_name: 'GSTIN Registration',
            license_no: '',
            issue_date: '',
            expiry_date: '',
            is_active: true
        }
    ]);

    // Helper to calculate Expiry Date from Issue Date + Validity Months
    const calculateExpiryDate = (issueDateStr, months) => {
        if (!issueDateStr || !months) return '';
        const d = new Date(issueDateStr);
        if (isNaN(d.getTime())) return '';
        d.setMonth(d.getMonth() + parseInt(months));
        return d.toISOString().split('T')[0];
    };

    const handleAddLicenseRow = () => {
        const defaultMaster = masterLicenses[0] || { id: 1, license_name: 'GSTIN Registration' };
        setLicenseRows(prev => [
            ...prev,
            {
                master_license_id: defaultMaster.id,
                license_name: defaultMaster.license_name,
                license_no: '',
                issue_date: '',
                expiry_date: '',
                is_active: true
            }
        ]);
    };

    const handleRemoveLicenseRow = (index) => {
        if (licenseRows.length <= 1) return;
        setLicenseRows(prev => prev.filter((_, i) => i !== index));
    };

    const handleRowChange = (index, field, value) => {
        setLicenseRows(prev => {
            const updated = [...prev];
            const currentRow = { ...updated[index], [field]: value };

            if (field === 'master_license_id') {
                const selected = masterLicenses.find(m => String(m.id) === String(value));
                if (selected) {
                    currentRow.master_license_id = selected.id;
                    currentRow.license_name = selected.license_name;
                    if (currentRow.issue_date) {
                        currentRow.expiry_date = calculateExpiryDate(currentRow.issue_date, selected.months_to_expiry);
                    }
                }
            } else if (field === 'issue_date') {
                const selected = masterLicenses.find(m => String(m.id) === String(currentRow.master_license_id));
                if (selected && value) {
                    currentRow.expiry_date = calculateExpiryDate(value, selected.months_to_expiry);
                }
            }

            updated[index] = currentRow;
            return updated;
        });
    };

    const handleBranchLicenseSubmit = (e) => {
        e.preventDefault();

        for (let i = 0; i < licenseRows.length; i++) {
            const row = licenseRows[i];
            if (!row.master_license_id || !row.license_no || !row.issue_date) {
                Swal.fire('Error', `Please fill in all required fields (License, Number, Issue Date) for row #${i + 1}`, 'error');
                return;
            }
        }

        if (editItemId) {
            setBranchLicenses(prev => prev.map(item => item.id === editItemId ? { ...licenseRows[0], id: editItemId } : item));
            Swal.fire({ title: 'Updated!', text: 'Branch license updated successfully.', icon: 'success', timer: 1500, showConfirmButton: false });
        } else {
            const newItems = licenseRows.map((row, index) => ({ ...row, id: Date.now() + index }));
            setBranchLicenses(prev => [...newItems, ...prev]);
            Swal.fire({ title: 'Added!', text: `${newItems.length} Branch license(s) added successfully.`, icon: 'success', timer: 1500, showConfirmButton: false });
        }
        setShowLicenseModal(false);
    };

    const handleDeleteBranchLicense = (licId) => {
        Swal.fire({
            title: 'Are you sure?',
            text: "Do you want to delete this license from this branch?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        }).then((result) => {
            if (result.isConfirmed) {
                setBranchLicenses(prev => prev.filter(l => l.id !== licId));
                Swal.fire('Deleted!', 'Branch license deleted.', 'success');
            }
        });
    };

    // Sub-item Form States (reused from ManageCompany)
    const [showAddressModal, setShowAddressModal] = useState(false);
    const [showContactModal, setShowContactModal] = useState(false);
    const [showBankModal, setShowBankModal] = useState(false);
    const [showFactoryModal, setShowFactoryModal] = useState(false);
    const [showWarehouseModal, setShowWarehouseModal] = useState(false);
    const [editItemId, setEditItemId] = useState(null);

    const handleFormKeyDown = (modalSelector) => (e) => {
        if (e.key !== 'Enter') return;
        const target = e.target;
        if (target.tagName === 'TEXTAREA' || target.type === 'submit') return;

        const focusableElements = Array.from(
            document.querySelectorAll(`${modalSelector} .form-control-custom, ${modalSelector} input[type="checkbox"]:not([disabled]), ${modalSelector} select:not([disabled]), ${modalSelector} button[type="submit"]:not([disabled])`)
        ).filter(el => el.offsetParent !== null && !el.disabled);

        const index = focusableElements.indexOf(target);
        if (index > -1 && index < focusableElements.length - 1) {
            e.preventDefault();
            const next = focusableElements[index + 1];
            next.focus();
            if (next.tagName === 'SELECT' && typeof next.showPicker === 'function') {
                try { next.showPicker(); } catch (err) { }
            }
        }
    };

    const [addressForm, setAddressForm] = useState({
        address_line_1: '',
        address_line_2: '',
        city: '',
        state: '',
        country: '',
        pincode: '',
        is_default: true
    });

    const [contactForm, setContactForm] = useState({
        email: '',
        phone: '',
        mobile: '',
        is_primary: true
    });

    const [bankForm, setBankForm] = useState({
        bank_name: '',
        branch_name: '',
        account_holder_name: '',
        account_number: '',
        ifsc_code: '',
        swift_code: '',
        is_primary: false
    });

    const [factoryForm, setFactoryForm] = useState({
        name: '',
        factory_code: '',
        license_number: '',
        timezone: 'Asia/Kolkata',
        is_active: true,
        branch: null
    });

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

    useEffect(() => {
        if (id) {
            loadAllData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const loadAllData = async () => {
        try {
            setLoading(true);
            const [branchRes, deptRes] = await Promise.all([
                fetchBranchById(id),
                getDepartments()
            ]);
            setBranch(branchRes.data);
            setAllDepartments(deptRes);

            // Set initial departments
            const branchDepts = deptRes.filter(d => d.branches?.includes(parseInt(id))).map(d => d.id);
            setSelectedBranchDepts(branchDepts);

            await loadRelatedData();
        } catch (error) {
            console.error('Failed to load data:', error);
            Swal.fire('Error', 'Failed to load branch details', 'error');
        } finally {
            setLoading(false);
        }
    };

    const customStyles = `
        .factory-hero-card {
            background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
            border: 1px solid #e2e8f0;
            margin-bottom: 24px;
            position: relative;
        }
        .factory-icon-badge {
            width: 56px;
            height: 56px;
            border-radius: 12px;
            background: linear-gradient(135deg, #7A70BA 0%, #58d68d 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 16px rgba(122, 112, 186, 0.2);
        }
        .stat-metric-card {
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 16px;
            display: flex;
            align-items: center;
            gap: 16px;
            transition: all 0.2s ease;
            height: 100%;
        }
        .stat-metric-card:hover {
            box-shadow: 0 8px 16px rgba(0,0,0,0.04);
            transform: translateY(-2px);
        }
        .stat-icon-circle {
            width: 42px;
            height: 42px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
        }
        .info-property-card {
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 16px;
            height: 100%;
        }
        .info-property-label {
            font-size: 11px;
            font-weight: 700;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .info-property-value {
            font-size: 15px;
            font-weight: 600;
            color: #334155;
            word-break: break-word;
        }
        [data-theme-version="dark"] .factory-hero-card {
            background: linear-gradient(135deg, #24292D 0%, #1e2630 100%) !important;
            border-color: #3d464e !important;
        }
        [data-theme-version="dark"] .stat-metric-card,
        [data-theme-version="dark"] .info-property-card {
            background-color: #24292D !important;
            border-color: #3d464e !important;
        }
        [data-theme-version="dark"] .info-property-value {
            color: #f1f5f9 !important;
        }
        .nav-tabs {
            border-bottom: none !important;
            gap: 4px;
            margin-bottom: 24px !important;
        }
        .custom-tab-link {
            border: none !important;
            background: transparent !important;
            color: #64748b !important;
            font-weight: 600 !important;
            padding: 12px 16px !important;
            font-size: 14px !important;
            border-bottom: 3px solid transparent !important;
            border-radius: 0 !important;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .custom-tab-link:hover { color: #7A70BA !important; background-color: #f8fafc !important; }
        .custom-tab-link.active {
            color: #7A70BA !important;
            border-bottom-color: #7A70BA !important;
            background-color: transparent !important;
            box-shadow: none !important;
        }
        [data-theme-version="dark"] .custom-tab-link { color: #94a3b8 !important; }
        [data-theme-version="dark"] .custom-tab-link.active {
            color: #c4b5fd !important;
            background-color: #24292D !important;
            border-bottom-color: #7A70BA !important;
        }
        .btn-primary-custom {
            background-color: #58d68d !important;
            border-color: #58d68d !important;
            color: white !important;
            border-radius: 8px !important;
            font-weight: 600 !important;
            font-size: 15px !important;
            padding: 10px 24px !important;
        }
        .btn-primary-custom:hover {
            background-color: #4ec08d !important;
            border-color: #4ec08d !important;
        }
        .table-custom thead th {
            background-color: #fcfdfe !important;
            color: #777 !important;
            font-weight: 700 !important;
            text-transform: uppercase !important;
            font-size: 13px !important;
            border-top: none !important;
            border-bottom: 2px solid #f0f0f0 !important;
            padding: 15px 12px !important;
            letter-spacing: 1px !important;
        }
        .table-custom tbody td {
            vertical-align: middle !important;
            font-size: 16px !important;
            padding: 20px 10px !important;
            border-bottom: 1px solid #f8f9fa !important;
            color: #444 !important;
        }
        .badge-primary-custom {
            background-color: #58d68d !important;
            color: #fff !important;
            font-weight: 600 !important;
            font-size: 14px !important;
            padding: 6px 16px !important;
            border-radius: 8px !important;
        }
        label {
            font-size: 15px !important;
            font-weight: 500 !important;
            font-weight: 600 !important;
            color: #555 !important;
            margin-bottom: 10px !important;
            display: block !important;
        }
        .form-control {
            font-size: 16px !important;
            padding: 12px 15px !important;
            border-radius: 8px !important;
            border: 1px solid #eee !important;
        }
        .form-control[readonly] {
            background-color: #fcfdfe !important;
            border: 1px solid #eef2f5 !important;
            border-radius: 10px !important;
            height: 48px !important;
            font-size: 15px !important;
            color: #333 !important;
            padding: 0 15px !important;
        }
        .action-btn {
            width: 35px !important;
            height: 35px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            border-radius: 8px !important;
            margin-right: 5px !important;
            border: none !important;
            color: #fff !important;
            font-size: 14px !important;
            transition: all 0.2s ease;
        }
        .btn-view { background-color: #3498db !important; box-shadow: 0 4px 6px rgba(52, 152, 219, 0.2); }
        .btn-edit { background-color: #58d68d !important; box-shadow: 0 4px 6px rgba(88, 214, 141, 0.2); }
        .btn-delete { background-color: #e74c3c !important; box-shadow: 0 4px 6px rgba(231, 76, 60, 0.2); }
        .action-btn:hover { transform: translateY(-2px); opacity: 0.9; }

        /* Custom Modals matching ManageCompany */
        .modal-content {
            border-radius: 16px !important;
            border: none !important;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
            overflow: hidden;
        }
        .modal-header-custom {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 24px 28px 16px 28px;
            border-bottom: 1px solid #f1f5f9;
        }
        .modal-icon-circle {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .addr-custom-modal .modal-icon-circle {
            background-color: #3b82f6;
            box-shadow: 0 4px 10px rgba(59,130,246,0.25);
        }
        .contact-custom-modal .modal-icon-circle {
            background-color: #10b981;
            box-shadow: 0 4px 10px rgba(16,185,129,0.25);
        }
        .bank-custom-modal .modal-icon-circle {
            background-color: #f59e0b;
            box-shadow: 0 4px 10px rgba(245,158,11,0.25);
        }
        .factory-custom-modal .modal-icon-circle {
            background-color: #f97316;
            box-shadow: 0 4px 10px rgba(249,115,22,0.25);
        }
        .warehouse-custom-modal .modal-icon-circle {
            background-color: #8b5cf6;
            box-shadow: 0 4px 10px rgba(139,92,246,0.25);
        }
        .modal-close-x {
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
        .modal-close-x:hover { color: #555; }
        .modal-body-custom {
            padding: 28px;
            max-height: 70vh;
            overflow-y: auto;
        }
        .modal-footer-custom {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            padding: 20px 28px 24px 28px;
            border-top: 1px solid #f1f5f9;
            background-color: #fafbfc;
            gap: 12px;
        }
        .form-label-custom {
            font-size: 13px;
            font-weight: 500;
            color: #4a5568;
            margin-bottom: 6px;
            display: block;
        }
        .form-control-custom {
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            padding: 10px 14px;
            font-size: 13px;
            color: #334155;
            background-color: #fff;
            transition: border-color 0.2s, box-shadow 0.2s;
            width: 100%;
        }
        .form-control-custom:focus {
            outline: none;
            border-color: #2ece8a;
            box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
        }
        .form-control-custom::placeholder { color: #94a3b8; }
        
        .btn-close-custom {
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
        .btn-close-custom:hover { background-color: #6357a7 !important; }
        
        .btn-save-custom {
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
        .btn-save-custom:hover { background-color: #26b277 !important; }

        /* ===== DARK MODE SUPPORT ===== */
        [data-theme-version="dark"] .modal-content {
            background-color: #2F363E !important;
            color: #f1f5f9 !important;
            border-color: #3d464e !important;
        }
        [data-theme-version="dark"] .modal-header-custom {
            border-bottom: 1px solid #3d464e !important;
            background-color: transparent !important;
        }
        [data-theme-version="dark"] .modal-header-custom .modal-title,
        [data-theme-version="dark"] .modal-title { color: #fff !important; }
        [data-theme-version="dark"] .modal-header-custom p.text-muted,
        [data-theme-version="dark"] .modal-header p.text-muted { color: #94a3b8 !important; }
        [data-theme-version="dark"] .modal-body-custom {
            background-color: #2F363E !important;
            color: #f1f5f9 !important;
        }
        [data-theme-version="dark"] .modal-footer-custom {
            background-color: #24292D !important;
            border-top: 1px solid #3d464e !important;
        }
        [data-theme-version="dark"] .form-label-custom,
        [data-theme-version="dark"] .modal-body-custom label { color: #cbd5e1 !important; }
        [data-theme-version="dark"] .form-control-custom,
        [data-theme-version="dark"] .modal-body-custom .form-control,
        [data-theme-version="dark"] .modal-body-custom select {
            background-color: #24292D !important;
            border-color: #4a5568 !important;
            color: #fff !important;
        }
        [data-theme-version="dark"] .form-control-custom:focus,
        [data-theme-version="dark"] .modal-body-custom .form-control:focus {
            border-color: #2ece8a !important;
            background-color: #24292D !important;
            color: #fff !important;
        }
        [data-theme-version="dark"] .form-control-custom::placeholder,
        [data-theme-version="dark"] .modal-body-custom .form-control::placeholder { color: #64748b !important; }
        [data-theme-version="dark"] .modal-close-x { color: #94a3b8 !important; }
        [data-theme-version="dark"] .modal-close-x:hover { color: #fff !important; }
        [data-theme-version="dark"] .form-control[readonly] {
            background-color: #24292D !important;
            border-color: #4a5568 !important;
            color: #cbd5e1 !important;
        }

        /* Dept cards */
        .dept-card { background-color: transparent; }
        .dept-card-selected { background-color: #f0fdf9; }
        [data-theme-version="dark"] .dept-card-selected {
            background-color: #1a3a2e !important;
        }
        [data-theme-version="dark"] .dept-card {
            border-color: #3d464e !important;
            color: #f1f5f9 !important;
        }
        [data-theme-version="dark"] .dept-card .form-check-label { color: #f1f5f9 !important; }

        /* License row */
        .license-row-card { background-color: #f8f9fa; }
        [data-theme-version="dark"] .license-row-card {
            background-color: #1e2630 !important;
            border-color: #3d464e !important;
        }

        /* Search input styling matching Menu Management */
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
        [data-theme-version="dark"] .search-input-custom {
            background-color: #24292D !important;
            border-color: #4a5568 !important;
            color: #fff !important;
        }
        [data-theme-version="dark"] .search-input-custom:focus {
            border-color: #2ece8a !important;
            background-color: #24292D !important;
            color: #fff !important;
        }
        [data-theme-version="dark"] .search-input-custom::placeholder {
            color: #64748b !important;
        }
    `;

    const loadRelatedData = async () => {
        try {
            const [addrRes, contactRes, bankRes, factoryRes, whRes] = await Promise.all([
                fetchBranchAddresses(id),
                fetchBranchContacts(id),
                fetchBranchBankAccounts(id),
                fetchFactories({ branch: id }),
                fetchWarehouses({ branch: id })
            ]);
            setBranchAddresses(addrRes.data);
            setBranchContacts(contactRes.data);
            setBranchBankAccounts(bankRes.data);
            setBranchFactories(factoryRes.data);
            setBranchWarehouses(whRes.data);
        } catch (error) {
            console.error('Failed to load related data:', error);
        }
    };

    const handleAddressSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...addressForm, branch: id };
            if (editItemId) await updateBranchAddress(editItemId, payload);
            else await createBranchAddress(payload);
            setShowAddressModal(false);
            loadRelatedData();
        } catch (error) {
            Swal.fire('Error', formatCompanyError(error), 'error');
        }
    };

    const handleContactSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...contactForm, branch: id };
            if (editItemId) await updateBranchContact(editItemId, payload);
            else await createBranchContact(payload);
            setShowContactModal(false);
            loadRelatedData();
        } catch (error) {
            Swal.fire('Error', formatCompanyError(error), 'error');
        }
    };

    const handleBankSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...bankForm, branch: id };
            if (editItemId) await updateBranchBankAccount(editItemId, payload);
            else await createBranchBankAccount(payload);
            setShowBankModal(false);
            loadRelatedData();
        } catch (error) {
            Swal.fire('Error', formatCompanyError(error), 'error');
        }
    };

    const handleFactorySubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...factoryForm, company: branch.company, branch: id };
            if (editItemId) await updateFactory(editItemId, payload);
            else await createFactory(payload);
            setShowFactoryModal(false);
            loadRelatedData();
        } catch (error) {
            Swal.fire('Error', formatCompanyError(error), 'error');
        }
    };

    const handleWarehouseSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...warehouseForm, company: branch.company, branch: id, factory: null };
            if (editItemId) await updateWarehouse(editItemId, payload);
            else await createWarehouse(payload);
            setShowWarehouseModal(false);
            loadRelatedData();
        } catch (error) {
            Swal.fire('Error', formatCompanyError(error), 'error');
        }
    };

    const handleDepartmentsSubmit = async (e) => {
        e.preventDefault();
        try {
            await updateBranchDepartments(id, selectedBranchDepts);
            Swal.fire('Success', 'Departments updated successfully', 'success');
            const deptRes = await getDepartments();
            setAllDepartments(deptRes);
        } catch (error) {
            Swal.fire('Error', formatCompanyError(error), 'error');
        }
    };

    const handleDeptToggle = (deptId) => {
        setSelectedBranchDepts(prev =>
            prev.includes(deptId) ? prev.filter(id => id !== deptId) : [...prev, deptId]
        );
    };

    const handleDelete = async (type, itemId) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                if (type === 'address') await deleteBranchAddress(itemId);
                else if (type === 'contact') await deleteBranchContact(itemId);
                else if (type === 'bank') await deleteBranchBankAccount(itemId);
                else if (type === 'factory') await deleteFactory(itemId);
                else if (type === 'warehouse') await deleteWarehouse(itemId);

                Swal.fire('Deleted!', 'Item has been deleted.', 'success');
                loadRelatedData();
            } catch (error) {
                Swal.fire('Error', 'Failed to delete item', 'error');
            }
        }
    };

    if (loading) return <div className="text-center p-5"><div className="spinner-border text-primary"></div></div>;
    if (!branch) return <div className="text-center p-5"><h4>Branch not found</h4><Button onClick={() => navigate('/company-settings?tab=branches')}>Go Back</Button></div>;

    return (
        <Fragment>
            <style>{customStyles}</style>
            <div className="container-fluid">
                {/* Top Breadcrumb & Actions */}
                <div className="row page-titles mx-0 mb-3">
                    <div className="col-12 p-0 d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <div className="d-flex align-items-center gap-2">
                            <span className="text-muted" style={{ fontSize: '14px' }}>Settings</span>
                            <span className="text-muted">/</span>
                            <span className="text-muted" style={{ fontSize: '14px' }}>Company</span>
                            <span className="text-muted">/</span>
                            <span style={{ fontSize: '14px', color: '#7A70BA', fontWeight: '600' }}>
                                {branch.name}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Hero Overview Banner Card */}
                <div className="factory-hero-card">
                    <div className="row align-items-center g-3">
                        <div className="col-lg-6 col-md-12">
                            <div className="d-flex align-items-center gap-3">
                                <div className="factory-icon-badge">
                                    <i className="fa fa-building text-white" style={{ fontSize: '28px' }}></i>
                                </div>
                                <div>
                                    <div className="d-flex align-items-center gap-2 flex-wrap">
                                        <h3 className="mb-0 font-w700" style={{ fontSize: '22px' }}>
                                            {branch.name}
                                        </h3>
                                    </div>
                                    <div className="d-flex align-items-center gap-3 mt-2 flex-wrap text-muted" style={{ fontSize: '13px' }}>
                                        <span className="d-flex align-items-center gap-1">
                                            <i className="fa fa-barcode text-primary"></i>
                                            <strong>Code:</strong> <code>{branch.branch_code || 'N/A'}</code>
                                        </span>
                                        <span className="d-flex align-items-center gap-1">
                                            <i className="fa fa-globe text-info"></i>
                                            <strong>Timezone:</strong> {branch.timezone || 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Metric summary cards */}
                        <div className="col-lg-6 col-md-12">
                            <div className="row g-2">
                                <div className="col-3">
                                    <div className="stat-metric-card">
                                        <div className="stat-icon-circle" style={{ backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
                                            <i className="fa fa-map-marker-alt"></i>
                                        </div>
                                        <div>
                                            <div className="text-muted" style={{ fontSize: '11px', fontWeight: '600' }}>ADDRESSES</div>
                                            <h5 className="mb-0 font-w700" style={{ fontSize: '18px' }}>{branchAddresses.length}</h5>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-3">
                                    <div className="stat-metric-card">
                                        <div className="stat-icon-circle" style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
                                            <i className="fa fa-users"></i>
                                        </div>
                                        <div>
                                            <div className="text-muted" style={{ fontSize: '11px', fontWeight: '600' }}>CONTACTS</div>
                                            <h5 className="mb-0 font-w700" style={{ fontSize: '18px' }}>{branchContacts.length}</h5>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-3">
                                    <div className="stat-metric-card">
                                        <div className="stat-icon-circle" style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
                                            <i className="fa fa-sitemap"></i>
                                        </div>
                                        <div>
                                            <div className="text-muted" style={{ fontSize: '11px', fontWeight: '600' }}>DEPTS</div>
                                            <h5 className="mb-0 font-w700" style={{ fontSize: '18px' }}>{selectedBranchDepts.length}</h5>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-3">
                                    <div className="stat-metric-card">
                                        <div className="stat-icon-circle" style={{ backgroundColor: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6' }}>
                                            <i className="fa fa-industry"></i>
                                        </div>
                                        <div>
                                            <div className="text-muted" style={{ fontSize: '11px', fontWeight: '600' }}>FACTORIES</div>
                                            <h5 className="mb-0 font-w700" style={{ fontSize: '18px' }}>{branchFactories.length}</h5>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="row">
                    <div className="col-xl-12">
                        <div className="card shadow-sm" style={{ borderRadius: '15px' }}>
                            <div className="card-body">
                                <Tab.Container defaultActiveKey="br-info">
                                    <div className="d-flex justify-content-between align-items-center mb-4" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '2px' }}>
                                        <Nav className="nav nav-tabs border-bottom-0 mb-0">
                                            <Nav.Item>
                                                <Nav.Link eventKey="br-info" className="custom-tab-link"><i className="fa fa-info-circle"></i> Branch Details</Nav.Link>
                                            </Nav.Item>
                                            <Nav.Item>
                                                <Nav.Link eventKey="br-addresses" className="custom-tab-link"><i className="fa fa-map-marker-alt"></i> Addresses <Badge bg="light" text="dark" pill className="ms-1 border">{branchAddresses.length}</Badge></Nav.Link>
                                            </Nav.Item>
                                            <Nav.Item>
                                                <Nav.Link eventKey="br-contacts" className="custom-tab-link"><i className="fa fa-users"></i> Contacts <Badge bg="light" text="dark" pill className="ms-1 border">{branchContacts.length}</Badge></Nav.Link>
                                            </Nav.Item>
                                            <Nav.Item>
                                                <Nav.Link eventKey="br-bank" className="custom-tab-link"><i className="fa fa-university"></i> Bank Details <Badge bg="light" text="dark" pill className="ms-1 border">{branchBankAccounts.length}</Badge></Nav.Link>
                                            </Nav.Item>
                                            <Nav.Item>
                                                <Nav.Link eventKey="br-departments" className="custom-tab-link"><i className="fa fa-sitemap"></i> Departments <Badge bg="light" text="dark" pill className="ms-1 border">{selectedBranchDepts.length}</Badge></Nav.Link>
                                            </Nav.Item>
                                            <Nav.Item>
                                                <Nav.Link eventKey="br-factories" className="custom-tab-link"><i className="fa fa-industry"></i> Factories <Badge bg="light" text="dark" pill className="ms-1 border">{branchFactories.length}</Badge></Nav.Link>
                                            </Nav.Item>
                                            <Nav.Item>
                                                <Nav.Link eventKey="br-warehouses" className="custom-tab-link"><i className="fa fa-warehouse"></i> Warehouses <Badge bg="light" text="dark" pill className="ms-1 border">{branchWarehouses.length}</Badge></Nav.Link>
                                            </Nav.Item>
                                            <Nav.Item>
                                                <Nav.Link eventKey="br-licenses" className="custom-tab-link"><i className="fa fa-id-card"></i> Licenses <Badge bg="light" text="dark" pill className="ms-1 border">{branchLicenses.length}</Badge></Nav.Link>
                                            </Nav.Item>
                                        </Nav>

                                    </div>
                                    <Tab.Content>
                                        <Tab.Pane eventKey="br-info">
                                            <div className="row g-3 mt-2">
                                                <div className="col-md-6 col-lg-4">
                                                    <div className="info-property-card">
                                                        <div className="info-property-label">
                                                            <i className="fa fa-building text-primary"></i> Branch Name
                                                        </div>
                                                        <div className="info-property-value">{branch.name}</div>
                                                    </div>
                                                </div>

                                                <div className="col-md-6 col-lg-4">
                                                    <div className="info-property-card">
                                                        <div className="info-property-label">
                                                            <i className="fa fa-barcode text-primary"></i> Branch Code
                                                        </div>
                                                        <div className="info-property-value">
                                                            <code>{branch.branch_code}</code>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="col-md-6 col-lg-4">
                                                    <div className="info-property-card">
                                                        <div className="info-property-label">
                                                            <i className="fa fa-file-invoice text-warning"></i> GST Number
                                                        </div>
                                                        <div className="info-property-value">{branch.gst_number || 'N/A'}</div>
                                                    </div>
                                                </div>

                                                <div className="col-md-6 col-lg-4">
                                                    <div className="info-property-card">
                                                        <div className="info-property-label">
                                                            <i className="fa fa-globe-americas text-info"></i> Country
                                                        </div>
                                                        <div className="info-property-value">{branch.country || 'N/A'}</div>
                                                    </div>
                                                </div>

                                                <div className="col-md-6 col-lg-4">
                                                    <div className="info-property-card">
                                                        <div className="info-property-label">
                                                            <i className="fa fa-money-bill-wave text-success"></i> Default Currency
                                                        </div>
                                                        <div className="info-property-value">{branch.default_currency_name || (branch.default_currency ? 'Currency Loaded' : 'N/A')}</div>
                                                    </div>
                                                </div>

                                                <div className="col-md-6 col-lg-4">
                                                    <div className="info-property-card">
                                                        <div className="info-property-label">
                                                            <i className="fa fa-clock text-secondary"></i> Operating Timezone
                                                        </div>
                                                        <div className="info-property-value">{branch.timezone || 'UTC'}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </Tab.Pane>

                                        {/* BRANCH LICENSES TAB */}
                                        <Tab.Pane eventKey="br-licenses">
                                            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                                                <div>
                                                    <h5 className="mb-1 font-w600">Branch Licenses</h5>
                                                    <p className="text-muted mb-0" style={{ fontSize: '13px' }}>View and manage active licenses for this branch</p>
                                                </div>
                                                <div className="d-flex gap-2 align-items-center">
                                                    <div style={{ width: '300px', position: 'relative' }}>
                                                        <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                                        <Form.Control
                                                            type="text"
                                                            placeholder="Search licenses..."
                                                            value={licenseSearchTerm}
                                                            onChange={(e) => setLicenseSearchTerm(e.target.value)}
                                                            className="search-input-custom"
                                                            style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                                        />
                                                    </div>
                                                    <CreateButton
                                                        module="company"
                                                        onClick={() => {
                                                            setEditItemId(null);
                                                            setLicenseRows([{
                                                                master_license_id: masterLicenses[0]?.id || 1,
                                                                license_name: masterLicenses[0]?.license_name || 'GSTIN Registration',
                                                                license_no: '',
                                                                issue_date: '',
                                                                expiry_date: '',
                                                                is_active: true
                                                            }]);
                                                            setShowLicenseModal(true);
                                                        }}
                                                    >
                                                        License
                                                    </CreateButton>
                                                </div>
                                            </div>
                                            <div className="table-responsive">
                                                <table className="table table-custom">
                                                    <thead>
                                                        <tr>
                                                            <th>LICENSE NAME</th>
                                                            <th>LICENSE NO</th>
                                                            <th>ISSUE DATE</th>
                                                            <th>EXPIRY DATE</th>
                                                            <th>STATUS</th>
                                                            <th className="text-end">ACTIONS</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {branchLicenses.filter(l => (l.license_name || '').toLowerCase().includes(licenseSearchTerm.toLowerCase()) || (l.license_no || '').toLowerCase().includes(licenseSearchTerm.toLowerCase())).length === 0 ? (
                                                            <tr>
                                                                <td colSpan="6" className="text-center py-4 text-muted">No branch licenses found</td>
                                                            </tr>
                                                        ) : (
                                                            branchLicenses.filter(l => (l.license_name || '').toLowerCase().includes(licenseSearchTerm.toLowerCase()) || (l.license_no || '').toLowerCase().includes(licenseSearchTerm.toLowerCase())).map(l => (
                                                                <tr key={l.id}>
                                                                    <td><span className="fw-bold">{l.license_name}</span></td>
                                                                    <td><code>{l.license_no}</code></td>
                                                                    <td>{l.issue_date || '-'}</td>
                                                                    <td><span className="badge badge-info light px-2">{l.expiry_date || 'N/A'}</span></td>
                                                                    <td>
                                                                        {l.is_active ? (
                                                                            <span className="badge badge-success">Active</span>
                                                                        ) : (
                                                                            <span className="badge badge-danger">Inactive</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="text-end">
                                                                        <div className="d-flex justify-content-end gap-1">
                                                                            <EditButton module="company" onClick={() => { setEditItemId(l.id); setLicenseRows([{ ...l }]); setShowLicenseModal(true); }} />
                                                                            <DeleteButton module="company" onClick={() => handleDeleteBranchLicense(l.id)} />
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </Tab.Pane>
                                        <Tab.Pane eventKey="br-addresses">
                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                <div>
                                                    <h5 className="mb-1 font-w600">Addresses</h5>
                                                    <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Physical and postal locations registered for this branch</p>
                                                </div>
                                                <CreateButton module="company" onClick={() => { setEditItemId(null); setAddressForm({ address_line_1: '', address_line_2: '', city: '', state: '', country: branch.country, pincode: '', is_default: true }); setShowAddressModal(true); }}>Address</CreateButton>
                                            </div>
                                            <div className="table-responsive">
                                                <table className="table table-custom">
                                                    <thead><tr><th>Address</th><th>City/State</th><th>Default</th><th>Actions</th></tr></thead>
                                                    <tbody>
                                                        {branchAddresses.map(a => (
                                                            <tr key={a.id}>
                                                                <td>{a.address_line_1}</td>
                                                                <td>{a.city}, {a.state}</td>
                                                                <td>{a.is_default ? <span className="badge badge-primary-custom">Default</span> : <span className="text-muted">No</span>}</td>
                                                                <td>
                                                                    <div className="d-flex gap-1">
                                                                        <EditButton module="company" onClick={() => { setEditItemId(a.id); setAddressForm(a); setShowAddressModal(true); }} />
                                                                        <DeleteButton module="company" onClick={() => handleDelete('address', a.id)} />
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {branchAddresses.length === 0 && <tr><td colSpan="4" className="text-center text-muted">No addresses added.</td></tr>}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </Tab.Pane>
                                        <Tab.Pane eventKey="br-contacts">
                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                <div>
                                                    <h5 className="mb-1 font-w600">Contacts</h5>
                                                    <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Primary and secondary contact persons for this branch</p>
                                                </div>
                                                <CreateButton module="company" onClick={() => { setEditItemId(null); setContactForm({ email: '', phone: '', mobile: '', is_primary: true }); setShowContactModal(true); }}>Contact</CreateButton>
                                            </div>
                                            <div className="table-responsive">
                                                <table className="table table-custom">
                                                    <thead><tr><th>Email</th><th>Phone/Mobile</th><th>Primary</th><th>Actions</th></tr></thead>
                                                    <tbody>
                                                        {branchContacts.map(c => (
                                                            <tr key={c.id}>
                                                                <td>{c.email}</td>
                                                                <td>{c.phone}{c.mobile ? ` / ${c.mobile}` : ''}</td>
                                                                <td>{c.is_primary ? <span className="badge badge-primary-custom">Primary</span> : <span className="text-muted">No</span>}</td>
                                                                <td>
                                                                    <div className="d-flex gap-1">
                                                                        <EditButton module="company" onClick={() => { setEditItemId(c.id); setContactForm(c); setShowContactModal(true); }} />
                                                                        <DeleteButton module="company" onClick={() => handleDelete('contact', c.id)} />
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {branchContacts.length === 0 && <tr><td colSpan="4" className="text-center text-muted">No contacts added.</td></tr>}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </Tab.Pane>
                                        <Tab.Pane eventKey="br-bank">
                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                <div>
                                                    <h5 className="mb-1 font-w600">Bank Accounts</h5>
                                                    <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Bank accounts associated with this branch</p>
                                                </div>
                                                <CreateButton module="company" onClick={() => { setEditItemId(null); setBankForm({ bank_name: '', branch_name: '', account_holder_name: '', account_number: '', ifsc_code: '', swift_code: '', is_primary: false }); setShowBankModal(true); }}>Bank Account</CreateButton>
                                            </div>
                                            <div className="table-responsive">
                                                <table className="table table-custom">
                                                    <thead><tr><th>Bank Info</th><th>Account Number</th><th>Primary</th><th>Actions</th></tr></thead>
                                                    <tbody>
                                                        {branchBankAccounts.map(b => (
                                                            <tr key={b.id}>
                                                                <td>
                                                                    <div style={{ fontWeight: '500' }}>{b.bank_name}</div>
                                                                    <small className="text-muted">{b.branch_name}</small>
                                                                </td>
                                                                <td>{b.account_number}</td>
                                                                <td>{b.is_primary ? <span className="badge badge-primary-custom">Primary</span> : <span className="text-muted">No</span>}</td>
                                                                <td>
                                                                    <div className="d-flex gap-1">
                                                                        <EditButton module="company" onClick={() => { setEditItemId(b.id); setBankForm(b); setShowBankModal(true); }} />
                                                                        <DeleteButton module="company" onClick={() => handleDelete('bank', b.id)} />
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {branchBankAccounts.length === 0 && <tr><td colSpan="4" className="text-center text-muted">No bank accounts added.</td></tr>}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </Tab.Pane>
                                        <Tab.Pane eventKey="br-departments">
                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                <div>
                                                    <h5 className="mb-1 font-w600">Departments</h5>
                                                    <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Departments operating under this branch</p>
                                                </div>
                                                <Button className="btn-primary-custom" onClick={handleDepartmentsSubmit}>Save Selection</Button>
                                            </div>
                                            <div className="row">
                                                {allDepartments.map(dept => (
                                                    <div key={dept.id} className="col-md-3 mb-3">
                                                        <div className={`form-check custom-checkbox p-3 border rounded h-100 transition-all hover-shadow dept-card${selectedBranchDepts.includes(dept.id) ? ' dept-card-selected' : ''}`} style={{ cursor: 'pointer', borderColor: selectedBranchDepts.includes(dept.id) ? '#58d68d' : '#eee' }} onClick={() => handleDeptToggle(dept.id)}>
                                                            <input
                                                                type="checkbox"
                                                                className="form-check-input"
                                                                id={`dept-${dept.id}`}
                                                                checked={selectedBranchDepts.includes(dept.id)}
                                                                onChange={() => { }}
                                                                style={{ accentColor: '#58d68d' }}
                                                            />
                                                            <label className="form-check-label ms-2" style={{ cursor: 'pointer', fontWeight: selectedBranchDepts.includes(dept.id) ? '600' : '400' }}>
                                                                {dept.name}
                                                            </label>
                                                        </div>
                                                    </div>
                                                ))}
                                                {allDepartments.length === 0 && <div className="col-12 text-center text-muted p-5">No departments found.</div>}
                                            </div>
                                        </Tab.Pane>
                                        <Tab.Pane eventKey="br-factories">
                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                <div>
                                                    <h5 className="mb-1 font-w600">Factories</h5>
                                                    <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Factories associated with this branch</p>
                                                </div>
                                                <CreateButton module="company" onClick={() => { setEditItemId(null); setFactoryForm({ name: '', factory_code: '', license_number: '', timezone: 'Asia/Kolkata', is_active: true, branch: id }); setShowFactoryModal(true); }}>Factory</CreateButton>
                                            </div>
                                            <div className="table-responsive">
                                                <table className="table table-custom">
                                                    <thead><tr><th>Name/Code</th><th>License</th><th>Status</th><th>Actions</th></tr></thead>
                                                    <tbody>
                                                        {branchFactories.map(f => (
                                                            <tr key={f.id}>
                                                                <td>
                                                                    <div style={{ fontWeight: '500' }}>{f.name}</div>
                                                                    <small className="text-muted">{f.factory_code}</small>
                                                                </td>
                                                                <td>{f.license_number || '-'}</td>
                                                                <td>{f.is_active ? <span className="badge badge-primary-custom">Active</span> : <span className="badge badge-light">Inactive</span>}</td>
                                                                <td>
                                                                    <div className="d-flex gap-1">
                                                                        <button className="action-btn btn-view" title="Manage Details" onClick={() => navigate(`/factory-details/${f.id}`)}><i className="fa fa-list"></i></button>
                                                                        <EditButton module="company" onClick={() => { setEditItemId(f.id); setFactoryForm(f); setShowFactoryModal(true); }} />
                                                                        <DeleteButton module="company" onClick={() => handleDelete('factory', f.id)} />
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {branchFactories.length === 0 && <tr><td colSpan="4" className="text-center text-muted">No factories added.</td></tr>}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </Tab.Pane>
                                        <Tab.Pane eventKey="br-warehouses">
                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                <div>
                                                    <h5 className="mb-1 font-w600">Warehouses</h5>
                                                    <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Warehouses associated with this branch</p>
                                                </div>
                                                <CreateButton module="company" onClick={() => { setEditItemId(null); setWarehouseForm({ name: '', code: '', total_capacity: '', capacity_unit: 'units', is_active: true, is_default: false, branch: id, factory: null }); setShowWarehouseModal(true); }}>Warehouse</CreateButton>
                                            </div>
                                            <div className="table-responsive">
                                                <table className="table table-custom">
                                                    <thead><tr><th>Name/Code</th><th>Capacity</th><th>Status</th><th>Actions</th></tr></thead>
                                                    <tbody>
                                                        {branchWarehouses.map(w => (
                                                            <tr key={w.id}>
                                                                <td>
                                                                    <div style={{ fontWeight: '500' }}>{w.name}</div>
                                                                    <small className="text-muted">{w.code}</small>
                                                                </td>
                                                                <td>{w.total_capacity} {w.capacity_unit}</td>
                                                                <td>{w.is_active ? <span className="badge badge-primary-custom">Active</span> : <span className="badge badge-light">Inactive</span>}</td>
                                                                <td>
                                                                    <div className="d-flex gap-1">
                                                                        <button className="action-btn btn-view" title="Manage Details" onClick={() => navigate(`/warehouse-details/${w.id}`)}><i className="fa fa-list"></i></button>
                                                                        <EditButton module="company" onClick={() => { setEditItemId(w.id); setWarehouseForm(w); setShowWarehouseModal(true); }} />
                                                                        <DeleteButton module="company" onClick={() => handleDelete('warehouse', w.id)} />
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {branchWarehouses.length === 0 && <tr><td colSpan="4" className="text-center text-muted">No warehouses added.</td></tr>}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </Tab.Pane>
                                    </Tab.Content>
                                    <div className="d-flex justify-content-end mt-4 mb-4">
                                        <Button
                                            variant="outline-secondary"
                                            size="sm"
                                            onClick={() => navigate('/company-settings?tab=branches')}
                                            style={{ borderRadius: '8px', fontSize: '13px', padding: '6px 12px' }}
                                        >
                                            <i className="fa fa-arrow-left me-1"></i> Back to Branches
                                        </Button>
                                    </div>
                                </Tab.Container>
                            </div>
                        </div>
                    </div>
                </div>

                {/* MODALS */}
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
                                    {editItemId ? 'Update the branch address details' : 'Enter the branch address details'}
                                </p>
                            </div>
                        </div>
                        <button type="button" className="modal-close-x" onClick={() => setShowAddressModal(false)}>&times;</button>
                    </div>
                    <Form onSubmit={handleAddressSubmit} onKeyDown={handleFormKeyDown('.addr-custom-modal')}>
                        <div className="modal-body-custom">
                            <div className="mb-3">
                                <Form.Label className="form-label-custom">Address Line 1 <span className="text-danger">*</span></Form.Label>
                                <Form.Control type="text" className="form-control-custom" required value={addressForm.address_line_1} placeholder="e.g., 123 Main Street" onChange={e => setAddressForm({ ...addressForm, address_line_1: e.target.value })} autoFocus />
                            </div>
                            <div className="mb-3">
                                <Form.Label className="form-label-custom">Line 2</Form.Label>
                                <Form.Control type="text" className="form-control-custom" value={addressForm.address_line_2 || ''} placeholder="Apt, Suite, Floor (optional)" onChange={e => setAddressForm({ ...addressForm, address_line_2: e.target.value })} />
                            </div>
                            <div className="row">
                                <div className="col-6 mb-3">
                                    <Form.Label className="form-label-custom">City <span className="text-danger">*</span></Form.Label>
                                    <Form.Control type="text" className="form-control-custom" required value={addressForm.city} placeholder="e.g., Mumbai" onChange={e => setAddressForm({ ...addressForm, city: e.target.value })} />
                                </div>
                                <div className="col-6 mb-3">
                                    <Form.Label className="form-label-custom">State <span className="text-danger">*</span></Form.Label>
                                    <Form.Control type="text" className="form-control-custom" required value={addressForm.state} placeholder="e.g., Maharashtra" onChange={e => setAddressForm({ ...addressForm, state: e.target.value })} />
                                </div>
                                <div className="col-6 mb-3">
                                    <Form.Label className="form-label-custom">Pincode <span className="text-danger">*</span></Form.Label>
                                    <Form.Control type="text" className="form-control-custom" required value={addressForm.pincode} placeholder="e.g., 400001" onChange={e => setAddressForm({ ...addressForm, pincode: e.target.value })} />
                                </div>
                                <div className="col-6 mb-3">
                                    <Form.Label className="form-label-custom">Country <span className="text-danger">*</span></Form.Label>
                                    <Form.Control type="text" className="form-control-custom" required value={addressForm.country} placeholder="e.g., India" onChange={e => setAddressForm({ ...addressForm, country: e.target.value })} />
                                </div>
                            </div>
                            <div className="mb-3">
                                <Form.Check type="checkbox" id="br-def-addr" label="Set as Default" checked={addressForm.is_default} onChange={e => setAddressForm({ ...addressForm, is_default: e.target.checked })} className="form-check-input-custom" />
                            </div>
                        </div>
                        <div className="modal-footer-custom">
                            <Button type="button" className="btn-close-custom" onClick={() => setShowAddressModal(false)}>Cancel</Button>
                            <Button type="submit" className="btn-save-custom">Save</Button>
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
                                    {editItemId ? 'Update the branch contact details' : 'Enter the branch contact details'}
                                </p>
                            </div>
                        </div>
                        <button type="button" className="modal-close-x" onClick={() => setShowContactModal(false)}>&times;</button>
                    </div>
                    <Form onSubmit={handleContactSubmit} onKeyDown={handleFormKeyDown('.contact-custom-modal')}>
                        <div className="modal-body-custom">
                            <div className="mb-3">
                                <Form.Label className="form-label-custom">Email <span className="text-danger">*</span></Form.Label>
                                <Form.Control type="email" className="form-control-custom" required value={contactForm.email} placeholder="e.g., branch@company.com" onChange={e => setContactForm({ ...contactForm, email: e.target.value })} autoFocus />
                            </div>
                            <div className="mb-3">
                                <Form.Label className="form-label-custom">Phone <span className="text-danger">*</span></Form.Label>
                                <Form.Control type="text" className="form-control-custom" required value={contactForm.phone} placeholder="e.g., +91 9876543210" onChange={e => setContactForm({ ...contactForm, phone: e.target.value })} />
                            </div>
                            <div className="mb-3">
                                <Form.Label className="form-label-custom">Mobile</Form.Label>
                                <Form.Control type="text" className="form-control-custom" value={contactForm.mobile || ''} placeholder="e.g., +91 9123456789" onChange={e => setContactForm({ ...contactForm, mobile: e.target.value })} />
                            </div>
                            <div className="mb-3">
                                <Form.Check type="checkbox" id="br-pri-con" label="Set as Primary" checked={contactForm.is_primary} onChange={e => setContactForm({ ...contactForm, is_primary: e.target.checked })} className="form-check-input-custom" />
                            </div>
                        </div>
                        <div className="modal-footer-custom">
                            <Button type="button" className="btn-close-custom" onClick={() => setShowContactModal(false)}>Cancel</Button>
                            <Button type="submit" className="btn-save-custom">Save</Button>
                        </div>
                    </Form>
                </Modal>

                {/* BANK MODAL */}
                <Modal show={showBankModal} onHide={() => setShowBankModal(false)} dialogClassName="bank-custom-modal" centered>
                    <div className="modal-header-custom">
                        <div className="d-flex align-items-center gap-3">
                            <div className="modal-icon-circle form-icon-circle">
                                <i className="fa fa-university text-white fs-4"></i>
                            </div>
                            <div>
                                <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                    {editItemId ? 'Edit Bank Account' : 'Add Bank Account'}
                                </h4>
                                <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                    {editItemId ? 'Update the branch bank details' : 'Enter the branch bank details'}
                                </p>
                            </div>
                        </div>
                        <button type="button" className="modal-close-x" onClick={() => setShowBankModal(false)}>&times;</button>
                    </div>
                    <Form onSubmit={handleBankSubmit} onKeyDown={handleFormKeyDown('.bank-custom-modal')}>
                        <div className="modal-body-custom">
                            <div className="mb-3">
                                <Form.Label className="form-label-custom">Bank Name <span className="text-danger">*</span></Form.Label>
                                <Form.Control type="text" className="form-control-custom" required value={bankForm.bank_name} placeholder="e.g., State Bank of India" onChange={e => setBankForm({ ...bankForm, bank_name: e.target.value })} autoFocus />
                            </div>
                            <div className="mb-3">
                                <Form.Label className="form-label-custom">Branch Name</Form.Label>
                                <Form.Control type="text" className="form-control-custom" value={bankForm.branch_name || ''} placeholder="e.g., Main Branch" onChange={e => setBankForm({ ...bankForm, branch_name: e.target.value })} />
                            </div>
                            <div className="mb-3">
                                <Form.Label className="form-label-custom">Account Holder Name <span className="text-danger">*</span></Form.Label>
                                <Form.Control type="text" className="form-control-custom" required value={bankForm.account_holder_name} placeholder="e.g., Company Name" onChange={e => setBankForm({ ...bankForm, account_holder_name: e.target.value })} />
                            </div>
                            <div className="mb-3">
                                <Form.Label className="form-label-custom">Account Number <span className="text-danger">*</span></Form.Label>
                                <Form.Control type="text" className="form-control-custom" required value={bankForm.account_number} placeholder="e.g., 123456789012" onChange={e => setBankForm({ ...bankForm, account_number: e.target.value })} />
                            </div>
                            <div className="row">
                                <div className="col-6 mb-3">
                                    <Form.Label className="form-label-custom">IFSC Code</Form.Label>
                                    <Form.Control type="text" className="form-control-custom" value={bankForm.ifsc_code || ''} placeholder="e.g., SBIN0001234" onChange={e => setBankForm({ ...bankForm, ifsc_code: e.target.value })} />
                                </div>
                                <div className="col-6 mb-3">
                                    <Form.Label className="form-label-custom">SWIFT Code</Form.Label>
                                    <Form.Control type="text" className="form-control-custom" value={bankForm.swift_code || ''} placeholder="e.g., SBININBB" onChange={e => setBankForm({ ...bankForm, swift_code: e.target.value })} />
                                </div>
                            </div>
                            <div className="mb-3">
                                <Form.Check type="checkbox" id="br-pri-bank" label="Set as Primary" checked={bankForm.is_primary} onChange={e => setBankForm({ ...bankForm, is_primary: e.target.checked })} className="form-check-input-custom" />
                            </div>
                        </div>
                        <div className="modal-footer-custom">
                            <Button type="button" className="btn-close-custom" onClick={() => setShowBankModal(false)}>Cancel</Button>
                            <Button type="submit" className="btn-save-custom">Save</Button>
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
                                    Manage manufacturing unit details
                                </p>
                            </div>
                        </div>
                        <button type="button" className="modal-close-x" onClick={() => setShowFactoryModal(false)}>&times;</button>
                    </div>
                    <Form onSubmit={handleFactorySubmit} onKeyDown={handleFormKeyDown('.factory-custom-modal')}>
                        <div className="modal-body-custom">
                            <div className="mb-3">
                                <Form.Label className="form-label-custom">Name <span className="text-danger">*</span></Form.Label>
                                <Form.Control type="text" className="form-control-custom" required value={factoryForm.name} placeholder="e.g., Unit 1" onChange={e => setFactoryForm({ ...factoryForm, name: e.target.value })} autoFocus />
                            </div>
                            <div className="mb-3">
                                <Form.Label className="form-label-custom">Code <span className="text-danger">*</span></Form.Label>
                                <Form.Control type="text" className="form-control-custom" required value={factoryForm.factory_code} placeholder="e.g., FAC-001" onChange={e => setFactoryForm({ ...factoryForm, factory_code: e.target.value })} />
                            </div>

                            <div className="mb-3">
                                <Form.Label className="form-label-custom">Timezone</Form.Label>
                                <select className="form-control-custom" value={factoryForm.timezone} onChange={e => setFactoryForm({ ...factoryForm, timezone: e.target.value })}>
                                    {commonTimezones.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                                </select>
                            </div>
                            <div className="mb-3">
                                <Form.Check type="checkbox" id="fact-act" label="Active" checked={factoryForm.is_active} onChange={e => setFactoryForm({ ...factoryForm, is_active: e.target.checked })} className="form-check-input-custom" />
                            </div>
                        </div>
                        <div className="modal-footer-custom">
                            <Button type="button" className="btn-close-custom" onClick={() => setShowFactoryModal(false)}>Cancel</Button>
                            <Button type="submit" className="btn-save-custom">Save</Button>
                        </div>
                    </Form>
                </Modal>

                {/* WAREHOUSE MODAL */}
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
                                    Manage warehouse storage units
                                </p>
                            </div>
                        </div>
                        <button type="button" className="modal-close-x" onClick={() => setShowWarehouseModal(false)}>&times;</button>
                    </div>
                    <Form onSubmit={handleWarehouseSubmit} onKeyDown={handleFormKeyDown('.warehouse-custom-modal')}>
                        <div className="modal-body-custom">
                            <div className="mb-3">
                                <Form.Label className="form-label-custom">Name <span className="text-danger">*</span></Form.Label>
                                <Form.Control type="text" className="form-control-custom" required value={warehouseForm.name} placeholder="e.g., Branch Warehouse" onChange={e => setWarehouseForm({ ...warehouseForm, name: e.target.value })} autoFocus />
                            </div>
                            <div className="mb-3">
                                <Form.Label className="form-label-custom">Code <span className="text-danger">*</span></Form.Label>
                                <Form.Control type="text" className="form-control-custom" required value={warehouseForm.code} placeholder="e.g., WH-002" onChange={e => setWarehouseForm({ ...warehouseForm, code: e.target.value })} />
                            </div>
                            <div className="row">
                                <div className="col-6 mb-3">
                                    <Form.Label className="form-label-custom">Total Capacity <span className="text-danger">*</span></Form.Label>
                                    <Form.Control type="number" className="form-control-custom" required value={warehouseForm.total_capacity} placeholder="e.g., 500" onChange={e => setWarehouseForm({ ...warehouseForm, total_capacity: e.target.value })} />
                                </div>
                                <div className="col-6 mb-3">
                                    <Form.Label className="form-label-custom">Unit <span className="text-danger">*</span></Form.Label>
                                    <select className="form-control-custom" value={warehouseForm.capacity_unit} onChange={e => setWarehouseForm({ ...warehouseForm, capacity_unit: e.target.value })}>
                                        <option value="kg">Kilograms (kg)</option>
                                        <option value="ton">Tons</option>
                                        <option value="litre">Litres</option>
                                        <option value="m3">Cubic Meter (m³)</option>
                                        <option value="units">Units</option>
                                    </select>
                                </div>
                            </div>
                            <div className="mb-3 d-flex gap-4">
                                <Form.Check
                                    type="checkbox"
                                    id="wh-act"
                                    label="Active"
                                    checked={!!warehouseForm.is_active}
                                    onChange={e => setWarehouseForm({ ...warehouseForm, is_active: e.target.checked })}
                                    className="form-check-input-custom"
                                />
                                <Form.Check
                                    type="checkbox"
                                    id="wh-default"
                                    label="Set as Default"
                                    checked={!!warehouseForm.is_default}
                                    onChange={e => setWarehouseForm({ ...warehouseForm, is_default: e.target.checked })}
                                    className="form-check-input-custom"
                                />
                            </div>
                        </div>
                        <div className="modal-footer-custom">
                            <Button type="button" className="btn-close-custom" onClick={() => setShowWarehouseModal(false)}>Cancel</Button>
                            <Button type="submit" className="btn-save-custom">Save</Button>
                        </div>
                    </Form>
                </Modal>

                {/* BRANCH LICENSE MODAL */}
                <Modal show={showLicenseModal} onHide={() => setShowLicenseModal(false)} dialogClassName="branch-custom-modal" centered size="xl">
                    <div className="modal-header-custom">
                        <div className="d-flex align-items-center gap-3">
                            <div className="modal-icon-circle" style={{ backgroundColor: '#6c5ce7', width: '45px', height: '45px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <i className="fa fa-id-card text-white fs-4"></i>
                            </div>
                            <div>
                                <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                    {editItemId ? 'Edit Branch License' : 'Add Branch License(s)'}
                                </h4>
                                <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                    Assign licenses in a single row layout with auto-calculated expiry dates
                                </p>
                            </div>
                        </div>
                        <button type="button" className="modal-close-x" onClick={() => setShowLicenseModal(false)}>&times;</button>
                    </div>
                    <Form onSubmit={handleBranchLicenseSubmit} onKeyDown={handleFormKeyDown('.branch-custom-modal')}>
                        <div className="modal-body-custom" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                            {/* Table Header Row */}
                            <div className="row fw-bold text-muted mb-2 px-1 d-none d-md-flex" style={{ fontSize: '12px', letterSpacing: '0.5px' }}>
                                <div className="col-md-3">SELECT LICENSE <span className="text-danger">*</span></div>
                                <div className="col-md-3">LICENSE NUMBER <span className="text-danger">*</span></div>
                                <div className="col-md-2">ISSUE DATE <span className="text-danger">*</span></div>
                                <div className="col-md-2">EXPIRY DATE</div>
                                <div className="col-md-1 text-center">ACTIVE</div>
                                <div className="col-md-1 text-end">ACTION</div>
                            </div>

                            {licenseRows.map((row, index) => (
                                <div key={index} className="row align-items-center g-2 mb-3 p-2 license-row-card rounded-3 border">
                                    <div className="col-md-3">
                                        <label className="form-label-custom d-md-none">Select License *</label>
                                        <select
                                            className="form-control-custom"
                                            required
                                            value={row.master_license_id}
                                            onChange={e => handleRowChange(index, 'master_license_id', e.target.value)}
                                            autoFocus={index === 0}
                                        >
                                            <option value="">Select License...</option>
                                            {masterLicenses.map(m => (
                                                <option key={m.id} value={m.id}>
                                                    {m.license_name} ({m.months_to_expiry} {m.months_to_expiry === 1 ? 'Month' : 'Months'})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label-custom d-md-none">License Number *</label>
                                        <Form.Control
                                            type="text"
                                            className="form-control-custom"
                                            required
                                            placeholder="E.G., 10020042001234"
                                            value={row.license_no}
                                            onChange={e => handleRowChange(index, 'license_no', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-md-2">
                                        <label className="form-label-custom d-md-none">Issue Date *</label>
                                        <Form.Control
                                            type="date"
                                            className="form-control-custom"
                                            required
                                            value={row.issue_date}
                                            onChange={e => handleRowChange(index, 'issue_date', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-md-2">
                                        <label className="form-label-custom d-md-none">Expiry Date</label>
                                        <Form.Control
                                            type="date"
                                            className="form-control-custom"
                                            value={row.expiry_date}
                                            onChange={e => handleRowChange(index, 'expiry_date', e.target.value)}
                                            title="Auto-calculated from Issue Date + Master Validity"
                                        />
                                    </div>
                                    <div className="col-md-1 text-center">
                                        <Form.Check
                                            type="checkbox"
                                            id={`br-lic-check-${index}`}
                                            checked={!!row.is_active}
                                            onChange={e => handleRowChange(index, 'is_active', e.target.checked)}
                                            className="form-check-input-custom d-inline-block"
                                        />
                                    </div>
                                    <div className="col-md-1 text-end">
                                        <div className="d-flex justify-content-end gap-1">
                                            <button
                                                type="button"
                                                className="btn btn-success btn-xs px-2 py-1"
                                                title="Add Another License"
                                                onClick={handleAddLicenseRow}
                                            >
                                                <i className="fa fa-plus"></i>
                                            </button>
                                            {licenseRows.length > 1 && (
                                                <button
                                                    type="button"
                                                    className="btn btn-danger btn-xs px-2 py-1"
                                                    title="Remove License Row"
                                                    onClick={() => handleRemoveLicenseRow(index)}
                                                >
                                                    <i className="fa fa-trash"></i>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="modal-footer-custom">
                            <Button type="button" className="btn-close-custom" onClick={() => setShowLicenseModal(false)}>Cancel</Button>
                            <Button type="submit" className="btn-save-custom">{editItemId ? 'Save Changes' : 'Save Licenses'}</Button>
                        </div>
                    </Form>
                </Modal>
            </div>
        </Fragment>
    );
};

export default BranchDetails;
