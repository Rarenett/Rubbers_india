import React, { useRef, Fragment, useEffect } from 'react';
import Select from 'react-select';

const DeliveryLocationForm = ({ formData, setFormData, onSave, onCancel, isEditing, ledgers, stops, existingMappings }) => {
    const submitBtnRef = useRef(null);
    const currentSelectControlRef = useRef(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            const inputs = Array.from(
                document.querySelectorAll('.pkg-custom-modal input:not([disabled]):not([readonly])')
            ).filter(el => el.offsetParent !== null && el.type !== 'hidden');
            if (inputs.length > 0) {
                inputs[0].focus();
            }
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    const getFocusable = () => {
        const modal = document.querySelector('.pkg-custom-modal');
        if (!modal) return [];
        return Array.from(
            modal.querySelectorAll(
                '.react-select__control, button[type="submit"]:not([disabled])'
            )
        ).filter(el => el.offsetParent !== null && !el.disabled);
    };

    const focusNextFromControl = (control) => {
        const all = getFocusable();
        const index = all.indexOf(control);
        if (index > -1 && index < all.length - 1) {
            if (index === all.length - 2) {
                all[all.length - 1].click();
            } else {
                const next = all[index + 1];
                if (next.classList.contains('react-select__control')) {
                    next.querySelector('input')?.focus();
                } else {
                    next.focus();
                }
            }
        }
    };

    const handleSelectFocus = (e) => {
        currentSelectControlRef.current = e.target.closest('.react-select__control');
    };

    const handleSelectKeyDown = (e) => {
        if (e.key === 'Enter') {
            const menuOpen = !!document.querySelector('.react-select__menu');
            if (!menuOpen) {
                e.preventDefault();
                const control = e.target.closest('.react-select__control');
                if (control) focusNextFromControl(control);
            }
        }
    };

    const customerOptions = ledgers
        .filter(l => {
            const groupName = (l.account_group_name || '').toLowerCase();
            return groupName.includes('sundry debtor') || groupName.includes('sundry creditor');
        })
        .map(l => ({
            value: l.id,
            label: l.name
        }));

    const customerMappings = existingMappings
        ? existingMappings.filter(m => {
              const custId = m.customer && typeof m.customer === 'object' ? m.customer.id : m.customer;
              return String(custId) === String(formData.customer);
          })
        : [];
        
    const alreadyMappedStopIds = customerMappings.map(m => String(m.delivery_location));

    const stopOptions = stops
        .filter(s => {
            if ((formData.delivery_location || []).includes(String(s.id))) return true;
            return !alreadyMappedStopIds.includes(String(s.id));
        })
        .map(s => ({
            value: s.id,
            label: s.stop_name
        }));

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
                    background-color: #0a500f;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
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
                .pkg-custom-modal .btn-close-custom {
                    background-color: #dc3545 !important;
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
                    background-color: #bb2d3b !important;
                }
                .pkg-custom-modal .btn-save-custom {
                    background-color: #0a500f !important;
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
                    background-color: #073d0b !important;
                }
            `}</style>
            
            <div className="modal-header-custom">
                <div className="d-flex align-items-center gap-3">
                    <div className="modal-icon-circle">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                    </div>
                    <div>
                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                            {isEditing ? 'Edit Delivery Location' : 'Map Delivery Location'}
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            {isEditing ? 'Update delivery location mapping' : 'Map a route stop to a customer'}
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
                        <div className="col-12 mb-4">
                            <label className="form-label-custom">
                                Customer <span className="text-danger">*</span>
                            </label>
                            <Select
                                options={customerOptions}
                                value={customerOptions.find(o => o.value === formData.customer) || null}
                                onChange={(selected) => {
                                    setFormData({ ...formData, customer: selected ? selected.value : '' });
                                    if (selected !== null) {
                                        const control = currentSelectControlRef.current;
                                        setTimeout(() => { if (control) focusNextFromControl(control); }, 50);
                                    }
                                }}
                                classNamePrefix="react-select"
                                onFocus={handleSelectFocus}
                                onKeyDown={handleSelectKeyDown}
                                openMenuOnFocus={true}
                                placeholder="Select Customer..."
                                isClearable
                                required
                                menuPosition="fixed"
                                menuPortalTarget={document.body}
                                styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                            />
                        </div>

                        <div className="col-12 mb-3">
                            <label className="form-label-custom">
                                Delivery Location (Route Stop) <span className="text-danger">*</span>
                            </label>
                            <Select
                                options={stopOptions}
                                value={stopOptions.filter(o => (formData.delivery_location || []).includes(String(o.value)))}
                                onChange={(selected) => {
                                    setFormData({ ...formData, delivery_location: selected ? selected.map(s => String(s.value)) : [] });
                                }}
                                classNamePrefix="react-select"
                                onFocus={handleSelectFocus}
                                onKeyDown={handleSelectKeyDown}
                                openMenuOnFocus={true}
                                isMulti={true}
                                placeholder="Select Locations..."
                                isClearable
                                required
                                menuPosition="fixed"
                                menuPortalTarget={document.body}
                                styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
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
                        disabled={!formData.customer || !formData.delivery_location || formData.delivery_location.length === 0}
                    >
                        {isEditing ? 'Save Changes' : 'Save'}
                    </button>
                </div>
            </form>
        </Fragment>
    );
};

export default DeliveryLocationForm;