import React, { useState, useEffect } from 'react';
import { getTableConfiguration } from '../../../services/ConfigurationService';

const styles = `
  .asset-form-wrap {
    max-width: 580px;
    width: 100%;
    margin: 0 auto;
    font-family: 'Segoe UI', system-ui, sans-serif;
  }

  .asset-form-wrap .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 16px;
  }

  @media (max-width: 600px) {
    .asset-form-wrap .form-row {
      grid-template-columns: 1fr !important;
    }
    .asset-form-wrap .section-header {
      grid-column: span 1 !important;
    }
    .doc-upload-zone {
      grid-column: span 1 !important;
    }
  }

  .asset-form-wrap .section-header {
    grid-column: span 2;
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 18px 0 10px;
    padding-bottom: 8px;
    border-bottom: 1.5px solid #e8ecf1;
  }

  .asset-form-wrap .section-header .step-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #0a500f;
    color: #fff;
    font-size: 0.68rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  .asset-form-wrap .section-header span.label {
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #374151;
  }

  /* ── Document Upload Section ── */
  .doc-upload-zone {
    grid-column: span 2;
  }

  .doc-existing-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 14px;
  }

  .doc-existing-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 8px;
    background: #e6fcf1;
    border: 1px solid #a7f3d0;
  }

  .doc-existing-item .doc-icon {
    width: 30px;
    height: 30px;
    border-radius: 6px;
    background: #d1fae5;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .doc-existing-item .doc-name {
    font-size: 0.82rem;
    font-weight: 600;
    color: #374151;
    flex: 1;
  }

  .doc-existing-item a {
    font-size: 0.78rem;
    color: #0a500f;
    text-decoration: none;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 20px;
    background: #d1fae5;
    transition: background 0.15s;
  }

  .doc-existing-item a:hover {
    background: #a7f3d0;
  }

  .doc-new-entries {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 10px;
  }

  .doc-entry-card {
    border-radius: 10px;
    border: 1.5px solid #e5e7eb;
    background: #fafbfc;
    overflow: hidden;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .doc-entry-card:focus-within {
    border-color: #0a500f;
    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.08);
  }

  .doc-entry-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px 9px 14px;
    background: #f3f4f6;
    border-bottom: 1px solid #e5e7eb;
  }

  .doc-entry-header .doc-type-select {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 0.82rem;
    font-weight: 600;
    color: #374151;
    outline: none;
    cursor: pointer;
  }

  .doc-entry-header .doc-type-select:focus {
    outline: none;
  }

  .doc-remove-btn {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 1.5px solid #e5e7eb;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    color: #9ca3af;
    transition: all 0.15s;
    flex-shrink: 0;
  }

  .doc-remove-btn:hover {
    background: #fee2e2;
    border-color: #fca5a5;
    color: #ef4444;
  }

  .doc-entry-body {
    padding: 10px 14px 12px;
  }

  .doc-file-drop {
    border: 2px dashed #d1d5db;
    border-radius: 8px;
    padding: 14px 12px;
    text-align: center;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    position: relative;
    background: #fff;
  }

  .doc-file-drop:hover {
    border-color: #0a500f;
    background: #f0fdf4;
  }

  .doc-file-drop input[type="file"] {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
    width: 100%;
    height: 100%;
  }

  .doc-file-drop .drop-icon {
    font-size: 1.4rem;
    margin-bottom: 4px;
    display: block;
  }

  .doc-file-drop .drop-label {
    font-size: 0.78rem;
    color: #6b7280;
    font-weight: 500;
  }

  .doc-file-drop .drop-label strong {
    color: #0a500f;
    font-weight: 700;
  }

  .doc-file-selected {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: #f0fdf4;
    border: 1.5px solid #86efac;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 600;
    color: #166534;
  }

  .doc-file-selected svg {
    flex-shrink: 0;
  }

  .doc-custom-name {
    margin-top: 8px;
  }

  .add-doc-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 20px;
    border: 2px dashed #0a500f;
    background: transparent;
    color: #0a500f;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s;
    letter-spacing: 0.02em;
  }

  .add-doc-btn:hover {
    background: #dcfce7;
  }
`;

