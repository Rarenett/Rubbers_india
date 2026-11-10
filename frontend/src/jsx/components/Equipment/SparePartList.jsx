import React, { useState, useEffect, Fragment } from 'react';
import { useFormConfig } from "../../../hooks/useFormConfig";
import { Card, Table, Button, Modal, Form, InputGroup } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    getSpareParts,
    createSparePart,
    updateSparePart,
    deleteSparePart,
    deleteSparePartImage,
    getLifespans
} from '../../../services/MachineManagementService';
import { getStockItems, getStockCategories } from '../../../services/InventoryService';
import { getLedgers } from '../../../services/FinanceService';
import { usePermission } from '../../../hooks/usePermission';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import Select from 'react-select';
import { useEnterTraversal } from '../../../hooks/useEnterTraversal';


const SparePartList = () => {
    const { isFieldVisible, stripHiddenFields } = useFormConfig('machine_app_sparepart', 'SparePartList');
    const companySettings = JSON.parse(localStorage.getItem('companySettings') || '{}');
    const currencySymbol = companySettings.currencySymbol || '';

    const [spareParts, setSpareParts] = useState([]);
    const [stockItems, setStockItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [lifespans, setLifespans] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;
    
    const { can } = usePermission();

    // Image Gallery Modal State 
    const [showGallery, setShowGallery] = useState(false);
    const [galleryImages, setGalleryImages] = useState([]);
    const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [animateTrigger, setAnimateTrigger] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [currentSparePart, setCurrentSparePart] = useState({
        id: null,
        name: '',
        code: '',
        brand: '',
        rate: '',
        lifespan_type: '',
        machine_name: '',
        priority: '',
        supplier: '',
        images: []
    });

    const { handleFormKeyDown, handleSelectFocus, handleSelectKeyDown, makeSelectChange } = useEnterTraversal('.sgfm-modal', setCurrentSparePart);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && showModal) {
                setAnimateTrigger(true);
                setTimeout(() => setAnimateTrigger(false), 300);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showModal]);

    useEffect(() => {
        if (showModal) {
            const timer = setTimeout(() => {
                const input = document.querySelector('.sgfm-modal input:not([disabled]):not([readonly])');
                if (input) {
                    input.focus();
                }
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [showModal]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [sparePartsData, itemsRes, catsRes, lifespansRes, ledgersRes] = await Promise.all([
                getSpareParts(),
                getStockItems(),
                getStockCategories(),
                getLifespans(),
                getLedgers()
            ]);
            setSpareParts(sparePartsData);
            setStockItems(Array.isArray(itemsRes) ? itemsRes : []);
            setCategories(Array.isArray(catsRes) ? catsRes : []);
            setLifespans(Array.isArray(lifespansRes) ? lifespansRes : []);
            setSuppliers(Array.isArray(ledgersRes) ? ledgersRes : []);
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to fetch spare parts or configuration options',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleShowModal = (sparePart = null) => {
        setSelectedFiles([]);
        if (sparePart) {
            setCurrentSparePart({
                id: sparePart.id,
                name: sparePart.name || '',
                code: sparePart.code || '',
                brand: sparePart.brand || '',
                rate: sparePart.rate !== null && sparePart.rate !== undefined ? sparePart.rate : '',
                lifespan_type: sparePart.lifespan_type || '',
                machine_name: sparePart.machine_name || '',
                priority: sparePart.priority || '',
                supplier: sparePart.supplier || '',
                images: sparePart.images || []
            });
            setEditMode(true);
        } else {
            setCurrentSparePart({
                id: null,
                name: '',
                code: '',
                brand: '',
                rate: '',
                lifespan_type: '',
                machine_name: '',
                priority: '',
                supplier: '',
                images: []
            });
            setEditMode(false);
        }
        setShowModal(true);
    };

    const handleFileChange = (e) => {
        if (e.target.files) {
            setSelectedFiles(Array.from(e.target.files));
        }
    };

    const handleDeleteImage = async (imageId) => {
        const result = await Swal.fire({
            title: 'Delete this image?',
            text: "This action cannot be undone.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deleteSparePartImage(currentSparePart.id, imageId);
                Swal.fire({ icon: 'success', title: 'Deleted', text: 'Image removed successfully', timer: 1500, showConfirmButton: false });
                
                // Update component state
                const updatedImages = currentSparePart.images.filter(img => img.id !== imageId);
                setCurrentSparePart({
                    ...currentSparePart,
                    images: updatedImages
                });
                
                // Refresh list table
                fetchData();
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete image' });
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Only validate fields that are currently visible
        if (isFieldVisible('name') && !currentSparePart.name) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Part Name is required' });
            return;
        }
        if (isFieldVisible('code') && (!currentSparePart.code || !currentSparePart.code.trim())) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Code is required' });
            return;
        }
        if (isFieldVisible('machine_name') && !currentSparePart.machine_name) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Equipment/Machine is required' });
            return;
        }
        if (isFieldVisible('lifespan_type') && !currentSparePart.lifespan_type) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Lifespan Type is required' });
            return;
        }
        if (isFieldVisible('priority') && !currentSparePart.priority) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Priority is required' });
            return;
        }

        // Construct FormData for multipart (file upload support)
        // Only append fields that are visible OR have existing values (edit mode)
        const formData = new FormData();
        if (isFieldVisible('name') || currentSparePart.name) formData.append('name', currentSparePart.name);
        if (isFieldVisible('code') || currentSparePart.code) formData.append('code', currentSparePart.code.trim());
        if (isFieldVisible('machine_name') || currentSparePart.machine_name) formData.append('machine_name', currentSparePart.machine_name);
        if (isFieldVisible('lifespan_type') || currentSparePart.lifespan_type) formData.append('lifespan_type', currentSparePart.lifespan_type);
        if (isFieldVisible('priority') || currentSparePart.priority) formData.append('priority', currentSparePart.priority);
        
        if (currentSparePart.brand) {
            formData.append('brand', currentSparePart.brand);
        }
        if (currentSparePart.supplier) {
            formData.append('supplier', currentSparePart.supplier);
        }
        if (currentSparePart.rate !== '') {
            formData.append('rate', parseFloat(currentSparePart.rate));
        }

        // Append multiple files for upload
        selectedFiles.forEach((file) => {
            formData.append('uploaded_images', file);
        });

        try {
            if (editMode && currentSparePart.id) {
                await updateSparePart(currentSparePart.id, formData);
                Swal.fire({ icon: 'success', title: 'Updated', text: 'Spare part updated successfully', timer: 2000, showConfirmButton: false });
            } else {
                await createSparePart(formData);
                Swal.fire({ icon: 'success', title: 'Created', text: 'Spare part created successfully', timer: 2000, showConfirmButton: false });
            }
            setShowModal(false);
            fetchData();
        } catch (error) {
            let errorMsg = 'Failed to save spare part';
            if (error.response?.data) {
                const keys = Object.keys(error.response.data);
                if (keys.length > 0) {
                    errorMsg = `${keys[0].toUpperCase()}: ${error.response.data[keys[0]][0]}`;
                }
            }
            Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
        }
    };

    const handleOpenGallery = (images) => {
        setGalleryImages(images);
        setActiveGalleryIndex(0);
        setShowGallery(true);
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Spare Part?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deleteSparePart(id);
                Swal.fire({ icon: 'success', title: 'Deleted', text: 'Spare part deleted successfully', timer: 2000, showConfirmButton: false });
                fetchData();
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete spare part' });
            }
        }
    };

    const filteredParts = spareParts.filter(item =>
        (item.name_details || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.brand_details || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.machine_name_details || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.supplier_details || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.priority || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredParts.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredParts.length / itemsPerPage);

    const 
    selectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '38px',
            borderColor: state.isFocused ? '#6d4aff' : '#cbd5e1',
            boxShadow: state.isFocused ? '0 0 0 2px rgba(109,74,255,0.15)' : 'none',
            '&:hover': { borderColor: '#6d4aff' },
            borderRadius: '10px',
            fontSize: '14px',
        }),
        menu: base => ({ ...base, zIndex: 99999, fontSize: '14px' }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#6d4aff' : state.isFocused ? '#f0ecff' : 'white',
            color: state.isSelected ? 'white' : '#333',
            cursor: 'pointer',
        }),
    };

    const isStockGroup = (item, groups) =>
    groups.includes((item.stock_group_name || '').trim().toLowerCase());

