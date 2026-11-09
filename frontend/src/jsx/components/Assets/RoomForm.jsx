import React, { useState, useEffect } from 'react';
import { getTableConfiguration } from '../../../services/ConfigurationService';

const RoomForm = ({
    formData,
    setFormData,
    onSave,
    onCancel,
    branches,
    departments,
    isEditing
}) => {
    const [formConfig, setFormConfig] = useState(null);
    const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
    const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);

    useEffect(() => {
        getTableConfiguration('assets_storageroom', 'RoomForm')
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
                            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" fill="white"/>
                        </svg>
                    </div>
                    <div>
                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                            {isEditing ? 'Edit Storage Room' : 'Create Storage Room'}
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            Enter details to manage storage room
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
                                <label className="form-label-custom">Room Name <span className="text-danger">*</span></label>
                                <input type="text" className="form-control-custom" placeholder="e.g. South Archive" required
                                    value={formData.name || ''}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                        )}
                        {(!formConfig || formConfig.total_capacity?.show !== false) && (
                            <div className="col-md-6 mb-3">
                                <label className="form-label-custom">Total Capacity</label>
                                <input type="text" className="form-control-custom" placeholder="e.g. 500 sq.ft / 10 cubic volume"
    value={formData.total_capacity || ''}
    onChange={(e) => setFormData({ ...formData, total_capacity: e.target.value })} />
                            </div>
                        )}
                        {(!formConfig || formConfig.location_description?.show !== false) && (
                            <div className="col-md-12 mb-3">
                                <label className="form-label-custom">Location Description</label>
                                <textarea className="form-control-custom" rows="3" placeholder="Additional details..."
                                    value={formData.location_description || ''}
                                    onChange={(e) => setFormData({ ...formData, location_description: e.target.value })} />
                            </div>
                        )}
                        {(!formConfig || formConfig.branch?.show !== false) && (
                            <div className="col-md-6 mb-3" style={{ position: 'relative' }}>
                                <label className="form-label-custom">Branch</label>
                                <div className="custom-select-container">
                                    <div 
                                        className="custom-select-trigger" 
                                        onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                                        tabIndex="0"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                setIsBranchDropdownOpen(!isBranchDropdownOpen);
                                            }
                                        }}
                                    >
                                        <span style={{ color: (branches || []).find(b => String(b.id) === String(formData.branch)) ? '#334155' : '#94a3b8' }}>
                                            {(branches || []).find(b => String(b.id) === String(formData.branch))?.name || 'Select Branch'}
                                        </span>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: isBranchDropdownOpen ? 'rotate(180deg)' : 'none' }}>
                                            <path d="m6 9 6 6 6-6" />
                                        </svg>
                                    </div>
                                    {isBranchDropdownOpen && (
                                        <>
                                            <div 
                                                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1040 }}
                                                onClick={() => setIsBranchDropdownOpen(false)}
                                            />
                                            <div className="custom-select-dropdown">
                                                <div 
                                                    className="custom-select-option custom-select-header-option"
                                                    onClick={() => {
                                                        setFormData({ ...formData, branch: '', department: '' });
                                                        setIsBranchDropdownOpen(false);
                                                    }}
                                                >
                                                    Select Branch
                                                </div>
                                                {(branches || []).map(b => (
                                                    <div 
                                                        key={b.id} 
                                                        className={`custom-select-option ${String(formData.branch) === String(b.id) ? 'selected' : ''}`}
                                                        onClick={() => {
                                                            setFormData({ ...formData, branch: b.id, department: '' });
                                                            setIsBranchDropdownOpen(false);
                                                        }}
                                                    >
                                                        {b.name}
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
                                            if (formData.branch) {
                                                setIsDeptDropdownOpen(!isDeptDropdownOpen);
                                            }
                                        }}
                                        tabIndex={formData.branch ? "0" : "-1"}
                                        style={!formData.branch ? { backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#94a3b8' } : {}}
                                        onKeyDown={(e) => {
                                            if (!formData.branch) return;
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                setIsDeptDropdownOpen(!isDeptDropdownOpen);
                                            }
                                        }}
                                    >
                                        <span style={{ color: (departments || []).find(d => String(d.id) === String(formData.department)) ? '#334155' : '#94a3b8' }}>
                                            {(departments || []).find(d => String(d.id) === String(formData.department))?.name || 'Select Department'}
                                        </span>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: isDeptDropdownOpen ? 'rotate(180deg)' : 'none', opacity: formData.branch ? 1 : 0.5 }}>
                                            <path d="m6 9 6 6 6-6" />
                                        </svg>
                                    </div>
                                    {isDeptDropdownOpen && formData.branch && (
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
                                                    .filter(d => formData.branch && d.branches && d.branches.length > 0 && d.branches.includes(Number(formData.branch)))
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

export default RoomForm;