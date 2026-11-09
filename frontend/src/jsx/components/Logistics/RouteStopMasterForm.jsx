import React, { useRef, Fragment } from 'react';
import Select from 'react-select';

const RouteStopMasterForm = ({ formData, setFormData, onSave, onCancel, isEditing, deliveryLocations }) => {
    const stopNameRef = useRef(null);
    const distanceKmRef = useRef(null);
    const submitBtnRef = useRef(null);

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
    // Prepare options for react-select
    const deliveryLocationOptions = (deliveryLocations || []).map(dl => ({
        value: dl.id,
        label: dl.location_name || dl.name || dl.id
    }));

    // Find selected options based on formData.delivery_location_ids
    const selectedDeliveryLocations = deliveryLocationOptions.filter(option => 
        formData.delivery_location_ids?.includes(option.value)
    );

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
                            {isEditing ? 'Edit Route Stop' : 'Add New Route Stop'}
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            {isEditing ? 'Update route stop details' : 'Enter details to add a new route stop'}
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
                                Stop Name <span className="text-danger">*</span>
                            </label>
                            <input
                                ref={stopNameRef}
                                type="text"
                                className="form-control-custom"
                                placeholder="e.g. Kozhikode"
                                required
                                maxLength={255}
                                value={formData.stop_name || ''}
                                onChange={(e) =>
                                    setFormData({ ...formData, stop_name: e.target.value })
                                }
                                onKeyDown={(e) => handleKeyDown(e, distanceKmRef)}
                                autoFocus
                            />
                        </div>

                        <div className="col-12 mb-3">
                            <label className="form-label-custom">
                                Distance (Km) <span className="text-danger">*</span>
                            </label>
                            <input
                                ref={distanceKmRef}
                                type="number"
                                step="0.01"
                                className="form-control-custom"
                                required
                                value={formData.distance_km === 0 && formData.distance_km !== '0' ? '' : formData.distance_km}
                                onChange={(e) =>
                                    setFormData({ ...formData, distance_km: e.target.value })
                                }
                                onKeyDown={(e) => handleKeyDown(e, submitBtnRef)}
                            />
                        </div>

                        <div className="col-12 mb-3">
                            <label className="form-label-custom">
                                Delivery Locations (Optional)
                            </label>
                            <Select
                                isMulti
                                options={deliveryLocationOptions}
                                value={selectedDeliveryLocations}
                                onChange={(selectedOptions) => {
                                    setFormData({
                                        ...formData,
                                        delivery_location_ids: selectedOptions ? selectedOptions.map(opt => opt.value) : []
                                    });
                                }}
                                className="react-select-container"
                                classNamePrefix="react-select"
                                placeholder="Select Delivery Locations..."
                                styles={{
                                    control: (base, state) => ({
                                        ...base,
                                        borderRadius: '10px',
                                        borderColor: state.isFocused ? '#2ece8a' : '#cbd5e1',
                                        boxShadow: state.isFocused ? '0 0 0 3px rgba(46, 206, 138, 0.15)' : 'none',
                                        minHeight: '42px',
                                        fontSize: '13px',
                                    }),
                                    multiValue: (base) => ({
                                        ...base,
                                        backgroundColor: '#f1f5f9',
                                        borderRadius: '6px',
                                    })
                                }}
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

export default RouteStopMasterForm;