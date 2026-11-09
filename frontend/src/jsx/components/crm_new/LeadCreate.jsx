import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Form, Row, Col, Table, Badge } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import CRMNewService from '../../../services/CRMNewService';
import { usePageTitle } from '../../../context/TitleContext';

const LeadCreate = () => {
    const { id } = useParams();
    const isEditMode = Boolean(id);
    usePageTitle(isEditMode ? 'Edit Lead' : 'Create Lead');
    const navigate = useNavigate();

    // Active tab state
    const [activeTab, setActiveTab] = useState('basic'); // 'basic' | 'contact' | 'products' | 'deal' | 'attachments'

    // Data lists
    const [employees, setEmployees] = useState([]);
    const [categories, setCategories] = useState([]);
    const [sources, setSources] = useState([]);
    const [industries, setIndustries] = useState([]);
    const [stockItems, setStockItems] = useState([]);
    const [crmServices, setCrmServices] = useState([]);

    // UI state
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(isEditMode);
    const [ownerType, setOwnerType] = useState('employee'); // 'employee' | 'external'

    // Image & attachments state
    const [imagePreview, setImagePreview] = useState(null);
    const [imageFile, setImageFile] = useState(null);
    const [selectedImages, setSelectedImages] = useState([]);
    const [existingImages, setExistingImages] = useState([]);
    const [selectedAttachments, setSelectedAttachments] = useState([]);
    const [existingAttachments, setExistingAttachments] = useState([]);
    const fileInputRef = useRef(null);
    const imageInputRef = useRef(null);

    // Search filters for tables
    const [productSearch, setProductSearch] = useState('');
    const [serviceSearch, setServiceSearch] = useState('');

    // Form state
    const initialFormData = {
        lead_owner: '',
        other_owner_name: '',

        category: '',
        lead_source: '',
        lead_status: 'Not Contacted',
        rating: 'Warm',
        industry: '',

        company: '',
        first_name: '',
        last_name: '',
        title: '',
        email: '',
        phone: '', // Mandatory
        fax: '',
        mobile: '',
        website: '',

        no_of_employees: '',
        annual_revenue: '',
        email_opt_out: false,
        skype_id: '',
        secondary_email: '',
        twitter: '',
        contact_preferences: '',

        flat_house_no: '',
        street_address: '',
        city: '',
        state_province: '',
        zip_postal_code: '',
        country: '',
        latitude: '',
        longitude: '',

        description: '',

        has_product_interest: false,
        has_service_interest: false,
        products: [],
        services: [],

        estimated_value: '',
        priority: 'Medium',
        expected_closing_date: '',
        assigned_sales_employees: '',
    };

    const [formData, setFormData] = useState(initialFormData);

    const statusChoices = [
        'Attempted to Contact', 'Contact in Future', 'Contacted',
        'Junk Lead', 'Lost Lead', 'Not Contacted', 'Pre Qualified', 'Not Qualified'
    ];

    const ratingChoices = [
        'Acquired', 'Active', 'Market Failed', 'Project Cancelled', 'Shut Down', 'Hot', 'Warm', 'Cold'
    ];

    const priorityChoices = ['High', 'Medium', 'Low'];

    const selectCustomStyles = useMemo(() => ({
        control: (provided, state) => ({
            ...provided,
            minHeight: '44px',
            borderRadius: '10px',
            borderColor: state.isFocused ? '#2ece8a' : '#cbd5e1',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(46, 206, 138, 0.15)' : 'none',
            '&:hover': {
                borderColor: state.isFocused ? '#2ece8a' : '#94a3b8'
            },
            backgroundColor: '#ffffff',
            fontSize: '13px',
            color: '#334155',
            cursor: 'pointer',
            transition: 'border-color 0.2s, box-shadow 0.2s'
        }),
        valueContainer: (provided) => ({
            ...provided,
            padding: '2px 14px'
        }),
        placeholder: (provided) => ({
            ...provided,
            color: '#94a3b8',
            fontSize: '13px'
        }),
        singleValue: (provided) => ({
            ...provided,
            color: '#334155',
            fontSize: '13px'
        }),
        input: (provided) => ({
            ...provided,
            color: '#334155',
            fontSize: '13px',
            margin: '0px'
        }),
        menu: (provided) => ({
            ...provided,
            borderRadius: '10px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
            zIndex: 9999,
            border: '1px solid #e2e8f0',
            overflow: 'hidden'
        }),
        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
        option: (provided, state) => ({
            ...provided,
            fontSize: '13px',
            backgroundColor: state.isSelected
                ? '#2ece8a'
                : state.isFocused
                    ? '#f1f5f9'
                    : '#ffffff',
            color: state.isSelected ? '#ffffff' : '#334155',
            cursor: 'pointer',
            '&:active': {
                backgroundColor: '#2ece8a',
                color: '#ffffff'
            }
        })
    }), []);

    const employeeOptions = useMemo(() => {
        return employees.map(u => {
            const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim();
            let displayName = fullName;
            if (!displayName) {
                if (u.username) {
                    displayName = u.username.includes('@') ? u.username.split('@')[0] : u.username;
                } else if (u.name) {
                    displayName = u.name;
                } else {
                    displayName = `Employee #${u.id}`;
                }
            }
            const deptName = u.department?.name || (typeof u.department === 'string' ? u.department : '') || u.department_name;
            const label = deptName ? `${displayName} (${deptName})` : `${displayName} (No Dept)`;
            return {
                value: u.id,
                label: label
            };
        });
    }, [employees]);

    const categoryOptions = useMemo(() => {
        return categories.map(c => ({
            value: c.id,
            label: c.name
        }));
    }, [categories]);

    const sourceOptions = useMemo(() => {
        return sources.map(s => ({
            value: s.id,
            label: s.name
        }));
    }, [sources]);

    const industryOptions = useMemo(() => {
        return industries.map(ind => ({
            value: ind.id,
            label: ind.name
        }));
    }, [industries]);

    const statusOptions = useMemo(() => {
        return statusChoices.map(st => ({
            value: st,
            label: st
        }));
    }, []);

    const ratingOptions = useMemo(() => {
        return ratingChoices.map(r => ({
            value: r,
            label: r
        }));
    }, []);

    const priorityOptions = useMemo(() => {
        return priorityChoices.map(p => ({
            value: p,
            label: p
        }));
    }, []);

    const tabs = [
        { id: 'basic', label: 'Lead Info', icon: 'fa-user' },
        { id: 'contact', label: 'Contact & Address', icon: 'fa-phone' },
        { id: 'products', label: 'Products & Services', icon: 'fa-cubes' },
        { id: 'deal', label: 'Deal & Pipeline', icon: 'fa-chart-line' },
        { id: 'attachments', label: 'Attachments & Media', icon: 'fa-paperclip' }
    ];

    const tabHeaders = {
        basic: {
            title: 'Lead Information',
            subtitle: 'Lead ownership, categorization, and organization overview',
            icon: 'fa-user'
        },
        contact: {
            title: 'Contact & Address Coordinates',
            subtitle: 'Direct communication channels, geographical location, and social handles',
            icon: 'fa-phone'
        },
        products: {
            title: 'Products & Services Requirements',
            subtitle: 'Enable table-wise switches and check off required items',
            icon: 'fa-cubes'
        },
        deal: {
            title: 'Deal & Pipeline Opportunities',
            subtitle: 'Financial estimate, priority, closing timeline, and notes',
            icon: 'fa-chart-line'
        },
        attachments: {
            title: 'Attachments & Media',
            subtitle: 'Lead profile photo and supporting document files',
            icon: 'fa-folder-open'
        }
    };

    useEffect(() => {
        loadDropdownData();
    }, []);

    useEffect(() => {
        if (isEditMode) {
            loadLeadData(id);
        }
    }, [id]);

    const loadDropdownData = async () => {
        try {
            try {
                const empRes = await CRMNewService.getEmployees();
                setEmployees(Array.isArray(empRes.data) ? empRes.data : []);
            } catch (err) {
                console.warn('Employees fetch failed', err);
            }

            try {
                const catRes = await CRMNewService.getCategories();
                const catData = Array.isArray(catRes.data) ? catRes.data : (catRes.data?.results || []);
                setCategories(catData.filter(c => c.is_active !== false));
            } catch (err) {
                console.warn('Categories fetch failed', err);
            }

            try {
                const srcRes = await CRMNewService.getSources();
                const srcData = Array.isArray(srcRes.data) ? srcRes.data : (srcRes.data?.results || []);
                setSources(srcData.filter(s => s.is_active !== false));
            } catch (err) {
                console.warn('Sources fetch failed', err);
            }

            try {
                const stockRes = await CRMNewService.getStockItems();
                const stockData = Array.isArray(stockRes.data) ? stockRes.data : (stockRes.data?.results || []);
                setStockItems(stockData);
            } catch (err) {
                console.warn('Stock items fetch failed', err);
            }

            try {
                const srvRes = await CRMNewService.getServices();
                const srvData = Array.isArray(srvRes.data) ? srvRes.data : (srvRes.data?.results || []);
                setCrmServices(srvData.filter(s => s.is_active !== false));
            } catch (err) {
                console.warn('CRM Services fetch failed', err);
            }

            try {
                const indRes = await CRMNewService.getIndustries();
                const indData = Array.isArray(indRes.data) ? indRes.data : (indRes.data?.results || []);
                setIndustries(indData.filter(i => i.is_active !== false));
            } catch (err) {
                console.warn('Industries fetch failed', err);
            }
        } catch (error) {
            console.error('Error loading dropdown lists:', error);
        }
    };

    const loadLeadData = async (leadId) => {
        setInitialLoading(true);
        try {
            const res = await CRMNewService.getLead(leadId);
            const data = res.data;
            if (data) {
                const isExt = !data.lead_owner && Boolean(data.other_owner_name);
                setOwnerType(isExt ? 'external' : 'employee');

                setFormData({
                    lead_owner: data.lead_owner || '',
                    other_owner_name: data.other_owner_name || '',
                    category: data.category || '',
                    lead_source: data.lead_source || '',
                    lead_status: data.lead_status || 'Not Contacted',
                    rating: data.rating || 'Warm',
                    industry: data.industry?.id || data.industry || '',
                    company: data.company || '',
                    first_name: data.first_name || '',
                    last_name: data.last_name || '',
                    title: data.title || '',
                    email: data.email || '',
                    phone: data.phone || '',
                    fax: data.fax || '',
                    mobile: data.mobile || '',
                    website: data.website || '',
                    no_of_employees: data.no_of_employees ?? '',
                    annual_revenue: data.annual_revenue ?? '',
                    email_opt_out: Boolean(data.email_opt_out),
                    skype_id: data.skype_id || '',
                    secondary_email: data.secondary_email || '',
                    twitter: data.twitter || '',
                    contact_preferences: data.contact_preferences !== undefined && data.contact_preferences !== null ? data.contact_preferences : 'Phone, Email',
                    flat_house_no: data.flat_house_no || '',
                    street_address: data.street_address || '',
                    city: data.city || '',
                    state_province: data.state_province || '',
                    zip_postal_code: data.zip_postal_code || '',
                    country: data.country || '',
                    latitude: data.latitude ?? '',
                    longitude: data.longitude ?? '',
                    description: data.description || '',
                    has_product_interest: Boolean(data.has_product_interest || (data.products && data.products.length > 0)),
                    has_service_interest: Boolean(data.has_service_interest || (data.services && data.services.length > 0)),
                    products: Array.isArray(data.products) ? data.products : [],
                    services: Array.isArray(data.services) ? data.services : [],
                    estimated_value: data.estimated_value ?? '',
                    priority: data.priority || 'Medium',
                    expected_closing_date: data.expected_closing_date || '',
                    assigned_sales_employees: data.assigned_sales_employees || '',
                });

                if (data.image) {
                    setImagePreview(data.image);
                }

                if (Array.isArray(data.images)) {
                    setExistingImages(data.images);
                }

                if (Array.isArray(data.attachments)) {
                    setExistingAttachments(data.attachments);
                }
            }
        } catch (err) {
            console.error('Error loading lead:', err);
            Swal.fire('Error', 'Failed to load lead details', 'error');
        } finally {
            setInitialLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name === 'contact_preferences_checkbox') {
            const currentPrefs = formData.contact_preferences
                ? formData.contact_preferences.split(',').map(p => p.trim()).filter(Boolean)
                : [];
            let nextPrefs;
            if (checked) {
                if (!currentPrefs.some(p => p.toLowerCase() === value.toLowerCase())) {
                    nextPrefs = [...currentPrefs, value];
                } else {
                    nextPrefs = currentPrefs;
                }
            } else {
                nextPrefs = currentPrefs.filter(p => p.toLowerCase() !== value.toLowerCase());
            }
            setFormData(prev => ({
                ...prev,
                contact_preferences: nextPrefs.join(', ')
            }));
            return;
        }
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleImageChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            const newImgObjs = files.map(file => ({
                file,
                previewUrl: URL.createObjectURL(file),
                name: file.name,
                size: file.size
            }));
            setSelectedImages(prev => [...prev, ...newImgObjs]);

            // Set primary photo if not set
            if (!imagePreview && !imageFile && files[0]) {
                setImageFile(files[0]);
                const reader = new FileReader();
                reader.onloadend = () => setImagePreview(reader.result);
                reader.readAsDataURL(files[0]);
            }
        }
        if (imageInputRef.current) imageInputRef.current.value = '';
    };

    const removeSelectedImage = (index) => {
        setSelectedImages(prev => {
            const item = prev[index];
            if (item && item.previewUrl) {
                URL.revokeObjectURL(item.previewUrl);
            }
            return prev.filter((_, i) => i !== index);
        });
    };

    const handleDeleteExistingImage = async (imageId) => {
        const result = await Swal.fire({
            title: 'Delete Image?',
            text: 'This image will be permanently removed.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await CRMNewService.deleteLeadImage(id, imageId);
                setExistingImages(prev => prev.filter(img => img.id !== imageId));
                Swal.fire('Deleted', 'Image removed successfully', 'success');
            } catch (err) {
                console.error('Failed to delete image', err);
                Swal.fire('Error', 'Failed to delete image', 'error');
            }
        }
    };

    const handleRemoveImage = () => {
        setImageFile(null);
        setImagePreview(null);
        if (imageInputRef.current) imageInputRef.current.value = '';
    };

    const handleAttachmentChange = (e) => {
        const files = Array.from(e.target.files);
        setSelectedAttachments(prev => [...prev, ...files]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeSelectedAttachment = (index) => {
        setSelectedAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleDeleteExistingAttachment = async (attachmentId) => {
        const result = await Swal.fire({
            title: 'Delete Attachment?',
            text: 'This file will be permanently removed.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await CRMNewService.deleteLeadAttachment(id, attachmentId);
                setExistingAttachments(prev => prev.filter(att => att.id !== attachmentId));
                Swal.fire('Deleted', 'Attachment removed successfully', 'success');
            } catch (err) {
                console.error('Failed to delete attachment', err);
                Swal.fire('Error', 'Failed to delete attachment', 'error');
            }
        }
    };

    const toggleProduct = (productId) => {
        setFormData(prev => {
            const exists = prev.products.includes(productId);
            const updated = exists ? prev.products.filter(p => p !== productId) : [...prev.products, productId];
            return { ...prev, products: updated };
        });
    };

    const toggleAllProducts = () => {
        if (formData.products.length === filteredStockItems.length) {
            setFormData(prev => ({ ...prev, products: [] }));
        } else {
            setFormData(prev => ({ ...prev, products: filteredStockItems.map(p => p.id) }));
        }
    };

    const toggleService = (serviceId) => {
        setFormData(prev => {
            const exists = prev.services.includes(serviceId);
            const updated = exists ? prev.services.filter(s => s !== serviceId) : [...prev.services, serviceId];
            return { ...prev, services: updated };
        });
    };

    const toggleAllServices = () => {
        if (formData.services.length === filteredCrmServices.length) {
            setFormData(prev => ({ ...prev, services: [] }));
        } else {
            setFormData(prev => ({ ...prev, services: filteredCrmServices.map(s => s.id) }));
        }
    };

    const resetForm = () => {
        setFormData(initialFormData);
        setOwnerType('employee');
        setImagePreview(null);
        setImageFile(null);
        selectedImages.forEach(img => {
            if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
        });
        setSelectedImages([]);
        setExistingImages([]);
        setSelectedAttachments([]);
        setExistingAttachments([]);
        setProductSearch('');
        setServiceSearch('');
        setActiveTab('basic');
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (imageInputRef.current) imageInputRef.current.value = '';
    };

    const handleSave = async (isSaveAndNext = false) => {
        // Phone is mandatory
        if (!formData.phone || !formData.phone.trim()) {
            setActiveTab('contact');
            Swal.fire('Validation Error', 'Primary Phone Number is mandatory. Please provide it in Contact & Address tab before saving.', 'warning');
            return;
        }

        setLoading(true);

        const payload = new FormData();

        Object.keys(formData).forEach(key => {
            if (key === 'products' || key === 'services') return;
            const val = formData[key];
            if (val !== null && val !== undefined) {
                if (key === 'lead_owner' && ownerType === 'external') return;
                if (key === 'other_owner_name' && ownerType === 'employee') return;
                payload.append(key, val);
            }
        });

        if (formData.has_product_interest) {
            formData.products.forEach(pId => payload.append('products', pId));
        }
        if (formData.has_service_interest) {
            formData.services.forEach(sId => payload.append('services', sId));
        }

        if (imageFile) {
            payload.append('image', imageFile);
        }

        selectedImages.forEach(imgObj => {
            payload.append('images', imgObj.file);
        });

        selectedAttachments.forEach(file => {
            payload.append('attachments', file);
        });

        try {
            if (isEditMode) {
                await CRMNewService.updateLead(id, payload, true);
                if (isSaveAndNext) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Success',
                        text: 'Lead updated successfully! Ready to create next lead.',
                        timer: 2000,
                        showConfirmButton: true
                    });
                    navigate('/crm/leads/create');
                } else {
                    Swal.fire('Success', 'Lead updated successfully!', 'success');
                    navigate('/crm/leads');
                }
            } else {
                await CRMNewService.createLead(payload, true);
                if (isSaveAndNext) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Success',
                        text: 'Lead created successfully! Form reset for next lead.',
                        timer: 2000,
                        showConfirmButton: true
                    });
                    resetForm();
                } else {
                    Swal.fire('Success', 'Lead created successfully!', 'success');
                    navigate('/crm/leads');
                }
            }
        } catch (error) {
            console.error('Error saving lead:', error);
            const responseData = error.response?.data;
            let errMsg = 'Failed to save lead. Please verify all inputs.';
            if (responseData && typeof responseData === 'object') {
                errMsg = Object.entries(responseData)
                    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
                    .join('\n');
            }
            Swal.fire('Save Failed', errMsg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        await handleSave(false);
    };

    const handleSaveAndNext = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        await handleSave(true);
    };

    const filteredStockItems = stockItems.filter(item => {
        const name = item.stock_item_name || item.name || '';
        const code = item.item_code || item.part_no || '';
        return name.toLowerCase().includes(productSearch.toLowerCase()) || code.toLowerCase().includes(productSearch.toLowerCase());
    });

    const filteredCrmServices = crmServices.filter(service => {
        const name = service.name || '';
        const desc = service.description || '';
        return name.toLowerCase().includes(serviceSearch.toLowerCase()) || desc.toLowerCase().includes(serviceSearch.toLowerCase());
    });

    // Next / Previous Tab helpers
    const currentTabIndex = tabs.findIndex(t => t.id === activeTab);
    const handlePrevTab = () => {
        if (currentTabIndex > 0) {
            setActiveTab(tabs[currentTabIndex - 1].id);
        }
    };
    const handleNextTab = () => {
        if (currentTabIndex < tabs.length - 1) {
            setActiveTab(tabs[currentTabIndex + 1].id);
        }
    };

    if (initialLoading) {
        return (
            <div className="container-fluid text-center py-5">
                <div className="spinner-border text-success" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="container-fluid">
            <style>{`
                .lead-normal-form .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                    display: block;
                }
                .lead-normal-form .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .lead-normal-form .form-control-custom:focus {
                    outline: none;
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                }
                .lead-normal-form .form-control-custom::placeholder {
                    color: #94a3b8;
                    font-size: 13px;
                }

                /* Form card top header above tabs (Stock Item Modal style) */
                .form-card-top-header {
                    padding: 22px 28px 18px 28px;
                    background: #ffffff;
                    border-bottom: 1px solid #f1f5f9;
                }
                .form-card-top-header .header-icon-box {
                    width: 44px;
                    height: 44px;
                    background-color: #2ece8a;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
                    flex-shrink: 0;
                }

                /* Tab navigation bar inside the form card */
                .custom-form-tabs {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0;
                    padding: 0 28px;
                    background: #ffffff;
                    border-bottom: 1px solid #e2e8f0;
                    margin-bottom: 0;
                    overflow: visible;
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                }
                .custom-form-tabs::-webkit-scrollbar {
                    display: none;
                    width: 0;
                    height: 0;
                }
                .custom-form-tabs .tab-btn {
                    border: none;
                    background: transparent;
                    border-bottom: 2px solid transparent;
                    margin-bottom: -1px;
                    padding: 16px 20px;
                    font-size: 14px;
                    font-weight: 500;
                    color: #64748b;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.2s;
                    border-radius: 0;
                    outline: none;
                    white-space: nowrap;
                    text-decoration: none;
                    box-sizing: border-box;
                }
                .custom-form-tabs .tab-btn:hover {
                    color: #475569;
                    background: transparent;
                    border-bottom-color: #cbd5e1;
                }
                .custom-form-tabs .tab-btn.active {
                    background: transparent !important;
                    border: none !important;
                    border-bottom: 2px solid #2ece8a !important;
                    color: #2ece8a !important;
                    font-weight: 600 !important;
                    box-shadow: none !important;
                }
                .custom-form-tabs .tab-badge {
                    background: #f1f5f9;
                    color: #94a3b8;
                    border-radius: 12px;
                    padding: 1px 8px;
                    font-size: 11px;
                    font-weight: 600;
                    margin-left: 4px;
                    transition: all 0.2s;
                    display: inline-block;
                }
                .custom-form-tabs .tab-btn.active .tab-badge {
                    background: #d1fae5;
                    color: #16a34a;
                }

                /* Section card */
                .form-section-card {
                    background: #ffffff;
                    border-radius: 16px;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
                    margin-bottom: 30px;
                    overflow: hidden;
                }
                .form-section-footer {
                    padding: 16px 24px;
                    background: #fafbfc;
                    border-top: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 12px;
                }
                .form-section-header {
                    padding: 18px 24px;
                    border-bottom: 1px solid #f1f5f9;
                    background: #fafbfc;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .form-section-header h5 {
                    margin: 0;
                    font-size: 15px;
                    font-weight: 700;
                    color: #1e293b;
                }
                .form-section-body {
                    padding: 24px;
                }

                /* Table-wise Switch Box (Exact design from category modal image) */
                .table-wise-switch-box {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 20px;
                    border-radius: 12px;
                    background-color: #f8fafc;
                    border: 1px solid #e2e8f0;
                    transition: all 0.2s ease;
                }
                .table-wise-switch-box:hover {
                    border-color: #cbd5e1;
                }
                .table-wise-switch-box .switch-title {
                    font-size: 13.5px;
                    font-weight: 600;
                    color: #1e293b;
                }
                .table-wise-switch-box .switch-subtitle {
                    font-size: 12px;
                    color: #64748b;
                }

                /* Green Toggle Switch */
                .table-wise-switch-box .form-check-input {
                    cursor: pointer;
                    width: 2.6em;
                    height: 1.35em;
                }
                .table-wise-switch-box .form-check-input:checked {
                    background-color: #2ece8a !important;
                    border-color: #2ece8a !important;
                }

                /* Action buttons */
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
                .btn-close-custom:hover {
                    background-color: #6357a7 !important;
                }
                .btn-save-custom {
                    background-color: #2ece8a !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 28px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .btn-save-custom:hover {
                    background-color: #26b579 !important;
                }
                .btn-save-next-custom {
                    background-color: #0284c7 !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }
                .btn-save-next-custom:hover {
                    background-color: #0369a1 !important;
                }
                .btn-save-next-custom:disabled {
                    opacity: 0.65;
                    cursor: not-allowed;
                }

                /* Step navigation buttons */
                .btn-tab-nav {
                    border: 1px solid #cbd5e1;
                    background: #ffffff;
                    color: #475569;
                    border-radius: 8px;
                    font-weight: 500;
                    font-size: 13.5px;
                    padding: 9px 18px;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    transition: all 0.2s ease;
                }
                .btn-tab-nav:hover {
                    background: #f8fafc;
                    border-color: #94a3b8;
                    color: #1e293b;
                }

                /* Plus add button */
                .btn-quick-add {
                    background-color: #2ece8a;
                    border: none;
                    color: white;
                    border-radius: 10px;
                    width: 44px;
                    height: 44px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: background-color 0.2s;
                    flex-shrink: 0;
                }
                .btn-quick-add:hover {
                    background-color: #26b579;
                }

                /* Interactive item table */
                .item-select-table {
                    margin-bottom: 0;
                }
                .item-select-table th {
                    background: #f1f5f9;
                    font-size: 12px;
                    font-weight: 600;
                    color: #475569;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    padding: 10px 14px;
                }
                .item-select-table td {
                    font-size: 13px;
                    vertical-align: middle;
                    padding: 10px 14px;
                }
                .item-select-table tr:hover {
                    background-color: #f8fafc;
                }

                /* Lead Owner Segmented Switcher */
                .owner-type-toggle-group {
                    display: inline-flex;
                    align-items: center;
                    background-color: #f1f5f9;
                    padding: 3px;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                    gap: 3px;
                }
                .owner-type-toggle-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 4px 12px;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 500;
                    color: #64748b;
                    background-color: transparent;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    user-select: none;
                    line-height: 1.2;
                    outline: none;
                }
                .owner-type-toggle-btn:hover:not(.active) {
                    color: #1e293b;
                    background-color: rgba(255, 255, 255, 0.75);
                }
                .owner-type-toggle-btn.active {
                    background-color: #2ece8a;
                    color: #ffffff;
                    font-weight: 600;
                    box-shadow: 0 2px 6px rgba(46, 206, 138, 0.35);
                }
                .owner-type-toggle-btn.active i {
                    color: #ffffff;
                }
                .owner-type-toggle-btn i {
                    font-size: 12.5px;
                    transition: color 0.2s ease;
                }
            `}</style>

            <Form onSubmit={handleSubmit} className="lead-normal-form">
                <div className="form-section-card">
                    {/* ── Active Section Header above the tabs (in place of Create Lead) ── */}
                    <div className="form-card-top-header">
                        <div className="d-flex align-items-center gap-3">
                            <div className="header-icon-box">
                                <i className={`fa ${tabHeaders[activeTab]?.icon || 'fa-user'}`} style={{ fontSize: '18px', color: '#ffffff' }}></i>
                            </div>
                            <div>
                                <h4 className="mb-0 text-dark fw-bold" style={{ fontSize: '18px', color: '#1e293b' }}>
                                    {tabHeaders[activeTab]?.title}
                                </h4>
                                <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                    {tabHeaders[activeTab]?.subtitle}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* ── Tabs Bar inside Form Card ── */}
                    <div className="custom-form-tabs">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                type="button"
                                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                <span>{tab.label}</span>
                                {tab.id === 'products' && (formData.products.length > 0 || formData.services.length > 0) && (
                                    <span className="tab-badge">
                                        {formData.products.length + formData.services.length}
                                    </span>
                                )}
                                {tab.id === 'attachments' && (selectedAttachments.length > 0 || existingAttachments.length > 0 || imagePreview) && (
                                    <span className="tab-badge">
                                        {selectedAttachments.length + existingAttachments.length + (imagePreview ? 1 : 0)}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* ══════════════════════════════════════════════════════════════
                        TAB 1: LEAD INFORMATION
                    ══════════════════════════════════════════════════════════════ */}
                    {activeTab === 'basic' && (
                        <div>
                            <div className="form-section-body">
                                {/* Lead Owner with Employee / External Referrer Switcher */}
                                <Row className="g-3 mb-3">
                                    <Col md={6}>
                                        <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 14px' }}>
                                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                                                <label className="form-label-custom mb-0" style={{ fontSize: '13px' }}>
                                                    Lead Owner <span className="text-danger">*</span>
                                                </label>
                                                <div className="owner-type-toggle-group" role="group" aria-label="Lead Owner Type">
                                                    <button
                                                        type="button"
                                                        className={`owner-type-toggle-btn ${ownerType === 'employee' ? 'active' : ''}`}
                                                        onClick={() => {
                                                            setOwnerType('employee');
                                                            setFormData(prev => ({ ...prev, other_owner_name: '' }));
                                                        }}
                                                    >
                                                        <i className="fa fa-user"></i>
                                                        <span>Employee</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`owner-type-toggle-btn ${ownerType === 'external' ? 'active' : ''}`}
                                                        onClick={() => {
                                                            setOwnerType('external');
                                                            setFormData(prev => ({ ...prev, lead_owner: '' }));
                                                        }}
                                                    >
                                                        <i className="fa fa-external-link"></i>
                                                        <span>External / Referrer</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {ownerType === 'employee' ? (
                                                <Select
                                                    options={employeeOptions}
                                                    value={employeeOptions.find(opt => String(opt.value) === String(formData.lead_owner)) || null}
                                                    onChange={selected => setFormData(prev => ({ ...prev, lead_owner: selected ? selected.value : '' }))}
                                                    placeholder="-- Select Lead Owner --"
                                                    isClearable
                                                    isSearchable
                                                    menuPortalTarget={document.body}
                                                    styles={selectCustomStyles}
                                                />
                                            ) : (
                                                <input
                                                    type="text"
                                                    className="form-control-custom"
                                                    name="other_owner_name"
                                                    value={formData.other_owner_name}
                                                    onChange={handleChange}
                                                    placeholder="Enter external person / agent / referrer name"
                                                    required={ownerType === 'external'}
                                                />
                                            )}
                                        </div>
                                    </Col>

                                    <Col md={6}>
                                        <label className="form-label-custom">Lead Category</label>
                                        <div className="d-flex gap-2">
                                            <div className="flex-grow-1">
                                                <Select
                                                    options={categoryOptions}
                                                    value={categoryOptions.find(opt => String(opt.value) === String(formData.category)) || null}
                                                    onChange={selected => setFormData(prev => ({ ...prev, category: selected ? selected.value : '' }))}
                                                    placeholder="-- Select Category --"
                                                    isClearable
                                                    isSearchable
                                                    menuPortalTarget={document.body}
                                                    styles={selectCustomStyles}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                className="btn-quick-add"
                                                onClick={() => navigate('/crm/categories')}
                                                title="Add New Category"
                                            >
                                                <i className="fa fa-plus"></i>
                                            </button>
                                        </div>
                                    </Col>
                                </Row>

                                <Row className="g-3 mb-3">
                                    <Col md={4}>
                                        <label className="form-label-custom">Lead Source</label>
                                        <div className="d-flex gap-2">
                                            <div className="flex-grow-1">
                                                <Select
                                                    options={sourceOptions}
                                                    value={sourceOptions.find(opt => String(opt.value) === String(formData.lead_source)) || null}
                                                    onChange={selected => setFormData(prev => ({ ...prev, lead_source: selected ? selected.value : '' }))}
                                                    placeholder="-- Select Source --"
                                                    isClearable
                                                    isSearchable
                                                    menuPortalTarget={document.body}
                                                    styles={selectCustomStyles}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                className="btn-quick-add"
                                                onClick={() => navigate('/crm/sources')}
                                                title="Add New Source"
                                            >
                                                <i className="fa fa-plus"></i>
                                            </button>
                                        </div>
                                    </Col>

                                    <Col md={4}>
                                        <label className="form-label-custom">Company / Organization</label>
                                        <input
                                            type="text"
                                            className="form-control-custom"
                                            name="company"
                                            value={formData.company}
                                            onChange={handleChange}
                                            placeholder="e.g. Acme Corporation"
                                        />
                                    </Col>
                                    <Col md={4}>
                                        <label className="form-label-custom">Title / Designation</label>
                                        <input
                                            type="text"
                                            className="form-control-custom"
                                            name="title"
                                            value={formData.title}
                                            onChange={handleChange}
                                            placeholder="e.g. Managing Director / Procurement Lead"
                                        />
                                    </Col>
                                </Row>

                                <Row className="g-3 mb-3">
                                    <Col md={6}>
                                        <label className="form-label-custom">First Name</label>
                                        <input
                                            type="text"
                                            className="form-control-custom"
                                            name="first_name"
                                            value={formData.first_name}
                                            onChange={handleChange}
                                            placeholder="Enter first name"
                                        />
                                    </Col>
                                    <Col md={6}>
                                        <label className="form-label-custom">Last Name</label>
                                        <input
                                            type="text"
                                            className="form-control-custom"
                                            name="last_name"
                                            value={formData.last_name}
                                            onChange={handleChange}
                                            placeholder="Enter last name"
                                        />
                                    </Col>
                                </Row>

                                <Row className="g-3 mb-3">
                                    <Col md={4}>
                                        <label className="form-label-custom">Lead Status</label>
                                        <Select
                                            options={statusOptions}
                                            value={statusOptions.find(opt => opt.value === (formData.lead_status || 'Not Contacted')) || null}
                                            onChange={selected => setFormData(prev => ({ ...prev, lead_status: selected ? selected.value : 'Not Contacted' }))}
                                            placeholder="Select Status"
                                            isSearchable
                                            menuPortalTarget={document.body}
                                            styles={selectCustomStyles}
                                        />
                                    </Col>
                                    <Col md={4}>
                                        <label className="form-label-custom">Rating</label>
                                        <Select
                                            options={ratingOptions}
                                            value={ratingOptions.find(opt => opt.value === (formData.rating || 'Warm')) || null}
                                            onChange={selected => setFormData(prev => ({ ...prev, rating: selected ? selected.value : 'Warm' }))}
                                            placeholder="Select Rating"
                                            isSearchable
                                            menuPortalTarget={document.body}
                                            styles={selectCustomStyles}
                                        />
                                    </Col>
                                    <Col md={4}>
                                        <label className="form-label-custom">Industry</label>
                                        <div className="d-flex gap-2">
                                            <div className="flex-grow-1">
                                                <Select
                                                    options={industryOptions}
                                                    value={industryOptions.find(opt => String(opt.value) === String(formData.industry)) || null}
                                                    onChange={selected => setFormData(prev => ({ ...prev, industry: selected ? selected.value : '' }))}
                                                    placeholder="-- Select Industry --"
                                                    isClearable
                                                    isSearchable
                                                    menuPortalTarget={document.body}
                                                    styles={selectCustomStyles}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                className="btn-quick-add"
                                                onClick={() => navigate('/crm/industries')}
                                                title="Add New Industry"
                                            >
                                                <i className="fa fa-plus"></i>
                                            </button>
                                        </div>
                                    </Col>
                                </Row>

                                <Row className="g-3 mb-3">
                                    <Col md={6}>
                                        <label className="form-label-custom">Number of Employees</label>
                                        <input
                                            type="number"
                                            className="form-control-custom"
                                            name="no_of_employees"
                                            value={formData.no_of_employees}
                                            onChange={handleChange}
                                            placeholder="e.g. 50"
                                        />
                                    </Col>
                                    <Col md={6}>
                                        <label className="form-label-custom">Annual Revenue</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="form-control-custom"
                                            name="annual_revenue"
                                            value={formData.annual_revenue}
                                            onChange={handleChange}
                                            placeholder="0.00"
                                        />
                                    </Col>
                                </Row>

                                {/* Table-wise Switch for Email Opt-Out */}
                                <div className="table-wise-switch-box mt-3">
                                    <div>
                                        <div className="switch-title">Email Opt-Out</div>
                                        <div className="switch-subtitle">Do not send marketing newsletters or automated campaigns</div>
                                    </div>
                                    <div className="form-check form-switch mb-0">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id="emailOptOutSwitch"
                                            name="email_opt_out"
                                            checked={formData.email_opt_out}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════════════════
                    TAB 2: CONTACT & ADDRESS
                ══════════════════════════════════════════════════════════════ */}
                    {activeTab === 'contact' && (
                        <div>
                            <div className="form-section-body">
                                <Row className="g-3 mb-3">
                                    <Col md={6}>
                                        <label className="form-label-custom">
                                            Phone Number <span className="text-danger">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            className="form-control-custom"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            placeholder="Primary Phone Number"
                                            required
                                        />
                                    </Col>
                                    <Col md={6}>
                                        <label className="form-label-custom">Mobile Number</label>
                                        <input
                                            type="text"
                                            className="form-control-custom"
                                            name="mobile"
                                            value={formData.mobile}
                                            onChange={handleChange}
                                            placeholder="Mobile / WhatsApp number"
                                        />
                                    </Col>
                                </Row>

                                <Row className="g-3 mb-3">
                                    <Col md={6}>
                                        <label className="form-label-custom">Primary Email</label>
                                        <input
                                            type="email"
                                            className="form-control-custom"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            placeholder="contact@company.com"
                                        />
                                    </Col>
                                    <Col md={6}>
                                        <label className="form-label-custom">Secondary Email</label>
                                        <input
                                            type="email"
                                            className="form-control-custom"
                                            name="secondary_email"
                                            value={formData.secondary_email}
                                            onChange={handleChange}
                                            placeholder="alternate@company.com"
                                        />
                                    </Col>
                                </Row>

                                <Row className="g-3 mb-3">
                                    <Col md={4}>
                                        <label className="form-label-custom">Website</label>
                                        <input
                                            type="url"
                                            className="form-control-custom"
                                            name="website"
                                            value={formData.website}
                                            onChange={handleChange}
                                            placeholder="https://company.com"
                                        />
                                    </Col>
                                    <Col md={4}>
                                        <label className="form-label-custom">Fax</label>
                                        <input
                                            type="text"
                                            className="form-control-custom"
                                            name="fax"
                                            value={formData.fax}
                                            onChange={handleChange}
                                            placeholder="Fax Number"
                                        />
                                    </Col>
                                    <Col md={4}>
                                        <label className="form-label-custom">Contact Preferences</label>
                                        <div
                                            className="d-flex flex-wrap align-items-center gap-3"
                                            style={{ minHeight: '42px', paddingTop: '6px' }}
                                        >
                                            {['WhatsApp', 'Email', 'Phone', 'SMS'].map(pref => {
                                                const currentPrefs = formData.contact_preferences
                                                    ? formData.contact_preferences.split(',').map(p => p.trim()).filter(Boolean)
                                                    : [];
                                                const isChecked = currentPrefs.some(p => p.toLowerCase() === pref.toLowerCase());
                                                return (
                                                    <label
                                                        key={pref}
                                                        className="d-inline-flex align-items-center gap-2 mb-0"
                                                        style={{
                                                            cursor: 'pointer',
                                                            fontSize: '13px',
                                                            fontWeight: 500,
                                                            color: '#334155',
                                                            userSelect: 'none'
                                                        }}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            name="contact_preferences_checkbox"
                                                            value={pref}
                                                            checked={isChecked}
                                                            onChange={handleChange}
                                                            style={{
                                                                width: '16px',
                                                                height: '16px',
                                                                accentColor: '#2ece8a',
                                                                cursor: 'pointer',
                                                                margin: 0
                                                            }}
                                                        />
                                                        <span>{pref}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </Col>
                                </Row>

                                <Row className="g-3 mb-4">
                                    <Col md={6}>
                                        <label className="form-label-custom">Skype ID</label>
                                        <input
                                            type="text"
                                            className="form-control-custom"
                                            name="skype_id"
                                            value={formData.skype_id}
                                            onChange={handleChange}
                                            placeholder="skype.username"
                                        />
                                    </Col>
                                    <Col md={6}>
                                        <label className="form-label-custom">Twitter Handle</label>
                                        <input
                                            type="text"
                                            className="form-control-custom"
                                            name="twitter"
                                            value={formData.twitter}
                                            onChange={handleChange}
                                            placeholder="@handle"
                                        />
                                    </Col>
                                </Row>

                                <hr className="my-4 text-muted" />

                                <h6 className="fw-bold text-dark mb-3">Physical Address</h6>

                                <Row className="g-3 mb-3">
                                    <Col md={6}>
                                        <label className="form-label-custom">Flat / House / Building No.</label>
                                        <input
                                            type="text"
                                            className="form-control-custom"
                                            name="flat_house_no"
                                            value={formData.flat_house_no}
                                            onChange={handleChange}
                                            placeholder="Flat / Building / Suite"
                                        />
                                    </Col>
                                    <Col md={6}>
                                        <label className="form-label-custom">Street Address</label>
                                        <input
                                            type="text"
                                            className="form-control-custom"
                                            name="street_address"
                                            value={formData.street_address}
                                            onChange={handleChange}
                                            placeholder="Street, Landmark, Locality"
                                        />
                                    </Col>
                                </Row>

                                <Row className="g-3 mb-3">
                                    <Col md={4}>
                                        <label className="form-label-custom">City</label>
                                        <input
                                            type="text"
                                            className="form-control-custom"
                                            name="city"
                                            value={formData.city}
                                            onChange={handleChange}
                                            placeholder="City"
                                        />
                                    </Col>
                                    <Col md={4}>
                                        <label className="form-label-custom">State / Province</label>
                                        <input
                                            type="text"
                                            className="form-control-custom"
                                            name="state_province"
                                            value={formData.state_province}
                                            onChange={handleChange}
                                            placeholder="State"
                                        />
                                    </Col>
                                    <Col md={4}>
                                        <label className="form-label-custom">Zip / Postal Code</label>
                                        <input
                                            type="text"
                                            className="form-control-custom"
                                            name="zip_postal_code"
                                            value={formData.zip_postal_code}
                                            onChange={handleChange}
                                            placeholder="Zip / Postal Code"
                                        />
                                    </Col>
                                </Row>

                                <Row className="g-3">
                                    <Col md={4}>
                                        <label className="form-label-custom">Country</label>
                                        <input
                                            type="text"
                                            className="form-control-custom"
                                            name="country"
                                            value={formData.country}
                                            onChange={handleChange}
                                            placeholder="Country"
                                        />
                                    </Col>
                                    <Col md={4}>
                                        <label className="form-label-custom">Latitude</label>
                                        <input
                                            type="number"
                                            step="any"
                                            className="form-control-custom"
                                            name="latitude"
                                            value={formData.latitude}
                                            onChange={handleChange}
                                            placeholder="e.g. 10.8505"
                                        />
                                    </Col>
                                    <Col md={4}>
                                        <label className="form-label-custom">Longitude</label>
                                        <input
                                            type="number"
                                            step="any"
                                            className="form-control-custom"
                                            name="longitude"
                                            value={formData.longitude}
                                            onChange={handleChange}
                                            placeholder="e.g. 76.2711"
                                        />
                                    </Col>
                                </Row>
                            </div>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════════════════
                    TAB 3: PRODUCTS & SERVICES (TABLE-WISE SWITCHES)
                ══════════════════════════════════════════════════════════════ */}
                    {activeTab === 'products' && (
                        <div>
                            <div className="form-section-body">
                                {/* 1. Inventory Products Switch Box */}
                                <div className="table-wise-switch-box mb-3">
                                    <div>
                                        <div className="switch-title">Inventory Products Requirement</div>
                                        <div className="switch-subtitle">Enable if this customer is interested in buying inventory stock items</div>
                                    </div>
                                    <div className="form-check form-switch mb-0">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id="has_product_interest"
                                            name="has_product_interest"
                                            checked={formData.has_product_interest}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>

                                {formData.has_product_interest && (
                                    <div className="border rounded p-3 mb-4 bg-white">
                                        <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                                            <div className="d-flex align-items-center gap-2">
                                                <span className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
                                                    Selected Stock Items: <Badge bg="success">{formData.products.length}</Badge>
                                                </span>
                                                <button
                                                    type="button"
                                                    className="btn btn-link btn-sm p-0 text-decoration-none text-primary"
                                                    onClick={toggleAllProducts}
                                                >
                                                    {formData.products.length === filteredStockItems.length ? 'Deselect All' : 'Select All'}
                                                </button>
                                            </div>
                                            <div style={{ maxWidth: '280px', width: '100%' }}>
                                                <input
                                                    type="text"
                                                    className="form-control-custom"
                                                    placeholder="Search items..."
                                                    value={productSearch}
                                                    onChange={(e) => setProductSearch(e.target.value)}
                                                    style={{ padding: '6px 12px', fontSize: '12.5px' }}
                                                />
                                            </div>
                                        </div>

                                        <div style={{ maxHeight: '240px', overflowY: 'auto' }} className="border rounded">
                                            <Table hover responsive className="item-select-table">
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: '50px', textAlign: 'center' }}>Select</th>
                                                        <th>Item Name</th>
                                                        <th>Code / SKU</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredStockItems.length > 0 ? (
                                                        filteredStockItems.map(item => {
                                                            const isChecked = formData.products.includes(item.id);
                                                            return (
                                                                <tr
                                                                    key={item.id}
                                                                    onClick={() => toggleProduct(item.id)}
                                                                    style={{ cursor: 'pointer' }}
                                                                >
                                                                    <td style={{ textAlign: 'center' }}>
                                                                        <input
                                                                            type="checkbox"
                                                                            className="form-check-input"
                                                                            checked={isChecked}
                                                                            onChange={() => { }}
                                                                            style={{ cursor: 'pointer' }}
                                                                        />
                                                                    </td>
                                                                    <td className="fw-semibold text-dark">
                                                                        {item.stock_item_name || item.name || `Item #${item.id}`}
                                                                    </td>
                                                                    <td className="text-muted">
                                                                        {item.item_code || item.part_no || '-'}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    ) : (
                                                        <tr>
                                                            <td colSpan="3" className="text-center py-3 text-muted small">
                                                                No stock items found matching search.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </Table>
                                        </div>
                                    </div>
                                )}

                                {/* 2. CRM Services Switch Box */}
                                <div className="table-wise-switch-box mb-3">
                                    <div>
                                        <div className="switch-title">CRM Services Requirement</div>
                                        <div className="switch-subtitle">Enable if this customer is interested in professional service packages</div>
                                    </div>
                                    <div className="form-check form-switch mb-0">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id="has_service_interest"
                                            name="has_service_interest"
                                            checked={formData.has_service_interest}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>

                                {formData.has_service_interest && (
                                    <div className="border rounded p-3 bg-white">
                                        <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                                            <div className="d-flex align-items-center gap-2">
                                                <span className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
                                                    Selected Services: <Badge bg="success">{formData.services.length}</Badge>
                                                </span>
                                                <button
                                                    type="button"
                                                    className="btn btn-link btn-sm p-0 text-decoration-none text-primary"
                                                    onClick={toggleAllServices}
                                                >
                                                    {formData.services.length === filteredCrmServices.length ? 'Deselect All' : 'Select All'}
                                                </button>
                                            </div>
                                            <div style={{ maxWidth: '280px', width: '100%' }}>
                                                <input
                                                    type="text"
                                                    className="form-control-custom"
                                                    placeholder="Search services..."
                                                    value={serviceSearch}
                                                    onChange={(e) => setServiceSearch(e.target.value)}
                                                    style={{ padding: '6px 12px', fontSize: '12.5px' }}
                                                />
                                            </div>
                                        </div>

                                        <div style={{ maxHeight: '240px', overflowY: 'auto' }} className="border rounded">
                                            <Table hover responsive className="item-select-table">
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: '50px', textAlign: 'center' }}>Select</th>
                                                        <th>Service Name</th>
                                                        <th>Description</th>
                                                        <th>Standard Rate</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredCrmServices.length > 0 ? (
                                                        filteredCrmServices.map(srv => {
                                                            const isChecked = formData.services.includes(srv.id);
                                                            return (
                                                                <tr
                                                                    key={srv.id}
                                                                    onClick={() => toggleService(srv.id)}
                                                                    style={{ cursor: 'pointer' }}
                                                                >
                                                                    <td style={{ textAlign: 'center' }}>
                                                                        <input
                                                                            type="checkbox"
                                                                            className="form-check-input"
                                                                            checked={isChecked}
                                                                            onChange={() => { }}
                                                                            style={{ cursor: 'pointer' }}
                                                                        />
                                                                    </td>
                                                                    <td className="fw-semibold text-dark">{srv.name}</td>
                                                                    <td className="text-muted small text-truncate" style={{ maxWidth: '200px' }}>
                                                                        {srv.description || '-'}
                                                                    </td>
                                                                    <td className="fw-semibold text-success">
                                                                        {srv.rate ? `₹${parseFloat(srv.rate).toFixed(2)}` : '-'}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    ) : (
                                                        <tr>
                                                            <td colSpan="4" className="text-center py-3 text-muted small">
                                                                No CRM services found matching search.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </Table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════════════════
                    TAB 4: DEAL & PIPELINE METRICS
                ══════════════════════════════════════════════════════════════ */}
                    {activeTab === 'deal' && (
                        <div>
                            <div className="form-section-body">
                                <Row className="g-3 mb-3">
                                    <Col md={6}>
                                        <label className="form-label-custom">Estimated Deal Value (₹)</label>
                                        <div className="d-flex">
                                            <span
                                                className="d-flex align-items-center justify-content-center px-3 bg-light border border-end-0 text-muted fw-bold"
                                                style={{ borderRadius: '10px 0 0 10px' }}
                                            >
                                                ₹
                                            </span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="form-control-custom"
                                                name="estimated_value"
                                                value={formData.estimated_value}
                                                onChange={handleChange}
                                                placeholder="0.00"
                                                style={{ borderRadius: '0 10px 10px 0' }}
                                            />
                                        </div>
                                    </Col>
                                    <Col md={6}>
                                        <label className="form-label-custom">Deal Priority</label>
                                        <select
                                            className="form-control-custom"
                                            name="priority"
                                            value={formData.priority || 'Medium'}
                                            onChange={handleChange}
                                        >
                                            {priorityChoices.map(p => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </select>
                                    </Col>
                                </Row>

                                <Row className="g-3 mb-3">
                                    <Col md={6}>
                                        <label className="form-label-custom">Expected Closing Date</label>
                                        <input
                                            type="date"
                                            className="form-control-custom"
                                            name="expected_closing_date"
                                            value={formData.expected_closing_date}
                                            onChange={handleChange}
                                        />
                                    </Col>
                                    <Col md={6}>
                                        <label className="form-label-custom">Assigned Sales Employees</label>
                                        <input
                                            type="text"
                                            className="form-control-custom"
                                            name="assigned_sales_employees"
                                            value={formData.assigned_sales_employees}
                                            onChange={handleChange}
                                            placeholder="e.g. Sales reps / account managers assigned"
                                        />
                                    </Col>
                                </Row>

                                <Row className="g-3">
                                    <Col md={12}>
                                        <label className="form-label-custom">Description & Meeting Notes</label>
                                        <textarea
                                            className="form-control-custom"
                                            rows="4"
                                            name="description"
                                            value={formData.description}
                                            onChange={handleChange}
                                            placeholder="Enter detailed conversation history, requirements, or next action items..."
                                        />
                                    </Col>
                                </Row>
                            </div>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════════════════
                    TAB 5: ATTACHMENTS & MEDIA
                ══════════════════════════════════════════════════════════════ */}
                    {activeTab === 'attachments' && (
                        <div>
                            <div className="form-section-body">
                                <Row className="g-4">
                                    {/* Lead Photos & Images (Multiple Allowed) */}
                                    <Col md={6}>
                                        <div className="p-3 border rounded h-100 bg-white">
                                            <label className="form-label-custom mb-2">Lead Photos & Images</label>

                                            <input
                                                type="file"
                                                ref={imageInputRef}
                                                accept="image/*"
                                                multiple
                                                style={{ display: 'none' }}
                                                onChange={handleImageChange}
                                            />

                                            <div
                                                className="p-4 rounded text-center mb-3"
                                                style={{
                                                    border: '2px dashed #2ece8a',
                                                    backgroundColor: '#f0fdf4',
                                                    cursor: 'pointer'
                                                }}
                                                onClick={() => imageInputRef.current && imageInputRef.current.click()}
                                            >
                                                <i className="fa fa-camera text-success mb-2" style={{ fontSize: '32px' }}></i>
                                                <div className="fw-semibold text-dark" style={{ fontSize: '13px' }}>Click to browse or drop images</div>
                                                <div className="text-muted small">Upload multiple images (PNG, JPG, WEBP, GIF - Max 5MB each)</div>
                                            </div>

                                            {/* Primary Profile Photo Preview if available */}
                                            {imagePreview && (
                                                <div className="mb-3 p-2 bg-light rounded border d-flex align-items-center justify-content-between">
                                                    <div className="d-flex align-items-center gap-3 text-truncate">
                                                        <img
                                                            src={imagePreview}
                                                            alt="Profile Photo"
                                                            style={{
                                                                width: '46px',
                                                                height: '46px',
                                                                borderRadius: '50%',
                                                                objectFit: 'cover',
                                                                border: '2px solid #2ece8a',
                                                                flexShrink: 0
                                                            }}
                                                        />
                                                        <div className="text-truncate">
                                                            <span className="badge badge-success light fs-11 mb-1">Primary Profile Photo</span>
                                                            <div className="small text-muted text-truncate">{imageFile ? imageFile.name : 'Current Profile Photo'}</div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="btn btn-link btn-sm p-0 text-danger ms-2"
                                                        onClick={handleRemoveImage}
                                                        title="Remove Primary Photo"
                                                    >
                                                        <i className="fa fa-trash"></i>
                                                    </button>
                                                </div>
                                            )}

                                            {/* New Images Ready to Upload */}
                                            {selectedImages.length > 0 && (
                                                <div className="mb-3">
                                                    <span className="small fw-bold text-muted text-uppercase d-block mb-2">
                                                        New Images Ready to Upload ({selectedImages.length}):
                                                    </span>
                                                    <div className="row g-2">
                                                        {selectedImages.map((img, idx) => (
                                                            <div key={idx} className="col-6 col-sm-4">
                                                                <div className="border rounded p-1 bg-light position-relative text-center h-100">
                                                                    <img
                                                                        src={img.previewUrl}
                                                                        alt={img.name}
                                                                        className="rounded img-fluid"
                                                                        style={{ height: '70px', width: '100%', objectFit: 'cover' }}
                                                                    />
                                                                    <div className="small text-truncate mt-1 px-1" title={img.name} style={{ fontSize: '11px' }}>
                                                                        {img.name}
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-danger btn-xs position-absolute shadow-sm"
                                                                        style={{ top: '3px', right: '3px', width: '20px', height: '20px', padding: 0, borderRadius: '50%', lineHeight: '18px' }}
                                                                        onClick={() => removeSelectedImage(idx)}
                                                                        title="Remove Image"
                                                                    >
                                                                        &times;
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Existing Images on Server */}
                                            {existingImages.length > 0 && (
                                                <div>
                                                    <span className="small fw-bold text-muted text-uppercase d-block mb-2">
                                                        Images on Server ({existingImages.length}):
                                                    </span>
                                                    <div className="row g-2">
                                                        {existingImages.map(img => (
                                                            <div key={img.id} className="col-6 col-sm-4">
                                                                <div className="border rounded p-1 bg-light position-relative text-center h-100">
                                                                    <a href={img.image} target="_blank" rel="noopener noreferrer">
                                                                        <img
                                                                            src={img.image}
                                                                            alt={img.image_name || 'Lead Image'}
                                                                            className="rounded img-fluid"
                                                                            style={{ height: '70px', width: '100%', objectFit: 'cover' }}
                                                                        />
                                                                    </a>
                                                                    <div className="small text-truncate mt-1 px-1" title={img.image_name || ''} style={{ fontSize: '11px' }}>
                                                                        {img.image_name || 'Image'}
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-danger btn-xs position-absolute shadow-sm"
                                                                        style={{ top: '3px', right: '3px', width: '20px', height: '20px', padding: 0, borderRadius: '50%', lineHeight: '18px' }}
                                                                        onClick={() => handleDeleteExistingImage(img.id)}
                                                                        title="Delete Image"
                                                                    >
                                                                        <i className="fa fa-trash" style={{ fontSize: '10px' }}></i>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </Col>

                                    {/* Supporting Documents */}
                                    <Col md={6}>
                                        <div className="p-3 border rounded h-100 bg-white">
                                            <label className="form-label-custom mb-2">Supporting Documents</label>

                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                multiple
                                                style={{ display: 'none' }}
                                                onChange={handleAttachmentChange}
                                            />

                                            <div
                                                className="p-4 rounded text-center mb-3"
                                                style={{
                                                    border: '2px dashed #cbd5e1',
                                                    backgroundColor: '#f8fafc',
                                                    cursor: 'pointer'
                                                }}
                                                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                                            >
                                                <i className="fa fa-cloud-upload text-success mb-2" style={{ fontSize: '32px' }}></i>
                                                <div className="fw-semibold text-dark" style={{ fontSize: '13px' }}>Click to browse or drop documents</div>
                                                <div className="text-muted small">Upload quotes, agreements, spreadsheets, or specs</div>
                                            </div>

                                            {/* Files staged for upload */}
                                            {selectedAttachments.length > 0 && (
                                                <div className="mb-3">
                                                    <span className="small fw-bold text-muted text-uppercase d-block mb-2">
                                                        New Files Ready to Upload ({selectedAttachments.length}):
                                                    </span>
                                                    <div className="d-flex flex-column gap-2">
                                                        {selectedAttachments.map((f, idx) => (
                                                            <div key={idx} className="d-flex align-items-center justify-content-between p-2 rounded bg-light border">
                                                                <div className="d-flex align-items-center gap-2 text-truncate">
                                                                    <i className="fa fa-file-text-o text-success"></i>
                                                                    <span className="small fw-semibold text-dark text-truncate">{f.name}</span>
                                                                    <small className="text-muted">({(f.size / 1024).toFixed(1)} KB)</small>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-link btn-sm p-0 text-danger"
                                                                    onClick={() => removeSelectedAttachment(idx)}
                                                                >
                                                                    <i className="fa fa-trash"></i>
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Existing attachments on server */}
                                            {existingAttachments.length > 0 && (
                                                <div>
                                                    <span className="small fw-bold text-muted text-uppercase d-block mb-2">
                                                        Attached on Server ({existingAttachments.length}):
                                                    </span>
                                                    <div className="d-flex flex-column gap-2">
                                                        {existingAttachments.map(att => (
                                                            <div key={att.id} className="d-flex align-items-center justify-content-between p-2 rounded bg-light border">
                                                                <div className="d-flex align-items-center gap-2 text-truncate">
                                                                    <i className="fa fa-check-circle text-success"></i>
                                                                    <a
                                                                        href={att.file}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="small fw-semibold text-primary text-decoration-underline text-truncate"
                                                                    >
                                                                        {att.file_name || 'Download Attachment'}
                                                                    </a>
                                                                    {att.file_size && (
                                                                        <small className="text-muted">({(att.file_size / 1024).toFixed(1)} KB)</small>
                                                                    )}
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-link btn-sm p-0 text-danger"
                                                                    onClick={() => handleDeleteExistingAttachment(att.id)}
                                                                >
                                                                    <i className="fa fa-trash"></i>
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </Col>
                                </Row>
                            </div>
                        </div>
                    )}

                    {/* ── Bottom Navigation & Action Footer inside Form Card ── */}
                    <div className="form-section-footer">
                        {/* Previous / Next Tab buttons */}
                        <div className="d-flex align-items-center gap-2">
                            {currentTabIndex > 0 && (
                                <button
                                    type="button"
                                    className="btn-tab-nav"
                                    onClick={handlePrevTab}
                                >
                                    <i className="fa fa-arrow-left"></i> Previous Tab
                                </button>
                            )}
                            {currentTabIndex < tabs.length - 1 && (
                                <button
                                    type="button"
                                    className="btn-tab-nav"
                                    onClick={handleNextTab}
                                >
                                    Next Tab <i className="fa fa-arrow-right"></i>
                                </button>
                            )}
                        </div>

                        {/* Close & Save Buttons */}
                        <div className="d-flex align-items-center gap-2">
                            <button
                                type="button"
                                className="btn-close-custom"
                                onClick={() => navigate('/crm/leads')}
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                className="btn-save-next-custom"
                                disabled={loading}
                                onClick={handleSaveAndNext}
                            >
                                {loading ? (
                                    <>
                                        <i className="fa fa-spinner fa-spin me-2"></i> Saving...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa fa-plus-circle me-1"></i> Save & Next
                                    </>
                                )}
                            </button>
                            <button
                                type="submit"
                                className="btn-save-custom"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <i className="fa fa-spinner fa-spin me-2"></i> Saving...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa fa-check me-2"></i> {isEditMode ? 'Update Lead' : 'Save Lead'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </Form>
        </div>
    );
};

export default LeadCreate;