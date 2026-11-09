import React, { useRef, useEffect, Fragment } from 'react';

const PackageTypeForm = ({ formData, setFormData, onSave, onCancel, isEditing }) => {
    const packNameRef = useRef(null);
    const lengthRef = useRef(null);
    const widthRef = useRef(null);
    const heightRef = useRef(null);
    const weightRef = useRef(null);
    const narrationRef = useRef(null);
    const submitBtnRef = useRef(null);
    
    // Auto-calculate volume on frontend for display purposes
    useEffect(() => {
        const length = parseFloat(formData.length) || 0;
        const width = parseFloat(formData.width) || 0;
        const height = parseFloat(formData.height) || 0;
        setFormData(prev => ({
            ...prev,
            volume: (length * width * height).toFixed(2)
        }));
    }, [formData.length, formData.width, formData.height, setFormData]);

    const handleKeyDown = (e, nextRef) => {
        if (e.key === 'Enter') {
            if (e.ctrlKey && nextRef === submitBtnRef) {
                e.preventDefault();
                onSave(e);
            } else {
                e.preventDefault();
                nextRef.current?.focus();
            }
        }
    };

    const handleTextAreaKeyDown = (e) => {
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                // allow default new line behavior
                return;
            } else {
                e.preventDefault();
                submitBtnRef.current?.focus();
            }
        }
    };

    return (
        <Fragment>
            <style>{`
                .pkg-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .pkg-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .pkg-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #2ece8a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
                }
                .pkg-custom-modal .modal-close-x {
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
                .pkg-custom-modal .modal-close-x:hover {
                    color: #555;
                }
                .pkg-custom-modal .modal-body-custom {
                    padding: 24px 28px;
                    max-height: 70vh;
                    overflow-y: auto;
                }
                .pkg-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .pkg-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .pkg-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .pkg-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                }
                .pkg-custom-modal .form-control-custom::placeholder {
                    color: #94a3b8;
                }
                .pkg-custom-modal .btn-close-custom {
                    background-color: #7A70BA !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s;
                }
                .pkg-custom-modal .btn-close-custom:hover {
                    background-color: #6357a7 !important;
                }
                .pkg-custom-modal .btn-save-custom {
                    background-color: #2ece8a !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s;
                }
                .pkg-custom-modal .btn-save-custom:hover {
                    background-color: #26b277 !important;
                }
            `}</style>
            
            <div className="modal-header-custom">
                <div className="d-flex align-items-center gap-3">
                    <div className="modal-icon-circle">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                            <line x1="12" y1="22.08" x2="12" y2="12"></line>
                        </svg>
                    </div>
                    <div>
                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                            {isEditing ? 'Edit Package Dimension' : 'Add New Package Dimension'}
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            {isEditing ? 'Update package dimension details' : 'Enter details to add a new package dimension'}
                        </p>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={onCancel}>
                    &times;
                </button>
            </div>

            <form onSubmit={onSave}>
                <div className="modal-body-custom">
                    <div className="row">
                        <div className="col-12 mb-3">
                            <label className="form-label-custom">
                                Package Name <span className="text-danger">*</span>
                            </label>
                            <input
                                ref={packNameRef}
                                type="text"
                                className="form-control-custom"
                                placeholder="e.g. Small Box, Pallet, etc."
                                required
                                maxLength={255}
                                value={formData.pack_name || ''}
                                onChange={(e) =>
                                    setFormData({ ...formData, pack_name: e.target.value })
                                }
                                onKeyDown={(e) => handleKeyDown(e, lengthRef)}
                                autoFocus
                            />
                        </div>

                        <div className="col-4 mb-3">
                            <label className="form-label-custom">
                                Length <span className="text-danger">*</span>
                            </label>
                            <input
                                ref={lengthRef}
                                type="number"
                                step="0.01"
                                className="form-control-custom"
                                required
                                value={formData.length || ''}
                                onChange={(e) =>
                                    setFormData({ ...formData, length: e.target.value })
                                }
                                onKeyDown={(e) => handleKeyDown(e, widthRef)}
                            />
                        </div>

                        <div className="col-4 mb-3">
                            <label className="form-label-custom">
                                Width <span className="text-danger">*</span>
                            </label>
                            <input
                                ref={widthRef}
                                type="number"
                                step="0.01"
                                className="form-control-custom"
                                required
                                value={formData.width || ''}
                                onChange={(e) =>
                                    setFormData({ ...formData, width: e.target.value })
                                }
                                onKeyDown={(e) => handleKeyDown(e, heightRef)}
                            />
                        </div>

                        <div className="col-4 mb-3">
                            <label className="form-label-custom">
                                Height <span className="text-danger">*</span>
                            </label>
                            <input
                                ref={heightRef}
                                type="number"
                                step="0.01"
                                className="form-control-custom"
                                required
                                value={formData.height || ''}
                                onChange={(e) =>
                                    setFormData({ ...formData, height: e.target.value })
                                }
                                onKeyDown={(e) => handleKeyDown(e, weightRef)}
                            />
                        </div>

                        <div className="col-6 mb-3">
                            <label className="form-label-custom">
                                Weight <span className="text-danger">*</span>
                            </label>
                            <input
                                ref={weightRef}
                                type="number"
                                step="0.01"
                                className="form-control-custom"
                                required
                                value={formData.weight || ''}
                                onChange={(e) =>
                                    setFormData({ ...formData, weight: e.target.value })
                                }
                                onKeyDown={(e) => handleKeyDown(e, narrationRef)}
                            />
                        </div>

                        <div className="col-6 mb-3">
                            <label className="form-label-custom">Volume (Calculated)</label>
                            <input
                                type="number"
                                className="form-control-custom bg-light"
                                value={formData.volume || '0.00'}
                                readOnly
                                tabIndex={-1}
                            />
                        </div>

                        <div className="col-12 mb-3">
                            <label className="form-label-custom">Narration</label>
                            <textarea
                                ref={narrationRef}
                                className="form-control-custom"
                                placeholder="Optional details..."
                                rows={3}
                                value={formData.narration || ''}
                                onChange={(e) =>
                                    setFormData({ ...formData, narration: e.target.value })
                                }
                                onKeyDown={handleTextAreaKeyDown}
                            />
                        </div>
                    </div>
                </div>

                <div className="modal-footer-custom">
                    <button
                        type="button"
                        className="btn-close-custom"
                        onClick={onCancel}
                    >
                        Cancel
                    </button>
                    <button
                        ref={submitBtnRef}
                        type="submit"
                        className="btn-save-custom"
                    >
                        {isEditing ? 'Save Changes' : 'Save'}
                    </button>
                </div>
            </form>
        </Fragment>
    );
};

export default PackageTypeForm;