const AssetForm = ({
    formData,
    setFormData,
    isEditing,
    onSave,
    onCancel,
    assetTypes,
    assetCategories,
    users,
    departments,
    formDocuments,
    setFormDocuments,
    availableDocTypes,
    getInheritedAttributes,
    onAddAssetType,
    onAddAssetCategory,
    onAddUser,
    onAddDepartment,
    onAddAttributeDefinition,
    selectedCustomValues,
    setSelectedCustomValues
}) => {
    const [formConfig, setFormConfig] = useState(null);

    useEffect(() => {
        getTableConfiguration('assets_asset', 'AssetForm')
            .then(config => {
                if (config) setFormConfig(config.settings);
            })
            .catch(() => setFormConfig({}));
    }, []);

    const handleFileChange = (index, e) => {
    };

    const checkInheritedProp = (categoryId, propName) => {
        if (!categoryId) return false;
        let currentId = categoryId;
        const seenCategories = new Set();
        while (currentId && !seenCategories.has(currentId)) {
            seenCategories.add(currentId);
            const cat = assetCategories.find(c => String(c.id) === String(currentId));
            if (cat && cat[propName]) return true;
            currentId = cat?.parent;
        }
        return false;
    };

    const SectionHeader = ({ step, label, onAdd }) => (
        <div className="section-header">
            <span className="step-badge">{step}</span>
            <span className="label" style={{ flex: 1 }}>{label}</span>
            {onAdd && (
                <button type="button" className="btn btn-sm btn-primary shadow-none" onClick={onAdd} title={`Add ${label}`} style={{ padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                    <i className="fa fa-plus" style={{ fontSize: '0.75rem' }}></i>
                </button>
            )}
        </div>
    );

    const existingDocs = formDocuments.filter(doc => doc.file && typeof doc.file === 'string');
    const newDocs = formDocuments.map((doc, index) => ({ doc, index })).filter(({ doc }) => !(doc.file && typeof doc.file === 'string'));

    return (
        <div className="scfm-modal w-100 h-100 d-flex flex-column" style={{ borderRadius: '16px', overflow: 'hidden', background: '#ffffff', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}>
            <style>{`
                .scfm-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .scfm-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: var(--form-icon-color, #0a500f);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .scfm-modal .modal-close-x {
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
                .scfm-modal .modal-close-x:hover { color: #555; }
                .scfm-modal .form-body {
                    padding: 24px 28px;
                }
                .scfm-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .scfm-modal label:not(.form-check-label):not(.mb-0) {
                    font-size: 14px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 8px;
                    display: block;
                }
                .scfm-modal .form-control {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 14px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                }
                .scfm-modal .form-control:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .scfm-modal .form-control::placeholder { color: #94a3b8; }
                .scfm-modal .btn-close-custom {
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
                .scfm-modal .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .scfm-modal .btn-save-custom {
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
                .scfm-modal .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }
                ${styles}
            `}</style>
            
            <div className="modal-header-custom">
                <div className="d-flex align-items-center gap-3">
                    <div className="modal-icon-circle">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 6h16M4 12h16M4 18h16" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
                        </svg>
                    </div>
                    <div>
                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                            {formData?.id ? 'Edit Asset' : 'Create Asset'}
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            {formData?.id ? 'Update asset details' : 'Register a new asset in the system'}
                        </p>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={onCancel}>&times;</button>
            </div>

            <div className="form-body asset-form-wrap flex-grow-1">
                <form onSubmit={onSave} className="d-flex flex-column flex-grow-1">
                    <div className="form-row">

                        {/* Step 1 */}
                        <SectionHeader step="1" label="Classification" />
                        {(!formConfig || formConfig.asset_type?.show !== false) && (
                        <div className="form-group mb-3">
                            <label>Asset Type</label>
                            <div className="d-flex gap-2">
                                <select className="form-control" required value={formData.asset_type || ''} onChange={(e) => setFormData({ ...formData, asset_type: e.target.value, category: '' })}>
                                    <option value="">Select Type</option>
                                    {assetTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                                {onAddAssetType && (
                                    <button type="button" className="btn btn-primary px-3 shadow-none" onClick={onAddAssetType} title="Add Asset Type">
                                        <i className="fa fa-plus"></i>
                                    </button>
                                )}
                            </div>
                        </div>
                        )}
                        {formData.asset_type && (!formConfig || formConfig.category?.show !== false) && (
                            <div className="form-group mb-3">
                                <label>Category</label>
                                <div className="d-flex gap-2">
                                    <select className="form-control" required value={formData.category || ''} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                                        <option value="">Select Category</option>
                                        {assetCategories
                                            .filter(c => String(c.asset_type) === String(formData.asset_type))
                                            .filter(c => !assetCategories.some(child => child.parent && String(child.parent) === String(c.id)))
                                            .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    {onAddAssetCategory && (
                                        <button type="button" className="btn btn-primary px-3 shadow-none" onClick={() => onAddAssetCategory(formData.asset_type)} title="Add Asset Category">
                                            <i className="fa fa-plus"></i>
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {formData.category && (
                            <>
                                {/* Step 2 */}
                                <SectionHeader step="2" label="Asset Details" />
                                <div className="form-group mb-3">
                                    <label>Asset Name</label>
                                    <input type="text" className="form-control" placeholder="e.g. Dell Latitude 5420" required
                                        value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                                <div className="form-group mb-3">
                                    <label>Department</label>
                                    <select className="form-control" value={formData.department || ''} onChange={(e) => setFormData({ ...formData, department: e.target.value, incharge: '' })}>
                                        <option value="">Select Department</option>
                                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group mb-3">
                                    <label>Incharge</label>
                                    <select className="form-control" value={formData.incharge || ''} onChange={(e) => setFormData({ ...formData, incharge: e.target.value })}>
                                        {!formData.department ? (
                                            <option value="">Select Department first</option>
                                        ) : (
                                            <option value="">Select Incharge</option>
                                        )}
                                        {users
                                            .filter(u => {
                                                if (!formData.department) return false;
                                                const uDeptId = u.department?.id !== undefined ? u.department.id : u.department;
                                                return String(uDeptId) === String(formData.department);
                                            })
                                            .map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                                    </select>
                                </div>

                                {/* Step 3 */}
                                <SectionHeader step="3" label="Identification & Lifecycle" />
                                <div className="form-group mb-3">
                                    <label>Asset Code</label>
                                    <input type="text" className="form-control" placeholder="Leave blank for auto-gen"
                                        value={formData.asset_code || ''} onChange={(e) => setFormData({ ...formData, asset_code: e.target.value })} />
                                </div>
                                <div className="form-group mb-3">
                                    <label>Serial Number</label>
                                    <input type="text" className="form-control" value={formData.serial_number || ''} onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })} />
                                </div>
                                <div className="form-group mb-3">
                                    <label>Purchase Date</label>
                                    <input type="date" className="form-control" value={formData.purchase_date || ''} onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })} />
                                </div>
                                <div className="form-group mb-3">
                                    <label>Purchase Cost</label>
                                    <input type="number" className="form-control" placeholder="0.00" value={formData.purchase_cost || ''} onChange={(e) => setFormData({ ...formData, purchase_cost: e.target.value })} />
                                </div>
                                <div className="form-group mb-3" style={{ gridColumn: 'span 2' }}>
                                    <label>Purchase Narration</label>
                                    <textarea className="form-control" rows="2" placeholder="Enter purchase details..." value={formData.purchase_narration || ''} onChange={(e) => setFormData({ ...formData, purchase_narration: e.target.value })} />
                                </div>
                                <div className="form-group mb-3">
                                    <label>Tag Number</label>
                                    <input type="text" className="form-control" value={formData.tag_number || ''} onChange={(e) => setFormData({ ...formData, tag_number: e.target.value })} />
                                </div>
                                <div className="form-group mb-3">
                                    <label>Status</label>
                                    <select className="form-control" value={formData.status || 'available'} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                                        <option value="available">Available</option>
                                        <option value="allocated">Allocated</option>
                                        <option value="maintenance">Under Maintenance</option>
                                        <option value="repair">Under Repair</option>
                                        <option value="retired">Retired</option>
                                        <option value="disposed">Disposed</option>
                                    </select>
                                </div>
                                <div className="form-group mb-3">
                                    <label>Condition</label>
                                    <select className="form-control" value={formData.condition || 'good'} onChange={(e) => setFormData({ ...formData, condition: e.target.value })}>
                                        <option value="new">New</option>
                                        <option value="good">Good</option>
                                        <option value="fair">Fair</option>
                                        <option value="damaged">Damaged</option>
                                        <option value="scrap">Scrap</option>
                                    </select>
                                </div>
                                <div className="form-group mb-3">
                                    <label>Depreciation (%)</label>
                                    <input type="number" step="0.01" className="form-control" placeholder="0.00" value={formData.depreciation_percentage || ''} onChange={(e) => setFormData({ ...formData, depreciation_percentage: e.target.value })} />
                                </div>
                                <div className="form-group mb-3 d-flex align-items-center gap-2 mt-4">
                                    <input type="checkbox" id="isActiveAsset" className="form-check-input mt-0"
                                        checked={formData.is_active !== undefined ? formData.is_active : true}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} />
                                    <label htmlFor="isActiveAsset" className="mb-0">Active</label>
                                </div>

                                {/* Step 4 */}
                                <SectionHeader step="4" label="Warranty & Renewals" />
                                <div className="form-group mb-3">
                                    <label>Warranty Start</label>
                                    <input type="date" className="form-control" value={formData.warranty_start_date || ''} onChange={(e) => setFormData({ ...formData, warranty_start_date: e.target.value })} />
                                </div>
                                <div className="form-group mb-3">
                                    <label>Warranty End</label>
                                    <input type="date" className="form-control" value={formData.warranty_end_date || ''} onChange={(e) => setFormData({ ...formData, warranty_end_date: e.target.value })} />
                                </div>
                                <div className="form-group mb-3">
                                    <label>Expiry Date</label>
                                    <input type="date" className="form-control" value={formData.expiry_date || ''} onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })} />
                                </div>
                                {checkInheritedProp(formData.category, 'is_renewable') ? (
                                    <>
                                        <div className="form-group mb-3">
                                            <label>Renewal Date</label>
                                            <input type="date" className="form-control" value={formData.renewal_date || ''} onChange={(e) => setFormData({ ...formData, renewal_date: e.target.value })} />
                                        </div>
                                        <div className="form-group mb-3">
                                            <label>Renewal Cycle (Days)</label>
                                            <input type="number" className="form-control" placeholder="e.g. 365" value={formData.renewal_cycle_days || ''} onChange={(e) => setFormData({ ...formData, renewal_cycle_days: e.target.value })} />
                                        </div>
                                        <div className="form-group mb-3">
                                            <label>Renewal Reminder (Days Before)</label>
                                            <input type="number" className="form-control" placeholder="e.g. 30" value={formData.renewal_reminder_days || ''} onChange={(e) => setFormData({ ...formData, renewal_reminder_days: e.target.value })} />
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-muted mb-3" style={{ gridColumn: 'span 2', fontSize: '0.82rem' }}>
                                        * Renewals are not required for this category.
                                    </div>
                                )}

                                {/* Step 5 */}
                                <SectionHeader step="5" label="Maintenance Info" />
                                {checkInheritedProp(formData.category, 'is_maintainable') ? (
                                    <>
                                        <div className="form-group mb-3">
                                            <label>Maintenance Type</label>
                                            <input type="text" className="form-control" placeholder="e.g. Annual Service" value={formData.maintenance_type || ''} onChange={(e) => setFormData({ ...formData, maintenance_type: e.target.value })} />
                                        </div>
                                        <div className="form-group mb-3">
                                            <label>Scheduled Date</label>
                                            <input type="date" className="form-control" value={formData.scheduled_date || ''} onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })} />
                                        </div>
                                        <div className="form-group mb-3">
                                            <label>Technician</label>
                                            <div className="d-flex gap-2">
                                                <select className="form-control" value={formData.technician || ''} onChange={(e) => setFormData({ ...formData, technician: e.target.value })}>
                                                    {!formData.department ? (
                                                        <option value="">Select Department first</option>
                                                    ) : (
                                                        <option value="">Select Technician</option>
                                                    )}
                                                    {users
                                                        .filter(u => {
                                                            if (!formData.department) return false;
                                                            const uDeptId = u.department?.id !== undefined ? u.department.id : u.department;
                                                            return String(uDeptId) === String(formData.department);
                                                        })
                                                        .map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                                                </select>
                                                {onAddUser && (
                                                    <button type="button" className="btn btn-primary px-3 shadow-none" disabled={!formData.department} onClick={() => onAddUser('technician')} title={!formData.department ? "Select Department first" : "Add Technician"}>
                                                        <i className="fa fa-plus"></i>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-muted mb-3" style={{ gridColumn: 'span 2', fontSize: '0.82rem' }}>
                                        * Maintenance is not required for this category.
                                    </div>
                                )}

                                {/* ── Step 6: Documents ── */}
                                <SectionHeader step="6" label="Asset Documents" />
                                <div className="doc-upload-zone">
                                    {/* Existing docs */}
                                    {existingDocs.length > 0 && (
                                        <div className="doc-existing-list">
                                            {existingDocs.map((doc, i) => (
                                                <div key={`existing-${i}`} className="doc-existing-item">
                                                    <div className="doc-icon">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                                                        </svg>
                                                    </div>
                                                    <span className="doc-name">
                                                        {doc.document_name === 'other'
                                                            ? (doc.custom_name || 'Other')
                                                            : doc.document_name.charAt(0).toUpperCase() + doc.document_name.slice(1)}
                                                    </span>
                                                    <a href={doc.file} target="_blank" rel="noopener noreferrer">View ↗</a>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* New doc entries */}
                                    <div className="doc-new-entries">
                                        {newDocs.map(({ doc, index }) => (
                                            <div key={`new-${index}`} className="doc-entry-card">
                                                {/* Card header: type selector + remove */}
                                                <div className="doc-entry-header">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                                                    </svg>
                                                    <select
                                                        className="doc-type-select"
                                                        value={doc.document_name || 'invoice'}
                                                        onChange={(e) => {
                                                            const updated = [...formDocuments];
                                                            updated[index].document_name = e.target.value;
                                                            if (e.target.value !== 'other') updated[index].custom_name = '';
                                                            setFormDocuments(updated);
                                                        }}
                                                    >
                                                        {availableDocTypes.map(t => (
                                                            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                                                        ))}
                                                        <option value="other">Other…</option>
                                                    </select>
                                                    <button
                                                        type="button"
                                                        className="doc-remove-btn"
                                                        onClick={() => setFormDocuments(formDocuments.filter((_, i) => i !== index))}
                                                        title="Remove"
                                                    >×</button>
                                                </div>

                                                {/* Card body: custom name + file drop */}
                                                <div className="doc-entry-body">
                                                    {doc.document_name === 'other' && (
                                                        <div className="doc-custom-name mb-2">
                                                            <input
                                                                type="text"
                                                                className="form-control"
                                                                placeholder="Document name…"
                                                                value={doc.custom_name || ''}
                                                                onChange={(e) => {
                                                                    const updated = [...formDocuments];
                                                                    updated[index].custom_name = e.target.value;
                                                                    setFormDocuments(updated);
                                                                }}
                                                            />
                                                        </div>
                                                    )}

                                                    {doc.file && typeof doc.file !== 'string' ? (
                                                        <div className="doc-file-selected">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="20 6 9 17 4 12" />
                                                            </svg>
                                                            {doc.file.name}
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const updated = [...formDocuments];
                                                                    updated[index].file = null;
                                                                    setFormDocuments(updated);
                                                                }}
                                                                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#4b7a56', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
                                                            >change</button>
                                                        </div>
                                                    ) : (
                                                        <div className="doc-file-drop">
                                                            <input
                                                                type="file"
                                                                onChange={(e) => {
                                                                    const updated = [...formDocuments];
                                                                    updated[index].file = e.target.files[0];
                                                                    setFormDocuments(updated);
                                                                }}
                                                            />
                                                            <span className="drop-icon">📄</span>
                                                            <div className="drop-label"><strong>Click to upload</strong> or drag & drop</div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Add button */}
                                    <button
                                        type="button"
                                        className="add-doc-btn"
                                        onClick={() => setFormDocuments([...formDocuments, { document_name: 'invoice', file: null, custom_name: '' }])}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                                        </svg>
                                        Add Document
                                    </button>
                                </div>

                                {/* Step 7 */}
                                <SectionHeader step="7" label="Additional Attributes" onAdd={onAddAttributeDefinition ? () => onAddAttributeDefinition(formData.category) : null} />
                                {getInheritedAttributes(formData.category).length > 0 ? (
                                    getInheritedAttributes(formData.category).map(ad => (
                                        <div className="form-group mb-3" key={ad.id}>
                                            <label>{ad.name} {ad.is_required && <span className="text-danger">*</span>}</label>
                                            {ad.field_type === 'text' && (
                                                <input type="text" className="form-control" required={ad.is_required} placeholder={ad.help_text}
                                                    value={(formData.attribute_values && formData.attribute_values[ad.id]) || ''}
                                                    onChange={(e) => setFormData({ ...formData, attribute_values: { ...(formData.attribute_values || {}), [ad.id]: e.target.value } })} />
                                            )}
                                            {ad.field_type === 'number' && (
                                                <input type="number" className="form-control" required={ad.is_required} placeholder={ad.help_text}
                                                    value={(formData.attribute_values && formData.attribute_values[ad.id]) || ''}
                                                    onChange={(e) => setFormData({ ...formData, attribute_values: { ...(formData.attribute_values || {}), [ad.id]: e.target.value } })} />
                                            )}
                                            {ad.field_type === 'date' && (
                                                <input type="date" className="form-control" required={ad.is_required}
                                                    value={(formData.attribute_values && formData.attribute_values[ad.id]) || ''}
                                                    onChange={(e) => setFormData({ ...formData, attribute_values: { ...(formData.attribute_values || {}), [ad.id]: e.target.value } })} />
                                            )}
                                            {ad.field_type === 'boolean' && (
                                                <div className="form-check mt-2">
                                                    <input type="checkbox" className="form-check-input" id={`attr-${ad.id}`}
                                                        checked={(formData.attribute_values && formData.attribute_values[ad.id]) || false}
                                                        onChange={(e) => setFormData({ ...formData, attribute_values: { ...(formData.attribute_values || {}), [ad.id]: e.target.checked } })} />
                                                    <label className="form-check-label" htmlFor={`attr-${ad.id}`}>{ad.help_text || 'Enabled'}</label>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-muted mb-3" style={{ gridColumn: 'span 2', fontSize: '0.82rem' }}>
                                        * No additional attributes defined for this category.
                                    </div>
                                )}

                                {/* Step 8 */}
                                <SectionHeader step="8" label="Description" />
                                <div className="form-group mb-3" style={{ gridColumn: 'span 2' }}>
                                    <textarea className="form-control" rows="2" value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                                </div>
                            </>
                        )}
                    </div>

                    <div className="modal-footer-custom mt-auto">
                        <button type="button" onClick={onCancel} className="btn-close-custom">Close</button>
                        <button type="submit" className="btn-save-custom">{isEditing || formData?.id ? 'Update' : 'Save'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AssetForm;