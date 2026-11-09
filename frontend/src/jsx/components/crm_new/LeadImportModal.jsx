import React, { useState, useEffect } from 'react';
import { Modal, Button, Badge, Form, Alert, Tabs, Tab } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import CRMNewService from '../../../services/CRMNewService';

const LeadImportModal = ({
    show,
    onHide,
    batchId,
    initialBatchData,
    onImportSuccess,
    onReUpload
}) => {
    const navigate = useNavigate();
    const [batch, setBatch] = useState(initialBatchData || null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    // Row editing state
    const [editingRow, setEditingRow] = useState(null);
    const [editFormData, setEditFormData] = useState({});
    const [savingRow, setSavingRow] = useState(false);

    useEffect(() => {
        if (initialBatchData) {
            setBatch(initialBatchData);
        } else if (batchId && show) {
            fetchBatch(batchId);
        }
    }, [batchId, initialBatchData, show]);

    const fetchBatch = async (id) => {
        const targetId = id || batchId || batch?.id;
        if (!targetId) return;
        setLoading(true);
        try {
            const data = await CRMNewService.getImportBatch(targetId);
            setBatch(data);
        } catch (error) {
            console.error('Error fetching batch:', error);
            Swal.fire('Error', 'Failed to load batch staging data from database.', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!batch && !loading) return null;

    const total_rows = batch?.total_rows || batch?.rows?.length || 0;
    const valid_rows_count = batch?.valid_rows || batch?.valid_rows_count || 0;
    const invalid_rows_count = batch?.invalid_rows || batch?.invalid_rows_count || 0;
    const missing_masters = batch?.missing_masters || {};
    const has_missing_masters = batch?.has_missing_masters || (
        (missing_masters.categories && missing_masters.categories.length > 0) ||
        (missing_masters.sources && missing_masters.sources.length > 0) ||
        (missing_masters.industries && missing_masters.industries.length > 0)
    );

    const missingIndustries = missing_masters.industries || [];
    const missingSources = missing_masters.sources || [];
    const missingCategories = missing_masters.categories || [];

    const rows = batch?.rows || [];

    const formatMasterItem = (item) => {
        if (typeof item === 'object' && item !== null) {
            const name = item.name || '';
            let rowStr = '';
            if (item.rows && item.rows.length > 0) {
                if (item.rows.length === 1) {
                    rowStr = `(row ${item.rows[0]})`;
                } else if (item.rows.length <= 3) {
                    rowStr = `(rows ${item.rows.join(', ')})`;
                } else {
                    rowStr = `(${item.rows.length} rows)`;
                }
            }
            return { name, rowStr, fullText: `${name} ${rowStr}`.trim() };
        }
        return { name: String(item), rowStr: '', fullText: String(item) };
    };

    // Filter rows based on tab and search
    const filteredRows = rows.filter((r) => {
        const isValid = r.validation_status === 'VALID' || r.is_valid;
        if (activeTab === 'valid' && !isValid) return false;
        if (activeTab === 'invalid' && isValid) return false;

        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        const name = `${r.first_name || ''} ${r.last_name || ''}`.toLowerCase();
        const phone = (r.phone || '').toLowerCase();
        const company = (r.company || '').toLowerCase();
        const ind = (r.industry_name || '').toLowerCase();
        const src = (r.source_name || '').toLowerCase();
        const cat = (r.category_name || '').toLowerCase();
        const errors = ((r.error_messages || r.errors) || []).join(' ').toLowerCase();

        return (
            name.includes(q) ||
            phone.includes(q) ||
            company.includes(q) ||
            ind.includes(q) ||
            src.includes(q) ||
            cat.includes(q) ||
            errors.includes(q)
        );
    });

    const handleRevalidate = async () => {
        if (!batch?.id) return;
        try {
            setActionLoading(true);
            const data = await CRMNewService.revalidateImportBatch(batch.id);
            setBatch(data);
            if (data.invalid_rows === 0 || data.invalid_rows_count === 0) {
                Swal.fire({
                    icon: 'success',
                    title: 'All Rows Ready',
                    text: 'All rows are verified and ready to push to the database!',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                Swal.fire({
                    icon: 'info',
                    title: 'Re-validation Complete',
                    text: `Valid rows: ${data.valid_rows || 0}, Issues remaining: ${data.invalid_rows || 0}`
                });
            }
        } catch (err) {
            console.error('Error revalidating batch:', err);
            Swal.fire('Error', err.response?.data?.detail || 'Failed to revalidate staging batch.', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleCreateMissingMastersInline = async () => {
        try {
            setActionLoading(true);
            const payload = {
                batch_id: batch?.id,
                categories: missingCategories.map(i => typeof i === 'object' ? i.name : i),
                sources: missingSources.map(i => typeof i === 'object' ? i.name : i),
                industries: missingIndustries.map(i => typeof i === 'object' ? i.name : i)
            };

            const res = await CRMNewService.createMissingMasters(payload);
            if (res.batch) {
                setBatch(res.batch);
            } else if (batch?.id) {
                await fetchBatch(batch.id);
            }

            Swal.fire({
                icon: 'success',
                title: 'Masters Created',
                text: 'Missing master records created successfully and staging rows re-checked!',
                timer: 1800,
                showConfirmButton: false
            });
        } catch (err) {
            console.error('Error creating missing masters:', err);
            Swal.fire('Error', err.response?.data?.detail || 'Failed to create missing masters.', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handlePushAllLeads = async () => {
        if (invalid_rows_count > 0 || !batch?.id) return;

        try {
            setActionLoading(true);
            const res = await CRMNewService.pushImportBatch(batch.id, { skip_invalid: false });
            Swal.fire({
                icon: 'success',
                title: 'Import Successful',
                html: `<strong>${res.message || 'Leads imported successfully!'}</strong><br><br>Added New: <strong>${res.added || 0}</strong><br>Updated Existing: <strong>${res.updated || 0}</strong>`,
            });
            if (onImportSuccess) onImportSuccess(res);
            onHide();
        } catch (error) {
            console.error('Error confirming lead import:', error);
            let errorMsg = error.response?.data?.detail || 'Failed to push leads into database.';
            Swal.fire({
                icon: 'error',
                title: 'Push Failed (Rolled Back)',
                html: errorMsg
            });
        } finally {
            setActionLoading(false);
        }
    };

    const handlePushValidOnly = async () => {
        if (!batch?.id || valid_rows_count === 0) {
            Swal.fire('Warning', 'There are no valid rows to push.', 'warning');
            return;
        }

        const confirmResult = await Swal.fire({
            title: 'Push Valid Rows Only?',
            html: `You have <strong>${valid_rows_count}</strong> valid leads ready to push.<br><br><span class="text-danger"><strong>${invalid_rows_count}</strong> row(s) with missing masters or duplicate phone numbers will be skipped.</span><br><br>Do you want to proceed pushing only the valid leads?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: `Yes, Push ${valid_rows_count} Valid Leads`
        });

        if (!confirmResult.isConfirmed) return;

        try {
            setActionLoading(true);
            const res = await CRMNewService.pushImportBatch(batch.id, { skip_invalid: true });
            Swal.fire({
                icon: 'success',
                title: 'Import Successful',
                html: `<strong>${res.message || 'Valid leads imported successfully!'}</strong><br><br>Added New: <strong>${res.added || 0}</strong><br>Updated Existing: <strong>${res.updated || 0}</strong><br>Skipped: <strong>${res.skipped || 0}</strong>`,
            });
            if (onImportSuccess) onImportSuccess(res);
            onHide();
        } catch (error) {
            console.error('Error pushing valid leads:', error);
            let errorMsg = error.response?.data?.detail || 'Failed to push valid leads into database.';
            Swal.fire({
                icon: 'error',
                title: 'Push Failed (Rolled Back)',
                html: errorMsg
            });
        } finally {
            setActionLoading(false);
        }
    };

    const handleCancelImport = async () => {
        if (!batch?.id) {
            onHide();
            return;
        }

        const result = await Swal.fire({
            title: 'Cancel Import?',
            text: 'Are you sure you want to cancel this import batch? You can also leave it in pending and resume later.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, Cancel Batch',
            cancelButtonText: 'Keep in Pending'
        });

        if (result.isConfirmed) {
            try {
                setActionLoading(true);
                await CRMNewService.cancelImportBatch(batch.id);
                Swal.fire('Cancelled', 'Batch has been marked as cancelled.', 'info');
                if (onImportSuccess) onImportSuccess();
                onHide();
            } catch (err) {
                console.error('Error cancelling batch:', err);
                Swal.fire('Error', 'Failed to cancel batch.', 'error');
            } finally {
                setActionLoading(false);
            }
        } else if (result.dismiss === Swal.DismissReason.cancel) {
            onHide();
        }
    };

    // Row edit modal handlers
    const openEditRow = (row) => {
        setEditingRow(row);
        setEditFormData({
            phone: row.phone || '',
            first_name: row.first_name || '',
            last_name: row.last_name || '',
            company: row.company || '',
            email: row.email || '',
            mobile: row.mobile || '',
            title: row.title || '',
            category_name: row.category_name || '',
            industry_name: row.industry_name || '',
            source_name: row.source_name || '',
            lead_status: row.lead_status || 'Not Contacted',
            priority: row.priority || 'Medium',
            rating: row.rating || 'Warm',
        });
    };

    const handleSaveRow = async () => {
        if (!editingRow?.id) return;
        try {
            setSavingRow(true);
            await CRMNewService.patchStagingRow(editingRow.id, editFormData);
            setEditingRow(null);
            await fetchBatch(batch.id);
            Swal.fire({
                icon: 'success',
                title: 'Row Updated',
                text: 'Staging row updated and re-validated.',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (err) {
            console.error('Error saving staging row:', err);
            Swal.fire('Error', err.response?.data?.detail || 'Failed to update staging row.', 'error');
        } finally {
            setSavingRow(false);
        }
    };

    return (
        <>
            <Modal
                show={show}
                onHide={onHide}
                size="xl"
                dialogClassName="modal-90w"
                centered
                backdrop="static"
                keyboard={!actionLoading}
            >
                <Modal.Header closeButton={!actionLoading} className="bg-light">
                    <Modal.Title className="d-flex align-items-center justify-content-between w-100 me-3">
                        <div className="d-flex align-items-center gap-2">
                            <i className="fa fa-database text-primary"></i>
                            <span>Lead Import — Staging Table</span>
                            {batch?.id && (
                                <Badge bg="secondary" className="ms-2">
                                    <i className="fa fa-layer-group me-1"></i>Batch #{batch.id}
                                </Badge>
                            )}
                            <Badge bg={batch?.status === 'READY' ? 'success' : batch?.status === 'HAS_ISSUES' ? 'warning' : 'info'}>
                                {batch?.status === 'READY' ? (
                                    <><i className="fa fa-check-circle me-1"></i>READY</>
                                ) : batch?.status === 'HAS_ISSUES' ? (
                                    <><i className="fa fa-exclamation-triangle me-1"></i>HAS_ISSUES</>
                                ) : (
                                    <><i className="fa fa-info-circle me-1"></i>{batch?.status || 'UPLOADED'}</>
                                )}
                            </Badge>
                        </div>
                        {batch?.file_name && (
                            <small className="text-muted fw-normal">
                                <i className="fa fa-file-excel me-1 text-success"></i> {batch.file_name}
                            </small>
                        )}
                    </Modal.Title>
                </Modal.Header>

                <Modal.Body className="p-4">
                    {/* Metrics / Statistics Cards */}
                    <div className="row g-3 mb-3">
                        <div className="col-md-4">
                            <div className="card border-0 shadow-sm rounded-3 mb-0" style={{ backgroundColor: '#f0f4ff', borderLeft: '4px solid #3d3577' }}>
                                <div className="card-body p-3 d-flex justify-content-between align-items-center">
                                    <div>
                                        <div className="text-muted small text-uppercase fw-bold">Total Staged Rows</div>
                                        <h3 className="fw-bold mb-0 text-dark">{total_rows}</h3>
                                    </div>
                                    <div className="rounded-circle p-2" style={{ backgroundColor: '#e0e7ff', color: '#3d3577' }}>
                                        <i className="fa fa-file-excel fa-2x"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-4">
                            <div className="card border-0 shadow-sm rounded-3 mb-0" style={{ backgroundColor: '#edfdf5', borderLeft: '4px solid #10b981' }}>
                                <div className="card-body p-3 d-flex justify-content-between align-items-center">
                                    <div>
                                        <div className="text-muted small text-uppercase fw-bold">Ready to Push (Valid)</div>
                                        <h3 className="fw-bold mb-0 text-success">{valid_rows_count}</h3>
                                    </div>
                                    <div className="rounded-circle p-2 text-success" style={{ backgroundColor: '#d1fae5' }}>
                                        <i className="fa fa-check-circle fa-2x"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-4">
                            <div className="card border-0 shadow-sm rounded-3 mb-0" style={{ backgroundColor: '#fef2f2', borderLeft: '4px solid #ef4444' }}>
                                <div className="card-body p-3 d-flex justify-content-between align-items-center">
                                    <div>
                                        <div className="text-muted small text-uppercase fw-bold">Rows with Issues</div>
                                        <h3 className="fw-bold mb-0 text-danger">{invalid_rows_count}</h3>
                                    </div>
                                    <div className="rounded-circle p-2 text-danger" style={{ backgroundColor: '#fee2e2' }}>
                                        <i className="fa fa-exclamation-triangle fa-2x"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Missing Master Data Warning Box */}
                    {has_missing_masters && (
                        <Alert variant="warning" className="border border-warning shadow-sm mb-3">
                            <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                                <div className="d-flex align-items-start gap-2">
                                    <i className="fa fa-exclamation-circle text-warning fs-4 mt-1"></i>
                                    <div>
                                        <h6 className="alert-heading fw-bold mb-1 text-dark">
                                            Missing Master Data in Database
                                        </h6>
                                        <p className="mb-2 text-dark small">
                                            These values are saved in the staging table but do not exist in the CRM master tables. You can add them in Master Settings or create them instantly:
                                        </p>
                                        <div className="d-flex flex-column gap-2 pt-1" style={{ maxHeight: '140px', overflowY: 'auto' }}>
                                            {missingIndustries.length > 0 && (
                                                 <div className="p-2 rounded bg-white border small">
                                                     <div className="d-flex justify-content-between align-items-center mb-1">
                                                         <strong className="text-danger">
                                                             Missing Industry ({missingIndustries.length} items):
                                                         </strong>
                                                         <button
                                                             type="button"
                                                             className="btn btn-link btn-xs p-0 text-decoration-underline"
                                                             onClick={() => window.open('/crm_new/industries', '_blank')}
                                                         >
                                                             Manage Industries <i className="fa fa-external-link"></i>
                                                         </button>
                                                     </div>
                                                     <div className="d-flex flex-wrap gap-1">
                                                         {missingIndustries.map((ind, i) => {
                                                             const formatted = formatMasterItem(ind);
                                                             return (
                                                                 <Badge key={i} bg="danger" className="px-2 py-1">
                                                                     {formatted.name} {formatted.rowStr && <span className="opacity-75">{formatted.rowStr}</span>}
                                                                 </Badge>
                                                             );
                                                         })}
                                                     </div>
                                                 </div>
                                             )}
                                             {missingSources.length > 0 && (
                                                 <div className="p-2 rounded bg-white border small">
                                                     <div className="d-flex justify-content-between align-items-center mb-1">
                                                         <strong className="text-warning text-dark">
                                                             Missing Source ({missingSources.length} items):
                                                         </strong>
                                                         <button
                                                             type="button"
                                                             className="btn btn-link btn-xs p-0 text-decoration-underline"
                                                             onClick={() => window.open('/crm_new/sources', '_blank')}
                                                         >
                                                             Manage Sources <i className="fa fa-external-link"></i>
                                                         </button>
                                                     </div>
                                                     <div className="d-flex flex-wrap gap-1">
                                                         {missingSources.map((src, i) => {
                                                             const formatted = formatMasterItem(src);
                                                             return (
                                                                 <Badge key={i} bg="warning" text="dark" className="px-2 py-1">
                                                                     {formatted.name} {formatted.rowStr && <span className="opacity-75">{formatted.rowStr}</span>}
                                                                 </Badge>
                                                             );
                                                         })}
                                                     </div>
                                                 </div>
                                             )}
                                             {missingCategories.length > 0 && (
                                                 <div className="p-2 rounded bg-white border small">
                                                     <div className="d-flex justify-content-between align-items-center mb-1">
                                                         <strong className="text-info text-dark">
                                                             Missing Category ({missingCategories.length} items):
                                                         </strong>
                                                         <button
                                                             type="button"
                                                             className="btn btn-link btn-xs p-0 text-decoration-underline"
                                                             onClick={() => window.open('/crm_new/categories', '_blank')}
                                                         >
                                                             Manage Categories <i className="fa fa-external-link"></i>
                                                         </button>
                                                     </div>
                                                     <div className="d-flex flex-wrap gap-1">
                                                         {missingCategories.map((cat, i) => {
                                                             const formatted = formatMasterItem(cat);
                                                             return (
                                                                 <Badge key={i} bg="info" className="px-2 py-1">
                                                                     {formatted.name} {formatted.rowStr && <span className="opacity-75">{formatted.rowStr}</span>}
                                                                 </Badge>
                                                             );
                                                         })}
                                                     </div>
                                                 </div>
                                             )}
                                         </div>
                                    </div>
                                </div>
                                <div className="d-flex flex-column gap-1">
                                    <Button
                                        variant="outline-primary"
                                        size="sm"
                                        onClick={handleCreateMissingMastersInline}
                                        disabled={actionLoading}
                                    >
                                        <i className="fa fa-magic me-1"></i> Create Missing Masters Now
                                    </Button>
                                    <Button
                                        variant="outline-success"
                                        size="sm"
                                        onClick={handleRevalidate}
                                        disabled={actionLoading}
                                    >
                                        <i className="fa fa-refresh me-1"></i> Re-check Staging Data
                                    </Button>
                                </div>
                            </div>
                        </Alert>
                    )}

                    {/* Table Filter Controls */}
                    <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                        <div className="btn-group" role="group">
                            <button
                                type="button"
                                className={`btn btn-sm ${activeTab === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
                                onClick={() => setActiveTab('all')}
                            >
                                <i className="fa fa-list me-1"></i> All Rows ({total_rows})
                            </button>
                            <button
                                type="button"
                                className={`btn btn-sm ${activeTab === 'valid' ? 'btn-success' : 'btn-outline-success'}`}
                                onClick={() => setActiveTab('valid')}
                            >
                                <i className="fa fa-check me-1"></i> Ready Only ({valid_rows_count})
                            </button>
                            <button
                                type="button"
                                className={`btn btn-sm ${activeTab === 'invalid' ? 'btn-danger' : 'btn-outline-danger'}`}
                                onClick={() => setActiveTab('invalid')}
                            >
                                <i className="fa fa-times me-1"></i> Issues Only ({invalid_rows_count})
                            </button>
                        </div>

                        <div className="d-flex align-items-center gap-2">
                            <div style={{ width: '220px' }}>
                                <Form.Control
                                    type="text"
                                    size="sm"
                                    placeholder="Filter staging rows..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Staging Preview Table */}
                    <div className="table-responsive border rounded" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                        <table className="table table-hover table-striped mb-0 align-middle" style={{ fontSize: '13px' }}>
                            <thead className="table-light sticky-top" style={{ zIndex: 1 }}>
                                <tr>
                                    <th style={{ width: '60px' }}>Row #</th>
                                    <th style={{ width: '120px' }}>Status</th>
                                    <th>Lead Name</th>
                                    <th>Company</th>
                                    <th>Phone</th>
                                    <th>Category</th>
                                    <th>Industry</th>
                                    <th>Source</th>
                                    <th>Validation / Issues</th>
                                    <th className="text-end" style={{ width: '60px' }}>Edit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRows.length > 0 ? (
                                    filteredRows.map((row, idx) => {
                                        const errList = row.error_messages || row.errors || [];
                                        const hasIndustryErr = errList.some(e => e.includes('Industry'));
                                        const hasSourceErr = errList.some(e => e.includes('Source'));
                                        const hasCategoryErr = errList.some(e => e.includes('Category'));
                                        const isDupInFile = row.is_duplicate_in_file;
                                        const isValid = row.validation_status === 'VALID' || row.is_valid;
                                        const isPushed = row.validation_status === 'PUSHED';
                                        const isExisting = row.existing_lead || row.is_existing;

                                        return (
                                            <tr key={row.id || idx} className={isValid ? '' : isPushed ? 'table-secondary' : 'table-danger-light'}>
                                                <td className="fw-bold text-muted">{row.row_number}</td>
                                                <td>
                                                    {isPushed ? (
                                                        <span
                                                            className="badge px-2 py-1"
                                                            style={{
                                                                backgroundColor: 'rgba(100, 116, 139, 0.15)',
                                                                color: '#475569',
                                                                border: '1px solid rgba(100, 116, 139, 0.3)',
                                                                fontWeight: 600,
                                                                borderRadius: '4px'
                                                            }}
                                                        >
                                                            <i className="fa fa-check me-1"></i> Pushed
                                                        </span>
                                                    ) : isValid ? (
                                                        isExisting ? (
                                                            <span
                                                                className="badge px-2 py-1"
                                                                style={{
                                                                    backgroundColor: 'rgba(13, 202, 240, 0.15)',
                                                                    color: '#0284c7',
                                                                    border: '1px solid rgba(13, 202, 240, 0.3)',
                                                                    fontWeight: 600,
                                                                    borderRadius: '4px'
                                                                }}
                                                            >
                                                                <i className="fa fa-refresh me-1"></i> Update Lead
                                                            </span>
                                                        ) : (
                                                            <span
                                                                className="badge px-2 py-1"
                                                                style={{
                                                                    backgroundColor: 'rgba(40, 167, 69, 0.15)',
                                                                    color: '#198754',
                                                                    border: '1px solid rgba(40, 167, 69, 0.3)',
                                                                    fontWeight: 600,
                                                                    borderRadius: '4px'
                                                                }}
                                                            >
                                                                <i className="fa fa-plus me-1"></i> New Lead
                                                            </span>
                                                        )
                                                    ) : (
                                                        <span
                                                            className="badge px-2 py-1"
                                                            style={{
                                                                backgroundColor: 'rgba(220, 53, 69, 0.15)',
                                                                color: '#dc3545',
                                                                border: '1px solid rgba(220, 53, 69, 0.3)',
                                                                fontWeight: 600,
                                                                borderRadius: '4px'
                                                            }}
                                                        >
                                                            <i className="fa fa-times me-1"></i> Issue
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="fw-semibold text-dark">
                                                        {`${row.first_name || ''} ${row.last_name || ''}`.trim() || '—'}
                                                    </div>
                                                    {row.title && <small className="text-muted">{row.title}</small>}
                                                </td>
                                                <td>{row.company || '—'}</td>
                                                <td className="fw-bold">
                                                    <span className={isDupInFile ? 'text-danger' : ''}>
                                                        {row.phone || <span className="text-danger">Missing</span>}
                                                    </span>
                                                    {isDupInFile && (
                                                        <div className="small text-danger fw-normal">
                                                            <i className="fa fa-copy me-1"></i> Duplicate in file
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    {row.category_name ? (
                                                        <span
                                                            className="badge"
                                                            style={hasCategoryErr ? {
                                                                backgroundColor: 'rgba(220, 53, 69, 0.15)',
                                                                color: '#dc3545',
                                                                border: '1px solid rgba(220, 53, 69, 0.3)',
                                                                fontWeight: 500,
                                                                borderRadius: '4px'
                                                            } : {
                                                                backgroundColor: '#f8fafc',
                                                                color: '#334155',
                                                                border: '1px solid #e2e8f0',
                                                                fontWeight: 500,
                                                                borderRadius: '4px'
                                                            }}
                                                        >
                                                            {row.category_name}
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                                <td>
                                                    {row.industry_name ? (
                                                        <span
                                                            className="badge"
                                                            style={hasIndustryErr ? {
                                                                backgroundColor: 'rgba(220, 53, 69, 0.15)',
                                                                color: '#dc3545',
                                                                border: '1px solid rgba(220, 53, 69, 0.3)',
                                                                fontWeight: 500,
                                                                borderRadius: '4px'
                                                            } : {
                                                                backgroundColor: '#f8fafc',
                                                                color: '#334155',
                                                                border: '1px solid #e2e8f0',
                                                                fontWeight: 500,
                                                                borderRadius: '4px'
                                                            }}
                                                        >
                                                            {row.industry_name}
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                                <td>
                                                    {row.source_name ? (
                                                        <span
                                                            className="badge"
                                                            style={hasSourceErr ? {
                                                                backgroundColor: 'rgba(220, 53, 69, 0.15)',
                                                                color: '#dc3545',
                                                                border: '1px solid rgba(220, 53, 69, 0.3)',
                                                                fontWeight: 500,
                                                                borderRadius: '4px'
                                                            } : {
                                                                backgroundColor: '#f8fafc',
                                                                color: '#334155',
                                                                border: '1px solid #e2e8f0',
                                                                fontWeight: 500,
                                                                borderRadius: '4px'
                                                            }}
                                                        >
                                                            {row.source_name}
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                                <td>
                                                    {isPushed ? (
                                                        <span className="text-muted small">Already in Leads</span>
                                                    ) : isValid ? (
                                                        <span className="text-success small">
                                                            <i className="fa fa-check me-1"></i> Ready
                                                        </span>
                                                    ) : (
                                                        <div className="text-danger small fw-semibold">
                                                            {errList.map((err, errIdx) => (
                                                                <div key={errIdx} className="d-flex align-items-center gap-1">
                                                                    <i className="fa fa-exclamation-triangle"></i>
                                                                    <span>{err}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="text-end">
                                                    <Button
                                                        variant="outline-primary"
                                                        size="sm"
                                                        className="shadow-sm"
                                                        style={{
                                                            width: '28px',
                                                            height: '28px',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            padding: 0,
                                                            fontSize: '12px',
                                                            borderRadius: '6px'
                                                        }}
                                                        onClick={() => openEditRow(row)}
                                                        disabled={isPushed}
                                                        title="Edit row data"
                                                    >
                                                        <i className="fa fa-pencil-alt"></i>
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="10" className="text-center py-4 text-muted">
                                            No rows match the selected filter.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Modal.Body>

                <Modal.Footer className="bg-light d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <div>
                        <Button
                            variant="outline-secondary"
                            onClick={onReUpload}
                            disabled={actionLoading}
                            className="me-2"
                            size="sm"
                        >
                            <i className="fa fa-upload me-1"></i> Upload New File
                        </Button>
                        <Button
                            variant="outline-danger"
                            onClick={handleCancelImport}
                            disabled={actionLoading}
                            size="sm"
                        >
                            Cancel Import
                        </Button>
                    </div>

                    <div className="d-flex align-items-center gap-2 flex-wrap">
                        {/* Secondary Push Option when there are invalid rows */}
                        {invalid_rows_count > 0 && valid_rows_count > 0 && (
                            <Button
                                variant="outline-warning"
                                size="sm"
                                onClick={handlePushValidOnly}
                                disabled={actionLoading}
                            >
                                <i className="fa fa-filter me-1"></i>
                                Push {valid_rows_count} Valid Rows Only (Skip {invalid_rows_count} Invalid)
                            </Button>
                        )}

                        {/* Primary Push Button (Disabled if any invalid rows exist) */}
                        <div title={invalid_rows_count > 0 ? `Resolve ${invalid_rows_count} invalid row(s) to push all leads` : ''}>
                            <Button
                                variant="primary"
                                onClick={handlePushAllLeads}
                                disabled={actionLoading || invalid_rows_count > 0 || total_rows === 0}
                                style={{ backgroundColor: 'rgb(61, 53, 119)', borderColor: 'rgb(61, 53, 119)' }}
                            >
                                {actionLoading ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                        Pushing Staged Leads...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa fa-check-circle me-2"></i>
                                        Push {total_rows} {total_rows === 1 ? 'Lead' : 'Leads'} to Database
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </Modal.Footer>
            </Modal>

            {/* Inline Row Editor Modal */}
            {editingRow && (
                <Modal
                    show={!!editingRow}
                    onHide={() => setEditingRow(null)}
                    centered
                    backdrop="static"
                >
                    <Modal.Header closeButton>
                        <Modal.Title>Edit Staging Row #{editingRow.row_number}</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <div className="row g-2">
                            <div className="col-md-6">
                                <Form.Group className="mb-2">
                                    <Form.Label className="small fw-bold">Phone *</Form.Label>
                                    <Form.Control
                                        type="text"
                                        size="sm"
                                        value={editFormData.phone}
                                        onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-6">
                                <Form.Group className="mb-2">
                                    <Form.Label className="small fw-bold">Mobile</Form.Label>
                                    <Form.Control
                                        type="text"
                                        size="sm"
                                        value={editFormData.mobile}
                                        onChange={(e) => setEditFormData({ ...editFormData, mobile: e.target.value })}
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-6">
                                <Form.Group className="mb-2">
                                    <Form.Label className="small fw-bold">First Name</Form.Label>
                                    <Form.Control
                                        type="text"
                                        size="sm"
                                        value={editFormData.first_name}
                                        onChange={(e) => setEditFormData({ ...editFormData, first_name: e.target.value })}
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-6">
                                <Form.Group className="mb-2">
                                    <Form.Label className="small fw-bold">Last Name</Form.Label>
                                    <Form.Control
                                        type="text"
                                        size="sm"
                                        value={editFormData.last_name}
                                        onChange={(e) => setEditFormData({ ...editFormData, last_name: e.target.value })}
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-12">
                                <Form.Group className="mb-2">
                                    <Form.Label className="small fw-bold">Company</Form.Label>
                                    <Form.Control
                                        type="text"
                                        size="sm"
                                        value={editFormData.company}
                                        onChange={(e) => setEditFormData({ ...editFormData, company: e.target.value })}
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-4">
                                <Form.Group className="mb-2">
                                    <Form.Label className="small fw-bold">Industry</Form.Label>
                                    <Form.Control
                                        type="text"
                                        size="sm"
                                        value={editFormData.industry_name}
                                        onChange={(e) => setEditFormData({ ...editFormData, industry_name: e.target.value })}
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-4">
                                <Form.Group className="mb-2">
                                    <Form.Label className="small fw-bold">Source</Form.Label>
                                    <Form.Control
                                        type="text"
                                        size="sm"
                                        value={editFormData.source_name}
                                        onChange={(e) => setEditFormData({ ...editFormData, source_name: e.target.value })}
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-4">
                                <Form.Group className="mb-2">
                                    <Form.Label className="small fw-bold">Category</Form.Label>
                                    <Form.Control
                                        type="text"
                                        size="sm"
                                        value={editFormData.category_name}
                                        onChange={(e) => setEditFormData({ ...editFormData, category_name: e.target.value })}
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-6">
                                <Form.Group className="mb-2">
                                    <Form.Label className="small fw-bold">Rating</Form.Label>
                                    <Form.Select
                                        size="sm"
                                        value={editFormData.rating || 'Warm'}
                                        onChange={(e) => setEditFormData({ ...editFormData, rating: e.target.value })}
                                    >
                                        <option value="Hot">Hot</option>
                                        <option value="Warm">Warm</option>
                                        <option value="Cold">Cold</option>
                                    </Form.Select>
                                </Form.Group>
                            </div>
                            <div className="col-md-6">
                                <Form.Group className="mb-2">
                                    <Form.Label className="small fw-bold">Priority</Form.Label>
                                    <Form.Select
                                        size="sm"
                                        value={editFormData.priority || 'Medium'}
                                        onChange={(e) => setEditFormData({ ...editFormData, priority: e.target.value })}
                                    >
                                        <option value="High">High</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Low">Low</option>
                                    </Form.Select>
                                </Form.Group>
                            </div>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" size="sm" onClick={() => setEditingRow(null)} disabled={savingRow}>
                            Cancel
                        </Button>
                        <Button variant="primary" size="sm" onClick={handleSaveRow} disabled={savingRow}>
                            {savingRow ? 'Saving & Re-validating...' : 'Save & Re-validate'}
                        </Button>
                    </Modal.Footer>
                </Modal>
            )}
        </>
    );
};

export default LeadImportModal;