const partNameOptions = stockItems
    .filter(item => item.id !== Number(currentSparePart.machine_name))
    .filter(item => !isStockGroup(item, ['machinery', 'equipment', 'vehicle']))
    .map(item => ({ value: item.id, label: item.name }));
const selectedPartName = currentSparePart.name ? partNameOptions.find(opt => opt.value === Number(currentSparePart.name)) || null : null;

const brandOptions = categories.map(cat => ({ value: cat.id, label: cat.name }));
const selectedBrand = currentSparePart.brand ? brandOptions.find(opt => opt.value === Number(currentSparePart.brand)) || null : null;

const machineNameOptions = stockItems
    .filter(item => item.id !== Number(currentSparePart.name))
    .filter(item => !isStockGroup(item, ['spare parts']))
    .map(item => ({ value: item.id, label: item.name }));
const selectedMachineName = currentSparePart.machine_name ? machineNameOptions.find(opt => opt.value === Number(currentSparePart.machine_name)) || null : null;

    const lifespanOptions = lifespans.map(l => ({ value: l.id, label: l.lifespan_type }));
    const selectedLifespan = currentSparePart.lifespan_type ? lifespanOptions.find(opt => opt.value === Number(currentSparePart.lifespan_type)) || null : null;

    const priorityOptions = [
        { value: 'High', label: 'High' },
        { value: 'Medium', label: 'Medium' },
        { value: 'Low', label: 'Low' }
    ];
    const selectedPriority = currentSparePart.priority ? priorityOptions.find(opt => opt.value === currentSparePart.priority) || null : null;

    const supplierOptions = suppliers.map(s => ({ value: s.id, label: s.name }));
    const selectedSupplier = currentSparePart.supplier ? supplierOptions.find(opt => opt.value === Number(currentSparePart.supplier)) || null : null;

    return (
        <Fragment>
            <style>{`
                .custom-badge-outline {
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    padding: 2px 8px;
                    font-size: 11px;
                    font-weight: 500;
                    color: #475569;
                    background: #f8fafc;
                }
                .image-container-thumbnail {
                    position: relative;
                    width: 80px;
                    height: 80px;
                    border-radius: 8px;
                    overflow: hidden;
                    border: 1px solid #e2e8f0;
                }
                .image-container-thumbnail img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .delete-image-overlay {
                    position: absolute;
                    top: 0;
                    right: 0;
                    background: rgba(239, 68, 68, 0.9);
                    border: none;
                    border-radius: 0 0 0 8px;
                    color: white;
                    padding: 2px 6px;
                    cursor: pointer;
                    font-size: 10px;
                }
                .delete-image-overlay:hover {
                    background: #ef4444;
                }
                .gallery-image-main {
                    max-width: 100%;
                    max-height: 450px;
                    object-fit: contain;
                    border-radius: 8px;
                }
                .sgfm-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .sgfm-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .sgfm-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #0a500f;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .sgfm-modal .modal-close-x {
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
                .sgfm-modal .modal-close-x:hover { color: #555; }
                .sgfm-modal .modal-body-custom { padding: 24px 28px; }
                .sgfm-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .sgfm-modal .form-label-custom {
                    font-size: 14px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 8px;
                }
                .sgfm-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 12px 16px;
                    font-size: 14px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .sgfm-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .sgfm-modal .form-control-custom::placeholder { color: #94a3b8; }
                .sgfm-modal .btn-close-custom {
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
                .sgfm-modal .btn-close-custom:hover { background-color: #bb2d3b !important; }
                .sgfm-modal .btn-save-custom {
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
                .sgfm-modal .btn-save-custom:hover { background-color: #073d0b !important; }
                @keyframes modalFeedback {
                    0%, 100% { transform: scale(1); }
                    20%, 60% { transform: scale(0.99) translateX(-4px); }
                    40%, 80% { transform: scale(1.01) translateX(4px); }
                }
                .modal-feedback {
                    animation: modalFeedback 0.25s ease-in-out !important;
                }
            `}</style>

            {/* <div className="page-titles">
                <button 
                    onClick={() => window.history.back()} 
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div> */}

            <div className="container-fluid">
                <div className="row">
                    <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center">
                            <Card.Title className="mb-0">Spare Parts Management</Card.Title>
                            <div className="d-flex align-items-center gap-2">
                                <div style={{ width: '300px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Spare Parts..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                
                                <CreateButton
                                    module="spareparts"
                                    onClick={() => handleShowModal()}
                                >
                                    Spare Part
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
                                    <table className="table table-responsive-md">
                                        <thead>
                                            <tr>
                                                <th><strong>SL.NO</strong></th>
                                                <th><strong>NAME & CODE</strong></th>
                                                <th><strong>BRAND</strong></th>
                                                <th><strong>MACHINE / EQUIPMENT</strong></th>
                                                <th><strong>SUPPLIER</strong></th>
                                                {/* <th><strong>UNIT PRICE</strong></th> */}
                                                <th><strong>LIFESPAN TYPE</strong></th>
                                                <th><strong>PRIORITY</strong></th>
                                                {/* <th><strong>IMAGES</strong></th> */}
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentItems.length > 0 ? (
                                                currentItems.map((item, idx) => (
                                                    <tr key={item.id}>
                                                        <td>{indexOfFirstItem + idx + 1}</td>
                                                        
                                                        <td>
                                                            <strong>{item.name_details}</strong>
                                                            <div className="text-muted fs-11" style={{ letterSpacing: '0.5px' }}>{item.code}</div>
                                                        </td>
                                                        <td>{item.brand_details || <span className="text-muted">-</span>}</td>
                                                        <td>{item.machine_name_details || <span className="text-muted">-</span>}</td>
                                                        <td>{item.supplier_details || <span className="text-muted">-</span>}</td>
                                                        {/* <td>
                                                            <strong>
                                                                {item.rate !== null && item.rate !== undefined ? (
                                                                    `${currencySymbol}${parseFloat(item.rate).toFixed(2)}`
                                                                ) : (
                                                                    '-'
                                                                )}
                                                            </strong>
                                                        </td> */}
                                                        <td>
                                                            {item.lifespan_type_details ? (
                                                                <span className="badge badge-info light">{item.lifespan_type_details}</span>
                                                            ) : (
                                                                <span className="text-muted">-</span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <span className={`badge badge-${
                                                                item.priority === 'High' ? 'danger' : item.priority === 'Medium' ? 'warning' : 'info'
                                                            } light`}>
                                                                {item.priority || '-'}
                                                            </span>
                                                        </td>
                                                        {/* <td>
                                                            {item.images && item.images.length > 0 ? (
                                                                <div className="d-flex align-items-center position-relative" style={{ cursor: 'pointer' }} onClick={() => handleOpenGallery(item.images)}>
                                                                    <img 
                                                                        src={item.images[0].image} 
                                                                        alt={item.name_details} 
                                                                        style={{ width: '45px', height: '45px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0' }} 
                                                                    />
                                                                    {item.images.length > 1 && (
                                                                        <span className="badge bg-primary position-absolute text-white" style={{ fontSize: '9px', right: '-12px', bottom: '0px', padding: '3px 6px', borderRadius: '50%' }}>
                                                                            +{item.images.length - 1}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="text-center text-muted border rounded d-flex align-items-center justify-content-center" style={{ width: '45px', height: '45px', background: '#f8fafc', fontSize: '10px' }}>
                                                                    No Image
                                                                </div>
                                                            )}
                                                        </td> */}
                                                        <td className="text-end">
                                                            {can('spareparts', 'edit') || can('spareparts', 'delete') ? (
                                                                <div className="d-flex justify-content-end">
                                                                    <EditButton
                                                                        module="spareparts"
                                                                        onClick={() => handleShowModal(item)}
                                                                        className="me-1"
                                                                    />
                                                                    <DeleteButton
                                                                        module="spareparts"
                                                                        onClick={() => handleDelete(item.id, item.name_details)}
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <span className="badge badge-danger light mt-1">No Access</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="10" className="text-center py-4 text-muted">
                                                        No entries
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {!loading && filteredParts.length > 0 && (
                                <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                    <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredParts.length)} of {filteredParts.length} entries
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
            </div>

            {/* Form Modal */}
            <Modal 
                show={showModal} 
                onHide={() => setShowModal(false)} 
                dialogClassName={`sgfm-modal modal-lg ${animateTrigger ? 'modal-feedback' : ''}`}
                backdrop="static"
                keyboard={false}
                centered
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" fill="white"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editMode ? 'Edit Spare Part' : 'Create Spare Part'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage spare part component
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowModal(false)}>&times;</button>
                </div>

                <Form onSubmit={handleSubmit} encType="multipart/form-data" onKeyDown={handleFormKeyDown}>
                    <div className="modal-body-custom">
                        <div className="row">
                            {isFieldVisible('name') && (
                                <div className="col-md-6 mb-3">
                                    <Form.Label className="form-label-custom">Part Name <span className="text-danger">*</span></Form.Label>
                                    <Select
                                        classNamePrefix="react-select"
                                        isClearable
                                        autoFocus
                                        defaultMenuIsOpen={true}
                                        options={partNameOptions}
                                        value={selectedPartName}
                                        onChange={makeSelectChange('name')}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        placeholder="Select Stock Item"
                                        styles={selectStyles}
                                    />
                                </div>
                            )}
                            {isFieldVisible('code') && (
                                <div className="col-md-6 mb-3">
                                    <Form.Label className="form-label-custom">Part Code <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="text"
                                        className="form-control-custom"
                                        placeholder="e.g. BP-1049, OF-9921"
                                        value={currentSparePart.code}
                                        onChange={(e) => setCurrentSparePart({ ...currentSparePart, code: e.target.value })}
                                        required
                                    />
                                </div>
                            )}
                        </div>

                        <div className="row">
                            {isFieldVisible('brand') && (
                                <div className="col-md-6 mb-3">
                                    <Form.Label className="form-label-custom">Brand</Form.Label>
                                    <Select
                                        classNamePrefix="react-select"
                                        isClearable
                                        options={brandOptions}
                                        value={selectedBrand}
                                        onChange={makeSelectChange('brand')}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        placeholder="Select Brand Category"
                                        styles={selectStyles}
                                    />
                                </div>
                            )}
                            {isFieldVisible('supplier') && (
                                <div className="col-md-6 mb-3">
                                    <Form.Label className="form-label-custom">Supplier<span className="text-danger">*</span></Form.Label>
                                    <Select
                                        classNamePrefix="react-select"
                                        isClearable
                                        options={supplierOptions}
                                        value={selectedSupplier}
                                        onChange={makeSelectChange('supplier')}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        placeholder="Select Supplier Ledger"
                                        styles={selectStyles}required
                                    />
                                </div>
                            )}
                        </div>

                        <div className="row">
                            {isFieldVisible('machine_name') && (
                                <div className="col-md-6 mb-3">
                                    <Form.Label className="form-label-custom">Machine / Equipment Relationship <span className="text-danger">*</span></Form.Label>
                                    <Select
                                        classNamePrefix="react-select"
                                        isClearable
                                        options={machineNameOptions}
                                        value={selectedMachineName}
                                        onChange={makeSelectChange('machine_name')}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        placeholder="Select Equipment/Machine"
                                        styles={selectStyles}
                                    />
                                </div>
                            )}
                            {isFieldVisible('lifespan_type') && (
                                <div className="col-md-6 mb-3">
                                    <Form.Label className="form-label-custom">Life Span Type <span className="text-danger">*</span></Form.Label>
                                    <Select
                                        classNamePrefix="react-select"
                                        isClearable
                                        options={lifespanOptions}
                                        value={selectedLifespan}
                                        onChange={makeSelectChange('lifespan_type')}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        placeholder="Select Lifespan"
                                        styles={selectStyles}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Existing Images Management */}
                        {editMode && currentSparePart.images && currentSparePart.images.length > 0 && (
                            <div className="mb-4">
                                <Form.Label className="form-label-custom">Existing Part Images</Form.Label>
                                <div className="d-flex flex-wrap gap-3">
                                    {currentSparePart.images.map((img) => (
                                        <div key={img.id} className="image-container-thumbnail">
                                            <img src={img.image} alt="part snippet" />
                                            <button 
                                                type="button" 
                                                className="delete-image-overlay"
                                                onClick={() => handleDeleteImage(img.id)}
                                                title="Remove image"
                                            >
                                                <i className="fa fa-trash"></i>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="row">
                            {isFieldVisible('priority') && (
                                <div className="col-md-6 mb-3">
                                    <Form.Label className="form-label-custom">Priority <span className="text-danger">*</span></Form.Label>
                                    <Select
                                        classNamePrefix="react-select"
                                        isClearable
                                        options={priorityOptions}
                                        value={selectedPriority}
                                        onChange={makeSelectChange('priority')}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        placeholder="Select Priority"
                                        styles={selectStyles}
                                    />
                                </div>
                            )}
                            {isFieldVisible('rate') && (
                                <div className="col-md-6 mb-3">
                                    <Form.Label className="form-label-custom">Unit Price ({currencySymbol})<span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="number"
                                        step="0.01"
                                        className="form-control-custom"
                                        placeholder="Unit Price"
                                        value={currentSparePart.rate}
                                        onChange={(e) => setCurrentSparePart({ ...currentSparePart, rate: e.target.value })} required
                                    />
                                </div>
                            )}
                        </div>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Part Image(s)</Form.Label>
                                <Form.Control
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="form-control-custom"
                                    onChange={handleFileChange}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={() => setShowModal(false)}>Close</Button>
                        <Button type="submit" className="btn-save-custom">
                            {editMode ? 'Save Changes' : 'Create'}
                        </Button>
                    </div>
                </Form>
            </Modal>

            {/* Image Gallery Modal */}
            <Modal show={showGallery} onHide={() => setShowGallery(false)} centered size="md" className="gallery-modal">
                <style>{`
                    .gallery-modal .modal-content { background-color: transparent; border: none; box-shadow: none; }
                    .gallery-modal .modal-header { border-bottom: none; }
                    .gallery-modal .btn-close { filter: invert(1) grayscale(100%) brightness(200%); }
                    .gallery-image-main { width: 100%; height: 400px; object-fit: contain; background: rgba(0,0,0,0.8); border-radius: 12px; }
                `}</style>
                <Modal.Header closeButton></Modal.Header>
                <Modal.Body className="p-0 text-center">
                    {galleryImages.length > 0 && (
                        <div>
                            <img src={galleryImages[activeGalleryIndex].image} alt="Gallery view" className="gallery-image-main mb-3" />
                            {galleryImages.length > 1 && (
                                <div className="d-flex justify-content-center gap-2 mt-3 overflow-auto p-2">
                                    {galleryImages.map((img, idx) => (
                                        <div 
                                            key={img.id} 
                                            onClick={() => setActiveGalleryIndex(idx)}
                                            style={{ 
                                                width: '60px', height: '60px', cursor: 'pointer',
                                                border: activeGalleryIndex === idx ? '2px solid #6d4aff' : '2px solid transparent',
                                                borderRadius: '6px', overflow: 'hidden', opacity: activeGalleryIndex === idx ? 1 : 0.6
                                            }}
                                        >
                                            <img src={img.image} alt="thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </Modal.Body>
            </Modal>
        </Fragment>
    );
};

export default SparePartList;