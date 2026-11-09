import React, { useState, useEffect, Fragment } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Modal, Button, Tab, Nav, Form, Card, Row, Col, Badge } from 'react-bootstrap';
import Swal from 'sweetalert2';
import CreateButton from '../../components/permissions/CreateButton';
import EditButton from '../../components/permissions/EditButton';
import DeleteButton from '../../components/permissions/DeleteButton';
import { showRequiredFieldsWarning } from '../../utils/formValidation';
import {
    fetchFactoryById,
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
    formatCompanyError,
    fetchBranchById
} from '../../services/CompanyService';

const FactoryDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [factory, setFactory] = useState(null);
    const [loading, setLoading] = useState(true);
    const [factoryAddresses, setFactoryAddresses] = useState([]);
    const [factoryContacts, setFactoryContacts] = useState([]);
    const [factoryWarehouses, setFactoryWarehouses] = useState([]);
    const [branchName, setBranchName] = useState('');

    // Master License list (choices for the dropdown)
    const [masterLicenses] = useState([
        { id: 1, license_name: 'GSTIN Registration', months_to_expiry: 3, status: 'Active' },
        { id: 2, license_name: 'FSSAI License', months_to_expiry: 6, status: 'Active' },
        { id: 3, license_name: 'Trade License', months_to_expiry: 1, status: 'Active' },
        { id: 4, license_name: 'Import Export Code (IEC)', months_to_expiry: 12, status: 'Active' },
        { id: 5, license_name: 'Drug License', months_to_expiry: 2, status: 'Active' },
        { id: 6, license_name: 'Factory License', months_to_expiry: 3, status: 'Active' },
        { id: 7, license_name: 'Pollution Control Board (PCB)', months_to_expiry: 6, status: 'Active' }
    ]);

    // Factory Licenses list
    const [factoryLicenses, setFactoryLicenses] = useState([
        { id: 1, master_license_id: 6, license_name: 'Factory License', license_no: '5222', issue_date: '2024-01-01', expiry_date: '2024-04-01', is_active: true }
    ]);

    const [licenseSearchTerm, setLicenseSearchTerm] = useState('');
    const [showLicenseModal, setShowLicenseModal] = useState(false);
    const [licenseRows, setLicenseRows] = useState([
        {
            master_license_id: 6,
            license_name: 'Factory License',
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

    const handleFactoryLicenseSubmit = (e) => {
        e.preventDefault();
        
        const missingFields = [];
        for (let i = 0; i < licenseRows.length; i++) {
            const row = licenseRows[i];
            const rowMissing = [];
            if (!row.master_license_id) rowMissing.push('License Type');
            if (!row.license_no?.trim()) rowMissing.push('License Number');
            if (!row.issue_date) rowMissing.push('Issue Date');

            if (rowMissing.length > 0) {
                missingFields.push(`Row #${i + 1}: ${rowMissing.join(', ')}`);
            }
        }

        if (missingFields.length > 0) {
            showRequiredFieldsWarning(missingFields);
            return;
        }

        if (editItemId) {
            setFactoryLicenses(prev => prev.map(item => item.id === editItemId ? { ...licenseRows[0], id: editItemId } : item));
            Swal.fire({ title: 'Updated!', text: 'Factory license updated successfully.', icon: 'success', timer: 1500, showConfirmButton: false });
        } else {
            const newItems = licenseRows.map((row, index) => ({ ...row, id: Date.now() + index }));
            setFactoryLicenses(prev => [...newItems, ...prev]);
            Swal.fire({ title: 'Added!', text: `${newItems.length} Factory license(s) added successfully.`, icon: 'success', timer: 1500, showConfirmButton: false });
        }
        setShowLicenseModal(false);
    };

    const handleDeleteFactoryLicense = (licId) => {
        Swal.fire({
            title: 'Are you sure?',
            text: "Do you want to delete this license from this factory?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        }).then((result) => {
            if (result.isConfirmed) {
                setFactoryLicenses(prev => prev.filter(l => l.id !== licId));
                Swal.fire('Deleted!', 'Factory license deleted.', 'success');
            }
        });
    };

    // Modals
    const [showAddressModal, setShowAddressModal] = useState(false);
    const [showContactModal, setShowContactModal] = useState(false);
    const [showWarehouseModal, setShowWarehouseModal] = useState(false);
    const [editItemId, setEditItemId] = useState(null);

    // Form states
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
        manager_name: '',
        email: '',
        phone: '',
        is_primary: true
    });

    const [warehouseForm, setWarehouseForm] = useState({
        name: '',
        code: '',
        total_capacity: '',
        capacity_unit: 'units',
        is_active: true,
        branch: null,
        factory: null
    });

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
                try { next.showPicker(); } catch (err) {}
            }
        }
    };

    useEffect(() => {
        if (id) {
            loadFactoryData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const loadFactoryData = async () => {
        try {
            setLoading(true);
            const res = await fetchFactoryById(id);
            setFactory(res.data);
            if (res.data.branch) {
                try {
                    const branchRes = await fetchBranchById(res.data.branch);
                    if (branchRes.data && branchRes.data.name) {
                        setBranchName(branchRes.data.name);
                    }
                } catch (err) {
                    console.error('Failed to fetch branch details:', err);
                }
            }
            await loadRelatedData();
        } catch (error) {
            console.error('Failed to load factory details:', error);
            Swal.fire('Error', 'Failed to load factory details', 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadRelatedData = async () => {
        try {
            const [addrRes, contactRes, whRes] = await Promise.all([
                fetchFactoryAddresses(id),
                fetchFactoryContacts(id),
                fetchWarehouses({ factory: id })
            ]);
            setFactoryAddresses(addrRes.data || []);
            setFactoryContacts(contactRes.data || []);
            setFactoryWarehouses(whRes.data || []);
        } catch (error) {
            console.error('Failed to load factory related data:', error);
        }
    };

    const handleAddressSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...addressForm, factory: id };
            if (editItemId) await updateFactoryAddress(editItemId, payload);
            else await createFactoryAddress(payload);
            setShowAddressModal(false);
            loadRelatedData();
            Swal.fire({ title: 'Success', text: editItemId ? 'Address updated successfully' : 'Address added successfully', icon: 'success', timer: 1500, showConfirmButton: false });
        } catch (error) {
            Swal.fire('Error', formatCompanyError(error), 'error');
        }
    };

    const handleContactSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...contactForm, factory: id };
            if (editItemId) await updateFactoryContact(editItemId, payload);
            else await createFactoryContact(payload);
            setShowContactModal(false);
            loadRelatedData();
            Swal.fire({ title: 'Success', text: editItemId ? 'Contact updated successfully' : 'Contact added successfully', icon: 'success', timer: 1500, showConfirmButton: false });
        } catch (error) {
            Swal.fire('Error', formatCompanyError(error), 'error');
        }
    };

    const handleWarehouseSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...warehouseForm,
                company: factory.company,
                branch: factory.branch || null,
                factory: id
            };
            if (editItemId) await updateWarehouse(editItemId, payload);
            else await createWarehouse(payload);
            setShowWarehouseModal(false);
            loadRelatedData();
            Swal.fire({ title: 'Success', text: editItemId ? 'Warehouse updated successfully' : 'Warehouse created successfully', icon: 'success', timer: 1500, showConfirmButton: false });
        } catch (error) {
            Swal.fire('Error', formatCompanyError(error), 'error');
        }
    };

    const handleDelete = async (type, itemId) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                if (type === 'address') await deleteFactoryAddress(itemId);
                else if (type === 'contact') await deleteFactoryContact(itemId);
                else if (type === 'warehouse') await deleteWarehouse(itemId);

                Swal.fire('Deleted!', 'Item has been deleted.', 'success');
                loadRelatedData();
            } catch (error) {
                Swal.fire('Error', formatCompanyError(error), 'error');
            }
        }
    };

    if (loading) return (
        <div className="text-center p-5">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="mt-3 text-muted">Loading factory details...</p>
        </div>
    );

    if (!factory) return (
        <div className="text-center p-5">
            <div className="mb-3"><i className="fa fa-exclamation-triangle text-warning" style={{ fontSize: '48px' }}></i></div>
            <h4>Factory not found</h4>
            <Button variant="primary" className="mt-3" onClick={() => navigate('/company-settings?tab=factories')}>
                Back to Factory List
            </Button>
        </div>
    );

    const customStyles = `
        /* Hero Banner & Cards */
        .factory-hero-card {
            background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
            margin-bottom: 24px;
            position: relative;
            overflow: hidden;
        }
        .factory-hero-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 6px;
            height: 100%;
            background: linear-gradient(180deg, #7A70BA 0%, #2ece8a 100%);
            border-top-left-radius: 16px;
            border-bottom-left-radius: 16px;
        }
        .factory-icon-badge {
            width: 64px;
            height: 64px;
            border-radius: 16px;
            background: linear-gradient(135deg, #7A70BA 0%, #5d539e 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 16px rgba(122, 112, 186, 0.25);
            flex-shrink: 0;
        }
        .stat-metric-card {
            background: #ffffff;
            border: 1px solid #eef2f6;
            border-radius: 12px;
            padding: 16px;
            display: flex;
            align-items: center;
            gap: 14px;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .stat-metric-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(0,0,0,0.06);
        }
        .stat-icon-circle {
            width: 44px;
            height: 44px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            flex-shrink: 0;
        }

        /* Modern Tabs */
        .factory-tabs .nav-tabs {
            border-bottom: 2px solid #eef2f6 !important;
            gap: 8px;
            margin-bottom: 24px !important;
            padding: 0 !important;
        }
        .factory-tab-link {
            color: #64748b !important;
            font-weight: 600 !important;
            padding: 12px 20px !important;
            border-radius: 10px 10px 0 0 !important;
            background-color: transparent !important;
            transition: all 0.2s ease;
            font-size: 14px !important;
            border: none !important;
            border-bottom: 3px solid transparent !important;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .factory-tab-link:hover:not(.active) {
            color: #7A70BA !important;
            background-color: rgba(122, 112, 186, 0.05) !important;
        }
        .factory-tab-link.active {
            color: #7A70BA !important;
            background-color: #ffffff !important;
            border-bottom: 3px solid #7A70BA !important;
            box-shadow: none !important;
        }

        /* Info Property Card in Overview */
        .info-property-card {
            background-color: #ffffff;
            border: 1px solid #eef2f6;
            border-radius: 12px;
            padding: 16px 20px;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            transition: border-color 0.2s;
        }
        .info-property-card:hover {
            border-color: #cbd5e1;
        }
        .info-property-label {
            font-size: 12px;
            font-weight: 600;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .info-property-value {
            font-size: 16px;
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 0;
            word-break: break-word;
        }

        /* Tables Styling */
        .factory-table-card {
            background-color: #ffffff;
            border: 1px solid #eef2f6;
            border-radius: 14px;
            overflow: hidden;
        }
        .table-custom thead th {
            background-color: #f8fafc !important;
            color: #64748b !important;
            font-weight: 600 !important;
            text-transform: uppercase !important;
            font-size: 12px !important;
            border-top: none !important;
            border-bottom: 1px solid #e2e8f0 !important;
            padding: 14px 16px !important;
            letter-spacing: 0.5px !important;
        }
        .table-custom tbody td {
            vertical-align: middle !important;
            font-size: 14px !important;
            padding: 16px !important;
            border-bottom: 1px solid #f1f5f9 !important;
            color: #334155 !important;
        }
        .table-custom tbody tr:last-child td {
            border-bottom: none !important;
        }

        /* Initial Avatar */
        .contact-avatar {
            width: 38px;
            height: 38px;
            border-radius: 10px;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: #ffffff;
            font-weight: 700;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 8px rgba(16, 185, 129, 0.2);
            flex-shrink: 0;
        }

        /* Action Buttons */
        .action-btn {
            width: 32px !important;
            height: 32px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            border-radius: 8px !important;
            border: none !important;
            color: #fff !important;
            font-size: 13px !important;
            transition: all 0.2s ease;
        }
        .btn-view { background-color: #3b82f6 !important; }
        .action-btn:hover { transform: translateY(-2px); opacity: 0.9; }

        /* Empty State Box */
        .empty-state-box {
            padding: 48px 24px;
            text-align: center;
        }
        .empty-state-icon {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background-color: #f1f5f9;
            color: #94a3b8;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            margin-bottom: 16px;
        }

        /* Custom Modals */
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
            padding: 22px 28px 16px 28px;
            border-bottom: 1px solid #f1f5f9;
        }
        .modal-icon-circle {
            width: 44px;
            height: 44px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .addr-custom-modal .modal-icon-circle { background-color: #3b82f6; }
        .contact-custom-modal .modal-icon-circle { background-color: #10b981; }
        .warehouse-custom-modal .modal-icon-circle { background-color: #8b5cf6; }
        .factory-custom-modal .modal-icon-circle { background-color: #7A70BA; }

        .modal-close-x {
            border: none;
            background: transparent;
            font-size: 24px;
            color: #94a3b8;
            cursor: pointer;
            transition: color 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 4px;
        }
        .modal-close-x:hover { color: #334155; }
        .modal-body-custom {
            padding: 24px 28px;
            max-height: 70vh;
            overflow-y: auto;
        }
        .modal-footer-custom {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            padding: 16px 28px 20px 28px;
            border-top: 1px solid #f1f5f9;
            background-color: #fafbfc;
            gap: 12px;
        }
        .form-label-custom {
            font-size: 13px;
            font-weight: 500;
            color: #475569;
            margin-bottom: 6px;
            display: block;
        }
        .form-control-custom {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
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
            font-size: 13px !important;
            padding: 9px 22px !important;
            border: none !important;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .btn-save-custom:hover { background-color: #26b277 !important; }

        /* Search input styling */
        .search-input-custom {
            height: 38px !important;
            border-radius: 8px !important;
            padding-left: 35px !important;
            font-size: 13px !important;
            border: 1px solid #cbd5e1 !important;
            background-color: #fff !important;
            color: #334155 !important;
        }
        .search-input-custom:focus {
            outline: none !important;
            border-color: #2ece8a !important;
            box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15) !important;
        }

        /* ===== DARK MODE OVERRIDES ===== */
        [data-theme-version="dark"] .factory-hero-card {
            background: linear-gradient(135deg, #24292D 0%, #1e2630 100%) !important;
            border-color: #3d464e !important;
        }
        [data-theme-version="dark"] .stat-metric-card,
        [data-theme-version="dark"] .info-property-card,
        [data-theme-version="dark"] .factory-table-card {
            background-color: #24292D !important;
            border-color: #3d464e !important;
        }
        [data-theme-version="dark"] .info-property-value {
            color: #f1f5f9 !important;
        }
        [data-theme-version="dark"] .factory-tabs .nav-tabs {
            border-bottom-color: #3d464e !important;
        }
        [data-theme-version="dark"] .factory-tab-link {
            color: #94a3b8 !important;
        }
        [data-theme-version="dark"] .factory-tab-link.active {
            color: #c4b5fd !important;
            background-color: #24292D !important;
            border-bottom-color: #7A70BA !important;
        }
        [data-theme-version="dark"] .table-custom thead th {
            background-color: #1e2630 !important;
            color: #94a3b8 !important;
            border-bottom-color: #3d464e !important;
        }
        [data-theme-version="dark"] .table-custom tbody td {
            color: #cbd5e1 !important;
            border-bottom-color: #3d464e !important;
        }
        [data-theme-version="dark"] .empty-state-icon {
            background-color: #1e2630 !important;
            color: #64748b !important;
        }
        [data-theme-version="dark"] .modal-content {
            background-color: #24292D !important;
        }
        [data-theme-version="dark"] .modal-header-custom,
        [data-theme-version="dark"] .modal-footer-custom {
            border-color: #3d464e !important;
            background-color: #1e2630 !important;
        }
        [data-theme-version="dark"] .form-label-custom {
            color: #cbd5e1 !important;
        }
        [data-theme-version="dark"] .form-control-custom {
            background-color: #1e2630 !important;
            border-color: #3d464e !important;
            color: #f1f5f9 !important;
        }
        [data-theme-version="dark"] .form-control-custom::placeholder {
            color: #64748b !important;
        }
        [data-theme-version="dark"] .search-input-custom {
            background-color: #1e2630 !important;
            border-color: #3d464e !important;
            color: #f1f5f9 !important;
        }
        [data-theme-version="dark"] .license-row-card {
            background-color: #1e2630 !important;
            border-color: #3d464e !important;
        }
    `;

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
                                {factory.name}
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
                                    <i className="fa fa-industry text-white" style={{ fontSize: '28px' }}></i>
                                </div>
                                <div>
                                    <div className="d-flex align-items-center gap-2 flex-wrap">
                                        <h3 className="mb-0 font-w700" style={{ fontSize: '22px' }}>
                                            {factory.name}
                                        </h3>
                                        
                                    </div>
                                    <div className="d-flex align-items-center gap-3 mt-2 flex-wrap text-muted" style={{ fontSize: '13px' }}>
                                        <span className="d-flex align-items-center gap-1">
                                            <i className="fa fa-barcode text-primary"></i>
                                            <strong>Code:</strong> <code>{factory.factory_code || 'N/A'}</code>
                                        </span>
                                        <span className="d-flex align-items-center gap-1">
                                            <i className="fa fa-globe text-info"></i>
                                            <strong>Timezone:</strong> {factory.timezone || 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Metric summary cards */}
                        <div className="col-lg-6 col-md-12">
                            <div className="row g-2">
                                <div className="col-6 col-sm-6 col-lg-3">
                                    <div className="stat-metric-card">
                                        <div className="stat-icon-circle" style={{ backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
                                            <i className="fa fa-map-marker-alt"></i>
                                        </div>
                                        <div>
                                            <div className="text-muted" style={{ fontSize: '11px', fontWeight: '600' }}>ADDRESSES</div>
                                            <h5 className="mb-0 font-w700" style={{ fontSize: '18px' }}>{factoryAddresses.length}</h5>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-6 col-sm-6 col-lg-3">
                                    <div className="stat-metric-card">
                                        <div className="stat-icon-circle" style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
                                            <i className="fa fa-user-tie"></i>
                                        </div>
                                        <div>
                                            <div className="text-muted" style={{ fontSize: '11px', fontWeight: '600' }}>CONTACTS</div>
                                            <h5 className="mb-0 font-w700" style={{ fontSize: '18px' }}>{factoryContacts.length}</h5>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-6 col-sm-6 col-lg-3">
                                    <div className="stat-metric-card">
                                        <div className="stat-icon-circle" style={{ backgroundColor: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6' }}>
                                            <i className="fa fa-warehouse"></i>
                                        </div>
                                        <div>
                                            <div className="text-muted" style={{ fontSize: '11px', fontWeight: '600' }}>WAREHOUSES</div>
                                            <h5 className="mb-0 font-w700" style={{ fontSize: '18px' }}>{factoryWarehouses.length}</h5>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-6 col-sm-6 col-lg-3">
                                    <div className="stat-metric-card">
                                        <div className="stat-icon-circle" style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
                                            <i className="fa fa-id-card"></i>
                                        </div>
                                        <div>
                                            <div className="text-muted" style={{ fontSize: '11px', fontWeight: '600' }}>LICENSES</div>
                                            <h5 className="mb-0 font-w700" style={{ fontSize: '18px' }}>{factoryLicenses.length}</h5>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content with Navigation Tabs */}
                <div className="card shadow-sm" style={{ borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                    <div className="card-body p-4">
                        <Tab.Container defaultActiveKey="fa-info">
                            <div className="factory-tabs d-flex justify-content-between align-items-center mb-3" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '2px' }}>
                                <Nav className="nav nav-tabs border-bottom-0 mb-0">
                                    <Nav.Item>
                                        <Nav.Link eventKey="fa-info" className="factory-tab-link">
                                            <i className="fa fa-info-circle"></i>
                                            <span>Factory Details</span>
                                        </Nav.Link>
                                    </Nav.Item>
                                    <Nav.Item>
                                        <Nav.Link eventKey="fa-addresses" className="factory-tab-link">
                                            <i className="fa fa-map-marker-alt"></i>
                                            <span>Addresses</span>
                                            <Badge bg="light" text="dark" pill className="ms-1 border">{factoryAddresses.length}</Badge>
                                        </Nav.Link>
                                    </Nav.Item>
                                    <Nav.Item>
                                        <Nav.Link eventKey="fa-contacts" className="factory-tab-link">
                                            <i className="fa fa-users"></i>
                                            <span>Contacts</span>
                                            <Badge bg="light" text="dark" pill className="ms-1 border">{factoryContacts.length}</Badge>
                                        </Nav.Link>
                                    </Nav.Item>
                                    <Nav.Item>
                                        <Nav.Link eventKey="fa-warehouses" className="factory-tab-link">
                                            <i className="fa fa-warehouse"></i>
                                            <span>Warehouses</span>
                                            <Badge bg="light" text="dark" pill className="ms-1 border">{factoryWarehouses.length}</Badge>
                                        </Nav.Link>
                                    </Nav.Item>
                                    <Nav.Item>
                                        <Nav.Link eventKey="fa-licenses" className="factory-tab-link">
                                            <i className="fa fa-id-card"></i>
                                            <span>Licenses</span>
                                            <Badge bg="light" text="dark" pill className="ms-1 border">{factoryLicenses.length}</Badge>
                                        </Nav.Link>
                                    </Nav.Item>
                                </Nav>
                                <Button 
                                    variant="outline-secondary" 
                                    size="sm" 
                                    className="me-2"
                                    onClick={() => navigate('/company-settings?tab=factories')}
                                    style={{ borderRadius: '8px', fontSize: '13px', padding: '6px 12px' }}
                                >
                                    <i className="fa fa-arrow-left me-1"></i> Back to Factories
                                </Button>
                            </div>

                            <Tab.Content>
                                {/* TAB 1: FACTORY DETAILS OVERVIEW */}
                                <Tab.Pane eventKey="fa-info">
                                    <div className="row g-3">
                                        <div className="col-md-6 col-lg-4">
                                            <div className="info-property-card">
                                                <div className="info-property-label">
                                                    <i className="fa fa-industry text-primary"></i> Factory Name
                                                </div>
                                                <div className="info-property-value">{factory.name}</div>
                                            </div>
                                        </div>

                                        <div className="col-md-6 col-lg-4">
                                            <div className="info-property-card">
                                                <div className="info-property-label">
                                                    <i className="fa fa-barcode text-primary"></i> Factory Code
                                                </div>
                                                <div className="info-property-value">
                                                    <code>{factory.factory_code}</code>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="col-md-6 col-lg-4">
                                            <div className="info-property-card">
                                                <div className="info-property-label">
                                                    <i className="fa fa-globe text-info"></i> Operating Timezone
                                                </div>
                                                <div className="info-property-value">{factory.timezone || 'UTC'}</div>
                                            </div>
                                        </div>

                                        <div className="col-md-6 col-lg-4">
                                            <div className="info-property-card">
                                                <div className="info-property-label">
                                                    <i className="fa fa-toggle-on text-success"></i> Operational Status
                                                </div>
                                                <div className="info-property-value">
                                                    <Badge bg={factory.is_active ? 'success' : 'danger'} pill className="px-3 py-2">
                                                        {factory.is_active ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>

                                        {(factory.branch_name || factory.branch) && (
                                            <div className="col-md-6 col-lg-4">
                                                <div className="info-property-card">
                                                    <div className="info-property-label">
                                                        <i className="fa fa-building text-secondary"></i> Associated Branch
                                                    </div>
                                                    <div className="info-property-value">
                                                        {branchName || factory.branch_name || `Branch #${factory.branch}`}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </Tab.Pane>

                                {/* TAB 2: ADDRESSES */}
                                <Tab.Pane eventKey="fa-addresses">
                                    <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                                        <div>
                                            <h5 className="mb-1 font-w600">Factory Addresses</h5>
                                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Physical and postal locations registered for this factory</p>
                                        </div>
                                        <CreateButton 
                                            module="company" 
                                            onClick={() => { 
                                                setEditItemId(null); 
                                                setAddressForm({ address_line_1: '', address_line_2: '', city: '', state: '', country: factory.country || '', pincode: '', is_default: factoryAddresses.length === 0 }); 
                                                setShowAddressModal(true); 
                                            }}
                                        >
                                            Address
                                        </CreateButton>
                                    </div>

                                    <div className="factory-table-card">
                                        <div className="table-responsive">
                                            <table className="table table-custom mb-0">
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: '60px' }}>#</th>
                                                        <th>Address</th>
                                                        <th>City / State</th>
                                                        <th>Pincode</th>
                                                        <th>Default</th>
                                                        <th className="text-end">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {factoryAddresses.map((a, idx) => (
                                                        <tr key={a.id}>
                                                            <td><span className="text-muted fw-bold">{idx + 1}</span></td>
                                                            <td>
                                                                <div className="d-flex align-items-center gap-2">
                                                                    <i className="fa fa-map-pin text-primary" style={{ fontSize: '14px' }}></i>
                                                                    <div>
                                                                        <span className="fw-semibold text-dark">{a.address_line_1}</span>
                                                                        {a.address_line_2 && <div className="text-muted" style={{ fontSize: '12px' }}>{a.address_line_2}</div>}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td>{a.city ? `${a.city}, ${a.state || ''}` : '-'}</td>
                                                            <td><code>{a.pincode || '-'}</code></td>
                                                            <td>
                                                                {a.is_default ? (
                                                                    <Badge bg="success" pill className="px-3 py-1">
                                                                        <i className="fa fa-check-circle me-1"></i> Default
                                                                    </Badge>
                                                                ) : (
                                                                    <span className="text-muted" style={{ fontSize: '12px' }}>-</span>
                                                                )}
                                                            </td>
                                                            <td className="text-end">
                                                                <div className="d-flex justify-content-end gap-1">
                                                                    <EditButton module="company" onClick={() => { setEditItemId(a.id); setAddressForm(a); setShowAddressModal(true); }} />
                                                                    <DeleteButton module="company" onClick={() => handleDelete('address', a.id)} />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {factoryAddresses.length === 0 && (
                                                        <tr>
                                                            <td colSpan="6">
                                                                <div className="empty-state-box">
                                                                    <div className="empty-state-icon">
                                                                        <i className="fa fa-map-marker-alt"></i>
                                                                    </div>
                                                                    <h6 className="font-w600">No Addresses Added</h6>
                                                                    <p className="text-muted mb-3" style={{ fontSize: '13px' }}>Add a physical or shipping address for this factory</p>
                                                                    <Button 
                                                                        variant="outline-primary" 
                                                                        size="sm"
                                                                        onClick={() => { 
                                                                            setEditItemId(null); 
                                                                            setAddressForm({ address_line_1: '', address_line_2: '', city: '', state: '', country: factory.country || '', pincode: '', is_default: true }); 
                                                                            setShowAddressModal(true); 
                                                                        }}
                                                                    >
                                                                        <i className="fa fa-plus me-1"></i> Add First Address
                                                                    </Button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </Tab.Pane>

                                {/* TAB 3: CONTACTS */}
                                <Tab.Pane eventKey="fa-contacts">
                                    <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                                        <div>
                                            <h5 className="mb-1 font-w600">Factory Contacts</h5>
                                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Plant managers, operational supervisors, and key personnel</p>
                                        </div>
                                        <CreateButton 
                                            module="company" 
                                            onClick={() => { 
                                                setEditItemId(null); 
                                                setContactForm({ manager_name: '', email: '', phone: '', is_primary: factoryContacts.length === 0 }); 
                                                setShowContactModal(true); 
                                            }}
                                        >
                                            Contact
                                        </CreateButton>
                                    </div>

                                    <div className="factory-table-card">
                                        <div className="table-responsive">
                                            <table className="table table-custom mb-0">
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: '60px' }}>#</th>
                                                        <th>Manager Name</th>
                                                        <th>Email Address</th>
                                                        <th>Phone Number</th>
                                                        <th>Primary</th>
                                                        <th className="text-end">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {factoryContacts.map((c, idx) => (
                                                        <tr key={c.id}>
                                                            <td><span className="text-muted fw-bold">{idx + 1}</span></td>
                                                            <td>
                                                                <div className="d-flex align-items-center gap-3">
                                                                    <div className="contact-avatar">
                                                                        {(c.manager_name || 'M').charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div>
                                                                        <span className="fw-semibold text-dark d-block">{c.manager_name}</span>
                                                                        {c.is_primary && <small className="text-success fw-bold">Primary Contact</small>}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td>
                                                                {c.email ? (
                                                                    <a href={`mailto:${c.email}`} className="text-primary text-decoration-none">
                                                                        <i className="fa fa-envelope me-1 text-muted"></i> {c.email}
                                                                    </a>
                                                                ) : '-'}
                                                            </td>
                                                            <td>
                                                                {c.phone ? (
                                                                    <a href={`tel:${c.phone}`} className="text-dark text-decoration-none">
                                                                        <i className="fa fa-phone me-1 text-muted"></i> {c.phone}
                                                                    </a>
                                                                ) : '-'}
                                                            </td>
                                                            <td>
                                                                {c.is_primary ? (
                                                                    <Badge bg="success" pill className="px-3 py-1">
                                                                        <i className="fa fa-star me-1"></i> Primary
                                                                    </Badge>
                                                                ) : (
                                                                    <span className="text-muted" style={{ fontSize: '12px' }}>Secondary</span>
                                                                )}
                                                            </td>
                                                            <td className="text-end">
                                                                <div className="d-flex justify-content-end gap-1">
                                                                    <EditButton module="company" onClick={() => { setEditItemId(c.id); setContactForm(c); setShowContactModal(true); }} />
                                                                    <DeleteButton module="company" onClick={() => handleDelete('contact', c.id)} />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {factoryContacts.length === 0 && (
                                                        <tr>
                                                            <td colSpan="6">
                                                                <div className="empty-state-box">
                                                                    <div className="empty-state-icon">
                                                                        <i className="fa fa-user-tie"></i>
                                                                    </div>
                                                                    <h6 className="font-w600">No Contacts Added</h6>
                                                                    <p className="text-muted mb-3" style={{ fontSize: '13px' }}>Assign manager and supervisor contacts for this factory</p>
                                                                    <Button 
                                                                        variant="outline-primary" 
                                                                        size="sm"
                                                                        onClick={() => { 
                                                                            setEditItemId(null); 
                                                                            setContactForm({ manager_name: '', email: '', phone: '', is_primary: true }); 
                                                                            setShowContactModal(true); 
                                                                        }}
                                                                    >
                                                                        <i className="fa fa-plus me-1"></i> Add First Contact
                                                                    </Button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </Tab.Pane>

                                {/* TAB 4: WAREHOUSES */}
                                <Tab.Pane eventKey="fa-warehouses">
                                    <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                                        <div>
                                            <h5 className="mb-1 font-w600">Factory Warehouses</h5>
                                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Storage and dispatch facilities tied directly to this factory</p>
                                        </div>
                                        <CreateButton 
                                            module="company" 
                                            onClick={() => { 
                                                setEditItemId(null); 
                                                setWarehouseForm({ name: '', code: '', total_capacity: '', capacity_unit: 'units', is_active: true, branch: factory.branch || null, factory: id }); 
                                                setShowWarehouseModal(true); 
                                            }}
                                        >
                                            Warehouse
                                        </CreateButton>
                                    </div>

                                    <div className="factory-table-card">
                                        <div className="table-responsive">
                                            <table className="table table-custom mb-0">
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: '60px' }}>#</th>
                                                        <th>Warehouse Name & Code</th>
                                                        <th>Total Capacity</th>
                                                        <th>Status</th>
                                                        <th className="text-end">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {factoryWarehouses.map((w, idx) => (
                                                        <tr key={w.id}>
                                                            <td><span className="text-muted fw-bold">{idx + 1}</span></td>
                                                            <td>
                                                                <div className="d-flex align-items-center gap-2">
                                                                    <div className="stat-icon-circle" style={{ width: '36px', height: '36px', backgroundColor: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6', fontSize: '14px' }}>
                                                                        <i className="fa fa-warehouse"></i>
                                                                    </div>
                                                                    <div>
                                                                        <span className="fw-semibold text-dark d-block">{w.name}</span>
                                                                        <small className="text-muted">Code: <code>{w.code}</code></small>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <Badge bg="light" text="dark" className="border px-2 py-1">
                                                                    <i className="fa fa-cubes me-1 text-primary"></i>
                                                                    {w.total_capacity} {w.capacity_unit}
                                                                </Badge>
                                                            </td>
                                                            <td>
                                                                <Badge bg={w.is_active ? 'success' : 'danger'} pill className="px-3 py-1">
                                                                    {w.is_active ? 'Active' : 'Inactive'}
                                                                </Badge>
                                                            </td>
                                                            <td className="text-end">
                                                                <div className="d-flex justify-content-end gap-1">
                                                                    <button 
                                                                        className="action-btn btn-view" 
                                                                        title="Manage Warehouse Details" 
                                                                        onClick={() => navigate(`/warehouse-details/${w.id}`)}
                                                                    >
                                                                        <i className="fa fa-list"></i>
                                                                    </button>
                                                                    <EditButton module="company" onClick={() => { setEditItemId(w.id); setWarehouseForm(w); setShowWarehouseModal(true); }} />
                                                                    <DeleteButton module="company" onClick={() => handleDelete('warehouse', w.id)} />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {factoryWarehouses.length === 0 && (
                                                        <tr>
                                                            <td colSpan="5">
                                                                <div className="empty-state-box">
                                                                    <div className="empty-state-icon">
                                                                        <i className="fa fa-warehouse"></i>
                                                                    </div>
                                                                    <h6 className="font-w600">No Warehouses Configured</h6>
                                                                    <p className="text-muted mb-3" style={{ fontSize: '13px' }}>Create and link warehouses attached to this production facility</p>
                                                                    <Button 
                                                                        variant="outline-primary" 
                                                                        size="sm"
                                                                        onClick={() => { 
                                                                            setEditItemId(null); 
                                                                            setWarehouseForm({ name: '', code: '', total_capacity: '', capacity_unit: 'units', is_active: true, branch: factory.branch || null, factory: id }); 
                                                                            setShowWarehouseModal(true); 
                                                                        }}
                                                                    >
                                                                        <i className="fa fa-plus me-1"></i> Add First Warehouse
                                                                    </Button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </Tab.Pane>

                                {/* TAB 5: LICENSES */}
                                <Tab.Pane eventKey="fa-licenses">
                                    <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                                        <div>
                                            <h5 className="mb-1 font-w600">Factory Compliance & Licenses</h5>
                                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Regulatory certifications, pollution control, and industrial operating permits</p>
                                        </div>
                                        <div className="d-flex gap-2 align-items-center flex-wrap">
                                            <div style={{ width: '280px', position: 'relative' }}>
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
                                                    setLicenseRows([{
                                                        master_license_id: masterLicenses[5]?.id || 6,
                                                        license_name: masterLicenses[5]?.license_name || 'Factory License',
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

                                    <div className="factory-table-card">
                                        <div className="table-responsive">
                                            <table className="table table-custom mb-0">
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: '60px' }}>#</th>
                                                        <th>License Name</th>
                                                        <th>License Number</th>
                                                        <th>Issue Date</th>
                                                        <th>Expiry Date</th>
                                                        <th>Status</th>
                                                        <th className="text-end">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {factoryLicenses.filter(l => (l.license_name || '').toLowerCase().includes(licenseSearchTerm.toLowerCase()) || (l.license_no || '').toLowerCase().includes(licenseSearchTerm.toLowerCase())).length === 0 ? (
                                                        <tr>
                                                            <td colSpan="7">
                                                                <div className="empty-state-box">
                                                                    <div className="empty-state-icon">
                                                                        <i className="fa fa-id-card"></i>
                                                                    </div>
                                                                    <h6 className="font-w600">No Licenses Found</h6>
                                                                    <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                                                        {licenseSearchTerm ? 'No licenses matched your search criteria.' : 'No compliance licenses registered for this factory.'}
                                                                    </p>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        factoryLicenses
                                                            .filter(l => (l.license_name || '').toLowerCase().includes(licenseSearchTerm.toLowerCase()) || (l.license_no || '').toLowerCase().includes(licenseSearchTerm.toLowerCase()))
                                                            .map((l, idx) => (
                                                                <tr key={l.id}>
                                                                    <td><span className="text-muted fw-bold">{idx + 1}</span></td>
                                                                    <td>
                                                                        <div className="d-flex align-items-center gap-2">
                                                                            <i className="fa fa-certificate text-warning" style={{ fontSize: '14px' }}></i>
                                                                            <span className="fw-semibold text-dark">{l.license_name}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td><code>{l.license_no}</code></td>
                                                                    <td>{l.issue_date || '-'}</td>
                                                                    <td>
                                                                        <Badge bg="light" text="dark" className="border px-2 py-1">
                                                                            <i className="fa fa-calendar-alt me-1 text-muted"></i>
                                                                            {l.expiry_date || 'N/A'}
                                                                        </Badge>
                                                                    </td>
                                                                    <td>
                                                                        <Badge bg={l.is_active ? 'success' : 'danger'} pill className="px-3 py-1">
                                                                            {l.is_active ? 'Active' : 'Inactive'}
                                                                        </Badge>
                                                                    </td>
                                                                    <td className="text-end">
                                                                        <div className="d-flex justify-content-end gap-1">
                                                                            <EditButton module="company" onClick={() => { setEditItemId(l.id); setLicenseRows([{ ...l }]); setShowLicenseModal(true); }} />
                                                                            <DeleteButton module="company" onClick={() => handleDeleteFactoryLicense(l.id)} />
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </Tab.Pane>
                            </Tab.Content>
                        </Tab.Container>
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
                                {editItemId ? 'Update the factory address details' : 'Enter the factory address details'}
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
                            <Form.Label className="form-label-custom">Address Line 2</Form.Label>
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
                        <div className="mb-2">
                            <Form.Check type="checkbox" id="fa-def-addr" label="Set as Default Address" checked={addressForm.is_default} onChange={e => setAddressForm({ ...addressForm, is_default: e.target.checked })} className="form-check-input-custom" />
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={() => setShowAddressModal(false)}>Cancel</Button>
                        <Button type="submit" className="btn-save-custom">{editItemId ? 'Update' : 'Save'}</Button>
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
                                {editItemId ? 'Update the factory contact details' : 'Enter the factory contact details'}
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowContactModal(false)}>&times;</button>
                </div>
                <Form onSubmit={handleContactSubmit} onKeyDown={handleFormKeyDown('.contact-custom-modal')}>
                    <div className="modal-body-custom">
                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Manager Name <span className="text-danger">*</span></Form.Label>
                            <Form.Control type="text" className="form-control-custom" required value={contactForm.manager_name} placeholder="e.g., John Doe" onChange={e => setContactForm({ ...contactForm, manager_name: e.target.value })} autoFocus />
                        </div>
                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Email <span className="text-danger">*</span></Form.Label>
                            <Form.Control type="email" className="form-control-custom" required value={contactForm.email} placeholder="e.g., manager@factory.com" onChange={e => setContactForm({ ...contactForm, email: e.target.value })} />
                        </div>
                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Phone <span className="text-danger">*</span></Form.Label>
                            <Form.Control type="text" className="form-control-custom" required value={contactForm.phone} placeholder="e.g., +91 9876543210" onChange={e => setContactForm({ ...contactForm, phone: e.target.value })} />
                        </div>
                        <div className="mb-2">
                            <Form.Check type="checkbox" id="fa-pri-con" label="Set as Primary Contact" checked={contactForm.is_primary} onChange={e => setContactForm({ ...contactForm, is_primary: e.target.checked })} className="form-check-input-custom" />
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={() => setShowContactModal(false)}>Cancel</Button>
                        <Button type="submit" className="btn-save-custom">{editItemId ? 'Update' : 'Save'}</Button>
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
                                Manage warehouse storage units attached to this factory
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowWarehouseModal(false)}>&times;</button>
                </div>
                <Form onSubmit={handleWarehouseSubmit} onKeyDown={handleFormKeyDown('.warehouse-custom-modal')}>
                    <div className="modal-body-custom">
                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Warehouse Name <span className="text-danger">*</span></Form.Label>
                            <Form.Control type="text" className="form-control-custom" required value={warehouseForm.name} placeholder="e.g., Main Warehouse" onChange={e => setWarehouseForm({ ...warehouseForm, name: e.target.value })} autoFocus />
                        </div>
                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Warehouse Code <span className="text-danger">*</span></Form.Label>
                            <Form.Control type="text" className="form-control-custom" required value={warehouseForm.code} placeholder="e.g., WH-001" onChange={e => setWarehouseForm({ ...warehouseForm, code: e.target.value })} />
                        </div>
                        <div className="row">
                            <div className="col-6 mb-3">
                                <Form.Label className="form-label-custom">Total Capacity <span className="text-danger">*</span></Form.Label>
                                <Form.Control type="number" className="form-control-custom" required value={warehouseForm.total_capacity} placeholder="e.g., 1000" onChange={e => setWarehouseForm({ ...warehouseForm, total_capacity: e.target.value })} />
                            </div>
                            <div className="col-6 mb-3">
                                <Form.Label className="form-label-custom">Capacity Unit <span className="text-danger">*</span></Form.Label>
                                <select className="form-control-custom" value={warehouseForm.capacity_unit} onChange={e => setWarehouseForm({ ...warehouseForm, capacity_unit: e.target.value })}>
                                    <option value="kg">Kilograms (kg)</option>
                                    <option value="ton">Tons</option>
                                    <option value="litre">Litres</option>
                                    <option value="m3">Cubic Meter (m³)</option>
                                    <option value="units">Units</option>
                                </select>
                            </div>
                        </div>
                        <div className="mb-2">
                            <Form.Check type="checkbox" id="wh-act" label="Active" checked={warehouseForm.is_active} onChange={e => setWarehouseForm({ ...warehouseForm, is_active: e.target.checked })} className="form-check-input-custom" />
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={() => setShowWarehouseModal(false)}>Cancel</Button>
                        <Button type="submit" className="btn-save-custom">{editItemId ? 'Update Warehouse' : 'Save Warehouse'}</Button>
                    </div>
                </Form>
            </Modal>

            {/* FACTORY LICENSE MODAL */}
            <Modal show={showLicenseModal} onHide={() => setShowLicenseModal(false)} dialogClassName="factory-custom-modal" centered size="xl">
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle" style={{ backgroundColor: '#7A70BA', width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <i className="fa fa-id-card text-white fs-4"></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editItemId ? 'Edit Factory License' : 'Add Factory License(s)'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Assign compliance licenses with auto-calculated expiry dates
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowLicenseModal(false)}>&times;</button>
                </div>
                <Form onSubmit={handleFactoryLicenseSubmit} onKeyDown={handleFormKeyDown('.factory-custom-modal')}>
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
                                        placeholder="E.g., 5222, 10020042001234"
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
                                        id={`fa-lic-check-${index}`}
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
        </Fragment>
    );
};

export default FactoryDetails;
