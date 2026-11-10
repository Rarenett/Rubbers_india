import React, { useState, useEffect } from 'react';
import { getTableConfiguration } from '../../../services/ConfigurationService';

const AssetCategoryForm = ({
    formData,
    setFormData,
    onSave,
    onCancel,
    assetTypes,
    assetCategories,
    users,
    selectedId,
    onAddAssetType
}) => {
    const [formConfig, setFormConfig] = useState(null);
    const editMode = !!formData?.id;

    useEffect(() => {
        getTableConfiguration('assets_assetcategory', 'AssetCategoryForm')
            .then(config => {
                if (config) setFormConfig(config.settings);
            })
            .catch(() => setFormConfig({}));
    }, []);

    const getDescendantIds = (parentId, categories) => {
        let descendants = [];
        const children = categories.filter(c => String(c.parent) === String(parentId));
        children.forEach(child => {
            descendants.push(String(child.id));
            descendants = descendants.concat(getDescendantIds(child.id, categories));
        });
        return descendants;
    };

    const invalidParentIds = formData.id ? [String(formData.id), ...getDescendantIds(formData.id, assetCategories)] : [];

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
                            {editMode ? 'Edit Asset Category' : 'Create Asset Category'}
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            Enter details to manage asset category
                        </p>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={onCancel}>&times;</button>
            </div>

            <form onSubmit={onSave} className="d-flex flex-column flex-grow-1">
                <div className="modal-body-custom flex-grow-1">
                    <div className="row">
                        {(!formConfig || formConfig.name?.show !== false) && (
                            <div className="col-md-6 mb-3">
                                <label className="form-label-custom">Category Name <span className="text-danger">*</span></label>
                                <input type="text" className="form-control-custom" placeholder="e.g. Laptops" required
                                    value={formData.name || ''}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                        )}
                        {(!formConfig || formConfig.asset_type?.show !== false) && (
                            <div className="col-md-6 mb-3">
                                <label className="form-label-custom">Asset Type <span className="text-danger">*</span></label>
                                <div className="d-flex gap-2">
                                    <select className="form-control-custom" required value={formData.asset_type || ''} onChange={(e) => setFormData({ ...formData, asset_type: e.target.value })}>
                                        <option value="">Select Type</option>
                                        {assetTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                    {onAddAssetType && (
                                        <button type="button" className="btn btn-primary px-3 shadow-none" style={{ borderRadius: '10px' }} onClick={onAddAssetType} title="Add Asset Type">
                                            <i className="fa fa-plus"></i>
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                        {(!formConfig || formConfig.parent?.show !== false) && (
                            <div className="col-md-6 mb-3">
                                <label className="form-label-custom">Parent Category</label>
                                <select className="form-control-custom" value={formData.parent || ''} onChange={(e) => setFormData({ ...formData, parent: e.target.value || null })}>
                                    <option value="">None (Top Level)</option>
                                    {assetCategories.filter(c => !invalidParentIds.includes(String(c.id))).map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {(!formConfig || formConfig.code_prefix?.show !== false) && (
                            <div className="col-md-6 mb-3">
                                <label className="form-label-custom">Code Prefix</label>
                                <input type="text" className="form-control-custom" placeholder="e.g. LAP"
                                    value={formData.code_prefix || ''}
                                    onChange={(e) => setFormData({ ...formData, code_prefix: e.target.value })} />
                            </div>
                        )}
                        {(!formConfig || formConfig.default_incharge?.show !== false) && (
                            <div className="col-md-6 mb-3">
                                <label className="form-label-custom">Default Incharge</label>
                                <select className="form-control-custom" value={formData.default_incharge || ''} onChange={(e) => setFormData({ ...formData, default_incharge: e.target.value })}>
                                    <option value="">Select User</option>
                                    {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                                </select>
                            </div>
                        )}
                        {(!formConfig || formConfig.is_active?.show !== false) && (
                            <div className="col-md-6 mb-3 d-flex align-items-center gap-2" style={{ paddingTop: '28px' }}>
                                <input type="checkbox" id="isActiveCat" className="form-check-input mt-0"
                                    checked={formData.is_active !== undefined ? formData.is_active : true}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} />
                                <label htmlFor="isActiveCat" className="mb-0 form-label-custom" style={{ margin: 0 }}>Active</label>
                            </div>
                        )}

                        <div className="col-md-12 mb-3">
                            <label className="form-label-custom" style={{ marginBottom: '12px' }}>Options</label>
                            <div className="d-flex flex-wrap gap-4">
                                {(!formConfig || formConfig.is_repairable?.show !== false) && (
                                    <div className="d-flex align-items-center gap-2">
                                        <input type="checkbox" id="isRepairable" className="form-check-input mt-0"
                                            checked={formData.is_repairable || false}
                                            onChange={(e) => setFormData({ ...formData, is_repairable: e.target.checked })} />
                                        <label htmlFor="isRepairable" className="mb-0" style={{ fontSize: '13px' }}>Repairable</label>
                                    </div>
                                )}
                                {(!formConfig || formConfig.is_maintainable?.show !== false) && (
                                    <div className="d-flex align-items-center gap-2">
                                        <input type="checkbox" id="isMaintainable" className="form-check-input mt-0"
                                            checked={formData.is_maintainable || false}
                                            onChange={(e) => setFormData({ ...formData, is_maintainable: e.target.checked })} />
                                        <label htmlFor="isMaintainable" className="mb-0" style={{ fontSize: '13px' }}>Maintainable</label>
                                    </div>
                                )}
                                {(!formConfig || formConfig.is_allocatable?.show !== false) && (
                                    <div className="d-flex align-items-center gap-2">
                                        <input type="checkbox" id="isAllocatable" className="form-check-input mt-0"
                                            checked={formData.is_allocatable !== undefined ? formData.is_allocatable : true}
                                            onChange={(e) => setFormData({ ...formData, is_allocatable: e.target.checked })} />
                                        <label htmlFor="isAllocatable" className="mb-0" style={{ fontSize: '13px' }}>Allocatable</label>
                                    </div>
                                )}
                                {(!formConfig || formConfig.is_location_asset?.show !== false) && (
                                    <div className="d-flex align-items-center gap-2">
                                        <input type="checkbox" id="isLocationAsset" className="form-check-input mt-0"
                                            checked={formData.is_location_asset || false}
                                            onChange={(e) => setFormData({ ...formData, is_location_asset: e.target.checked })} />
                                        <label htmlFor="isLocationAsset" className="mb-0" style={{ fontSize: '13px' }}>Location Asset</label>
                                    </div>
                                )}
                                {(!formConfig || formConfig.is_renewable?.show !== false) && (
                                    <div className="d-flex align-items-center gap-2">
                                        <input type="checkbox" id="isRenewable" className="form-check-input mt-0"
                                            checked={formData.is_renewable || false}
                                            onChange={(e) => setFormData({ ...formData, is_renewable: e.target.checked })} />
                                        <label htmlFor="isRenewable" className="mb-0" style={{ fontSize: '13px' }}>Renewable</label>
                                    </div>
                                )}
                            </div>
                        </div>

                        {(!formConfig || formConfig.description?.show !== false) && (
                            <div className="col-md-12 mb-3">
                                <label className="form-label-custom">Description</label>
                                <textarea className="form-control-custom" rows="2" placeholder="Describe this category..."
                                    value={formData.description || ''}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                            </div>
                        )}
                    </div>
                </div>

                <div className="modal-footer-custom mt-auto">
                    <button type="button" onClick={onCancel} className="btn-close-custom">Close</button>
                    <button type="submit" className="btn-save-custom">{editMode ? 'Update' : 'Save'}</button>
                </div>
            </form>
        </div>
    );
};

export default AssetCategoryForm;
