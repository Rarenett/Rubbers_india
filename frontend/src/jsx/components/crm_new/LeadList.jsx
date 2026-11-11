import React, { useState, useEffect } from 'react';
import { Card, Button, Form, Modal } from 'react-bootstrap';
import { useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import CRMNewService from '../../../services/CRMNewService';
import { usePageTitle } from '../../../context/TitleContext';
import { usePermission } from '../../../hooks/usePermission';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import LeadImportModal from './LeadImportModal';

const LeadList = () => {
    usePageTitle('Lead Management');
    const navigate = useNavigate();
    const { can } = usePermission();

    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const fileInputRef = React.useRef(null);

    const [showImportModal, setShowImportModal] = useState(false);
    const [activeBatchId, setActiveBatchId] = useState(null);
    const [activeBatchData, setActiveBatchData] = useState(null);

    const [showPendingModal, setShowPendingModal] = useState(false);
    const [pendingBatches, setPendingBatches] = useState([]);
    const [loadingBatches, setLoadingBatches] = useState(false);

    useEffect(() => {
        fetchLeads();
        fetchPendingBatches();
    }, []);

    const fetchLeads = async () => {
        setLoading(true);
        try {
            const res = await CRMNewService.getLeads();
            const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            setLeads(data);
        } catch (error) {
            console.error('Error fetching leads:', error);
            Swal.fire('Error', 'Failed to fetch leads list', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchPendingBatches = async () => {
        try {
            setLoadingBatches(true);
            const res = await CRMNewService.getImportBatches();
            const batchesList = Array.isArray(res) ? res : (res?.results || []);
            const pending = batchesList.filter(b => b.status === 'UPLOADED' || b.status === 'HAS_ISSUES' || b.status === 'READY');
            setPendingBatches(pending);
        } catch (error) {
            console.error('Error fetching pending batches:', error);
        } finally {
            setLoadingBatches(false);
        }
    };

    const handleDownloadTemplate = async () => {
        try {
            const response = await CRMNewService.downloadLeadsTemplate();
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'Leads_Template.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Error downloading template:', error);
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to download template' });
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            setLoading(true);
            const batchData = await CRMNewService.uploadLeadsExcel(formData);
            setActiveBatchId(batchData.id);
            setActiveBatchData(batchData);
            fetchPendingBatches();

            if (batchData.has_missing_masters) {
                const { industries = [], sources = [], categories = [] } = batchData.missing_masters || {};
                
                const sectionsData = {
                    'industries': { title: 'Missing Industries', items: industries, color: '#ef4444' },
                    'sources': { title: 'Missing Lead Sources', items: sources, color: '#f59e0b' },
                    'categories': { title: 'Missing Lead Categories', items: categories, color: '#3b82f6' }
                };

                const openMissingDataPopup = (sectionKey) => {
                    const section = sectionsData[sectionKey];
                    if (!section || !section.items || section.items.length === 0) return;

                    const { title, items, color } = section;

                    const existingModal = document.getElementById('missing-data-modal-overlay');
                    if (existingModal) existingModal.remove();

                    const overlay = document.createElement('div');
                    overlay.id = 'missing-data-modal-overlay';
                    overlay.style.cssText = `
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100vw;
                        height: 100vh;
                        background: rgba(15, 23, 42, 0.65);
                        backdrop-filter: blur(3px);
                        z-index: 999999;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 20px;
                        box-sizing: border-box;
                    `;

                    const renderRows = (filterText = '') => {
                        const query = filterText.toLowerCase().trim();
                        const filtered = items.filter(item => {
                            const name = typeof item === 'object' ? item.name : String(item);
                            return !query || String(name).toLowerCase().includes(query);
                        });

                        if (filtered.length === 0) {
                            return `
                                <tr>
                                    <td colspan="3" style="text-align: center; padding: 28px 12px; color: #64748b; font-size: 13px;">
                                        No matching items found
                                    </td>
                                </tr>
                            `;
                        }

                        return filtered.map((item, idx) => {
                            const name = typeof item === 'object' ? item.name : item;
                            const rowArr = (typeof item === 'object' && Array.isArray(item.rows)) ? item.rows : [];
                            let rowBadge = '—';
                            if (rowArr.length === 1) {
                                rowBadge = `Row ${rowArr[0]}`;
                            } else if (rowArr.length > 1 && rowArr.length <= 4) {
                                rowBadge = `Rows ${rowArr.join(', ')}`;
                            } else if (rowArr.length > 4) {
                                rowBadge = `${rowArr.length} rows (${rowArr.slice(0, 3).join(', ')}...)`;
                            }

                            return `
                                <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s;" onmouseenter="this.style.background='#f8fafc'" onmouseleave="this.style.background='transparent'">
                                    <td style="padding: 9px 14px; font-size: 12px; color: #94a3b8; width: 45px; text-align: center;">${idx + 1}</td>
                                    <td style="padding: 9px 14px; font-size: 13px; font-weight: 600; color: #0f172a;">${name}</td>
                                    <td style="padding: 9px 14px; font-size: 12px; color: #475569; text-align: right;">
                                        <span style="display: inline-block; background: #f1f5f9; border: 1px solid #e2e8f0; color: #475569; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500;">
                                            ${rowBadge}
                                        </span>
                                    </td>
                                </tr>
                            `;
                        }).join('');
                    };

                    overlay.innerHTML = `
                        <div style="
                            background: #ffffff;
                            border-radius: 12px;
                            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                            width: 100%;
                            max-width: 540px;
                            max-height: 85vh;
                            display: flex;
                            flex-direction: column;
                            border-top: 4px solid ${color};
                            overflow: hidden;
                        ">
                            <!-- Header -->
                            <div style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #fafbfc;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <h5 style="margin: 0; font-size: 15px; font-weight: 700; color: #0f172a;">${title}</h5>
                                    <span style="font-size: 11px; font-weight: 600; background: ${color}18; color: ${color}; padding: 2px 8px; border-radius: 12px;">
                                        ${items.length} total
                                    </span>
                                </div>
                                <button type="button" id="close-missing-data-modal-x" style="background: transparent; border: none; font-size: 20px; line-height: 1; color: #94a3b8; cursor: pointer; padding: 4px 8px; border-radius: 4px;" title="Close">&times;</button>
                            </div>

                            <!-- Search input if many items -->
                            ${items.length > 4 ? `
                            <div style="padding: 10px 18px; background: #ffffff; border-bottom: 1px solid #f1f5f9;">
                                <input 
                                    type="text" 
                                    id="missing-data-search-input" 
                                    placeholder="Search ${title.toLowerCase()}..." 
                                    style="width: 100%; box-sizing: border-box; padding: 7px 12px; font-size: 12.5px; border: 1px solid #cbd5e1; border-radius: 6px; outline: none;"
                                />
                            </div>
                            ` : ''}

                            <!-- Table content -->
                            <div style="overflow-y: auto; flex: 1; max-height: 52vh; padding: 0;">
                                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                                    <thead style="background: #f8fafc; position: sticky; top: 0; z-index: 2; border-bottom: 1px solid #e2e8f0;">
                                        <tr>
                                            <th style="padding: 8px 14px; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; width: 45px; text-align: center;">#</th>
                                            <th style="padding: 8px 14px; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase;">Missing Name</th>
                                            <th style="padding: 8px 14px; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; text-align: right;">Excel Row</th>
                                        </tr>
                                    </thead>
                                    <tbody id="missing-data-table-body">
                                        ${renderRows()}
                                    </tbody>
                                </table>
                            </div>

                            <!-- Footer -->
                            <div style="padding: 12px 18px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #fafbfc;">
                                <span style="font-size: 12px; color: #64748b;" id="missing-data-footer-count">
                                    Showing <strong>${items.length}</strong> of <strong>${items.length}</strong> items
                                </span>
                                <button 
                                    type="button" 
                                    id="close-missing-data-modal-btn" 
                                    style="padding: 6px 16px; font-size: 12px; font-weight: 600; background: #0a500f; color: #ffffff; border: none; border-radius: 6px; cursor: pointer;"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    `;

                    document.body.appendChild(overlay);

                    const closeModal = () => {
                        document.removeEventListener('keydown', onKeyDown);
                        overlay.remove();
                    };

                    const onKeyDown = (e) => {
                        if (e.key === 'Escape') closeModal();
                    };
                    document.addEventListener('keydown', onKeyDown);

                    overlay.addEventListener('click', (e) => {
                        if (e.target === overlay) closeModal();
                    });

                    const closeBtnX = overlay.querySelector('#close-missing-data-modal-x');
                    if (closeBtnX) closeBtnX.addEventListener('click', closeModal);

                    const closeBtn = overlay.querySelector('#close-missing-data-modal-btn');
                    if (closeBtn) closeBtn.addEventListener('click', closeModal);

                    const searchInput = overlay.querySelector('#missing-data-search-input');
                    const tbody = overlay.querySelector('#missing-data-table-body');
                    const footerCount = overlay.querySelector('#missing-data-footer-count');

                    if (searchInput) {
                        searchInput.focus();
                        searchInput.addEventListener('input', (e) => {
                            const query = e.target.value.toLowerCase().trim();
                            tbody.innerHTML = renderRows(e.target.value);
                            const count = items.filter(item => {
                                const name = typeof item === 'object' ? item.name : String(item);
                                return !query || String(name).toLowerCase().includes(query);
                            }).length;
                            if (footerCount) {
                                footerCount.innerHTML = `Showing <strong>${count}</strong> of <strong>${items.length}</strong> items`;
                            }
                        });
                    }
                };

                const formatSection = (title, items, color, linkUrl, linkLabel, sectionKey) => {
                    if (!items || items.length === 0) return '';
                    const totalUnique = items.length;

                    return `
                        <div style="text-align: left; margin-top: 10px; padding: 10px 14px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; border-left: 4px solid ${color};">
                            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span style="font-weight: 700; font-size: 13.5px; color: ${color};">${title}</span>
                                    <span style="font-size: 11px; font-weight: 600; background: ${color}18; color: ${color}; padding: 2px 8px; border-radius: 12px;">
                                        ${totalUnique} new ${totalUnique === 1 ? 'item' : 'items'}
                                    </span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <button 
                                        type="button" 
                                        class="missing-data-eye-btn" 
                                        data-section="${sectionKey}" 
                                        title="View missing items in popup"
                                        style="
                                            display: inline-flex;
                                            align-items: center;
                                            justify-content: center;
                                            gap: 5px;
                                            padding: 4px 10px;
                                            height: 28px;
                                            background: #ffffff;
                                            border: 1px solid ${color}70;
                                            color: ${color};
                                            font-size: 11.5px;
                                            font-weight: 600;
                                            border-radius: 5px;
                                            cursor: pointer;
                                            transition: all 0.2s ease;
                                            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                                        "
                                    >
                                        <i class="fa fa-eye" style="font-size: 12px; pointer-events: none;"></i>
                                        <span>View</span>
                                    </button>
                                    <a href="${linkUrl}" target="_blank" style="font-size: 11px; font-weight: 500; color: ${color}; text-decoration: underline;">${linkLabel} &rarr;</a>
                                </div>
                            </div>
                        </div>
                    `;
                };

                const popupHtml = `
                    <div style="text-align: left; font-size: 13px; color: #444;">
                        <p style="margin-bottom: 8px; font-size: 13px; color: #475569;">
                            These values are saved in your <strong>database staging table (Batch #${batchData.id})</strong> but do not exist in master tables:
                        </p>
                        <div style="max-height: 380px; overflow-y: auto; padding-right: 2px;">
                            ${formatSection('Missing Industries', industries, '#ef4444', '/crm_new/industries', 'Go to Industries', 'industries')}
                            ${formatSection('Missing Lead Sources', sources, '#f59e0b', '/crm_new/sources', 'Go to Sources', 'sources')}
                            ${formatSection('Missing Lead Categories', categories, '#3b82f6', '/crm_new/categories', 'Go to Categories', 'categories')}
                        </div>
                        <p style="margin-top: 10px; margin-bottom: 0; font-size: 11.5px; color: #64748b; line-height: 1.4;">
                            <em>Note: The Excel data is safely saved in the staging table. You can create them automatically below or add them in Master Settings without re-uploading the file.</em>
                        </p>
                    </div>
                `;

                setLoading(false);
                const result = await Swal.fire({
                    title: 'Missing master data found',
                    html: popupHtml,
                    icon: 'warning',
                    width: '620px',
                    showConfirmButton: true,
                    confirmButtonText: 'Create missing & view staging',
                    confirmButtonColor: '#0a500f',
                    showCancelButton: true,
                    cancelButtonText: 'Cancel import',
                    cancelButtonColor: '#dc3545',
                    allowOutsideClick: false,
                    customClass: {
                        popup: 'swal2-missing-masters-popup'
                    },
                    didOpen: (popup) => {
                        const eyeButtons = popup.querySelectorAll('.missing-data-eye-btn');
                        eyeButtons.forEach(btn => {
                            btn.addEventListener('mouseenter', () => {
                                btn.style.transform = 'translateY(-1px)';
                                btn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.12)';
                            });
                            btn.addEventListener('mouseleave', () => {
                                btn.style.transform = 'none';
                                btn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                            });
                            btn.addEventListener('click', (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const sectionKey = btn.getAttribute('data-section');
                                openMissingDataPopup(sectionKey);
                            });
                        });
                    },
                    willClose: () => {
                        const modal = document.getElementById('missing-data-modal-overlay');
                        if (modal) modal.remove();
                    }
                });

                if (result.isConfirmed) {
                    try {
                        Swal.fire({
                            title: 'Creating missing masters...',
                            text: 'Please wait',
                            allowOutsideClick: false,
                            didOpen: () => Swal.showLoading()
                        });

                        const payload = {
                            batch_id: batchData.id,
                            categories: categories.map(i => typeof i === 'object' ? i.name : i),
                            sources: sources.map(i => typeof i === 'object' ? i.name : i),
                            industries: industries.map(i => typeof i === 'object' ? i.name : i)
                        };

                        const res = await CRMNewService.createMissingMasters(payload);
                        if (res.batch) {
                            setActiveBatchData(res.batch);
                        } else {
                            const updatedBatch = await CRMNewService.getImportBatch(batchData.id);
                            setActiveBatchData(updatedBatch);
                        }
                        setShowImportModal(true);

                        Swal.fire({
                            icon: 'success',
                            title: 'Masters Created',
                            text: 'Missing master records created successfully and batch re-validated.',
                            timer: 1800,
                            showConfirmButton: false
                        });
                    } catch (createErr) {
                        console.error('Error creating missing masters:', createErr);
                        Swal.fire({
                            icon: 'error',
                            title: 'Failed to create masters',
                            text: createErr.response?.data?.detail || 'An error occurred while creating missing masters.'
                        });
                        setShowImportModal(true);
                    }
                } else {
                    await CRMNewService.cancelImportBatch(batchData.id);
                    fetchPendingBatches();
                }
            } else {
                setShowImportModal(true);
            }
        } catch (error) {
            console.error('Error uploading leads Excel:', error);
            let errorMsg = 'Failed to upload Excel file.';
            if (error.response?.data?.detail) {
                errorMsg = error.response.data.detail;
            }
            Swal.fire({ icon: 'error', title: 'Upload Failed', text: errorMsg });
        } finally {
            setLoading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };


    const handleDelete = async (id, leadName) => {
        const result = await Swal.fire({
            title: 'Delete Lead?',
            text: `Are you sure you want to delete lead "${leadName || '#' + id}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await CRMNewService.deleteLead(id);
                Swal.fire('Deleted', 'Lead deleted successfully', 'success');
                fetchLeads();
            } catch (err) {
                console.error('Error deleting lead:', err);
                Swal.fire('Error', 'Failed to delete lead', 'error');
            }
        }
    };

    // Filter leads
    const filteredLeads = leads.filter(l => {
        const fullName = `${l.first_name || ''} ${l.last_name || ''}`.toLowerCase();
        const comp = (l.company || '').toLowerCase();
        const ph = (l.phone || '').toLowerCase();
        const em = (l.email || '').toLowerCase();
        const cat = (l.category_name || '').toLowerCase();
        const ind = (l.industry_name || (typeof l.industry === 'object' ? l.industry?.name : l.industry) || '').toLowerCase();
        const src = (l.lead_source_name || '').toLowerCase();
        const status = (l.lead_status || '').toLowerCase();
        const search = searchTerm.toLowerCase();

        return (
            fullName.includes(search) ||
            comp.includes(search) ||
            ph.includes(search) ||
            em.includes(search) ||
            cat.includes(search) ||
            ind.includes(search) ||
            src.includes(search) ||
            status.includes(search)
        );
    });

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentLeads = filteredLeads.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Contacted':
                return 'badge-info light';
            case 'Pre Qualified':
                return 'badge-success light';
            case 'Not Contacted':
                return 'badge-warning light';
            case 'Attempted to Contact':
                return 'badge-primary light';
            case 'Lost Lead':
            case 'Junk Lead':
            case 'Not Qualified':
                return 'badge-danger light';
            default:
                return 'badge-secondary light';
        }
    };

    const getPriorityBadge = (priority) => {
        switch (priority) {
            case 'Critical':
                return 'badge badge-danger light';
            case 'High':
                return 'badge badge-warning light';
            case 'Medium':
                return 'badge badge-info light';
            case 'Low':
                return 'badge badge-success light';
            default:
                return 'badge badge-info light';
        }
    };

    return (
        <>
            <style>{`
                .lead-header-container {
                    display: flex !important;
                    flex-direction: row !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    flex-wrap: wrap !important;
                    gap: 15px !important;
                }
                .lead-controls-wrapper {
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                    flex-wrap: wrap !important;
                }
                .lead-search-bar {
                    width: 300px !important;
                    position: relative !important;
                }
                .lead-table th {
                    white-space: nowrap !important;
                }
                @media (max-width: 767px) {
                    .lead-header-container {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        gap: 12px !important;
                    }
                    .lead-controls-wrapper {
                        width: 100% !important;
                        justify-content: flex-start !important;
                        gap: 8px !important;
                    }
                    .lead-search-bar {
                        width: 100% !important;
                        order: 2 !important;
                        margin-top: 4px !important;
                    }
                    .lead-add-btn {
                        width: auto !important;
                        flex-grow: 0 !important;
                        order: 1 !important;
                        font-size: 12px !important;
                        padding: 0 12px !important;
                        justify-content: center !important;
                    }
                    .lead-table {
                        min-width: 750px !important;
                    }
                }
            `}</style>

            <div className="container-fluid">
                <div className="row">
                    <div className="col-lg-12">
                        <Card>
                            <Card.Header className="d-flex justify-content-between align-items-center lead-header-container">
                                <Card.Title className="mb-0">Leads</Card.Title>
                                <div className="d-flex align-items-center gap-2 lead-controls-wrapper">
                                    <div className="lead-search-bar">
                                        <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                        <Form.Control
                                            type="text"
                                            placeholder="Search leads..."
                                            value={searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                            style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                        />
                                    </div>
                                    {pendingBatches.length > 0 && (
                                        <button 
                                            type="button"
                                            className="btn btn-warning d-flex align-items-center justify-content-center position-relative" 
                                            onClick={() => {
                                                fetchPendingBatches();
                                                setShowPendingModal(true);
                                            }} 
                                            title="View Pending Import Batches"
                                            style={{ height: '38px', borderRadius: '6px', fontSize: '13px', whiteSpace: 'nowrap', padding: '0 14px', color: '#854d0e', backgroundColor: '#fef08a', borderColor: '#fde047' }}
                                        >
                                            <i className="fa fa-clock-o me-1"></i> Pending Imports
                                            <span className="badge bg-danger rounded-pill ms-2">{pendingBatches.length}</span>
                                        </button>
                                    )}
                                    <button 
                                        type="button"
                                        className="btn btn-secondary d-flex align-items-center justify-content-center" 
                                        onClick={handleDownloadTemplate} 
                                        title="Download Template"
                                        style={{ height: '38px', borderRadius: '6px', fontSize: '13px', whiteSpace: 'nowrap', padding: '0 14px' }}
                                    >
                                        <i className="fa fa-download me-1"></i> Template
                                    </button>
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        ref={fileInputRef}
                                        style={{ display: 'none' }}
                                        onChange={handleFileUpload}
                                    />
                                    <button 
                                        type="button"
                                        className="btn btn-info d-flex align-items-center justify-content-center" 
                                        onClick={() => fileInputRef.current.click()} 
                                        title="Import Excel"
                                        style={{ height: '38px', borderRadius: '6px', fontSize: '13px', color: 'white', whiteSpace: 'nowrap', padding: '0 14px' }}
                                    >
                                        <i className="fa fa-upload me-1"></i> Import
                                    </button>
                                    <Button
                                        variant="primary"
                                        onClick={() => navigate('/crm_new/leads/create')}
                                        className="d-flex align-items-center justify-content-center lead-add-btn"
                                        style={{ height: "38px", borderRadius: "6px", whiteSpace: "nowrap", padding: "0 16px", backgroundColor: "var(--cc-primary, #0a500f)", borderColor: "var(--cc-primary, #0a500f)", color: "white" }}
                                    >
                                        <i className="fa fa-plus me-2"></i>
                                        ADD LEAD
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
                                        <table className="table table-responsive-md lead-table">
                                            <thead>
                                                <tr>
                                                    <th style={{ width: '80px' }}><strong>SL.NO</strong></th>
                                                    <th><strong>LEAD NAME</strong></th>
                                                    <th><strong>COMPANY</strong></th>
                                                    <th><strong>PHONE</strong></th>
                                                    <th><strong>CATEGORY</strong></th>
                                                    <th><strong>INDUSTRY</strong></th>
                                                    <th><strong>SOURCE</strong></th>
                                                    <th><strong>STATUS</strong></th>
                                                    <th><strong>PRIORITY</strong></th>
                                                    <th><strong>OWNER</strong></th>
                                                    <th className="text-end"><strong>ACTION</strong></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {currentLeads.length > 0 ? (
                                                    currentLeads.map((lead, index) => {
                                                        const leadName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.company || 'Unnamed Lead';
                                                        return (
                                                            <tr key={lead.id || index}>
                                                                <td>{indexOfFirstItem + index + 1}</td>
                                                                <td>
                                                                    <Link
                                                                        to={`/crm_new/leads/detail/${lead.id}`}
                                                                        className="fw-semibold text-dark text-decoration-none"
                                                                    >
                                                                        {leadName}
                                                                    </Link>
                                                                    {lead.title && (
                                                                        <div className="text-muted small">{lead.title}</div>
                                                                    )}
                                                                </td>
                                                                <td>
                                                                    <span className="text-dark">{lead.company || '—'}</span>
                                                                </td>
                                                                <td>
                                                                    <span className="fw-semibold text-dark">{lead.phone || '—'}</span>
                                                                </td>
                                                                <td>
                                                                    <span className="badge badge-light border text-dark">
                                                                        {lead.category_name || '—'}
                                                                    </span>
                                                                </td>
                                                                <td>
                                                                    <span className="badge badge-light border text-dark">
                                                                        {lead.industry_name || (typeof lead.industry === 'object' ? lead.industry?.name : lead.industry) || '—'}
                                                                    </span>
                                                                </td>
                                                                <td>
                                                                    <small className="text-muted">{lead.lead_source_name || '—'}</small>
                                                                </td>
                                                                <td>
                                                                    <span
                                                                        className={`badge ${getStatusBadge(lead.lead_status)}`}
                                                                        style={{ borderRadius: '8px', fontSize: '12px', fontWeight: 700, padding: '5px 14px', lineHeight: 1.2 }}
                                                                    >
                                                                        {lead.lead_status || 'Not Contacted'}
                                                                    </span>
                                                                </td>
                                                                <td>
                                                                    <span
                                                                        className={getPriorityBadge(lead.priority)}
                                                                        style={{ borderRadius: '8px', fontSize: '12px', fontWeight: 700, padding: '5px 14px', lineHeight: 1.2 }}
                                                                    >
                                                                        {lead.priority || 'Medium'}
                                                                    </span>
                                                                </td>
                                                                <td>
                                                                    <small className="text-muted">
                                                                        {lead.lead_owner_name || lead.other_owner_name || '—'}
                                                                    </small>
                                                                </td>
                                                                <td className="text-end">
                                                                    <div className="d-flex justify-content-end gap-1">
                                                                        <Link
                                                                            to={`/crm_new/leads/detail/${lead.id}`}
                                                                            className="btn btn-outline-info shadow btn-xs"
                                                                            title="View Details"
                                                                            style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                                                                        >
                                                                            <i className="fa fa-eye"></i>
                                                                        </Link>
                                                                        <EditButton
                                                                            onClick={() => navigate(`/crm_new/leads/edit/${lead.id}`)}
                                                                        />
                                                                        <DeleteButton
                                                                            onClick={() => handleDelete(lead.id, leadName)}
                                                                        />
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                ) : (
                                                    <tr>
                                                        <td colSpan="11" className="text-center py-4 text-muted">
                                                            No leads found
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                        {filteredLeads.length > 0 && (
                                            <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                                <div className="text-muted" style={{ fontSize: '13px' }}>
                                                    Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredLeads.length)} of {filteredLeads.length} entries
                                                </div>
                                                {totalPages > 1 && (
                                                    <nav>
                                                        <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                            <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                                <button
                                                                    type="button"
                                                                    className="page-link"
                                                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                                                    disabled={currentPage === 1}
                                                                    style={{ border: 'none', background: 'none' }}
                                                                >
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
                                                                            <button
                                                                                type="button"
                                                                                className="page-link"
                                                                                onClick={() => setCurrentPage(pageNumber)}
                                                                                style={{ border: 'none' }}
                                                                            >
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
                                                                <button
                                                                    type="button"
                                                                    className="page-link"
                                                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                                                    disabled={currentPage === totalPages}
                                                                    style={{ border: 'none', background: 'none' }}
                                                                >
                                                                    <i className="la la-angle-right" />
                                                                </button>
                                                            </li>
                                                        </ul>
                                                    </nav>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </Card.Body>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Staging Import Modal */}
            <LeadImportModal
                show={showImportModal}
                onHide={() => {
                    setShowImportModal(false);
                    fetchPendingBatches();
                }}
                batchId={activeBatchId}
                initialBatchData={activeBatchData}
                onImportSuccess={() => {
                    fetchLeads();
                    fetchPendingBatches();
                }}
                onReUpload={() => {
                    setShowImportModal(false);
                    if (fileInputRef.current) {
                        fileInputRef.current.click();
                    }
                }}
            />

            {/* Pending Import Batches Modal */}
            <Modal
                show={showPendingModal}
                onHide={() => setShowPendingModal(false)}
                size="lg"
                centered
            >
                <Modal.Header closeButton className="bg-light">
                    <Modal.Title className="d-flex align-items-center gap-2">
                        <i className="fa fa-clock-o text-warning"></i>
                        <span>Pending Import Batches</span>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-3">
                    <p className="text-muted small mb-3">
                        These batches were uploaded and staged in the database, but haven't been pushed to the Leads table yet. You can resume them at any time.
                    </p>
                    {loadingBatches ? (
                        <div className="text-center py-4">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    ) : pendingBatches.length > 0 ? (
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0" style={{ fontSize: '13px' }}>
                                <thead className="table-light">
                                    <tr>
                                        <th>Batch #</th>
                                        <th>File Name</th>
                                        <th>Status</th>
                                        <th>Rows Summary</th>
                                        <th>Uploaded At</th>
                                        <th className="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingBatches.map((b) => (
                                        <tr key={b.id}>
                                            <td className="fw-bold">#{b.id}</td>
                                            <td>
                                                <div className="fw-semibold text-dark">{b.file_name}</div>
                                                <small className="text-muted">{b.uploaded_by_name || 'System'}</small>
                                            </td>
                                            <td>
                                                <span className={`badge ${b.status === 'READY' ? 'bg-success' : b.status === 'HAS_ISSUES' ? 'bg-warning text-dark' : 'bg-info'}`}>
                                                    {b.status}
                                                </span>
                                            </td>
                                            <td>
                                                <div>
                                                    <span className="text-success fw-bold me-2"><i className="fa fa-check"></i> {b.valid_rows} Valid</span>
                                                    {b.invalid_rows > 0 && (
                                                        <span className="text-danger fw-bold"><i className="fa fa-times"></i> {b.invalid_rows} Issues</span>
                                                    )}
                                                </div>
                                                <small className="text-muted">Total: {b.total_rows} rows</small>
                                            </td>
                                            <td>
                                                <small className="text-muted">
                                                    {b.created_at ? new Date(b.created_at).toLocaleString() : '—'}
                                                </small>
                                            </td>
                                            <td className="text-end">
                                                <div className="d-flex justify-content-end gap-1">
                                                    <Button
                                                        variant="primary"
                                                        size="sm"
                                                        style={{ fontSize: '12px', padding: '3px 8px' }}
                                                        onClick={() => {
                                                            setActiveBatchId(b.id);
                                                            setActiveBatchData(null);
                                                            setShowPendingModal(false);
                                                            setShowImportModal(true);
                                                        }}
                                                    >
                                                        <i className="fa fa-folder-open me-1"></i> Open
                                                    </Button>
                                                    <Button
                                                        variant="outline-danger"
                                                        size="sm"
                                                        style={{ fontSize: '12px', padding: '3px 8px' }}
                                                        onClick={async () => {
                                                            const res = await Swal.fire({
                                                                title: 'Cancel Batch?',
                                                                text: `Cancel Batch #${b.id}?`,
                                                                icon: 'warning',
                                                                showCancelButton: true,
                                                                confirmButtonText: 'Yes, Cancel',
                                                                confirmButtonColor: '#d33'
                                                            });
                                                            if (res.isConfirmed) {
                                                                await CRMNewService.cancelImportBatch(b.id);
                                                                fetchPendingBatches();
                                                            }
                                                        }}
                                                    >
                                                        <i className="fa fa-trash"></i>
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-4 text-muted">
                            <i className="fa fa-check-circle text-success fa-2x mb-2 d-block"></i>
                            No pending import batches found.
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" size="sm" onClick={() => setShowPendingModal(false)}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
};

export default LeadList;

