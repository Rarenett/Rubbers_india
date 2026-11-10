import React from 'react';
import Select from 'react-select';

const AssetAllocationModals = ({
    activeManagement,
    showAllocateModal,
    setShowAllocateModal,
    showReturnModal,
    setShowReturnModal,
    showReallocateModal,
    setShowReallocateModal,
    selectedFile,
    selectedAllocation,
    allocateFormData,
    setAllocateFormData,
    handleAllocateSubmit,
    returnFormData,
    setReturnFormData,
    handleReturnSubmit,
    reallocateFormData,
    setReallocateFormData,
    handleReallocateSubmit,
    users,
    departments,
    availableFiles,
    availableKeys,
    availableITAssets,
    localMinDateTime
}) => {
    const userOptions = (users || []).map(u => {
        const dept = u.department?.name || u.department_name || 'N/A';
        const desig = u.designation?.title || u.designation?.name || u.designation_name || '';
        return {
            value: u.id,
            label: `${u.first_name || ''} ${u.last_name || ''} (${dept}${desig ? ' - ' + desig : ''})`
        };
    });

    const customSelectStyles = {
        control: (provided, state) => ({
            ...provided,
            backgroundColor: '#ffffff',
            borderColor: state.isFocused ? '#0a500f' : '#cbd5e1',
            borderRadius: '10px',
            minHeight: '46px',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 80, 15, 0.15)' : 'none',
            fontSize: '14px',
            color: '#334155',
            transition: 'border-color 0.2s, box-shadow 0.2s',
            '&:hover': {
                borderColor: state.isFocused ? '#0a500f' : '#cbd5e1',
            }
        }),
        valueContainer: (provided) => ({
            ...provided,
            padding: '0 16px',
        }),
        singleValue: (provided) => ({
            ...provided,
            color: '#334155',
        }),
        placeholder: (provided) => ({
            ...provided,
            color: '#94a3b8',
        }),
        menu: (provided) => ({
            ...provided,
            borderRadius: '10px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            zIndex: 9999,
            overflow: 'hidden'
        }),
        option: (provided, state) => ({
            ...provided,
            fontSize: '14px',
            backgroundColor: state.isSelected 
                ? '#0a500f' 
                : state.isFocused 
                    ? '#f1f5f9' 
                    : 'transparent',
            color: state.isSelected 
                ? '#ffffff' 
                : '#334155',
            '&:active': {
                backgroundColor: '#0a500f',
                color: '#ffffff'
            }
        })
    };

    const getModalTitle = () => {
        if (activeManagement.startsWith('Key')) return 'Key';
        if (activeManagement === 'File' || activeManagement === 'Allocation') return 'File';
        return 'Asset';
    };

    const getAvailableAssets = () => {
        if (activeManagement.startsWith('Key')) return availableKeys;
        if (activeManagement === 'File' || activeManagement === 'Allocation') return availableFiles;
        return availableITAssets || [];
    };

    const getAssetName = (asset) => {
        if (!asset) return '';
        return asset.file_name || asset.key_name || asset.name || asset.asset_code || 'Unnamed Asset';
    };

    const styles = `
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
        .scfm-modal .modal-icon-circle.return {
            background-color: #f59e0b;
            box-shadow: 0 4px 10px rgba(245, 158, 11, 0.2);
        }
        .scfm-modal .modal-icon-circle.reallocate {
            background-color: #3b82f6;
            box-shadow: 0 4px 10px rgba(59, 130, 246, 0.2);
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
        .scfm-modal .btn-save-custom.return { background-color: #f59e0b !important; }
        .scfm-modal .btn-save-custom.return:hover { background-color: #d97706 !important; }
        .scfm-modal .btn-save-custom.reallocate { background-color: #3b82f6 !important; }
        .scfm-modal .btn-save-custom.reallocate:hover { background-color: #2563eb !important; }
        .scfm-modal .selection-box {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 16px;
            margin-bottom: 24px;
            display: flex;
            align-items: center;
            gap: 12px;
        }
    `;

    return (
        <>
            <style>{styles}</style>
            
            {/* Allocate Modal */}
            {showAllocateModal && (
                <div className="fd-modal-overlay" style={{ zIndex: 1050 }}>
                    <div className="fd-modal-content" style={{ padding: 0, maxWidth: '600px', borderRadius: '16px', overflow: 'hidden' }}>
                        <div className="scfm-modal w-100 h-100 d-flex flex-column">
                            <div className="modal-header-custom bg-white">
                                <div className="d-flex align-items-center gap-3">
                                    <div className="modal-icon-circle">
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M12 4v16m8-8H4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                            Allocate {getModalTitle()}
                                        </h4>
                                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                            Assign {getModalTitle().toLowerCase()} to a user or department
                                        </p>
                                    </div>
                                </div>
                                <button type="button" className="modal-close-x" onClick={() => setShowAllocateModal(false)}>&times;</button>
                            </div>

                            <form onSubmit={handleAllocateSubmit} className="d-flex flex-column flex-grow-1">
                                <div className="modal-body-custom flex-grow-1">
                                    {selectedFile && (
                                        <div className="selection-box">
                                            <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(10, 80, 15, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0a500f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="9 11 12 14 22 4"></polyline>
                                                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                                                </svg>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500', marginBottom: '2px' }}>Selected {getModalTitle()}</div>
                                                <div style={{ fontSize: '15px', color: '#0f172a', fontWeight: '600' }}>{getAssetName(selectedFile)}</div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="row">
                                        {!selectedFile && (
                                            <div className="col-md-12 mb-3">
                                                <label className="form-label-custom">Select {getModalTitle()} To Allocate <span className="text-danger">*</span></label>
                                                <select className="form-control-custom" required
                                                    value={allocateFormData.asset || ''}
                                                    onChange={(e) => setAllocateFormData({ ...allocateFormData, asset: e.target.value })}>
                                                    <option value="">Choose...</option>
                                                    {getAvailableAssets().map(f => (
                                                        <option key={f.id} value={f.id}>{getAssetName(f)}</option>
                                                    ))}
                                                </select>
                                                {getAvailableAssets().length === 0 && (
                                                    <small className="text-danger mt-1 d-block">No available assets found for this type.</small>
                                                )}
                                            </div>
                                        )}
                                        
                                        <div className="col-md-12 mb-3">
                                            <label className="form-label-custom">Assign To User <span className="text-danger">*</span></label>
                                            <Select
                                                options={userOptions}
                                                value={userOptions.find(opt => String(opt.value) === String(allocateFormData.assigned_to)) || null}
                                                onChange={(val) => setAllocateFormData({ ...allocateFormData, assigned_to: val ? val.value : '' })}
                                                placeholder="Select User..."
                                                isClearable
                                                classNamePrefix="react-select"
                                                styles={customSelectStyles}
                                            />
                                        </div>

                                        {activeManagement === 'Asset' && (
                                            <div className="col-md-12 mb-3">
                                                <label className="form-label-custom">Assign To Department</label>
                                                <select className="form-control-custom"
                                                    value={allocateFormData.allocated_to_department || ''}
                                                    onChange={(e) => setAllocateFormData({ ...allocateFormData, allocated_to_department: e.target.value })}>
                                                    <option value="">Select Department...</option>
                                                    {departments.map(d => (
                                                        <option key={d.id} value={d.id}>{d.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        <div className="col-md-12 mb-3">
                                            <label className="form-label-custom">Due Date &amp; Time <span className="text-danger">*</span></label>
                                            <input
                                                type="datetime-local"
                                                className="form-control-custom"
                                                required
                                                min={localMinDateTime}
                                                value={allocateFormData.due_date || ''}
                                                onChange={(e) => setAllocateFormData({ ...allocateFormData, due_date: e.target.value })}
                                            />
                                        </div>

                                        {(activeManagement === 'File' || activeManagement === 'Allocation' || activeManagement.startsWith('Key')) && (
                                            <div className="col-md-12 mb-3">
                                                <div className="d-flex align-items-center gap-2" style={{ cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        id="allow_reallocation"
                                                        checked={allocateFormData.allow_reallocation !== false}
                                                        onChange={(e) => setAllocateFormData({ ...allocateFormData, allow_reallocation: e.target.checked })}
                                                        style={{ cursor: 'pointer', width: '18px', height: '18px', margin: 0, accentColor: '#0a500f' }}
                                                    />
                                                    <label htmlFor="allow_reallocation" style={{ cursor: 'pointer', margin: 0, fontWeight: '500', color: '#4a5568', fontSize: '14px' }}>
                                                        Allow Recipient to Reallocate
                                                    </label>
                                                </div>
                                            </div>
                                        )}

                                        <div className="col-md-12 mb-2">
                                            <label className="form-label-custom">Allocation Remarks</label>
                                            <textarea className="form-control-custom" rows="3" placeholder="e.g. For project work"
                                                value={allocateFormData.remarks || ''}
                                                onChange={(e) => setAllocateFormData({ ...allocateFormData, remarks: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer-custom mt-auto">
                                    <button type="button" onClick={() => setShowAllocateModal(false)} className="btn-close-custom">Cancel</button>
                                    <button type="submit" className="btn-save-custom" disabled={!selectedFile && getAvailableAssets().length === 0}>
                                        Confirm Allocation
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Return Modal */}
            {showReturnModal && selectedFile && (
                <div className="fd-modal-overlay" style={{ zIndex: 1050 }}>
                    <div className="fd-modal-content" style={{ padding: 0, maxWidth: '600px', borderRadius: '16px', overflow: 'hidden' }}>
                        <div className="scfm-modal w-100 h-100 d-flex flex-column">
                            <div className="modal-header-custom bg-white">
                                <div className="d-flex align-items-center gap-3">
                                    <div className="modal-icon-circle return">
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                            Return {getModalTitle()}
                                        </h4>
                                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                            Process the return of an allocated item
                                        </p>
                                    </div>
                                </div>
                                <button type="button" className="modal-close-x" onClick={() => setShowReturnModal(false)}>&times;</button>
                            </div>

                            <form onSubmit={handleReturnSubmit} className="d-flex flex-column flex-grow-1">
                                <div className="modal-body-custom flex-grow-1">
                                    <div className="selection-box">
                                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                                            </svg>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500', marginBottom: '2px' }}>Returning</div>
                                            <div style={{ fontSize: '15px', color: '#0f172a', fontWeight: '600' }}>{getAssetName(selectedFile)}</div>
                                            {selectedFile?.rack_custodian_name && (
                                                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                                                    Custodian: {selectedFile.rack_custodian_name}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="row">
                                        {selectedAllocation?.previous_holder_details && (
                                            <div className="col-md-12 mb-3">
                                                <label className="form-label-custom">Return To <span className="text-danger">*</span></label>
                                                <select className="form-control-custom"
                                                    value={returnFormData.return_to || 'admin'}
                                                    onChange={(e) => setReturnFormData({ ...returnFormData, return_to: e.target.value })}>
                                                    <option value="admin">{selectedFile?.rack_custodian_name ? `${selectedFile.rack_custodian_name} (Custodian)` : 'Admin (Available Stock)'}</option>
                                                    <option value="previous_holder">{selectedAllocation.previous_holder_details.name}</option>
                                                </select>
                                                <small className="text-muted mt-1 d-block">This file was reallocated to you. You may return it to the previous holder.</small>
                                            </div>
                                        )}
                                        
                                        <div className="col-md-12 mb-2">
                                            <label className="form-label-custom">Return Remarks</label>
                                            <textarea className="form-control-custom" rows="3"
                                                value={returnFormData.return_remarks || ''}
                                                onChange={(e) => setReturnFormData({ ...returnFormData, return_remarks: e.target.value })}
                                                placeholder="e.g. Returned in good condition"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer-custom mt-auto">
                                    <button type="button" onClick={() => setShowReturnModal(false)} className="btn-close-custom">Cancel</button>
                                    <button type="submit" className="btn-save-custom return">Confirm Return</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Reallocate Modal */}
            {showReallocateModal && selectedFile && (
                <div className="fd-modal-overlay" style={{ zIndex: 1050 }}>
                    <div className="fd-modal-content" style={{ padding: 0, maxWidth: '600px', borderRadius: '16px', overflow: 'hidden' }}>
                        <div className="scfm-modal w-100 h-100 d-flex flex-column">
                            <div className="modal-header-custom bg-white">
                                <div className="d-flex align-items-center gap-3">
                                    <div className="modal-icon-circle reallocate">
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M17 3l4 4m0 0l-4 4m4-4H3m4 14l-4-4m0 0l4-4m-4 4h18" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                            Reallocate {getModalTitle()}
                                        </h4>
                                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                            Transfer assignment to a new user
                                        </p>
                                    </div>
                                </div>
                                <button type="button" className="modal-close-x" onClick={() => setShowReallocateModal(false)}>&times;</button>
                            </div>

                            <form onSubmit={handleReallocateSubmit} className="d-flex flex-column flex-grow-1">
                                <div className="modal-body-custom flex-grow-1">
                                    <div className="selection-box">
                                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M16 21v-2a4 4 0 0 0-4-4H5c-1.1 0-2 .9-2 2v2"></path>
                                                <circle cx="8.5" cy="7" r="4"></circle>
                                                <polyline points="17 11 19 13 23 9"></polyline>
                                            </svg>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500', marginBottom: '2px' }}>Reallocating</div>
                                            <div style={{ fontSize: '15px', color: '#0f172a', fontWeight: '600' }}>{selectedFile.file_name || selectedFile.key_name}</div>
                                        </div>
                                    </div>

                                    <div className="row">
                                        <div className="col-md-12 mb-3" style={{ position: 'relative' }}>
                                            <label className="form-label-custom">New Recipient <span className="text-danger">*</span></label>
                                            <Select
                                                options={userOptions}
                                                value={userOptions.find(opt => String(opt.value) === String(reallocateFormData.assigned_to)) || null}
                                                onChange={(val) => setReallocateFormData({ ...reallocateFormData, assigned_to: val ? val.value : '' })}
                                                placeholder="Select New User..."
                                                isClearable
                                                classNamePrefix="react-select"
                                                styles={customSelectStyles}
                                            />
                                            <input
                                                tabIndex={-1}
                                                autoComplete="off"
                                                style={{ opacity: 0, height: 0, position: 'absolute', bottom: 0, left: '50%', width: '1px' }}
                                                value={reallocateFormData.assigned_to || ''}
                                                required
                                                onChange={() => {}}
                                            />
                                        </div>
                                        
                                        <div className="col-md-12 mb-3">
                                            <label className="form-label-custom">New Due Date &amp; Time <span className="text-danger">*</span></label>
                                            <input
                                                type="datetime-local"
                                                className="form-control-custom"
                                                required
                                                min={localMinDateTime}
                                                value={reallocateFormData.due_date || ''}
                                                onChange={(e) => setReallocateFormData({ ...reallocateFormData, due_date: e.target.value })}
                                            />
                                        </div>

                                        <div className="col-md-12 mb-3">
                                            <div className="d-flex align-items-center gap-2" style={{ cursor: 'pointer' }}>
                                                <input
                                                    type="checkbox"
                                                    id="realloc_allow_reallocation"
                                                    checked={reallocateFormData.allow_reallocation !== false}
                                                    onChange={(e) => setReallocateFormData({ ...reallocateFormData, allow_reallocation: e.target.checked })}
                                                    style={{ cursor: 'pointer', width: '18px', height: '18px', margin: 0, accentColor: '#3b82f6' }}
                                                />
                                                <label htmlFor="realloc_allow_reallocation" style={{ cursor: 'pointer', margin: 0, fontWeight: '500', color: '#4a5568', fontSize: '14px' }}>
                                                    Allow Recipient to Reallocate
                                                </label>
                                            </div>
                                        </div>

                                        <div className="col-md-12 mb-2">
                                            <label className="form-label-custom">Reallocation Remarks</label>
                                            <textarea className="form-control-custom" rows="3" placeholder="Reason for reallocation..."
                                                value={reallocateFormData.remarks || ''}
                                                onChange={(e) => setReallocateFormData({ ...reallocateFormData, remarks: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer-custom mt-auto">
                                    <button type="button" onClick={() => setShowReallocateModal(false)} className="btn-close-custom">Cancel</button>
                                    <button type="submit" className="btn-save-custom reallocate">Confirm Reallocation</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AssetAllocationModals;
