import React, { useRef } from 'react';
import { useFormConfig } from '../../../hooks/useFormConfig';

/**
 * ServiceTypeForm
 * Props:
 *  - formData    : { service_type: '', description: '' }
 *  - setFormData : setter
 *  - onSave      : (e) => void  — called on form submit
 *  - onCancel    : () => void
 *  - isEditing   : bool
 */
const ServiceTypeForm = ({ formData, setFormData, onSave, onCancel, isEditing }) => {
    const serviceTypeRef = useRef(null);
    const descriptionRef = useRef(null);
    const submitBtnRef = useRef(null);
    const { isFieldVisible } = useFormConfig('logistics_app_servicetype', 'Servicetypeform');

    const handleKeyDown = (e, nextRef) => {
        if (e.key === 'Enter') {
            if (e.ctrlKey) {
                e.preventDefault();
                onSave(e);
            } else {
                e.preventDefault();
                nextRef.current?.focus();
            }
        }
    };

    const handleTextAreaKeyDown = (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            onSave(e);
        }
    };

    return (
        <div className="scfm-modal w-100 h-100 d-flex flex-column" style={{ borderRadius: '16px', overflow: 'hidden' }}>
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
            `}</style>
            <div className="modal-header-custom">
                <div className="d-flex align-items-center gap-3">
                    <div className="modal-icon-circle">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </div>
                    <div>
                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                            {isEditing ? 'Edit Service Type' : 'Create Service Type'}
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            Enter details to manage service type
                        </p>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={onCancel}>&times;</button>
            </div>
            <form onSubmit={onSave} className="d-flex flex-column flex-grow-1">
                <div className="modal-body-custom flex-grow-1">
                    <div className="row">
                {isFieldVisible('service_type') && (
                    <div className="form-group col-12 mb-3">
                        <label className="fw-semibold">
                            Service Type <span className="text-danger">*</span>
                        </label>
                        <input
                            ref={serviceTypeRef}
                            type="text"
                            className="form-control"
                            placeholder="e.g. Oil Change, Tyre Replacement, General Service…"
                            required
                            maxLength={100}
                            value={formData.service_type || ''}
                            onChange={(e) =>
                                setFormData({ ...formData, service_type: e.target.value })
                            }
                            onKeyDown={(e) => handleKeyDown(e, descriptionRef)}
                            autoFocus
                        />
                        <small className="text-muted">Maximum 100 characters.</small>
                    </div>
                )}

                {isFieldVisible('description') && (
                    <div className="form-group col-12 mb-3">
                        <label className="fw-semibold">Description</label>
                        <textarea
                            ref={descriptionRef}
                            className="form-control"
                            placeholder="Optional — describe what this service type involves…"
                            rows={3}
                            value={formData.description || ''}
                            onChange={(e) =>
                                setFormData({ ...formData, description: e.target.value })
                            }
                            onKeyDown={(e) => handleTextAreaKeyDown(e)}
                        />
                    </div>
                )}
            </div>

                </div>
                <div className="modal-footer-custom mt-auto">
                    <button type="button" onClick={onCancel} className="btn-close-custom">Close</button>
                    <button ref={submitBtnRef} type="submit" className="btn-save-custom">{isEditing ? 'Update' : 'Save'}</button>
                </div>
            </form>
        </div>
    );
};

export default ServiceTypeForm;