import React, { useState, useEffect, Fragment, useRef } from 'react';
import { Card, Modal, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { getStockItems } from '../../../services/InventoryService';
import {
    getRepairRequests,
    createRepairRequest,
    updateRepairRequest,
    deleteRepairRequest,
    deleteRepairRequestImage,
    getRepairParts
} from '../../../services/MachineManagementService';
import { usePermission } from '../../../hooks/usePermission';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import Select from 'react-select';
import { useEnterTraversal } from '../../../hooks/useEnterTraversal';
import { usePageTitle } from '../../../context/TitleContext';

import { useFormConfig } from '../../../hooks/useFormConfig';

const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const isRequestInactive = (item) => {
    if (!item) return false;
    if (!item.is_defined) return false;
    if (item.status === 'Accepted' || item.status === 'Rejected') return true;
    if (item.feedbacks && item.feedbacks.length > 0) return true;
    if (!item.duedate) return false;
    const today = new Date();
    today.setHours(0,0,0,0);
    const due = new Date(item.duedate);
    return due < today;
};

const addDaysToDate = (dateStr, days) => {
    if (!dateStr) return dateStr;
    const date = new Date(dateStr);
    date.setDate(date.getDate() + parseInt(days, 10));
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const RepairRequestList = () => {
    const [repairRequests, setRepairRequests] = useState([]);
    const [stockItems, setStockItems] = useState([]);
    const [repairParts, setRepairParts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [activeTab, setActiveTab] = useState('pending');
    const itemsPerPage = 10;
    
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
    const fileInputRef = useRef(null);
    const [currentRepairRequest, setCurrentRepairRequest] = useState({
        id: null,
        part: '',
        duedate: getTodayDateString(),
        entry_date: getTodayDateString(),
        priority: 'Medium',
        notes: '',
        remarks: '',
        images: []
    });

    usePageTitle("Repair Request List");


    const { handleFormKeyDown, handleSelectFocus, handleSelectKeyDown, makeSelectChange } = useEnterTraversal('.sgfm-modal', setCurrentRepairRequest);
    const { isFieldVisible } = useFormConfig('machine_app_repairrequest', 'RepairRequestList');

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
            const [requestsData, itemsRes, partsRes] = await Promise.all([
                getRepairRequests(),
                getStockItems({ from_stock_definition: 'true' }),
                getRepairParts()
            ]);
            setRepairRequests(requestsData);
            setStockItems(Array.isArray(itemsRes) ? itemsRes : []);
            setRepairParts(Array.isArray(partsRes) ? partsRes : []);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to fetch data' });
        } finally {
            setLoading(false);
        }
    };

    const handlePartSelect = (selectedOption) => {
        const val = selectedOption ? selectedOption.value : '';
        let calculatedDueDate = currentRepairRequest.entry_date || getTodayDateString();
        if (val) {
            const definition = repairParts.find(rp => rp.machine === val);
            if (definition && definition.cutoff_days) {
                calculatedDueDate = addDaysToDate(calculatedDueDate, definition.cutoff_days);
            }
        }
        setCurrentRepairRequest(prev => ({
            ...prev,
            part: val,
            duedate: calculatedDueDate
        }));
    };

    const handleShowModal = (request = null) => {
        setSelectedFiles([]);
        const todayStr = getTodayDateString();
        if (request) {
            setCurrentRepairRequest({
                id: request.id,
                part: request.part || '',
                duedate: request.duedate || todayStr,
                entry_date: request.entry_date || todayStr,
                priority: request.priority || 'Medium',
                notes: request.notes || '',
                remarks: request.remarks || '',
                images: request.images || []
            });
            setEditMode(true);
        } else {
            setCurrentRepairRequest({
                id: null,
                part: '',
                duedate: todayStr,
                entry_date: todayStr,
                priority: 'Medium',
                notes: '',
                remarks: '',
                images: []
            });
            setEditMode(false);
        }
        setShowModal(true);
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            setSelectedFiles(prev => [...prev, ...newFiles]);
        }
        // Reset the input so the same file(s) can be picked again
        if (fileInputRef.current) {
            fileInputRef.current.value = null;
        }
    };

    const handleRemoveSelectedFile = (index) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
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
                await deleteRepairRequestImage(currentRepairRequest.id, imageId);
                Swal.fire({ icon: 'success', title: 'Deleted', text: 'Image removed successfully', timer: 1500, showConfirmButton: false });
                
                const updatedImages = currentRepairRequest.images.filter(img => img.id !== imageId);
                setCurrentRepairRequest({
                    ...currentRepairRequest,
                    images: updatedImages
                });
                
                fetchData();
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete image' });
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (isFieldVisible('part') && !currentRepairRequest.part) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Part is required' });
            return;
        }

        const formData = new FormData();
        formData.append('part', currentRepairRequest.part);
        formData.append('duedate', currentRepairRequest.duedate);
        if (currentRepairRequest.entry_date) {
            formData.append('entry_date', currentRepairRequest.entry_date);
        }
        if (currentRepairRequest.priority) {
            formData.append('priority', currentRepairRequest.priority);
        }
        formData.append('notes', currentRepairRequest.notes);
        formData.append('remarks', currentRepairRequest.remarks);

        selectedFiles.forEach((file) => {
            formData.append('uploaded_images', file);
        });

        try {
            if (editMode && currentRepairRequest.id) {
                await updateRepairRequest(currentRepairRequest.id, formData);
                Swal.fire({ icon: 'success', title: 'Updated', text: 'Repair request updated successfully', timer: 2000, showConfirmButton: false });
            } else {
                await createRepairRequest(formData);
                Swal.fire({ icon: 'success', title: 'Created', text: 'Repair request created successfully', timer: 2000, showConfirmButton: false });
            }
            setShowModal(false);
            fetchData();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to save repair request' });
        }
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                await deleteRepairRequest(id);
                Swal.fire('Deleted!', 'Repair request has been deleted.', 'success');
                fetchData();
            } catch (error) {
                Swal.fire('Error!', 'Failed to delete repair request.', 'error');
            }
        }
    };

    const handleOpenGallery = (images) => {
        setGalleryImages(images);
        setActiveGalleryIndex(0);
        setShowGallery(true);
    };

    const getPriorityWeight = (priority) => {
        if (!priority) return 1;
        const p = priority.toLowerCase();
        if (p === 'high') return 3;
        if (p === 'medium') return 2;
        return 1; // 'low' or default
    };

    // Filter, Sort, and Pagination
    const sortedItems = [...repairRequests].sort((a, b) => {
        const weightA = getPriorityWeight(a.priority);
        const weightB = getPriorityWeight(b.priority);
        if (weightB !== weightA) {
            return weightB - weightA;
        }
        const dateA = a.duedate ? new Date(a.duedate) : new Date('9999-12-31');
        const dateB = b.duedate ? new Date(b.duedate) : new Date('9999-12-31');
        return dateA - dateB;
    });

    const filteredItems = sortedItems.filter(req => {
        const pDetails = (req.part_details || '').toLowerCase();
        return pDetails.includes(searchTerm.toLowerCase());
    });

    const pendingItems = filteredItems.filter(req => !isRequestInactive(req));
    const processingItems = filteredItems.filter(req => {
        if (!isRequestInactive(req)) return false;
        if (req.status === 'Accepted' || req.status === 'Rejected') return false;
        if (req.feedbacks && req.feedbacks.length > 0) return true;
        return false;
    });
    const completedItems = filteredItems.filter(req => {
        if (!isRequestInactive(req)) return false;
        if (req.status === 'Accepted' || req.status === 'Rejected') return true;
        if (!req.feedbacks || req.feedbacks.length === 0) return true;
        return false;
    });

    let tabItems = pendingItems;
    if (activeTab === 'processing') tabItems = processingItems;
    if (activeTab === 'completed') tabItems = completedItems;

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = tabItems.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(tabItems.length / itemsPerPage);

    const partOptions = stockItems.map(item => ({
        value: item.id,
        label: item.name
    }));

    const selectedPart = partOptions.find(opt => opt.value === currentRepairRequest.part) || null;

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            border: state.isFocused ? '1px solid #0a500f' : '1px solid #cbd5e1',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 80, 15, 0.15)' : 'none',
            borderRadius: '10px',
            minHeight: '44px',
            fontSize: '14px',
            backgroundColor: '#fff',
            '&:hover': {
                borderColor: state.isFocused ? '#0a500f' : '#cbd5e1'
            }
        })
    };

    const isFieldsDisabled = editMode && isRequestInactive(currentRepairRequest);

    return (
        <Fragment>
            <style>{`
                .sgfm-modal .modal-content {
                    border: none;
                    border-radius: 16px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.1);
                    overflow: hidden;
                }
                .sgfm-modal .modal-header-custom {
                    background-color: #fff;
                    padding: 24px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .sgfm-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: var(--form-icon-color, #0a500f);
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
                .sgfm-modal .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .sgfm-modal .btn-save-custom {
                    background-color: var(--save-btn-color, #0a500f) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .sgfm-modal .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }
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
                            <Card.Title className="mb-0">Repair Requests Management</Card.Title>
                            <div className="d-flex align-items-center gap-2">
                                <div style={{ width: '300px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Repair Requests..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                
                                <CreateButton
                                    module="repairrequests"
                                    onClick={() => handleShowModal()}
                                >
                                    Repair Request
                                </CreateButton>
                            </div>
                        </Card.Header>
                        <Card.Body className="p-0">
                            {/* Tab Navigation */}
                            <div style={{ borderBottom: '2px solid #f1f5f9', padding: '0 20px', display: 'flex', gap: '4px' }}>
                                {[
                                    { key: 'pending', label: 'Pending', count: pendingItems.length, icon: 'fa-clock' },
                                    { key: 'processing', label: 'Processing', count: processingItems.length, icon: 'fa-spinner' },
                                    { key: 'completed', label: 'Completed', count: completedItems.length, icon: 'fa-check-circle' }
                                ].map(tab => (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => { setActiveTab(tab.key); setCurrentPage(1); }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            borderBottom: activeTab === tab.key ? '2px solid #0a500f' : '2px solid transparent',
                                            marginBottom: '-2px',
                                            padding: '14px 18px 12px',
                                            fontSize: '14px',
                                            fontWeight: activeTab === tab.key ? 600 : 400,
                                            color: activeTab === tab.key ? '#0a500f' : '#64748b',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            transition: 'color 0.2s',
                                        }}
                                    >
                                        <i className={`fa ${tab.icon}`} style={{ fontSize: '13px' }}></i>
                                        {tab.label}
                                        <span style={{
                                            background: activeTab === tab.key ? '#d1fae5' : '#f1f5f9',
                                            color: activeTab === tab.key ? '#16a34a' : '#94a3b8',
                                            borderRadius: '12px',
                                            padding: '1px 8px',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                        }}>
                                            {tab.count}
                                        </span>
                                    </button>
                                ))}
                            </div>
                            
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
                                                <th><strong>PART</strong></th>
                                                <th><strong>ENTRY DATE</strong></th>
                                                {activeTab !== 'completed' && <th><strong>DUE DATE</strong></th>}
                                                <th style={{ minWidth: '200px', maxWidth: '300px' }}><strong>NOTES</strong></th>
                                                <th style={{ minWidth: '150px', maxWidth: '250px' }}><strong>REMARKS</strong></th>
                                                {/* <th><strong>IMAGES</strong></th> */}
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentItems.length > 0 ? (
                                                currentItems.map((item, idx) => {
                                                    const isInactive = isRequestInactive(item);
                                                    return (
                                                        <tr key={item.id}>
                                                            <td>{indexOfFirstItem + idx + 1}</td>
                                                            <td><strong>{item.part_details || item.part}</strong></td>
                                                            <td>{item.entry_date ? item.entry_date.split('-').reverse().join('/') : '-'}</td>
                                                            {activeTab !== 'completed' && <td>{item.duedate ? item.duedate.split('-').reverse().join('/') : '-'}</td>}
                                                            <td style={{ whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: '300px' }}>{item.notes}</td>
                                                            <td style={{ whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: '250px' }}>{item.remarks}</td>
                                                            {/* <td>
                                                                {item.images && item.images.length > 0 ? (
                                                                    <div className="d-flex align-items-center position-relative" style={{ cursor: 'pointer' }} onClick={() => handleOpenGallery(item.images)}>
                                                                        <img 
                                                                            src={item.images[0].image} 
                                                                            alt="thumbnail" 
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
                                                                        No Img
                                                                    </div>
                                                                )}
                                                            </td> */}
                                                            <td className="text-end">
                                                                <div className="d-flex justify-content-end align-items-center gap-2">
                                                                    {activeTab === 'pending' && (
                                                                        <span 
                                                                            title={item.is_defined ? "Defined" : "Undefined"} 
                                                                            className={`text-${item.is_defined ? 'success' : 'danger'}`}
                                                                            style={{ cursor: 'help', fontSize: '18px', marginRight: '4px' }}
                                                                        >
                                                                            <i className={`fa ${item.is_defined ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
                                                                        </span>
                                                                    )}
                                                                    {isInactive ? (
                                                                        <>
                                                                            {(item.status === 'Accepted' || item.status === 'Rejected' || item.status === 'Hold') && item.decision_notes ? (
                                                                                <button
                                                                                    className="btn btn-outline-info shadow btn-xs sharp"
                                                                                    title="View Admin Remark"
                                                                                    onClick={() => Swal.fire({
                                                                                        title: 'Admin Remark',
                                                                                        text: item.decision_notes,
                                                                                        icon: 'info',
                                                                                        confirmButtonText: 'Close'
                                                                                    })}
                                                                                >
                                                                                    <i className="fas fa-comment-dots"></i>
                                                                                </button>
                                                                            ) : (
                                                                                <>
                                                                                    <button
                                                                                        className="btn btn-outline-success shadow btn-xs sharp"
                                                                                        title={item.status === 'Accepted' || item.status === 'Rejected' ? 'Finalized — cannot edit' : (item.feedbacks && item.feedbacks.length > 0 ? 'Under Review — cannot edit' : 'Overdue — cannot edit')}
                                                                                        disabled
                                                                                        style={{ opacity: 0.4, cursor: 'not-allowed' }}
                                                                                    >
                                                                                        <i className="fas fa-pencil-alt"></i>
                                                                                    </button>
                                                                                    <button
                                                                                        className="btn btn-outline-danger shadow btn-xs sharp"
                                                                                        title={item.status === 'Accepted' || item.status === 'Rejected' ? 'Finalized — cannot delete' : (item.feedbacks && item.feedbacks.length > 0 ? 'Under Review — cannot delete' : 'Overdue — cannot delete')}
                                                                                        disabled
                                                                                        style={{ opacity: 0.4, cursor: 'not-allowed' }}
                                                                                    >
                                                                                        <i className="fas fa-trash"></i>
                                                                                    </button>
                                                                                </>
                                                                            )}
                                                                        </>
                                                                    ) : can('repairrequests', 'edit') || can('repairrequests', 'delete') ? (
                                                                        <>
                                                                            <EditButton
                                                                                module="repairrequests"
                                                                                onClick={() => handleShowModal(item)}
                                                                            />
                                                                            <DeleteButton
                                                                                module="repairrequests"
                                                                                onClick={() => handleDelete(item.id)}
                                                                            />
                                                                        </>
                                                                    ) : (
                                                                        <span className="badge badge-danger light mt-1">No Access</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan={activeTab === 'completed' ? "6" : "7"} className="text-center py-4 text-muted">No repair requests found</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {!loading && tabItems.length > 0 && (
                                <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                    <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, tabItems.length)} of {tabItems.length} entries
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
                <div className="modal-header-custom d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" fill="white"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editMode ? 'Edit Repair Request' : 'Create Repair Request'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage repair request component
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowModal(false)}>&times;</button>
                </div>

                <Form onSubmit={handleSubmit} encType="multipart/form-data" onKeyDown={handleFormKeyDown}>
                    <div className="modal-body-custom">
                        {isFieldVisible('part') && (
                            <div className="row">
                                <div className="col-md-12 mb-3">
                                    <Form.Label className="form-label-custom">Part <span className="text-danger">*</span></Form.Label>
                                    <Select
                                        classNamePrefix="react-select"
                                        isClearable
                                        autoFocus
                                        defaultMenuIsOpen={!editMode}
                                        openMenuOnFocus={true}
                                        options={partOptions}
                                        value={selectedPart}
                                        onChange={handlePartSelect}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        placeholder="Select Stock Item"
                                        styles={selectStyles}
                                        isDisabled={isFieldsDisabled || editMode}
                                    />
                                </div>
                            </div>
                        )}
                        <div className="row">
                            {isFieldVisible('entry_date') && (
                                <div className="col-md-4 mb-3">
                                    <Form.Label className="form-label-custom">Entry Date</Form.Label>
                                    <Form.Control
                                        type="date"
                                        className="form-control-custom"
                                        value={currentRepairRequest.entry_date}
                                        readOnly
                                        disabled
                                        style={{ backgroundColor: '#f8fafc', cursor: 'not-allowed', color: '#64748b' }}
                                    />
                                </div>
                            )}
                            {isFieldVisible('duedate') && (
                                <div className="col-md-4 mb-3">
                                    <Form.Label className="form-label-custom">Due Date</Form.Label>
                                    <Form.Control
                                        type="date"
                                        className="form-control-custom"
                                        value={currentRepairRequest.duedate}
                                        readOnly
                                        disabled
                                        style={{ backgroundColor: '#f8fafc', cursor: 'not-allowed', color: '#64748b' }}
                                    />
                                </div>
                            )}
                            {isFieldVisible('priority') && (
                                <div className="col-md-4 mb-3">
                                    <Form.Label className="form-label-custom">Priority</Form.Label>
                                    <Form.Select
                                        className="form-control-custom text-dark"
                                        value={currentRepairRequest.priority || 'Medium'}
                                        onChange={(e) => setCurrentRepairRequest({ ...currentRepairRequest, priority: e.target.value })}
                                        style={{ height: '44px', borderRadius: '10px', fontSize: '14px', border: '1px solid #cbd5e1' }}
                                        disabled={isFieldsDisabled}
                                    >
                                        <option value="High">High</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Low">Low</option>
                                    </Form.Select>
                                </div>
                            )}
                        </div>

                        <div className="row">
                            {isFieldVisible('notes') && (
                                <div className="col-md-6 mb-3">
                                    <Form.Label className="form-label-custom">Notes</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        rows={3}
                                        className="form-control-custom"
                                        placeholder="Enter detailed notes about the issue..."
                                        value={currentRepairRequest.notes}
                                        onChange={(e) => setCurrentRepairRequest({ ...currentRepairRequest, notes: e.target.value })}
                                        disabled={isFieldsDisabled}
                                    />
                                </div>
                            )}
                            {isFieldVisible('remarks') && (
                                <div className="col-md-6 mb-3">
                                    <Form.Label className="form-label-custom">Remarks</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        rows={3}
                                        className="form-control-custom"
                                        placeholder="Enter any remarks or comments..."
                                        value={currentRepairRequest.remarks}
                                        onChange={(e) => setCurrentRepairRequest({ ...currentRepairRequest, remarks: e.target.value })}
                                        disabled={isFieldsDisabled}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="row">
                            <div className="col-md-12 mb-3">
                                <Form.Label className="form-label-custom">Document Image(s)</Form.Label>
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                    disabled={isFieldsDisabled}
                                />
                                <div className="form-control-custom" style={{ padding: '0px', backgroundColor: isFieldsDisabled ? '#f8fafc' : '#fff' }}>
                                    <div className="input-group">
                                        <button
                                            type="button"
                                            className="input-group-text"
                                            style={{ cursor: isFieldsDisabled ? 'not-allowed' : 'pointer', border: 'none', borderRight: '1px solid #cbd5e1', background: '#f8fafc', borderRadius: '10px 0 0 10px', fontSize: '14px', color: '#64748b', padding: '12px 16px' }}
                                            onClick={() => fileInputRef.current && fileInputRef.current.click()}
                                            disabled={isFieldsDisabled}
                                        >
                                            <i className="fa fa-plus me-2"></i> Add Files
                                        </button>
                                        <div className="d-flex align-items-center px-3 text-muted" style={{ fontSize: '14px' }}>
                                            {selectedFiles.length > 0 ? `${selectedFiles.length} file(s) selected` : 'No file chosen'}
                                        </div>
                                    </div>
                                </div>
                                {selectedFiles.length > 0 && (
                                    <div className="d-flex flex-wrap gap-2 mt-2">
                                        {selectedFiles.map((file, idx) => (
                                            <div key={idx} className="d-flex align-items-center gap-1 px-2 py-1" style={{ background: '#f1f5f9', borderRadius: '6px', fontSize: '12px', color: '#475569' }}>
                                                <i className="fa fa-image me-1" style={{ color: '#94a3b8' }}></i>
                                                <span style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
                                                    {file.name}
                                                </span>
                                                {!isFieldsDisabled && (
                                                    <i 
                                                        className="fa fa-times-circle ms-1" 
                                                        style={{ cursor: 'pointer', color: '#ef4444', fontSize: '13px' }}
                                                        onClick={() => handleRemoveSelectedFile(idx)}
                                                        title="Remove this file"
                                                    ></i>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {editMode && currentRepairRequest.images && currentRepairRequest.images.length > 0 && (
                            <div className="row mt-3">
                                <div className="col-12">
                                    <Form.Label className="form-label-custom border-bottom pb-2 mb-3 d-block w-100">Existing Images</Form.Label>
                                    <div className="d-flex flex-wrap gap-3">
                                        {currentRepairRequest.images.map((img) => (
                                            <div key={img.id} className="position-relative" style={{ width: '100px', height: '100px', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                                                <img src={img.image} alt="Document" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                {!isFieldsDisabled && (
                                                    <div 
                                                        className="position-absolute d-flex align-items-center justify-content-center"
                                                        style={{ top: '6px', right: '6px', width: '24px', height: '24px', background: 'rgba(255,255,255,0.9)', borderRadius: '50%', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.2)', transition: 'transform 0.2s' }}
                                                        onClick={() => handleDeleteImage(img.id)}
                                                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                                        title="Delete Image"
                                                    >
                                                        <i className="fa fa-trash text-danger" style={{ fontSize: '12px' }}></i>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="modal-footer-custom">
                        <button type="button" className="btn-close-custom" onClick={() => setShowModal(false)}>
                            Close
                        </button>
                        {!isFieldsDisabled && (
                            <button type="submit" className="btn-save-custom">
                                {editMode ? 'Update' : 'Create'}
                            </button>
                        )}
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

export default RepairRequestList;