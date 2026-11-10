import React, { useState, useEffect, useMemo } from 'react';
import { Button, Modal, Form, Row, Col, Card, Nav, Tab } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import Swal from 'sweetalert2';
import axiosInstance from '../../../services/AxiosInstance';
import { usePageTitle } from '../../../context/TitleContext';
import { usePermission } from '../../../hooks/usePermission';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import { getStockItems } from '../../../services/CRMNewService';

const CRITERIA_TYPES = [
    { value: 'Amount Based', label: 'Purchase Amount Based' },
    { value: 'Product Based', label: 'Product Quantity Based' },
    { value: 'Service Based', label: 'Service Based' },
];

const STATUS_CHOICES = [
    { value: 'Active', label: 'Active' },
    { value: 'Draft', label: 'Draft' },
    { value: 'Expired', label: 'Expired' },
    { value: 'Cancelled', label: 'Cancelled' },
];

const initialForm = {
    title: '',
    code: '',
    description: '',
    terms_and_conditions: '',
    criteria_type: 'Amount Based',
    category: null,
    offer_type: 'Percentage',
    discount_percent: '',
    discount_amount: '',
    max_discount_amount: '',
    min_purchase_amount: '',
    start_date: '',
    end_date: '',
    status: 'Active',
    is_active: true
};

const createEmptyAmountRow = () => ({
    _tempId: `row_amt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    product: null,
    product_name: '',
    min_purchase_amount: '',
    discount_type: 'Percentage',
    discount_value: ''
});

const createEmptyProductRow = () => ({
    _tempId: `row_prd_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    product: null,
    product_name: '',
    quantity: '',
    discount_percentage: '',
    discount_value: ''
});

