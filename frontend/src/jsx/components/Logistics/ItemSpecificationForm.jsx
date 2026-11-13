import React, { useRef, useEffect } from 'react';
import Select from 'react-select';

const ItemSpecificationForm = ({ 
    formData, 
    setFormData, 
    onSave, 
    onCancel, 
    isEditing, 
    stockItems = [], 
    packageTypes = [] 
}) => {
    const stockItemSelectRef = useRef(null);
    const packageTypeSelectRef = useRef(null);
    const itemsPerCaseRef = useRef(null);
    const volumeRef = useRef(null);
    const weightRef = useRef(null);
    const submitBtnRef = useRef(null);

    useEffect(() => {
        // Auto-focus the first field (Stock Item select) on mount
        const timer = setTimeout(() => {
            if (stockItemSelectRef.current) {
                stockItemSelectRef.current.focus();
            }
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    const handleKeyDown = (e, nextRef) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            nextRef.current?.focus();
        }
    };

    // Format options for react-select
    const stockItemOptions = stockItems.map(item => ({
        value: item.id,
        label: item.name
    }));

    const packageTypeOptions = packageTypes.map(pkg => ({
        value: pkg.id,
        label: pkg.pack_name
    }));

    const selectedStockItem = stockItemOptions.find(opt => opt.value === formData.stock_item) || null;
    const selectedPackageType = packageTypeOptions.find(opt => opt.value === formData.package_type) || null;

    return (
        <form onSubmit={onSave}>
            <style>{`
                .pkg-close-btn {
                    background-color: var(--cancel-btn-color, #dc3545) !important;
                    border-color: var(--cancel-btn-color, #dc3545) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s !important;
                }
                .pkg-close-btn:hover {
                    background-color: var(--cancel-btn-color, #dc3545) !important;
                    border-color: var(--cancel-btn-color, #dc3545) !important;
                    opacity: 0.9 !important;
                }
                .pkg-submit-btn {
                    background-color: var(--save-btn-color, #0a500f) !important;
                    border-color: var(--save-btn-color, #0a500f) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s !important;
                }
                .pkg-submit-btn:hover, .pkg-submit-btn:focus {
                    background-color: var(--save-btn-color, #0a500f) !important;
                    border-color: var(--save-btn-color, #0a500f) !important;
                    opacity: 0.9 !important;
                    box-shadow: 0 0 0 4px rgba(10, 80, 15, 0.2) !important;
                    outline: none !important;
                }
            `}</style>
            <div style={{ marginBottom: '0' }}>
                <div className="d-flex align-items-center justify-content-between gap-3 mb-1" style={{ paddingBottom: '4px' }}>
                    <div className="d-flex align-items-center gap-3">
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '50%',
                            background: 'var(--primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                                <line x1="12" y1="22.08" x2="12" y2="12"></line>
                            </svg>
                        </div>
                        <div>
                            <h5 style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem', color: '#1e293b' }}>
                                {isEditing ? 'Edit Product Dimension' : 'Add Product Dimension'}
                            </h5>
                            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                                Define how stock items are packed into package types
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <hr style={{ borderColor: '#e2e8f0', margin: '16px 0 20px 0' }} />

            <div className="row">
                <div className="form-group col-6 mb-3">
                    <label className="fw-semibold">
                        Stock Item <span className="text-danger">*</span>
                    </label>
                    <Select
                        ref={stockItemSelectRef}
                        options={stockItemOptions}
                        value={selectedStockItem}
                        onChange={(selected) => {
                            setFormData({ ...formData, stock_item: selected ? selected.value : '' });
                            if (selected) {
                                setTimeout(() => packageTypeSelectRef.current?.focus(), 50);
                            }
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                setTimeout(() => packageTypeSelectRef.current?.focus(), 50);
                            }
                        }}
                        openMenuOnFocus={true}
                        isClearable
                        placeholder="Select Stock Item"
                        required
                    />
                </div>

                <div className="form-group col-6 mb-3">
                    <label className="fw-semibold">
                        Package Type <span className="text-danger">*</span>
                    </label>
                    <Select
                        ref={packageTypeSelectRef}
                        options={packageTypeOptions}
                        value={selectedPackageType}
                        onChange={(selected) => {
                            setFormData({ ...formData, package_type: selected ? selected.value : '' });
                            if (selected) {
                                setTimeout(() => itemsPerCaseRef.current?.focus(), 50);
                            }
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                setTimeout(() => itemsPerCaseRef.current?.focus(), 50);
                            }
                        }}
                        openMenuOnFocus={true}
                        isClearable
                        placeholder="Select Package Type"
                        required
                    />
                </div>

                <div className="form-group col-4 mb-3">
                    <label className="fw-semibold">
                        Items Per Case <span className="text-danger">*</span>
                    </label>
                    <input
                        ref={itemsPerCaseRef}
                        type="number"
                        className="form-control"
                        required
                        min="1"
                        value={formData.items_per_case || ''}
                        onChange={(e) =>
                            setFormData({ ...formData, items_per_case: e.target.value })
                        }
                        onKeyDown={(e) => handleKeyDown(e, volumeRef)}
                    />
                </div>

                <div className="form-group col-4 mb-3">
                    <label className="fw-semibold">
                        Volume Per Case (m³) <span className="text-danger">*</span>
                    </label>
                    <input
                        ref={volumeRef}
                        type="number"
                        step="0.0001"
                        className="form-control"
                        required
                        value={formData.volume_per_case || ''}
                        onChange={(e) =>
                            setFormData({ ...formData, volume_per_case: e.target.value })
                        }
                        onKeyDown={(e) => handleKeyDown(e, weightRef)}
                    />
                </div>

                <div className="form-group col-4 mb-3">
                    <label className="fw-semibold">
                        Case Weight (kg) <span className="text-danger">*</span>
                    </label>
                    <input
                        ref={weightRef}
                        type="number"
                        step="0.01"
                        className="form-control"
                        required
                        value={formData.case_weight || ''}
                        onChange={(e) =>
                            setFormData({ ...formData, case_weight: e.target.value })
                        }
                        onKeyDown={(e) => handleKeyDown(e, submitBtnRef)}
                    />
                </div>
            </div>

            <div
                className="modal-actions d-flex justify-content-end gap-2 mt-4 pt-3"
                style={{ borderTop: '1px solid #f1f5f9' }}
            >
                <button
                    type="button"
                    className="pkg-close-btn btn-close-custom btn-universal-close"
                    onClick={onCancel}
                >
                    Cancel
                </button>
                <button
                    ref={submitBtnRef}
                    type="submit"
                    className="pkg-submit-btn btn-save-custom btn-universal-save"
                >
                    {isEditing ? 'Save Changes' : 'Save'}
                </button>
            </div>
        </form>
    );
};

export default ItemSpecificationForm;
