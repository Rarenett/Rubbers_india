import React, { useState, useEffect, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Modal, Button, Tab, Nav, Form, Badge } from 'react-bootstrap';
import Swal from 'sweetalert2';
import CreateButton from '../../components/permissions/CreateButton';
import EditButton from '../../components/permissions/EditButton';
import DeleteButton from '../../components/permissions/DeleteButton';
import {
    fetchWarehouseById,
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
    }
};

const WarehouseDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [warehouse, setWarehouse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [warehouseAddresses, setWarehouseAddresses] = useState([]);
    const [warehouseContacts, setWarehouseContacts] = useState([]);

    // Modals
    const [showAddressModal, setShowAddressModal] = useState(false);
    const [showContactModal, setShowContactModal] = useState(false);
    const [editItemId, setEditItemId] = useState(null);

    // Form states
    const [addressForm, setAddressForm] = useState({
        address_line_1: '',
        address_line_2: '',
        city: '',
        state: '',
        country: '',
        pincode: ''
    });

    const [contactForm, setContactForm] = useState({
        contact_person: '',
        email: '',
        phone: '',
        is_primary: true
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
            loadWarehouseData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const loadWarehouseData = async () => {
        try {
            setLoading(true);
            const res = await fetchWarehouseById(id);
            setWarehouse(res.data);
            await loadRelatedData();
        } catch (error) {
            console.error('Failed to load warehouse details:', error);
            Swal.fire('Error', 'Failed to load warehouse details', 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadRelatedData = async () => {
        try {
            const [addrRes, contactRes] = await Promise.all([
                fetchWarehouseAddresses(id),
                fetchWarehouseContacts(id)
            ]);
            setWarehouseAddresses(addrRes.data);
            setWarehouseContacts(contactRes.data);
        } catch (error) {
            console.error('Failed to load warehouse related data:', error);
        }
    };

    const handleAddressSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...addressForm, warehouse: id };
            if (editItemId) await updateWarehouseAddress(editItemId, payload);
            else await createWarehouseAddress(payload);
            setShowAddressModal(false);
            loadRelatedData();
        } catch (error) {
            Swal.fire('Error', formatCompanyError(error), 'error');
        }
    };

    const handleContactSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...contactForm, warehouse: id };
            if (editItemId) await updateWarehouseContact(editItemId, payload);
            else await createWarehouseContact(payload);
            setShowContactModal(false);
            loadRelatedData();
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
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                if (type === 'address') await deleteWarehouseAddress(itemId);
                else if (type === 'contact') await deleteWarehouseContact(itemId);

                Swal.fire('Deleted!', 'Item has been deleted.', 'success');
                loadRelatedData();
            } catch (error) {
                Swal.fire('Error', formatCompanyError(error), 'error');
            }
        }
    };

    if (loading) return <div className="text-center p-5"><div className="spinner-border text-primary"></div></div>;
    if (!warehouse) return <div className="text-center p-5"><h4>Warehouse not found</h4><Button onClick={() => navigate('/company-settings?tab=warehouses')}>Go Back</Button></div>;

    const showAddressTab = !warehouse.branch && !warehouse.factory;

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

        /* Custom Modals matching BranchDetails */
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
                                {warehouse.name}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Hero Overview Banner Card */}
                <div className="factory-hero-card">
                    <div className="row align-items-center g-3">
                        <div className="col-lg-6 col-md-12">
                            <div className="d-flex align-items-center gap-3">
                                <div className="factory-icon-badge" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)', boxShadow: '0 8px 16px rgba(139, 92, 246, 0.2)' }}>
                                    <i className="fa fa-warehouse text-white" style={{ fontSize: '24px' }}></i>
                                </div>
                                <div>
                                    <div className="d-flex align-items-center gap-2 flex-wrap">
                                        <h3 className="mb-0 font-w700" style={{ fontSize: '22px' }}>
                                            {warehouse.name}
                                        </h3>
                                        
                                        {warehouse.is_default && (
                                            <Badge bg="primary" pill style={{ fontSize: '11px', padding: '5px 10px' }}>
                                                Default
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="d-flex align-items-center gap-3 mt-2 flex-wrap text-muted" style={{ fontSize: '13px' }}>
                                        <span className="d-flex align-items-center gap-1">
                                            <i className="fa fa-barcode text-primary"></i>
                                            <strong>Code:</strong> <code>{warehouse.code || 'N/A'}</code>
                                        </span>
                                        <span className="d-flex align-items-center gap-1">
                                            <i className="fa fa-box text-info"></i>
                                            <strong>Capacity:</strong> {warehouse.total_capacity ? `${warehouse.total_capacity} ${warehouse.capacity_unit}` : 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Metric summary cards */}
                        <div className="col-lg-6 col-md-12">
                            <div className="row g-2 justify-content-end">
                                <div className="col-6 col-sm-6 col-md-4">
                                    <div className="stat-metric-card">
                                        <div className="stat-icon-circle" style={{ backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
                                            <i className="fa fa-map-marker-alt"></i>
                                        </div>
                                        <div>
                                            <div className="text-muted" style={{ fontSize: '11px', fontWeight: '600' }}>ADDRESSES</div>
                                            <h5 className="mb-0 font-w700" style={{ fontSize: '18px' }}>{warehouseAddresses.length}</h5>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-6 col-sm-6 col-md-4">
                                    <div className="stat-metric-card">
                                        <div className="stat-icon-circle" style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
                                            <i className="fa fa-users"></i>
                                        </div>
                                        <div>
                                            <div className="text-muted" style={{ fontSize: '11px', fontWeight: '600' }}>CONTACTS</div>
                                            <h5 className="mb-0 font-w700" style={{ fontSize: '18px' }}>{warehouseContacts.length}</h5>
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
                                <Tab.Container defaultActiveKey={showAddressTab ? 'wh-addresses' : 'wh-info'}>
                                    <div className="d-flex justify-content-between align-items-center mb-4" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '2px' }}>
                                        <Nav className="nav nav-tabs border-bottom-0 mb-0">
                                        <Nav.Item>
                                            <Nav.Link eventKey="wh-info" className="custom-tab-link"><i className="fa fa-info-circle"></i> Warehouse Details</Nav.Link>
                                        </Nav.Item>
                                        {showAddressTab && (
                                            <Nav.Item>
                                                <Nav.Link eventKey="wh-addresses" className="custom-tab-link"><i className="fa fa-map-marker-alt"></i> Address <Badge bg="light" text="dark" pill className="ms-1 border">{warehouseAddresses.length}</Badge></Nav.Link>
                                            </Nav.Item>
                                        )}
                                        <Nav.Item>
                                            <Nav.Link eventKey="wh-contacts" className="custom-tab-link"><i className="fa fa-users"></i> Contacts <Badge bg="light" text="dark" pill className="ms-1 border">{warehouseContacts.length}</Badge></Nav.Link>
                                        </Nav.Item>
                                        </Nav>
                                        <Button 
                                            variant="outline-secondary" 
                                            size="sm" 
                                            className="me-2"
                                            onClick={() => navigate('/company-settings?tab=warehouses')}
                                            style={{ borderRadius: '8px', fontSize: '13px', padding: '6px 12px' }}
                                        >
                                            <i className="fa fa-arrow-left me-1"></i> Back to Warehouses
                                        </Button>
                                    </div>
                                    <Tab.Content>
                                        <Tab.Pane eventKey="wh-info" className="mb-3">
                                            <div className="row g-3 mt-2">
                                                <div className="col-md-6 col-lg-4">
                                                    <div className="info-property-card">
                                                        <div className="info-property-label">
                                                            <i className="fa fa-warehouse text-primary"></i> Warehouse Name
                                                        </div>
                                                        <div className="info-property-value">{warehouse.name}</div>
                                                    </div>
                                                </div>

                                                <div className="col-md-6 col-lg-4">
                                                    <div className="info-property-card">
                                                        <div className="info-property-label">
                                                            <i className="fa fa-barcode text-primary"></i> Warehouse Code
                                                        </div>
                                                        <div className="info-property-value">
                                                            <code>{warehouse.code}</code>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="col-md-6 col-lg-4">
                                                    <div className="info-property-card">
                                                        <div className="info-property-label">
                                                            <i className="fa fa-box-open text-warning"></i> Total Capacity
                                                        </div>
                                                        <div className="info-property-value">{warehouse.total_capacity ? `${warehouse.total_capacity} ${warehouse.capacity_unit}` : 'N/A'}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </Tab.Pane>
                                        {showAddressTab && (
                                            <Tab.Pane eventKey="wh-addresses">
                                                <div className="d-flex justify-content-between align-items-center mb-3">
                                                <div>
                                                    <h5 className="mb-1 font-w600">Address</h5>
                                                    <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Physical and postal location registered for this warehouse</p>
                                                </div>
                                                    <CreateButton module="company" onClick={() => { setEditItemId(null); setAddressForm({ address_line_1: '', address_line_2: '', city: '', state: '', country: warehouse.country || '', pincode: '' }); setShowAddressModal(true); }}>Address</CreateButton>
                                                </div>
                                                <div className="table-responsive">
                                                    <table className="table table-custom">
                                                        <thead><tr><th>Address</th><th>City/State</th><th>Actions</th></tr></thead>
                                                        <tbody>
                                                            {warehouseAddresses.map(a => (
                                                                <tr key={a.id}>
                                                                    <td>{a.address_line_1}</td>
                                                                    <td>{a.city}, {a.state}</td>
                                                                    <td>
                                                                        <div className="d-flex gap-1">
                                                                            <EditButton module="company" onClick={() => { setEditItemId(a.id); setAddressForm(a); setShowAddressModal(true); }} />
                                                                            <DeleteButton module="company" onClick={() => handleDelete('address', a.id)} />
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                            {warehouseAddresses.length === 0 && <tr><td colSpan="3" className="text-center text-muted">No address added.</td></tr>}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </Tab.Pane>
                                        )}
                                        <Tab.Pane eventKey="wh-contacts">
                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                            <div>
                                                <h5 className="mb-1 font-w600">Contacts</h5>
                                                <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Primary and secondary contact persons for this warehouse</p>
                                            </div>
                                                <CreateButton module="company" onClick={() => { setEditItemId(null); setContactForm({ contact_person: '', email: '', phone: '', is_primary: true }); setShowContactModal(true); }}>Contact</CreateButton>
                                            </div>
                                            <div className="table-responsive">
                                                <table className="table table-custom">
                                                    <thead><tr><th>Contact Person</th><th>Email</th><th>Phone</th><th>Primary</th><th>Actions</th></tr></thead>
                                                    <tbody>
                                                        {warehouseContacts.map(c => (
                                                            <tr key={c.id}>
                                                                <td>{c.contact_person}</td>
                                                                <td>{c.email}</td>
                                                                <td>{c.phone}</td>
                                                                <td>{c.is_primary ? <span className="badge badge-primary-custom">Primary</span> : <span className="text-muted">No</span>}</td>
                                                                <td>
                                                                    <div className="d-flex gap-1">
                                                                        <EditButton module="company" onClick={() => { setEditItemId(c.id); setContactForm(c); setShowContactModal(true); }} />
                                                                        <DeleteButton module="company" onClick={() => handleDelete('contact', c.id)} />
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {warehouseContacts.length === 0 && <tr><td colSpan="5" className="text-center text-muted">No contacts added.</td></tr>}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </Tab.Pane>
                                    </Tab.Content>
                                </Tab.Container>
                            </div>
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
                                {editItemId ? 'Update the warehouse address details' : 'Enter the warehouse address details'}
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
                                {editItemId ? 'Update the warehouse contact details' : 'Enter the warehouse contact details'}
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowContactModal(false)}>&times;</button>
                </div>
                <Form onSubmit={handleContactSubmit} onKeyDown={handleFormKeyDown('.contact-custom-modal')}>
                    <div className="modal-body-custom">
                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Contact Person <span className="text-danger">*</span></Form.Label>
                            <Form.Control type="text" className="form-control-custom" required value={contactForm.contact_person} placeholder="e.g., John Doe" onChange={e => setContactForm({ ...contactForm, contact_person: e.target.value })} autoFocus />
                        </div>
                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Email <span className="text-danger">*</span></Form.Label>
                            <Form.Control type="email" className="form-control-custom" required value={contactForm.email} placeholder="e.g., john@example.com" onChange={e => setContactForm({ ...contactForm, email: e.target.value })} />
                        </div>
                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Phone <span className="text-danger">*</span></Form.Label>
                            <Form.Control type="text" className="form-control-custom" required value={contactForm.phone} placeholder="e.g., +91 9876543210" onChange={e => setContactForm({ ...contactForm, phone: e.target.value })} />
                        </div>
                        <div className="mb-3">
                            <Form.Check type="checkbox" id="wh-pri-con" label="Set as Primary" checked={contactForm.is_primary} onChange={e => setContactForm({ ...contactForm, is_primary: e.target.checked })} className="form-check-input-custom" />
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={() => setShowContactModal(false)}>Cancel</Button>
                        <Button type="submit" className="btn-save-custom">Save</Button>
                    </div>
                </Form>
            </Modal>
        </Fragment>
    );
};

export default WarehouseDetails;
