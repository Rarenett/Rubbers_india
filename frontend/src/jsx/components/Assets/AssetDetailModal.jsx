import React, { useContext } from 'react';
import { ThemeContext } from '../../../context/ThemeContext';

const AssetDetailModal = ({
    show,
    onClose,
    formData,
    formDocuments,
    getInheritedAttributes
}) => {
    const { cancelBtnColor } = useContext(ThemeContext) || {};
    if (!show) return null;

    return (
        <>
            <style>{`
                .btn-close-custom-adm {
                    background-color: var(--cancel-btn-color, #dc3545) !important;
                    border-color: var(--cancel-btn-color, #dc3545) !important;
                    color: #ffffff !important;
                    border-radius: 10px !important;
                    transition: all 0.2s ease;
                }
                .btn-close-custom-adm:hover,
                .btn-close-custom-adm:active,
                .btn-close-custom-adm:focus,
                .btn-close-custom-adm:focus-visible {
                    background-color: var(--cancel-btn-color, #dc3545) !important;
                    border-color: var(--cancel-btn-color, #dc3545) !important;
                    color: #ffffff !important;
                    opacity: 1 !important;
                    box-shadow: none !important;
                }
            `}</style>
            <div className="fd-modal-overlay">
                <div className="fd-modal-content" style={{ maxWidth: '800px', borderRadius: '16px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                    <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <h2 className="m-0" style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>Asset Details</h2>
                        <button className="btn-close" onClick={onClose} style={{ padding: '0.5rem' }}></button>
                    </div>

                    <div className="row g-4 text-start">
                    <div className="col-md-6 text-start">
                        <h6 className="text-primary text-uppercase fw-bold mb-3" style={{ fontSize: '0.7rem', letterSpacing: '1.2px' }}>Classification</h6>
                        <div className="detail-item mb-3">
                            <label className="text-muted small fw-semibold mb-1 d-block">Asset Name</label>
                            <div style={{ color: '#334155', fontWeight: '600' }}>{formData.name || '—'}</div>
                        </div>
                        <div className="detail-item mb-3">
                            <label className="text-muted small fw-semibold mb-1 d-block">Asset Type</label>
                            <div style={{ color: '#334155', fontWeight: '600' }}>{formData.asset_type_name || '—'}</div>
                        </div>
                        <div className="detail-item mb-3">
                            <label className="text-muted small fw-semibold mb-1 d-block">Category</label>
                            <div style={{ color: '#334155', fontWeight: '600' }}>{formData.category_name || '—'}</div>
                        </div>
                        <div className="detail-item mb-3">
                            <label className="text-muted small fw-semibold mb-1 d-block">Asset Code</label>
                            <div className="badge bg-soft-primary text-primary px-2 py-1" style={{ fontSize: '0.9rem', background: '#eff6ff' }}>{formData.asset_code || '—'}</div>
                        </div>
                    </div>

                    <div className="col-md-6 text-start">
                        <h6 className="text-primary text-uppercase fw-bold mb-3" style={{ fontSize: '0.7rem', letterSpacing: '1.2px' }}>Status & Ownership</h6>
                        <div className="detail-item mb-3">
                            <label className="text-muted small fw-semibold mb-1 d-block">Status</label>
                            <span className={`status-badge badge-${formData.status?.toLowerCase().replace(' ', '') || 'available'}`}>
                                {formData.status || 'Available'}
                            </span>
                        </div>
                        <div className="detail-item mb-3">
                            <label className="text-muted small fw-semibold mb-1 d-block">Condition</label>
                            <span className={`status-badge badge-${formData.condition?.toLowerCase() || 'good'}`} style={{ backgroundColor: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>
                                {formData.condition || 'Good'}
                            </span>
                        </div>
                        <div className="detail-item mb-3">
                            <label className="text-muted small fw-semibold mb-1 d-block">Incharge</label>
                            <div style={{ color: '#334155', fontWeight: '600' }}>{formData.incharge_name || '—'}</div>
                        </div>
                        <div className="detail-item mb-3">
                            <label className="text-muted small fw-semibold mb-1 d-block">Department</label>
                            <div style={{ color: '#334155', fontWeight: '600' }}>{formData.department_name || '—'}</div>
                        </div>
                    </div>

                    <div className="col-12"><div style={{ height: '1px', background: '#f1f5f9' }}></div></div>

                    <div className="col-md-6 text-start">
                        <h6 className="text-primary text-uppercase fw-bold mb-3" style={{ fontSize: '0.7rem', letterSpacing: '1.2px' }}>Financial Info</h6>
                        <div className="detail-item mb-3">
                            <label className="text-muted small fw-semibold mb-1 d-block">Purchase Date</label>
                            <div style={{ color: '#334155', fontWeight: '600' }}>{formData.purchase_date || '—'}</div>
                        </div>
                        <div className="detail-item mb-3">
                            <label className="text-muted small fw-semibold mb-1 d-block">Purchase Cost</label>
                            <div style={{ color: '#334155', fontWeight: '600' }}>{formData.purchase_cost ? `${Number(formData.purchase_cost).toLocaleString()}` : '—'}</div>
                        </div>
                        <div className="detail-item mb-3">
                            <label className="text-muted small fw-semibold mb-1 d-block">Depreciation</label>
                            <div style={{ color: '#ef4444', fontWeight: '700' }}>{formData.depreciation_percentage ? `${formData.depreciation_percentage}%` : '0%'}</div>
                        </div>
                    </div>

                    <div className="col-md-6 text-start">
                        <h6 className="text-primary text-uppercase fw-bold mb-3" style={{ fontSize: '0.7rem', letterSpacing: '1.2px' }}>Warranty & Identification</h6>
                        <div className="detail-item mb-3">
                            <label className="text-muted small fw-semibold mb-1 d-block">Serial Number</label>
                            <div style={{ color: '#334155', fontWeight: '600' }}>{formData.serial_number || '—'}</div>
                        </div>
                        <div className="detail-item mb-3">
                            <label className="text-muted small fw-semibold mb-1 d-block">Warranty Period</label>
                            <div style={{ color: '#334155', fontWeight: '600' }}>
                                {formData.warranty_start_date ? `${formData.warranty_start_date} to ${formData.warranty_end_date || 'Present'}` : '—'}
                            </div>
                        </div>
                        <div className="detail-item mb-3">
                            <label className="text-muted small fw-semibold mb-1 d-block">Tag Number</label>
                            <div style={{ color: '#334155', fontWeight: '600' }}>{formData.tag_number || '—'}</div>
                        </div>
                        <div className="detail-item mb-3">
                            <label className="text-muted small fw-semibold mb-1 d-block">Expiry Date</label>
                            <div style={{ color: '#ef4444', fontWeight: '600' }}>{formData.expiry_date || '—'}</div>
                        </div>
                        <div className="detail-item mb-3">
                            <label className="text-muted small fw-semibold mb-1 d-block">Renewal Date</label>
                            <div style={{ color: '#0ea5e9', fontWeight: '600' }}>{formData.renewal_date || '—'}</div>
                        </div>
                    </div>

                    {formData.category && getInheritedAttributes(formData.category).length > 0 && (
                        <div className="col-12 text-start">
                            <div style={{ height: '1px', background: '#f1f5f9' }} className="mb-3"></div>
                            <h6 className="text-primary text-uppercase fw-bold mb-3" style={{ fontSize: '0.7rem', letterSpacing: '1.2px' }}>Additional Attributes</h6>
                            <div className="row g-3">
                                {getInheritedAttributes(formData.category).map(ad => (
                                    <div key={ad.id} className="col-md-4">
                                        <label className="text-muted small fw-semibold mb-1 d-block">{ad.name}</label>
                                        <div style={{ color: '#334155', fontWeight: '600' }}>
                                            {(() => {
                                                const val = formData.attribute_values?.[ad.id];
                                                if (val && typeof val === 'object') {
                                                    return val.value_text || val.value_number || val.value_date || (val.value_boolean ? 'Yes' : 'No') || '—';
                                                }
                                                return val || '—';
                                            })()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {(formData.description || formData.purchase_narration) && (
                        <div className="col-12 text-start">
                            <div style={{ height: '1px', background: '#f1f5f9' }} className="mb-3"></div>
                            <label className="text-muted small fw-semibold mb-2 d-block">Description & Narration</label>
                            <div className="p-3 bg-light rounded-3 mb-3" style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.6', border: '1px solid #e2e8f0' }}>
                                {formData.description || 'No description provided.'}
                                {formData.purchase_narration && (
                                    <div className="mt-2 pt-2 border-top">
                                        <strong>Purchase Narration:</strong> {formData.purchase_narration}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {formData.maintenances && formData.maintenances.length > 0 && (
                        <div className="col-12 text-start">
                            <div style={{ height: '1px', background: '#f1f5f9' }} className="mb-3"></div>
                            <h6 className="text-primary text-uppercase fw-bold mb-3" style={{ fontSize: '0.7rem', letterSpacing: '1.2px' }}>Scheduled Maintenance</h6>
                            <div className="table-responsive">
                                <table className="table table-sm" style={{ fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Maintenance Type</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formData.maintenances.filter(m => !m.completed_date).map((m, i) => (
                                            <tr key={i}>
                                                <td>{m.scheduled_date}</td>
                                                <td>{m.maintenance_type}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {formDocuments && formDocuments.length > 0 && formDocuments.some(doc => doc.file) && (
                        <div className="col-12 text-start mt-3">
                            <h6 className="text-primary text-uppercase fw-bold mb-3" style={{ fontSize: '0.7rem', letterSpacing: '1.2px' }}>Attachments</h6>
                            <div className="d-flex flex-wrap gap-2">
                                {formDocuments.map((doc, idx) => (
                                    doc.file && (
                                        <a key={idx} href={typeof doc.file === 'string' ? doc.file : URL.createObjectURL(doc.file)}
                                            target="_blank" rel="noopener noreferrer"
                                            className="btn btn-sm btn-light border d-flex align-items-center gap-2 px-3 py-2"
                                            style={{ borderRadius: '8px' }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                                            <span className="text-capitalize">{doc.document_name}</span>
                                        </a>
                                    )
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="d-flex justify-content-end mt-5 pt-3" style={{ borderTop: '1px solid #f1f5f9' }}>
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn btn-close-custom-adm btn-universal-close px-5 py-2 fw-bold"
                        style={{
                            backgroundColor: cancelBtnColor || 'var(--cancel-btn-color, #dc3545)',
                            borderColor: cancelBtnColor || 'var(--cancel-btn-color, #dc3545)',
                            color: '#ffffff',
                            borderRadius: '10px'
                        }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
        </>
    );
};

export default AssetDetailModal;
