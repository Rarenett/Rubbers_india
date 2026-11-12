import React, { useState, useEffect } from 'react';
import { getTableConfiguration } from '../../../services/ConfigurationService';

const ShelfForm = ({
    formData,
    setFormData,
    onSave,
    onCancel,
    rooms
}) => {
    const [formConfig, setFormConfig] = useState(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const editMode = !!formData?.id;

    useEffect(() => {
        getTableConfiguration('assets_shelf', 'ShelfForm')
            .then(config => {
                if (config) setFormConfig(config.settings);
            })
            .catch(() => setFormConfig({}));
    }, []);

    return (
        <div className="sfm-modal w-100 h-100 d-flex flex-column" style={{ borderRadius: '16px', overflow: 'hidden', background: '#ffffff', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}>
            <style>{`
                .sfm-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .sfm-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: var(--form-icon-color, #0a500f);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .sfm-modal .modal-close-x {
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
                .sfm-modal .modal-close-x:hover { color: #555; }
                .sfm-modal .modal-body-custom { padding: 24px 28px; }
                .sfm-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .sfm-modal .form-label-custom {
                    font-size: 14px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 8px;
                    display: block;
                }
                .sfm-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 12px 16px;
                    font-size: 14px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .sfm-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .sfm-modal .form-control-custom::placeholder { color: #94a3b8; }
                .sfm-modal .btn-close-custom {
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
                .sfm-modal .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .sfm-modal .btn-save-custom {
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
                .sfm-modal .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }

                .sfm-modal .custom-select-container {
                    position: relative;
                    width: 100%;
                }
                .sfm-modal .custom-select-trigger {
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
                .sfm-modal .custom-select-trigger:focus-within {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .sfm-modal .custom-select-dropdown {
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
                .sfm-modal .custom-select-option {
                    padding: 10px 16px;
                    font-size: 14px;
                    color: #334155;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .sfm-modal .custom-select-option:hover {
                    background-color: #f1f5f9;
                }
                .sfm-modal .custom-select-option.selected {
                    background-color: #e2e8f0;
                    font-weight: 500;
                }
                .sfm-modal .custom-select-header-option {
                    background-color: #fafbfc;
                    border-bottom: 1px solid #f1f5f9;
                    color: #94a3b8;
                }
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
                            {editMode ? 'Edit Shelf' : 'Create Shelf'}
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            Enter details to manage shelf
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
                                <label className="form-label-custom">Shelf Name <span className="text-danger">*</span></label>
                                <input type="text" className="form-control-custom" placeholder="e.g. Shelf A1" required
                                    value={formData.name || ''}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                        )}
                        {(!formConfig || formConfig.room?.show !== false) && (
                            <div className="col-md-6 mb-3" style={{ position: 'relative' }}>
                                <label className="form-label-custom">Room <span className="text-danger">*</span></label>
                                <div className="custom-select-container">
                                    <div 
                                        className="custom-select-trigger" 
                                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                        tabIndex="0"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                setIsDropdownOpen(!isDropdownOpen);
                                            }
                                        }}
                                    >
                                        <span style={{ color: (rooms || []).find(r => String(r.id) === String(formData.room)) ? '#334155' : '#94a3b8' }}>
                                            {(rooms || []).find(r => String(r.id) === String(formData.room))?.name || 'Select Room'}
                                        </span>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: isDropdownOpen ? 'rotate(180deg)' : 'none' }}>
                                            <path d="m6 9 6 6 6-6" />
                                        </svg>
                                    </div>
                                    <input 
                                        type="text" 
                                        required 
                                        tabIndex="-1"
                                        style={{ opacity: 0, position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
                                        value={formData.room || ''}
                                        onChange={() => {}}
                                    />
                                    {isDropdownOpen && (
                                        <>
                                            <div 
                                                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1040 }}
                                                onClick={() => setIsDropdownOpen(false)}
                                            />
                                            <div className="custom-select-dropdown">
                                                <div 
                                                    className="custom-select-option custom-select-header-option"
                                                    onClick={() => {
                                                        setFormData({ ...formData, room: '' });
                                                        setIsDropdownOpen(false);
                                                    }}
                                                >
                                                    Select Room
                                                </div>
                                                {(rooms || []).map(r => (
                                                    <div 
                                                        key={r.id} 
                                                        className={`custom-select-option ${String(formData.room) === String(r.id) ? 'selected' : ''}`}
                                                        onClick={() => {
                                                            setFormData({ ...formData, room: r.id });
                                                            setIsDropdownOpen(false);
                                                        }}
                                                    >
                                                        {r.name}
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
                    <button type="submit" className="btn-save-custom">{editMode ? 'Update' : 'Save'}</button>
                </div>
            </form>
        </div>
    );
};

export default ShelfForm;