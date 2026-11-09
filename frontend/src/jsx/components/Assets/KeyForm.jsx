import React, { useState, useEffect } from 'react';
import { getTableConfiguration } from '../../../services/ConfigurationService';

const KeyForm = ({
    formData,
    setFormData,
    onSave,
    onCancel,
    departments = [],
    assetTypes,
    racks = [],
    rooms = [],
    shelves = [],
    isEditing
}) => {
    const [formConfig, setFormConfig] = useState(null);
    const [isRackDropdownOpen, setIsRackDropdownOpen] = useState(false);
    const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
    const [isAssetTypeDropdownOpen, setIsAssetTypeDropdownOpen] = useState(false);

    useEffect(() => {
        getTableConfiguration('assets_key', 'KeyForm')
            .then(config => {
                if (config) setFormConfig(config.settings);
            })
            .catch(() => setFormConfig({}));
    }, []);

    const selectedRack = formData.rack ? racks.find(r => r.id === Number(formData.rack)) : null;
    const selectedShelf = selectedRack ? shelves.find(s => s.id === selectedRack.shelf) : null;
    const selectedRoom = selectedShelf ? rooms.find(r => r.id === selectedShelf.room) : null;
    const currentBranchId = selectedRoom ? selectedRoom.branch : null;

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
                    background-color: #2ece8a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
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
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                }
                .scfm-modal .form-control-custom::placeholder { color: #94a3b8; }
                .scfm-modal .btn-close-custom {
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
                .scfm-modal .btn-close-custom:hover { background-color: #6357a7 !important; }
                .scfm-modal .btn-save-custom {
                    background-color: #2ece8a !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .scfm-modal .btn-save-custom:hover { background-color: #26b277 !important; }

                .scfm-modal .custom-select-container {
                    position: relative;
                    width: 100%;
                }
                .scfm-modal .custom-select-trigger {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 12px 16px;
                    font-size: 14px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                    cursor: pointer;
                    height: 48px;
                }
                .scfm-modal .custom-select-trigger:focus-within {
                    outline: none;
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                }
                .scfm-modal .custom-select-dropdown {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    background-color: #fff;
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    margin-top: 4px;
                    max-height: 200px;
                    overflow-y: auto;
                    z-index: 1050;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                }
                .scfm-modal .custom-select-option {
                    padding: 10px 16px;
                    font-size: 14px;
                    color: #334155;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .scfm-modal .custom-select-option:hover {
                    background-color: #f1f5f9;
                }
                .scfm-modal .custom-select-option.selected {
                    background-color: #e2e8f0;
                    font-weight: 500;
                }
                .scfm-modal .custom-select-header-option {
                    background-color: #fafbfc;
                    border-bottom: 1px solid #f1f5f9;
                    color: #94a3b8;
                }
            `}</style>

            <div className="modal-header-custom">
                <div className="d-flex align-items-center gap-3">
                    <div className="modal-icon-circle">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </div>
                    <div>
                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                            {isEditing ? 'Edit Key' : 'Create Key'}
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            Enter details to manage key record
                        </p>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={onCancel}>&times;</button>
            </div>

            <form onSubmit={onSave} className="d-flex flex-column flex-grow-1">
                <div className="modal-body-custom flex-grow-1">
                    <div className="row">
                        {(!formConfig || formConfig.key_name?.show !== false) && (
                            <div className="col-md-6 mb-3">
                                <label className="form-label-custom">Key Name <span className="text-danger">*</span></label>
                                <input type="text" className="form-control-custom" placeholder="e.g. Server Room Key" required
                                    value={formData.key_name || ''}
                                    onChange={(e) => setFormData({ ...formData, key_name: e.target.value })} />
                            </div>
                        )}
                        {(!formConfig || formConfig.rack?.show !== false) && (
                            <div className="col-md-6 mb-3" style={{ position: 'relative' }}>
                                <label className="form-label-custom">Rack/Slot (Optional)</label>
                                <div className="custom-select-container">
                                    <div 
                                        className="custom-select-trigger" 
                                        onClick={() => setIsRackDropdownOpen(!isRackDropdownOpen)}
                                        tabIndex="0"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                setIsRackDropdownOpen(!isRackDropdownOpen);
                                            }
                                        }}
                                    >
                                        <span style={{ color: (racks || []).find(rk => String(rk.id) === String(formData.rack)) ? '#334155' : '#94a3b8' }}>
                                            {(racks || []).find(rk => String(rk.id) === String(formData.rack))?.name || 'Select Rack'}
                                        </span>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: isRackDropdownOpen ? 'rotate(180deg)' : 'none' }}>
                                            <path d="m6 9 6 6 6-6" />
                                        </svg>
                                    </div>
                                    {isRackDropdownOpen && (
                                        <>
                                            <div 
                                                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1040 }}
                                                onClick={() => setIsRackDropdownOpen(false)}
                                            />
                                            <div className="custom-select-dropdown">
                                                <div 
                                                    className="custom-select-option custom-select-header-option"
                                                    onClick={() => {
                                                        setFormData({ ...formData, rack: '' });
                                                        setIsRackDropdownOpen(false);
                                                    }}
                                                >
                                                    Select Rack
                                                </div>
                                                {(racks || []).map(rk => (
                                                    <div 
                                                        key={rk.id} 
                                                        className={`custom-select-option ${String(formData.rack) === String(rk.id) ? 'selected' : ''}`}
                                                        onClick={() => {
                                                            setFormData({ ...formData, rack: rk.id });
                                                            setIsRackDropdownOpen(false);
                                                        }}
                                                    >
                                                        {rk.name}
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                        {(!formConfig || formConfig.department?.show !== false) && (
                            <div className="col-md-6 mb-3" style={{ position: 'relative' }}>
                                <label className="form-label-custom">Department (Optional)</label>
                                <div className="custom-select-container">
                                    <div 
                                        className="custom-select-trigger" 
                                        onClick={() => {
                                            if (currentBranchId) {
                                                setIsDeptDropdownOpen(!isDeptDropdownOpen);
                                            }
                                        }}
                                        tabIndex={currentBranchId ? "0" : "-1"}
                                        style={!currentBranchId ? { backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#94a3b8' } : {}}
                                        onKeyDown={(e) => {
                                            if (!currentBranchId) return;
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                setIsDeptDropdownOpen(!isDeptDropdownOpen);
                                            }
                                        }}
                                    >
                                        <span style={{ color: (departments || []).find(d => String(d.id) === String(formData.department)) ? '#334155' : '#94a3b8' }}>
                                            {(departments || []).find(d => String(d.id) === String(formData.department))?.name || 'Select Department'}
                                        </span>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: isDeptDropdownOpen ? 'rotate(180deg)' : 'none', opacity: currentBranchId ? 1 : 0.5 }}>
                                            <path d="m6 9 6 6 6-6" />
                                        </svg>
                                    </div>
                                    {isDeptDropdownOpen && currentBranchId && (
                                        <>
                                            <div 
                                                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1040 }}
                                                onClick={() => setIsDeptDropdownOpen(false)}
                                            />
                                            <div className="custom-select-dropdown">
                                                <div 
                                                    className="custom-select-option custom-select-header-option"
                                                    onClick={() => {
                                                        setFormData({ ...formData, department: '' });
                                                        setIsDeptDropdownOpen(false);
                                                    }}
                                                >
                                                    Select Department
                                                </div>
                                                {(departments || [])
                                                    .filter(d => currentBranchId && d.branches && d.branches.length > 0 && d.branches.includes(Number(currentBranchId)))
                                                    .map(d => (
                                                        <div 
                                                            key={d.id} 
                                                            className={`custom-select-option ${String(formData.department) === String(d.id) ? 'selected' : ''}`}
                                                            onClick={() => {
                                                                setFormData({ ...formData, department: d.id });
                                                                setIsDeptDropdownOpen(false);
                                                            }}
                                                        >
                                                            {d.name}
                                                        </div>
                                                    ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                        {(!formConfig || formConfig.asset_type?.show !== false) && (
                            <div className="col-md-6 mb-3" style={{ position: 'relative' }}>
                                <label className="form-label-custom">Asset Type (Optional)</label>
                                <div className="custom-select-container">
                                    <div 
                                        className="custom-select-trigger" 
                                        onClick={() => setIsAssetTypeDropdownOpen(!isAssetTypeDropdownOpen)}
                                        tabIndex="0"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                setIsAssetTypeDropdownOpen(!isAssetTypeDropdownOpen);
                                            }
                                        }}
                                    >
                                        <span style={{ color: (assetTypes || []).find(t => String(t.id) === String(formData.asset_type)) ? '#334155' : '#94a3b8' }}>
                                            {(assetTypes || []).find(t => String(t.id) === String(formData.asset_type))?.name || 'Select Type'}
                                        </span>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: isAssetTypeDropdownOpen ? 'rotate(180deg)' : 'none' }}>
                                            <path d="m6 9 6 6 6-6" />
                                        </svg>
                                    </div>
                                    {isAssetTypeDropdownOpen && (
                                        <>
                                            <div 
                                                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1040 }}
                                                onClick={() => setIsAssetTypeDropdownOpen(false)}
                                            />
                                            <div className="custom-select-dropdown">
                                                <div 
                                                    className="custom-select-option custom-select-header-option"
                                                    onClick={() => {
                                                        setFormData({ ...formData, asset_type: '' });
                                                        setIsAssetTypeDropdownOpen(false);
                                                    }}
                                                >
                                                    Select Type
                                                </div>
                                                {(assetTypes || []).map(t => (
                                                    <div 
                                                        key={t.id} 
                                                        className={`custom-select-option ${String(formData.asset_type) === String(t.id) ? 'selected' : ''}`}
                                                        onClick={() => {
                                                            setFormData({ ...formData, asset_type: t.id });
                                                            setIsAssetTypeDropdownOpen(false);
                                                        }}
                                                    >
                                                        {t.name}
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                        {(!formConfig || formConfig.description?.show !== false) && (
                            <div className="col-md-12 mb-3">
                                <label className="form-label-custom">Description (Optional)</label>
                                <textarea className="form-control-custom" rows="3" placeholder="Additional details..."
                                    value={formData.description || ''}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                            </div>
                        )}
                    </div>
                </div>

                <div className="modal-footer-custom mt-auto">
                    <button type="button" onClick={onCancel} className="btn-close-custom">Close</button>
                    <button type="submit" className="btn-save-custom">{isEditing ? 'Update' : 'Save'}</button>
                </div>
            </form>
        </div>
    );
};

export default KeyForm;
