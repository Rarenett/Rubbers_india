import React, { useEffect, useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import Select from 'react-select';
import InventoryService from '../../../services/InventoryService';

/* ─────────────────────────────────────────────────────────────────────────────
   Modal Popup Form
───────────────────────────────────────────────────────────────────────────── */
const ProductConfigurationForm = ({
    open,
    formData,
    setFormData,
    onSave,
    onCancel,
    isEditing,
}) => {
    const [voucherTypes, setVoucherTypes] = useState([]);
    const [loadingVT, setLoadingVT] = useState(false);

    /* Fetch voucher types */
    useEffect(() => {
        if (!open) return;
        const fetch = async () => {
            setLoadingVT(true);
            try {
                const res = await InventoryService.getVoucherTypes();
                setVoucherTypes(Array.isArray(res.data) ? res.data : []);
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingVT(false);
            }
        };
        fetch();
    }, [open]);

    const handleChange = (field, value) =>
        setFormData((prev) => ({ ...prev, [field]: value }));

    const customSelectStyles = {
        control: (provided, state) => ({
            ...provided,
            borderRadius: '10px',
            borderColor: state.isFocused ? '#0a500f' : '#cbd5e1',
            minHeight: '42px',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 80, 15, 0.15)' : 'none',
            '&:hover': {
                borderColor: state.isFocused ? '#0a500f' : '#cbd5e1'
            },
            backgroundColor: isEditing ? '#f8fafc' : '#fff'
        }),
        option: (provided, state) => ({
            ...provided,
            backgroundColor: state.isSelected ? '#0a500f' : state.isFocused ? '#f8f9fa' : 'white',
            color: state.isSelected ? 'white' : '#334155',
        }),
        menu: (provided) => ({
            ...provided,
            zIndex: 9999
        })
    };

    const typeOptions = voucherTypes.map(vt => ({ value: vt.id, label: `${vt.name} (${vt.code})` }));
    const selectedType = typeOptions.find(opt => opt.value === formData.voucher_type) || null;

    return (
        <>
            <style>{`
                .cl-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .cl-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .cl-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: var(--form-icon-color, #0a500f);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .cl-custom-modal .modal-close-x {
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
                .cl-custom-modal .modal-close-x:hover { color: #555; }
                .cl-custom-modal .modal-body-custom {
                    padding: 24px 28px;
                    max-height: 70vh;
                    overflow-y: auto;
                }
                .cl-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .cl-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .cl-custom-modal .btn-close-custom {
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
                .cl-custom-modal .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .cl-custom-modal .btn-close-custom:focus { 
                    outline: none !important;
                    box-shadow: 0 0 0 4px rgba(122, 112, 186, 0.3) !important;
                }
                .cl-custom-modal .btn-save-custom {
                    background-color: var(--save-btn-color, #0a500f) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, box-shadow 0.2s;
                }
                .cl-custom-modal .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }
                .cl-custom-modal .btn-save-custom:focus {
                    outline: none !important;
                    box-shadow: 0 0 0 4px rgba(10, 80, 15, 0.3) !important;
                }
                
                /* Beautiful Custom Switches */
                .cl-custom-modal .custom-feature-switch {
                    margin-bottom: 20px;
                }
                .cl-custom-modal .custom-feature-switch .form-check {
                    display: flex;
                    align-items: center;
                    min-height: 28px;
                    margin-bottom: 0;
                    padding-left: 0;
                }
                .cl-custom-modal .custom-feature-switch .form-check-input {
                    width: 44px;
                    height: 24px;
                    margin-top: 0;
                    margin-left: 0;
                    background-color: #e2e8f0;
                    border-color: #e2e8f0;
                    cursor: pointer;
                    transition: all 0.25s ease;
                }
                .cl-custom-modal .custom-feature-switch .form-check-input:checked {
                    background-color: #0a500f;
                    border-color: #0a500f;
                }
                .cl-custom-modal .custom-feature-switch .form-check-input:focus {
                    box-shadow: none;
                    border-color: #cbd5e1;
                }
                .cl-custom-modal .custom-feature-switch .form-check-label {
                    margin-left: 12px;
                    font-size: 15px;
                    font-weight: 500;
                    color: #475569;
                    cursor: pointer;
                }
                .cl-custom-modal .custom-feature-switch .switch-desc {
                    margin-left: 56px;
                    font-size: 13px;
                    color: #94a3b8;
                    margin-top: 2px;
                }
            `}</style>

            <Modal show={open} onHide={onCancel} dialogClassName="cl-custom-modal" backdrop="static" keyboard={false} enforceFocus={false} size="md" centered>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.73 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .43-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.49-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" fill="white" />
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {isEditing ? 'Edit Mapping' : 'New Mapping'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                {isEditing ? 'Update feature toggles for this voucher type.' : 'Select a voucher type and configure feature flags.'}
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={onCancel}>&times;</button>
                </div>

                <Form onSubmit={onSave}>
                    <div className="modal-body-custom">
                        <div className="row mb-4">
                            <div className="col-12">
                                <Form.Label className="form-label-custom">Voucher Type <span className="text-danger">*</span></Form.Label>
                                <Select
                                    classNamePrefix="react-select"
                                    styles={customSelectStyles}
                                    options={typeOptions}
                                    value={selectedType}
                                    onChange={(opt) => handleChange('voucher_type', opt ? opt.value : '')}
                                    placeholder={loadingVT ? 'Loading...' : '-- Select Voucher Type --'}
                                    isDisabled={isEditing || loadingVT}
                                    isLoading={loadingVT}
                                />
                                {isEditing && (
                                    <Form.Text className="text-muted mt-1" style={{ fontSize: '12px' }}>
                                        <i className="fa fa-info-circle me-1"></i> Voucher type cannot be changed after creation.
                                    </Form.Text>
                                )}
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-12">
                                <h6 className="form-label-custom text-uppercase mb-3" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>Feature Toggles</h6>
                                
                                <div className="custom-feature-switch">
                                    <Form.Check
                                        type="switch"
                                        id="chk-maintain_batch"
                                        label="Maintain Batch"
                                        checked={!!formData.maintain_batch}
                                        onChange={(e) => handleChange('maintain_batch', e.target.checked)}
                                    />
                                    <div className="switch-desc">Track individual product batches in transactions.</div>
                                </div>


                                <div className="custom-feature-switch">
                                    <Form.Check
                                        type="switch"
                                        id="chk-maintain_manufacture_date"
                                        label="Manufacture Date"
                                        checked={!!formData.maintain_manufacture_date}
                                        onChange={(e) => handleChange('maintain_manufacture_date', e.target.checked)}
                                    />
                                    <div className="switch-desc">Record manufacture date for each batch used.</div>
                                </div>

                                <div className="custom-feature-switch">
                                    <Form.Check
                                        type="switch"
                                        id="chk-maintain_expiry_date"
                                        label="Expiry Date"
                                        checked={!!formData.maintain_expiry_date}
                                        onChange={(e) => handleChange('maintain_expiry_date', e.target.checked)}
                                    />
                                    <div className="switch-desc">Track expiry dates for items in this voucher type.</div>
                                </div>

                                <div className="custom-feature-switch">
                                    <Form.Check
                                        type="switch"
                                        id="chk-maintain_warehouse"
                                        label="Godown"
                                        checked={!!formData.maintain_warehouse}
                                        onChange={(e) => handleChange('maintain_warehouse', e.target.checked)}
                                    />
                                    <div className="switch-desc">Require warehouse selection during transactions.</div>
                                </div>

                                <div className="custom-feature-switch">
                                    <Form.Check
                                        type="switch"
                                        id="chk-maintain_narration"
                                        label="Maintain Row Narration"
                                        checked={!!formData.maintain_narration}
                                        onChange={(e) => handleChange('maintain_narration', e.target.checked)}
                                    />
                                    <div className="switch-desc">Enable row-level narration tracking in ledger entries.</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer-custom">
                        <Button 
                            type="button" 
                            className="btn-close-custom" 
                            onClick={onCancel}
                        >
                            Close
                        </Button>
                        <Button 
                            type="submit" 
                            className="btn-save-custom" 
                        >
                            {isEditing ? 'Save Changes' : 'Save'}
                        </Button>
                    </div>
                </Form>
            </Modal>
        </>
    );
};

export default ProductConfigurationForm;
