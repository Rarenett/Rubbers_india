import React, { useState, useEffect } from 'react';
import { getTableConfiguration } from '../../../services/ConfigurationService';

const AssetTypeForm = ({
    formData,
    setFormData,
    onSave,
    onCancel
}) => {
    const [formConfig, setFormConfig] = useState(null);
    const editMode = !!formData?.id;

    useEffect(() => {
        getTableConfiguration('assets_assettype', 'AssetTypeForm')
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
                            {editMode ? 'Edit Asset Type' : 'Create Asset Type'}
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            Enter details to manage asset type
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
                                <label className="form-label-custom">Type Name <span className="text-danger">*</span></label>
                                <input type="text" className="form-control-custom" placeholder="e.g. IT Equipment" required
                                    value={formData.name || ''}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                        )}
                        {(!formConfig || formConfig.code_prefix?.show !== false) && (
                            <div className="col-md-6 mb-3">
                                <label className="form-label-custom">Code Prefix</label>
                                <input type="text" className="form-control-custom" placeholder="e.g. IT"
                                    value={formData.code_prefix || ''}
                                    onChange={(e) => setFormData({ ...formData, code_prefix: e.target.value })} />
                            </div>
                        )}
                        {(!formConfig || formConfig.description?.show !== false) && (
                            <div className="col-md-12 mb-3">
                                <label className="form-label-custom">Description</label>
                                <textarea className="form-control-custom" rows="2" placeholder="Describe this asset type..."
                                    value={formData.description || ''}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                            </div>
                        )}
                        {(!formConfig || formConfig.is_active?.show !== false) && (
                            <div className="col-md-12 mb-3 d-flex align-items-center gap-2">
                                <input type="checkbox" id="isActiveType" className="form-check-input mt-0"
                                    checked={formData.is_active !== undefined ? formData.is_active : true}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} />
                                <label htmlFor="isActiveType" className="mb-0 form-label-custom" style={{ margin: 0 }}>Active</label>
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

export default AssetTypeForm;