const createEmptyServiceRow = () => ({
    _tempId: `row_srv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    service: null,
    service_name: '',
    discount_percentage: '',
    discount_value: ''
});

const tableSelectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: '34px',
        height: '34px',
        fontSize: '12.5px',
        borderColor: state.isFocused ? '#0a500f' : '#cbd5e1',
        borderRadius: '6px',
        backgroundColor: '#ffffff',
        boxShadow: state.isFocused ? '0 0 0 2px rgba(10, 80, 15, 0.2)' : 'none',
        '&:hover': {
            borderColor: state.isFocused ? '#0a500f' : '#94a3b8'
        }
    }),
    valueContainer: (base) => ({
        ...base,
        padding: '0 8px',
        height: '34px'
    }),
    input: (base) => ({
        ...base,
        margin: 0,
        padding: 0
    }),
    indicatorsContainer: (base) => ({
        ...base,
        height: '34px'
    }),
    dropdownIndicator: (base) => ({
        ...base,
        padding: '4px'
    }),
    clearIndicator: (base) => ({
        ...base,
        padding: '4px'
    }),
    menuPortal: (base) => ({
        ...base,
        zIndex: 99999
    }),
    menu: (base) => ({
        ...base,
        zIndex: 99999,
        fontSize: '12.5px',
        borderRadius: '8px',
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.12)',
        border: '1px solid #e2e8f0',
        overflow: 'hidden'
    }),
    menuList: (base) => ({
        ...base,
        padding: '4px',
        maxHeight: '220px'
    }),
    option: (base, state) => ({
        ...base,
        fontSize: '12.5px',
        padding: '6px 12px',
        borderRadius: '4px',
        backgroundColor: state.isSelected ? '#0a500f' : state.isFocused ? '#f1f5f9' : 'transparent',
        color: state.isSelected ? '#ffffff' : '#334155',
        cursor: 'pointer',
        '&:active': {
            backgroundColor: '#0a500f',
            color: '#ffffff'
        }
    })
};

const CrmOfferList = () => {
    usePageTitle('Offers');
    const navigate = useNavigate();
    const { can } = usePermission();

    const [offers, setOffers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Master options for dropdowns
    const [productOptions, setProductOptions] = useState([]);
    const [serviceOptions, setServiceOptions] = useState([]);
    const [categoryOptions, setCategoryOptions] = useState([]);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [activeTab, setActiveTab] = useState('general');
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState(initialForm);
    const [criteriaRows, setCriteriaRows] = useState([createEmptyAmountRow()]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchData();
        loadMasterOptions();
    }, []);

    const loadMasterOptions = async () => {
        try {
            // Load products/stock items
            const prdRes = await getStockItems();
            const rawPrds = Array.isArray(prdRes.data) ? prdRes.data : (prdRes.data?.results || []);
            setProductOptions(
                rawPrds.map(p => ({
                    value: p.id,
                    label: p.stock_item_name || p.name || `Product #${p.id}`
                }))
            );
        } catch (e) {
            console.error('Error loading products for offers:', e);
        }

        try {
            // Load CRM services
            let srvRes;
            try {
                srvRes = await axiosInstance.get('/api/crm_new/services/');
            } catch {
                srvRes = await axiosInstance.get('/api/crm/services/');
            }
            const rawSrv = Array.isArray(srvRes.data) ? srvRes.data : (srvRes.data?.results || []);
            setServiceOptions(
                rawSrv.map(s => ({
                    value: s.id,
                    label: s.name
                }))
            );
        } catch (e) {
            console.error('Error loading services for offers:', e);
        }

        try {
            // Load Lead Categories
            let catRes;
            try {
                catRes = await axiosInstance.get('/api/crm_new/categories/');
            } catch {
                catRes = await axiosInstance.get('/api/crm/categories/');
            }
            const rawCat = Array.isArray(catRes.data) ? catRes.data : (catRes.data?.results || []);
            setCategoryOptions(rawCat.filter(c => c.is_active !== false));
        } catch (e) {
            console.error('Error loading categories for offers:', e);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            let res;
            try {
                res = await axiosInstance.get('/api/crm_new/offers/');
            } catch (fallbackErr) {
                res = await axiosInstance.get('/api/crm/offers/');
            }
            const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            setOffers(data);
        } catch (err) {
            console.error('Error fetching offers:', err);
            Swal.fire('Error', 'Failed to fetch offers', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleShowModal = (offer = null) => {
        setActiveTab('general');
        if (offer) {
            setEditId(offer.id);
            const cType = offer.criteria_type || 'Amount Based';
            setFormData({
                title: offer.title || '',
                code: offer.code || '',
                category: offer.category || null,
                description: offer.description || '',
                terms_and_conditions: offer.terms_and_conditions || '',
                criteria_type: cType,
                offer_type: offer.offer_type || 'Percentage',
                discount_percent: offer.discount_percent ?? '',
                discount_amount: offer.discount_amount ?? '',
                max_discount_amount: offer.max_discount_amount ?? '',
                min_purchase_amount: offer.min_purchase_amount ?? '',
                start_date: offer.start_date || '',
                end_date: offer.end_date || '',
                status: offer.status || 'Active',
                is_active: offer.is_active !== undefined ? offer.is_active : true
            });

            if (Array.isArray(offer.criteria_rows) && offer.criteria_rows.length > 0) {
                setCriteriaRows(
                    offer.criteria_rows.map(r => ({
                        ...r,
                        _tempId: r._tempId || `row_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
                    }))
                );
            } else {
                setCriteriaRows(
                    cType === 'Product Based'
                        ? [createEmptyProductRow()]
                        : cType === 'Service Based'
                        ? [createEmptyServiceRow()]
                        : [createEmptyAmountRow()]
                );
            }
        } else {
            setEditId(null);
            setFormData(initialForm);
            setCriteriaRows([createEmptyAmountRow()]);
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditId(null);
        setFormData(initialForm);
        setCriteriaRows([createEmptyAmountRow()]);
    };

    const handleCriteriaTypeChange = (newType) => {
        setFormData(prev => ({ ...prev, criteria_type: newType }));
        // Reset criteria rows to match the new type
        if (newType === 'Product Based') {
            setCriteriaRows([createEmptyProductRow()]);
        } else if (newType === 'Service Based') {
            setCriteriaRows([createEmptyServiceRow()]);
        } else {
            setCriteriaRows([createEmptyAmountRow()]);
        }
    };

    const handleAddCriteriaRow = () => {
        if (formData.criteria_type === 'Product Based') {
            setCriteriaRows(prev => [...prev, createEmptyProductRow()]);
        } else if (formData.criteria_type === 'Service Based') {
            setCriteriaRows(prev => [...prev, createEmptyServiceRow()]);
        } else {
            setCriteriaRows(prev => [...prev, createEmptyAmountRow()]);
        }
    };

    const handleRemoveCriteriaRow = (tempId) => {
        if (criteriaRows.length <= 1) {
            Swal.fire('Info', 'At least one criteria row is required.', 'info');
            return;
        }
        setCriteriaRows(prev => prev.filter(r => r._tempId !== tempId));
    };

    const handleCriteriaRowChange = (tempId, field, value) => {
        setCriteriaRows(prev =>
            prev.map(r => {
                if (r._tempId !== tempId) return r;
                return { ...r, [field]: value };
            })
        );
    };

    const handleSaveAndNext = (e) => {
        if (e) e.preventDefault();
        const trimmedTitle = (formData.title || '').trim();
        if (!trimmedTitle) {
            Swal.fire('Warning', 'Offer Name is required', 'warning');
            setActiveTab('general');
            return;
        }

        if (formData.start_date && formData.end_date) {
            if (new Date(formData.end_date) < new Date(formData.start_date)) {
                Swal.fire('Warning', 'End date cannot be earlier than start date', 'warning');
                setActiveTab('general');
                return;
            }
        }
        setActiveTab('criteria');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (activeTab === 'general') {
            handleSaveAndNext(e);
            return;
        }
        const trimmedTitle = (formData.title || '').trim();
        if (!trimmedTitle) {
            Swal.fire('Warning', 'Offer Name is required', 'warning');
            setActiveTab('general');
            return;
        }

        if (formData.start_date && formData.end_date) {
            if (new Date(formData.end_date) < new Date(formData.start_date)) {
                Swal.fire('Warning', 'End date cannot be earlier than start date', 'warning');
                setActiveTab('general');
                return;
            }
        }

        // Clean up criteria rows
        const cleanedRows = criteriaRows.map(row => {
            const copy = { ...row };
            delete copy._tempId;
            return copy;
        });

        // Compute top-level discount/benefit values from row 0 for backward compatibility
        let discountPercent = formData.discount_percent !== '' ? formData.discount_percent : null;
        let discountAmount = formData.discount_amount !== '' ? formData.discount_amount : null;
        let minPurchase = formData.min_purchase_amount !== '' ? formData.min_purchase_amount : null;
        let maxDiscount = formData.max_discount_amount !== '' ? formData.max_discount_amount : null;

        if (cleanedRows.length > 0) {
            const first = cleanedRows[0];
            if (formData.criteria_type === 'Amount Based') {
                if (first.min_purchase_amount) minPurchase = first.min_purchase_amount;
                if (first.max_discount_amount) maxDiscount = first.max_discount_amount;
                if (first.discount_type === 'Percentage') {
                    discountPercent = first.discount_value || null;
                } else if (first.discount_type === 'Flat Amount') {
                    discountAmount = first.discount_value || null;
                }
            } else if (formData.criteria_type === 'Product Based' || formData.criteria_type === 'Service Based') {
                if (first.discount_percentage) discountPercent = first.discount_percentage;
                if (first.discount_value) discountAmount = first.discount_value;
            }
        }

        const payload = {
            title: trimmedTitle,
            code: (formData.code || '').trim() || null,
            description: (formData.description || '').trim() || null,
            terms_and_conditions: (formData.terms_and_conditions || '').trim() || null,
            criteria_type: formData.criteria_type,
            criteria_rows: cleanedRows,
            offer_type: formData.criteria_type === 'Product Based' ? 'Buy X Get Y' : (formData.criteria_type === 'Service Based' ? 'Free service' : 'Percentage'),
            discount_percent: discountPercent,
            discount_amount: discountAmount,
            max_discount_amount: maxDiscount,
            min_purchase_amount: minPurchase,
            start_date: formData.start_date || null,
            end_date: formData.end_date || null,
            status: formData.status,
            is_active: !!formData.is_active
        };

        setSaving(true);
        try {
            if (editId) {
                try {
                    await axiosInstance.put(`/api/crm_new/offers/${editId}/`, payload);
                } catch {
                    await axiosInstance.put(`/api/crm/offers/${editId}/`, payload);
                }
                Swal.fire('Updated', 'Offer updated successfully', 'success');
            } else {
                try {
                    await axiosInstance.post('/api/crm_new/offers/', payload);
                } catch {
                    await axiosInstance.post('/api/crm/offers/', payload);
                }
                Swal.fire('Created', 'Offer created successfully', 'success');
            }
            fetchData();
            handleCloseModal();
        } catch (err) {
            console.error('Error saving offer:', err);
            const msg = err.response?.data?.code 
                ? (Array.isArray(err.response.data.code) ? err.response.data.code[0] : err.response.data.code)
                : (err.response?.data?.title ? err.response.data.title[0] : 'Operation failed. Please check inputs.');
            Swal.fire('Error', msg, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Offer?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                try {
                    await axiosInstance.delete(`/api/crm_new/offers/${id}/`);
                } catch {
                    await axiosInstance.delete(`/api/crm/offers/${id}/`);
                }
                Swal.fire('Deleted', 'Offer deleted successfully', 'success');
                fetchData();
            } catch (err) {
                console.error('Error deleting offer:', err);
                Swal.fire('Error', 'Failed to delete offer', 'error');
            }
        }
    };

    const getCriteriaSummary = (offer) => {
        const rows = offer.criteria_rows || [];
        const type = offer.criteria_type || 'Amount Based';

        if (type === 'Amount Based') {
            if (rows.length > 0 && rows[0].min_purchase_amount) {
                const r0 = rows[0];
                const disc = r0.discount_type === 'Percentage' ? `${r0.discount_value}%` : `₹${r0.discount_value}`;
                const pLabel = r0.product_name || (productOptions.find(p => p.value === r0.product)?.label);
                const scope = pLabel ? ` on ${pLabel}` : '';
                return `Min ₹${parseFloat(r0.min_purchase_amount).toLocaleString()} → ${disc} Off${scope}`;
            }
            if (offer.min_purchase_amount) {
                const disc = offer.discount_percent ? `${parseFloat(offer.discount_percent)}%` : `₹${parseFloat(offer.discount_amount || 0)}`;
                return `Min ₹${parseFloat(offer.min_purchase_amount).toLocaleString()} → ${disc} Off`;
            }
            return offer.discount_percent ? `${parseFloat(offer.discount_percent)}% Off` : (offer.discount_amount ? `₹${parseFloat(offer.discount_amount)} Off` : 'Amount Criteria');
        }

        if (type === 'Product Based') {
            if (rows.length > 0) {
                const r0 = rows[0];
                const pName = r0.product_name || (productOptions.find(p => p.value === r0.product)?.label) || 'Product';
                const disc = r0.discount_percentage ? `${r0.discount_percentage}%` : (r0.discount_value ? `₹${r0.discount_value}` : 'Discount');
                return `${pName} (Qty ${r0.quantity || 1}+) → ${disc}`;
            }
            return 'Product Quantity Scheme';
        }

        if (type === 'Service Based') {
            if (rows.length > 0) {
                const r0 = rows[0];
                const sName = r0.service_name || (serviceOptions.find(s => s.value === r0.service)?.label) || 'Service';
                const disc = r0.discount_percentage ? `${r0.discount_percentage}%` : (r0.discount_value ? `₹${r0.discount_value}` : 'Discount');
                return `${sName} → ${disc}`;
            }
            return 'Service Scheme';
        }

        return '—';
    };

    const filteredOffers = offers.filter(o =>
        (o.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.criteria_type || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentOffers = filteredOffers.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredOffers.length / itemsPerPage);

    // Custom select styles for criteria table cell - matches rendered dimensions and styling of Form.Control fields
    const tableSelectStyles = useMemo(() => ({
        control: (provided, state) => ({
            ...provided,
            backgroundColor: '#ffffff',
            borderColor: state.isFocused ? '#0a500f' : '#cbd5e1',
            borderRadius: '6px',
            fontSize: '12.5px',
            minHeight: '34px',
            height: '34px',
            boxShadow: 'none',
        }),
        valueContainer: (provided) => ({
            ...provided,
            padding: '0 8px',
            height: '100%',
        }),
        singleValue: (provided) => ({
            ...provided,
            fontSize: '12.5px',
            color: '#1e293b'
        }),
        placeholder: (provided) => ({
            ...provided,
            fontSize: '12.5px',
            color: '#94a3b8'
        }),
        menu: (provided) => ({
            ...provided,
            zIndex: 99999,
            fontSize: '12.5px'
        }),
        menuPortal: (provided) => ({
            ...provided,
            zIndex: 99999
        })
    }), []);

    return (
        <>
            <style>{`
                .item-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .item-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 22px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .item-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #0a500f;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .item-custom-modal .modal-close-x {
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
                .item-custom-modal .modal-close-x:hover {
                    color: #555;
                }
                .item-custom-modal .modal-body-custom {
                    padding: 20px 28px;
                    max-height: 75vh;
                    overflow-y: auto;
                }
                .item-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 16px 28px 20px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .item-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .item-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                    padding: 8px 12px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .item-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .item-custom-modal .btn-close-custom {
                    background-color: #dc3545 !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 9px 22px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s;
                }
                .item-custom-modal .btn-close-custom:hover {
                    background-color: #bb2d3b !important;
                }
                .item-custom-modal .btn-save-custom {
                    background-color: #0a500f !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 9px 22px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s;
                }
                .item-custom-modal .btn-save-custom:hover {
                    background-color: #073d0b !important;
                }
                .lead-category-header-container {
                    display: flex !important;
                    flex-direction: row !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    flex-wrap: wrap !important;
                    gap: 15px !important;
                }
                .lead-category-controls-wrapper {
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                    flex-wrap: wrap !important;
                }
                .lead-category-search-bar {
                    width: 300px !important;
                    position: relative !important;
                }
                .lead-category-table th {
                    white-space: nowrap !important;
                }
                .scheme-modal-nav .nav-link {
                    color: #64748b;
                    font-weight: 600;
                    font-size: 13.5px;
                    border: none;
                    border-bottom: 2px solid transparent;
                    padding: 8px 16px;
                    background: transparent;
                }
                .scheme-modal-nav .nav-link.active {
                    color: #0a500f !important;
                    border-bottom: 2px solid #0a500f !important;
                    background: transparent !important;
                }
                .criteria-table th {
                    background-color: #f8fafc;
                    font-size: 12px;
                    font-weight: 600;
                    color: #475569;
                    text-transform: uppercase;
                    padding: 10px 8px;
                }
                .criteria-table td {
                    padding: 6px 8px;
                    vertical-align: middle;
                }
            `}</style>

            <div className="container-fluid">
                <div className="row">
                    <div className="col-lg-12">
                        <Card>
                            <Card.Header className="d-flex justify-content-between align-items-center lead-category-header-container">
                                <Card.Title className="mb-0">Offers</Card.Title>
                                <div className="d-flex align-items-center gap-2 lead-category-controls-wrapper">
                                    <div className="lead-category-search-bar">
                                        <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                        <Form.Control
                                            type="text"
                                            placeholder="Search offers..."
                                            value={searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                            style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                        />
                                    </div>
                                    <Button
                                        variant="primary"
                                        onClick={() => handleShowModal()}
                                        className="d-flex align-items-center justify-content-center lead-category-add-btn"
                                        style={{ height: '38px', borderRadius: '6px', whiteSpace: 'nowrap', padding: '0 16px', backgroundColor: '#0a500f', borderColor: '#0a500f', color: 'white' }}
                                    >
                                        <i className="fa fa-plus me-2"></i>
                                        ADD OFFER
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
                                    <div className="table-responsive pb-4">
                                        <table className="table table-responsive-md lead-category-table align-middle">
                                            <thead>
                                                <tr>
                                                    <th style={{ width: '70px' }}><strong>SL.NO</strong></th>
                                                    <th><strong>OFFER NAME</strong></th>
                                                    <th><strong>CODE</strong></th>
                                                    <th><strong>CATEGORY</strong></th>
                                                    <th><strong>SCENARIO</strong></th>
                                                    <th><strong>CRITERIA / BENEFIT</strong></th>
                                                    <th><strong>DESCRIPTION</strong></th>
                                                    <th><strong>STATUS</strong></th>
                                                    <th><strong>CREATED AT</strong></th>
                                                    <th className="text-end" style={{ width: '110px' }}><strong>ACTION</strong></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {currentOffers.length > 0 ? (
                                                    currentOffers.map((offer, index) => (
                                                        <tr key={offer.id || index}>
                                                            <td>{indexOfFirstItem + index + 1}</td>
                                                            <td>
                                                                <strong className="text-dark">{offer.title}</strong>
                                                            </td>
                                                            <td>
                                                                {offer.code ? (
                                                                    <span className="badge badge-light border font-monospace text-uppercase" style={{ fontSize: '11.5px', letterSpacing: '0.5px' }}>
                                                                        {offer.code}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-muted">—</span>
                                                                )}
                                                            </td>
                                                            <td>
                                                                <span className="badge badge-secondary light" style={{ fontSize: '11px' }}>
                                                                    {offer.category_name || 'All Categories'}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className={`badge ${
                                                                    offer.criteria_type === 'Product Based' 
                                                                        ? 'badge-info light' 
                                                                        : (offer.criteria_type === 'Service Based' ? 'badge-warning light' : 'badge-primary light')
                                                                }`}>
                                                                    {offer.criteria_type || 'Amount Based'}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <strong className="text-success" style={{ fontSize: '12.5px' }}>
                                                                    {getCriteriaSummary(offer)}
                                                                </strong>
                                                            </td>
                                                            <td>
                                                                <span className="text-muted text-truncate d-inline-block" style={{ maxWidth: '200px' }} title={offer.description}>
                                                                    {offer.description || '—'}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className={`badge ${offer.is_active && offer.status === 'Active' ? 'badge-success light' : offer.status === 'Draft' ? 'badge-secondary light' : 'badge-danger light'}`}>
                                                                    {offer.status || (offer.is_active ? 'Active' : 'Inactive')}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <small className="text-muted">
                                                                    {offer.created_at ? new Date(offer.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                                </small>
                                                            </td>
                                                            <td className="text-end">
                                                                <div className="d-flex justify-content-end gap-1">
                                                                    <EditButton
                                                                        onClick={() => handleShowModal(offer)}
                                                                    />
                                                                    <DeleteButton
                                                                        onClick={() => handleDelete(offer.id, offer.title)}
                                                                    />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan="9" className="text-center py-4 text-muted">
                                                            No offers found
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap">
                                        <small className="text-muted">
                                            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredOffers.length)} of {filteredOffers.length} offers
                                        </small>
                                        <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                            <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                <button className="page-link" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                                                    <i className="la la-angle-double-left"></i>
                                                </button>
                                            </li>
                                            <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                <button className="page-link" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
                                                    <i className="la la-angle-left"></i>
                                                </button>
                                            </li>
                                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
                                                <li key={num} className={`page-item ${currentPage === num ? 'active' : ''}`}>
                                                    <button className="page-link" onClick={() => setCurrentPage(num)}>
                                                        {num}
                                                    </button>
                                                </li>
                                            ))}
                                            <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                                <button className="page-link" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>
                                                    <i className="la la-angle-right"></i>
                                                </button>
                                            </li>
                                            <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                                <button className="page-link" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>
                                                    <i className="la la-angle-double-right"></i>
                                                </button>
                                            </li>
                                        </ul>
                                    </div>
                                )}
                            </Card.Body>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Custom Modal for Add/Edit Offer */}
            <Modal show={showModal} onHide={handleCloseModal} centered size="xl" className="item-custom-modal">
                <Form onSubmit={handleSubmit}>
                    <div className="modal-header-custom">
                        <div className="d-flex align-items-center gap-3">
                            <div className="modal-icon-circle">
                                <i className="fa fa-tags text-white fs-4"></i>
                            </div>
                            <div>
                                <h5 className="modal-title fw-bold text-dark mb-0">
                                    {editId ? 'Edit Offer' : 'Add Scheme / Offer'}
                                </h5>
                                <p className="text-muted small mb-0">Enter details to manage scheme</p>
                            </div>
                        </div>
                        <button type="button" className="modal-close-x" onClick={handleCloseModal}>
                            &times;
                        </button>
                    </div>

                    {/* Tab Navigation */}
                    <div className="px-4 pt-3 border-bottom bg-white">
                        <Nav variant="tabs" className="scheme-modal-nav border-0">
                            <Nav.Item>
                                <Nav.Link
                                    active={activeTab === 'general'}
                                    onClick={() => setActiveTab('general')}
                                    style={{ cursor: 'pointer' }}
                                >
                                    General Info
                                </Nav.Link>
                            </Nav.Item>
                            <Nav.Item>
                                <Nav.Link
                                    active={activeTab === 'criteria'}
                                    onClick={() => setActiveTab('criteria')}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {formData.criteria_type === 'Product Based'
                                        ? 'Quantity Criteria *'
                                        : (formData.criteria_type === 'Service Based' ? 'Service Criteria *' : 'Amount Criteria *')}
                                </Nav.Link>
                            </Nav.Item>
                        </Nav>
                    </div>

                    <div className="modal-body-custom">
                        {activeTab === 'general' ? (
                            <Row>
                                <Col md={8} className="mb-3">
                                    <label className="form-label-custom">
                                        Offer Name / Scheme Name <span className="text-danger">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="form-control-custom"
                                        placeholder='e.g. "Diwali 20% Off", "Bulk Purchase Offer"'
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        required
                                        autoFocus
                                    />
                                </Col>
                                <Col md={4} className="mb-3">
                                    <label className="form-label-custom">Coupon / Reference Code</label>
                                    <input
                                        type="text"
                                        className="form-control-custom text-uppercase"
                                        placeholder="e.g. DIWALI20"
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                    />
                                </Col>

                                <Col md={4} className="mb-3">
                                    <label className="form-label-custom">
                                        Offer Scenario / Basis <span className="text-danger">*</span>
                                    </label>
                                    <Form.Select
                                        className="form-control-custom"
                                        value={formData.criteria_type}
                                        onChange={(e) => handleCriteriaTypeChange(e.target.value)}
                                    >
                                        {CRITERIA_TYPES.map(t => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </Form.Select>
                                </Col>

                                <Col md={4} className="mb-3">
                                    <label className="form-label-custom">
                                        Applicable Category
                                    </label>
                                    <Form.Select
                                        className="form-control-custom"
                                        value={formData.category || ''}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value ? Number(e.target.value) : null })}
                                    >
                                        <option value="">All Categories (Universal)</option>
                                        {categoryOptions.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </Form.Select>
                                </Col>

                                <Col md={4} className="mb-3">
                                    <label className="form-label-custom">
                                        Status <span className="text-danger">*</span>
                                    </label>
                                    <Form.Select
                                        className="form-control-custom"
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        {STATUS_CHOICES.map(s => (
                                            <option key={s.value} value={s.value}>{s.label}</option>
                                        ))}
                                    </Form.Select>
                                </Col>

                                <Col md={6} className="mb-3">
                                    <label className="form-label-custom">Start Date</label>
                                    <input
                                        type="date"
                                        className="form-control-custom"
                                        value={formData.start_date}
                                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                    />
                                </Col>

                                <Col md={6} className="mb-3">
                                    <label className="form-label-custom">End Date</label>
                                    <input
                                        type="date"
                                        className="form-control-custom"
                                        value={formData.end_date}
                                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                    />
                                </Col>

                                <Col md={12} className="mb-3">
                                    <label className="form-label-custom">Pitch Description (for callers to read out)</label>
                                    <textarea
                                        className="form-control-custom"
                                        rows="2"
                                        placeholder="Short pitch for callers to read out..."
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </Col>

                                <Col md={12} className="mb-3">
                                    <label className="form-label-custom">Terms and Conditions</label>
                                    <textarea
                                        className="form-control-custom"
                                        rows="2"
                                        placeholder="Conditions and exclusions..."
                                        value={formData.terms_and_conditions}
                                        onChange={(e) => setFormData({ ...formData, terms_and_conditions: e.target.value })}
                                    />
                                </Col>

                                <Col md={12}>
                                    <div className="d-flex align-items-center justify-content-between p-3 rounded" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                        <div>
                                            <div className="fw-semibold text-dark" style={{ fontSize: '13px' }}>Active Status</div>
                                            <div className="text-muted" style={{ fontSize: '12px' }}>Enable this offer in CRM</div>
                                        </div>
                                        <div className="form-check form-switch mb-0">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                id="offerActiveSwitch"
                                                checked={formData.is_active}
                                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                                style={{ cursor: 'pointer', width: '2.5em', height: '1.25em' }}
                                            />
                                        </div>
                                    </div>
                                </Col>
                            </Row>
                        ) : (
                            /* Tab 2: Criteria Table */
                            <div>
                                <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                                    <div>
                                        <h6 className="fw-bold mb-1 text-success" style={{ fontSize: '14px' }}>
                                            {formData.criteria_type === 'Product Based' && (
                                                <><i className="fa fa-cubes me-2"></i>Scheme Criteria Quantity Based</>
                                            )}
                                            {formData.criteria_type === 'Service Based' && (
                                                <><i className="fa fa-wrench me-2"></i>Scheme Criteria Service Based</>
                                            )}
                                            {formData.criteria_type === 'Amount Based' && (
                                                <><i className="fa fa-coins me-2"></i>Scheme Criteria Amount Based</>
                                            )}
                                        </h6>
                                        <p className="text-muted mb-0 small" style={{ fontSize: '12px' }}>
                                            {formData.criteria_type === 'Product Based' && 'Add multiple criteria rows for this scheme based on quantity'}
                                            {formData.criteria_type === 'Service Based' && 'Add multiple criteria rows for this scheme based on specific services'}
                                            {formData.criteria_type === 'Amount Based' && 'Add multiple criteria rows for this scheme based on order purchase amount'}
                                        </p>
                                    </div>
                                    <div className="d-flex align-items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline-success"
                                            size="sm"
                                            onClick={handleAddCriteriaRow}
                                            className="d-flex align-items-center gap-1 fw-semibold"
                                            style={{ borderRadius: '6px', padding: '5px 12px', fontSize: '12.5px' }}
                                        >
                                            <i className="fa fa-plus"></i> Add Criteria
                                        </Button>
                                    </div>
                                </div>

                                <div className="table-responsive border rounded mb-2">
                                    {/* SCENARIO 1: AMOUNT BASED TABLE */}
                                    {formData.criteria_type === 'Amount Based' && (
                                        <table className="table table-bordered table-sm align-middle mb-0 criteria-table" style={{ fontSize: '13px' }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ minWidth: '130px' }}>Scheme Name</th>
                                                    <th style={{ minWidth: '220px' }}>Product <small className="text-muted fw-normal">(Optional)</small></th>
                                                    <th style={{ minWidth: '170px' }}>Min Purchase Amount (₹) <span className="text-danger">*</span></th>
                                                    <th style={{ minWidth: '150px' }}>Discount Type</th>
                                                    <th style={{ width: '130px' }}>Discount Value <span className="text-danger">*</span></th>
                                                    <th style={{ width: '55px' }} className="text-center">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {criteriaRows.map((row) => (
                                                    <tr key={row._tempId}>
                                                        <td>
                                                            <Form.Control
                                                                type="text"
                                                                size="sm"
                                                                value={formData.title || '(Current Scheme)'}
                                                                readOnly
                                                                className="bg-light text-muted"
                                                                style={{ fontSize: '12.5px' }}
                                                            />
                                                        </td>
                                                        <td>
                                                            <Select
                                                                options={productOptions}
                                                                value={productOptions.find(opt => opt.value === row.product) || null}
                                                                onChange={(selected) => {
                                                                    handleCriteriaRowChange(row._tempId, 'product', selected ? selected.value : null);
                                                                    handleCriteriaRowChange(row._tempId, 'product_name', selected ? selected.label : '');
                                                                }}
                                                                placeholder="All Products (Any)"
                                                                isSearchable
                                                                isClearable
                                                                styles={tableSelectStyles}
                                                                menuPortalTarget={document.body}
                                                                menuPosition="fixed"
                                                            />
                                                        </td>
                                                        <td>
                                                            <Form.Control
                                                                type="number"
                                                                step="0.01"
                                                                size="sm"
                                                                placeholder="e.g. 5000.00"
                                                                value={row.min_purchase_amount}
                                                                onChange={(e) => handleCriteriaRowChange(row._tempId, 'min_purchase_amount', e.target.value)}
                                                                style={{ fontSize: '12.5px' }}
                                                                required
                                                            />
                                                        </td>
                                                        <td>
                                                            <Form.Select
                                                                size="sm"
                                                                value={row.discount_type || 'Percentage'}
                                                                onChange={(e) => handleCriteriaRowChange(row._tempId, 'discount_type', e.target.value)}
                                                                style={{ fontSize: '12.5px' }}
                                                            >
                                                                <option value="Percentage">Percentage (%)</option>
                                                                <option value="Flat Amount">Flat Amount (₹)</option>
                                                            </Form.Select>
                                                        </td>
                                                        <td>
                                                            <Form.Control
                                                                type="number"
                                                                step="0.01"
                                                                size="sm"
                                                                placeholder="e.g. 10 or 500"
                                                                value={row.discount_value}
                                                                onChange={(e) => handleCriteriaRowChange(row._tempId, 'discount_value', e.target.value)}
                                                                style={{ fontSize: '12.5px' }}
                                                                required
                                                            />
                                                        </td>
                                                        <td className="text-center">
                                                            <Button
                                                                variant="outline-danger"
                                                                size="sm"
                                                                onClick={() => handleRemoveCriteriaRow(row._tempId)}
                                                                style={{ padding: '2px 8px', borderRadius: '6px' }}
                                                                title="Remove row"
                                                            >
                                                                <i className="fa fa-trash"></i>
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}

                                    {/* SCENARIO 2: PRODUCT QUANTITY BASED TABLE (EXACT MATCH TO SCREENSHOT) */}
                                    {formData.criteria_type === 'Product Based' && (
                                        <table className="table table-bordered table-sm align-middle mb-0 criteria-table" style={{ fontSize: '13px' }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ minWidth: '150px' }}>Scheme Name</th>
                                                    <th style={{ minWidth: '240px' }}>Product ID <span className="text-danger">*</span></th>
                                                    <th style={{ width: '120px' }}>Quantity</th>
                                                    <th style={{ width: '140px' }}>Discount Percentage (%)</th>
                                                    <th style={{ width: '130px' }}>Discount Value</th>
                                                    <th style={{ width: '55px' }} className="text-center">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {criteriaRows.map((row) => (
                                                    <tr key={row._tempId}>
                                                        <td>
                                                            <Form.Control
                                                                type="text"
                                                                size="sm"
                                                                value={formData.title || '(Current Scheme)'}
                                                                readOnly
                                                                className="bg-light text-muted"
                                                                style={{ fontSize: '12.5px' }}
                                                            />
                                                        </td>
                                                        <td>
                                                            <Select
                                                                options={productOptions}
                                                                value={productOptions.find(opt => opt.value === row.product) || null}
                                                                onChange={(selected) => {
                                                                    handleCriteriaRowChange(row._tempId, 'product', selected ? selected.value : null);
                                                                    handleCriteriaRowChange(row._tempId, 'product_name', selected ? selected.label : '');
                                                                }}
                                                                placeholder="Select Product"
                                                                isSearchable
                                                                isClearable
                                                                styles={tableSelectStyles}
                                                                menuPortalTarget={document.body}
                                                                menuPosition="fixed"
                                                            />
                                                        </td>
                                                        <td>
                                                            <Form.Control
                                                                type="number"
                                                                step="0.01"
                                                                size="sm"
                                                                placeholder="0.00"
                                                                value={row.quantity}
                                                                onChange={(e) => handleCriteriaRowChange(row._tempId, 'quantity', e.target.value)}
                                                                style={{ fontSize: '12.5px' }}
                                                            />
                                                        </td>
                                                        <td>
                                                            <Form.Control
                                                                type="number"
                                                                step="0.01"
                                                                size="sm"
                                                                placeholder="0.00"
                                                                value={row.discount_percentage}
                                                                onChange={(e) => handleCriteriaRowChange(row._tempId, 'discount_percentage', e.target.value)}
                                                                style={{ fontSize: '12.5px' }}
                                                            />
                                                        </td>
                                                        <td>
                                                            <Form.Control
                                                                type="number"
                                                                step="0.01"
                                                                size="sm"
                                                                placeholder="0.00"
                                                                value={row.discount_value}
                                                                onChange={(e) => handleCriteriaRowChange(row._tempId, 'discount_value', e.target.value)}
                                                                style={{ fontSize: '12.5px' }}
                                                            />
                                                        </td>
                                                        <td className="text-center">
                                                            <Button
                                                                variant="outline-danger"
                                                                size="sm"
                                                                onClick={() => handleRemoveCriteriaRow(row._tempId)}
                                                                style={{ padding: '2px 8px', borderRadius: '6px' }}
                                                                title="Remove row"
                                                            >
                                                                <i className="fa fa-trash"></i>
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}

                                    {/* SCENARIO 3: SERVICE BASED TABLE */}
                                    {formData.criteria_type === 'Service Based' && (
                                        <table className="table table-bordered table-sm align-middle mb-0 criteria-table" style={{ fontSize: '13px' }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ minWidth: '150px' }}>Scheme Name</th>
                                                    <th style={{ minWidth: '240px' }}>Service <span className="text-danger">*</span></th>
                                                    <th style={{ width: '150px' }}>Discount Percentage (%)</th>
                                                    <th style={{ width: '140px' }}>Discount Value (₹)</th>
                                                    <th style={{ width: '55px' }} className="text-center">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {criteriaRows.map((row) => (
                                                    <tr key={row._tempId}>
                                                        <td>
                                                            <Form.Control
                                                                type="text"
                                                                size="sm"
                                                                value={formData.title || '(Current Scheme)'}
                                                                readOnly
                                                                className="bg-light text-muted"
                                                                style={{ fontSize: '12.5px' }}
                                                            />
                                                        </td>
                                                        <td>
                                                            <Select
                                                                options={serviceOptions}
                                                                value={serviceOptions.find(opt => opt.value === row.service) || null}
                                                                onChange={(selected) => {
                                                                    handleCriteriaRowChange(row._tempId, 'service', selected ? selected.value : null);
                                                                    handleCriteriaRowChange(row._tempId, 'service_name', selected ? selected.label : '');
                                                                }}
                                                                placeholder="Select Service"
                                                                isSearchable
                                                                isClearable
                                                                styles={tableSelectStyles}
                                                                menuPortalTarget={document.body}
                                                                menuPosition="fixed"
                                                            />
                                                        </td>
                                                        <td>
                                                            <Form.Control
                                                                type="number"
                                                                step="0.01"
                                                                size="sm"
                                                                placeholder="0.00"
                                                                value={row.discount_percentage}
                                                                onChange={(e) => handleCriteriaRowChange(row._tempId, 'discount_percentage', e.target.value)}
                                                                style={{ fontSize: '12.5px' }}
                                                            />
                                                        </td>
                                                        <td>
                                                            <Form.Control
                                                                type="number"
                                                                step="0.01"
                                                                size="sm"
                                                                placeholder="0.00"
                                                                value={row.discount_value}
                                                                onChange={(e) => handleCriteriaRowChange(row._tempId, 'discount_value', e.target.value)}
                                                                style={{ fontSize: '12.5px' }}
                                                            />
                                                        </td>
                                                        <td className="text-center">
                                                            <Button
                                                                variant="outline-danger"
                                                                size="sm"
                                                                onClick={() => handleRemoveCriteriaRow(row._tempId)}
                                                                style={{ padding: '2px 8px', borderRadius: '6px' }}
                                                                title="Remove row"
                                                            >
                                                                <i className="fa fa-trash"></i>
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="modal-footer-custom">
                        <button type="button" className="btn-close-custom" onClick={handleCloseModal} disabled={saving}>
                            Cancel
                        </button>
                        {activeTab === 'general' ? (
                            <button
                                type="button"
                                className="btn-save-custom"
                                onClick={handleSaveAndNext}
                                disabled={saving}
                            >
                                Save & Next
                            </button>
                        ) : (
                            <button
                                type="submit"
                                className="btn-save-custom"
                                disabled={saving}
                            >
                                {saving ? 'Saving...' : (editId ? 'Update' : 'Save')}
                            </button>
                        )}
                    </div>
                </Form>
            </Modal>
        </>
    );
};

export default CrmOfferList;
