import React, { useState, useEffect } from 'react';
import { getTableConfiguration } from '../../../services/ConfigurationService';

const AssetAttributeForm = ({
    formData,
    setFormData,
    isEditing,
    onSave,
    onCancel,
    assetCategories,
    attributeDefinitions,
    bulkAttributes,
    setBulkAttributes
}) => {
    const [formConfig, setFormConfig] = useState(null);

    useEffect(() => {
        getTableConfiguration('assets_assetattributedefinition', 'AssetAttributeForm')
            .then(config => {
                if (config) setFormConfig(config.settings);
            })
            .catch(() => setFormConfig({}));
    }, []);

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
                    background-color: #0a500f;
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
                .scfm-modal .modal-body-custom { padding: 24px 28px; }
                .scfm-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .scfm-modal .form-label-custom {
                    font-size: 14px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 8px;
                    display: block;
                }
                .scfm-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 12px 16px;
                    font-size: 14px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .scfm-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .scfm-modal .form-control-custom::placeholder { color: #94a3b8; }
                .scfm-modal .btn-close-custom {
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
                .scfm-modal .btn-close-custom:hover { background-color: #bb2d3b !important; }
                .scfm-modal .btn-save-custom {
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
                .scfm-modal .btn-save-custom:hover { background-color: #073d0b !important; }
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
                            {isEditing ? 'Edit Attribute' : 'Create Attribute'}
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            {isEditing ? 'Update attribute details' : 'Define new attributes for category'}
                        </p>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={onCancel}>&times;</button>
            </div>

            <form onSubmit={onSave} className="d-flex flex-column flex-grow-1">
                <div className="modal-body-custom flex-grow-1">
                    <div className="row">
                        {(!formConfig || formConfig.category?.show !== false) && (
                        <div className="col-md-12 mb-3">
                            <label className="form-label-custom">Target Asset Category <span className="text-danger">*</span></label>
                            <select className="form-control-custom" required value={formData.category || ''}
                                disabled={isEditing}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                                <option value="">Select Category</option>
                                {assetCategories.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        )}
                    </div>

                    {formData.category && !isEditing ? (
                        <div className="mt-3">
                            <div className="form-group mb-3">
                                <label className="form-label-custom">Currently Defined Attributes</label>
                                <div className="d-flex flex-wrap gap-2">
                                    {attributeDefinitions.filter(a => String(a.category) === String(formData.category)).length > 0 ? (
                                        attributeDefinitions.filter(a => String(a.category) === String(formData.category)).map(a => (
                                            <span key={a.id} className="badge bg-white border text-secondary shadow-sm" style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '6px' }}>
                                                <strong className="text-dark">{a.name}</strong> <small className="text-muted ms-1">({a.field_type})</small>
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-muted small">No attributes defined yet for this category.</span>
                                    )}
                                </div>
                            </div>

                            <div className="table-responsive">
                                <table className="fd-table align-middle" style={{ width: '100%' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ fontSize: '12px', color: '#4a5568', fontWeight: '700', borderBottom: '1.5px solid #e2e8f0', padding: '10px 8px' }}>ATTRIBUTE NAME</th>
                                            <th style={{ fontSize: '12px', color: '#4a5568', fontWeight: '700', borderBottom: '1.5px solid #e2e8f0', padding: '10px 8px', width: '140px' }}>FIELD TYPE</th>
                                            <th className="text-center" style={{ fontSize: '12px', color: '#4a5568', fontWeight: '700', borderBottom: '1.5px solid #e2e8f0', padding: '10px 8px', width: '60px' }}>REQ?</th>
                                            <th style={{ fontSize: '12px', color: '#4a5568', fontWeight: '700', borderBottom: '1.5px solid #e2e8f0', padding: '10px 8px' }}>PLACEHOLDER / HELP TEXT</th>
                                            <th className="text-center" style={{ fontSize: '12px', color: '#4a5568', fontWeight: '700', borderBottom: '1.5px solid #e2e8f0', padding: '10px 8px', width: '90px' }}>ORDER</th>
                                            <th style={{ borderBottom: '1.5px solid #e2e8f0', width: '40px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bulkAttributes.map((attr, idx) => (
                                            <tr key={idx}>
                                                <td style={{ padding: '8px' }}>
                                                    <input type="text" className="form-control-custom" placeholder="e.g. Memory Size"
                                                        value={attr.name} onChange={(e) => {
                                                            const updated = [...bulkAttributes];
                                                            updated[idx].name = e.target.value;
                                                            setBulkAttributes(updated);
                                                        }} />
                                                </td>
                                                <td style={{ padding: '8px' }}>
                                                    <select className="form-control-custom"
                                                        value={attr.field_type} onChange={(e) => {
                                                            const updated = [...bulkAttributes];
                                                            updated[idx].field_type = e.target.value;
                                                            setBulkAttributes(updated);
                                                        }}>
                                                        <option value="text">Text</option>
                                                        <option value="number">Number</option>
                                                        <option value="date">Date</option>
                                                        <option value="boolean">Boolean</option>
                                                        <option value="file">File</option>
                                                    </select>
                                                </td>
                                                <td className="text-center" style={{ padding: '8px' }}>
                                                    <input type="checkbox" className="form-check-input mt-0" checked={attr.is_required}
                                                        onChange={(e) => {
                                                            const updated = [...bulkAttributes];
                                                            updated[idx].is_required = e.target.checked;
                                                            setBulkAttributes(updated);
                                                        }} />
                                                </td>
                                                <td style={{ padding: '8px' }}>
                                                    <input type="text" className="form-control-custom" placeholder="e.g. Enter amount in GB"
                                                        value={attr.help_text} onChange={(e) => {
                                                            const updated = [...bulkAttributes];
                                                            updated[idx].help_text = e.target.value;
                                                            setBulkAttributes(updated);
                                                        }} />
                                                </td>
                                                <td className="text-center" style={{ padding: '8px' }}>
                                                    <input type="number" className="form-control-custom text-center"
                                                        value={attr.display_order} onChange={(e) => {
                                                            const updated = [...bulkAttributes];
                                                            updated[idx].display_order = parseInt(e.target.value) || 0;
                                                            setBulkAttributes(updated);
                                                        }} />
                                                </td>
                                                <td className="text-center" style={{ padding: '8px' }}>
                                                    {bulkAttributes.length > 1 && (
                                                        <button type="button" className="btn btn-sm btn-light border text-danger shadow-none" style={{ borderRadius: '6px', width: '32px', height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0' }} onClick={() => setBulkAttributes(bulkAttributes.filter((_, i) => i !== idx))}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-3">
                                <button type="button" className="btn btn-sm btn-outline-success px-3 shadow-none" style={{ borderRadius: '8px', fontWeight: '500' }}
                                    onClick={() => setBulkAttributes([...bulkAttributes, {
                                        name: '',
                                        field_type: 'text',
                                        is_required: false,
                                        is_active: true,
                                        display_order: attributeDefinitions.filter(a => String(a.category) === String(formData.category)).length + bulkAttributes.length,
                                        help_text: ''
                                    }])}>
                                    + Add Another Attribute field
                                </button>
                            </div>
                        </div>
                    ) : isEditing ? (
                        <div className="row mt-3">
                            <div className="col-md-6 mb-3">
                                <label className="form-label-custom">Attribute Name <span className="text-danger">*</span></label>
                                <input type="text" className="form-control-custom" required
                                    value={formData.name || ''}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label className="form-label-custom">Field Type <span className="text-danger">*</span></label>
                                <select className="form-control-custom" required
                                    value={formData.field_type || ''} onChange={(e) => setFormData({ ...formData, field_type: e.target.value })}>
                                    <option value="">Select</option>
                                    <option value="text">Text</option>
                                    <option value="number">Number</option>
                                    <option value="date">Date</option>
                                    <option value="boolean">Boolean</option>
                                    <option value="file">File</option>
                                </select>
                            </div>
                            <div className="col-md-6 mb-3">
                                <label className="form-label-custom">Order</label>
                                <input type="number" className="form-control-custom"
                                    value={formData.display_order || 0} onChange={(e) => setFormData({ ...formData, display_order: e.target.value })} />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label className="form-label-custom">Placeholder / Helper Text</label>
                                <input type="text" className="form-control-custom"
                                    value={formData.help_text || ''} onChange={(e) => setFormData({ ...formData, help_text: e.target.value })} />
                            </div>

                            <div className="col-md-12 d-flex align-items-center gap-4 mt-2">
                                <div className="d-flex align-items-center gap-2">
                                    <input type="checkbox" id="isRequiredAttr" className="form-check-input mt-0"
                                        checked={formData.is_required || false}
                                        onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })} />
                                    <label htmlFor="isRequiredAttr" className="mb-0 form-label-custom" style={{ margin: 0 }}>Required</label>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                    <input type="checkbox" id="isActiveAttr" className="form-check-input mt-0"
                                        checked={formData.is_active !== undefined ? formData.is_active : true}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} />
                                    <label htmlFor="isActiveAttr" className="mb-0 form-label-custom" style={{ margin: 0 }}>Active</label>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-muted small mt-3">
                            Please select an asset category to start adding attribute definitions.
                        </div>
                    )}
                </div>

                <div className="modal-footer-custom mt-auto">
                    <button type="button" onClick={onCancel} className="btn-close-custom">Close</button>
                    <button type="submit" className="btn-save-custom">{isEditing ? 'Update' : 'Save'}</button>
                </div>
            </form>
        </div>
    );
};

export default AssetAttributeForm;