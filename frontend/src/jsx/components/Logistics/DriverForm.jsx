import React, { useRef } from 'react';
import Swal from 'sweetalert2';
import { useFormConfig } from '../../../hooks/useFormConfig';
const DriverForm = ({
    formData,
    setFormData,
    onSave,
    onCancel,
    isEditing,
    users = []
}) => {
    const { isFieldVisible } = useFormConfig('logistics_app_driver', 'DriverForm');
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const fieldRefs = {
        user: useRef(null),
        mobile: useRef(null),
        license_number: useRef(null),
        license_expiry: useRef(null),
        aadhaar_number: useRef(null),
        driver_status: useRef(null),
        upload_license: useRef(null),
        remarks: useRef(null),
    };

    const fieldOrder = [
        'user',
        'mobile',
        'license_number',
        'license_expiry',
        'aadhaar_number',
        'driver_status',
        'upload_license',
        'remarks',
    ];

    const selectOpen = useRef({
        user: false,
        driver_status: false,
    });

    const focusNext = (currentField) => {
        const idx = fieldOrder.indexOf(currentField);

        for (let i = idx + 1; i < fieldOrder.length; i++) {
            const next = fieldRefs[fieldOrder[i]]?.current;
            if (next) {
                next.focus();
                break;
            }
        }
    };

    const focusPrev = (currentField) => {
        const idx = fieldOrder.indexOf(currentField);

        for (let i = idx - 1; i >= 0; i--) {
            const prev = fieldRefs[fieldOrder[i]]?.current;
            if (prev) {
                prev.focus();
                break;
            }
        }
    };

    const handleEnter = (e, currentField) => {
        if (e.key === 'Enter' || e.key === 'ArrowDown') {
            e.preventDefault();
            focusNext(currentField);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            focusPrev(currentField);
        }
    };

    const handleSelectKeyDown = (e, fieldName) => {
        if (e.key === 'Enter') {
            if (!selectOpen.current[fieldName]) {
                selectOpen.current[fieldName] = true;
                if (typeof e.target.showPicker === 'function') {
                    try {
                        e.target.showPicker();
                    } catch (err) {
                        console.error(err);
                    }
                }
            } else {
                e.preventDefault();
                selectOpen.current[fieldName] = false;
                focusNext(fieldName);
            }
        } else if (!selectOpen.current[fieldName]) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                focusNext(fieldName);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                focusPrev(fieldName);
            }
        }
    };

    const handleSelectBlur = (fieldName) => {
        selectOpen.current[fieldName] = false;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });
    };

    const handleUserChange = (e) => {
        const userId = e.target.value;

        const selectedUser = users.find(
            (u) => String(u.id) === String(userId)
        );

        if (selectedUser) {
            setFormData({
                ...formData,
                user: userId,
                name:
                    `${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() ||
                    selectedUser.username,
                email: selectedUser.email || '',
                mobile:
                    selectedUser.phone ||
                    selectedUser.phone_number ||
                    '',
                remarks: selectedUser.remarks || (selectedUser.customer_info && selectedUser.customer_info.remarks) || '',
            });
        } else {
            setFormData({
                ...formData,
                user: '',
                name: '',
                email: '',
                mobile: '',
                remarks: '',
            });
        }

        selectOpen.current.user = false;

        setTimeout(() => {
            focusNext('user');
        }, 0);
    };

    const handleDriverStatusChange = (e) => {
        setFormData({
            ...formData,
            driver_status: e.target.value,
        });

        selectOpen.current.driver_status = false;

        setTimeout(() => {
            focusNext('driver_status');
        }, 0);
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const previewUrl = URL.createObjectURL(file);

            setFormData({
                ...formData,
                upload_license: file,
                upload_license_preview: previewUrl,
            });
        }

        setTimeout(() => {
            focusNext('upload_license');
        }, 0);
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
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <circle cx="12" cy="7" r="4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </div>
                    <div>
                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                            {isEditing ? 'Edit Driver' : 'Create Driver'}
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            Enter details to manage driver
                        </p>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={onCancel}>&times;</button>
            </div>
            <form onSubmit={onSave} className="d-flex flex-column flex-grow-1">
                <div className="modal-body-custom flex-grow-1">
                    <div className="row">

                {isFieldVisible('user') && (
                    <div className="col-md-6 mb-3">
                        <label className="fw-semibold">
                            Driver Name <span className="text-danger">*</span>
                        </label>
                        <select
                            ref={fieldRefs.user}
                            name="user"
                            className="form-control"
                            required
                            autoFocus
                            value={formData.user || ''}
                            onChange={handleUserChange}
                            onKeyDown={(e) => handleSelectKeyDown(e, 'user')}
                            onBlur={() => handleSelectBlur('user')}
                        >
                            <option value="">Select Driver</option>
                            {users.map((usr) => (
                                <option key={usr.id} value={usr.id}>
                                    {`${usr.first_name} ${usr.last_name}`.trim() || usr.username || usr.email}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {isFieldVisible('mobile') && (
                    <div className="col-md-6 mb-3">
                        <label className="fw-semibold">
                            Mobile <span className="text-danger">*</span>
                        </label>
                        <input
                            ref={fieldRefs.mobile}
                            type="text"
                            name="mobile"
                            className="form-control"
                            required
                            maxLength={10}
                            pattern="[0-9]{10}"
                            title="Please enter a valid 10-digit mobile number"
                            placeholder="e.g. 9876543210"
                            value={formData.mobile || ''}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                setFormData({ ...formData, mobile: val });
                            }}
                            onKeyDown={(e) => handleEnter(e, 'mobile')}
                        />
                    </div>
                )}

                {isFieldVisible('license_number') && (
                    <div className="col-md-6 mb-3">
                        <label className="fw-semibold">
                            License Number <span className="text-danger">*</span>
                        </label>

                        <input
                            ref={fieldRefs.license_number}
                            type="text"
                            name="license_number"
                            className="form-control"
                            required
                            placeholder="e.g. DL-0120110012345"
                            value={formData.license_number || ''}
                            onChange={handleChange}
                            onKeyDown={(e) =>
                                handleEnter(e, 'license_number')
                            }
                        />
                    </div>
                )}

                {isFieldVisible('license_expiry') && (
                    <div className="col-md-6 mb-3">
                        <label className="fw-semibold">
                            License Expiry
                        </label>

                        <input
                            ref={fieldRefs.license_expiry}
                            type="date"
                            name="license_expiry"
                            className="form-control"
                            min={todayStr}
                            value={formData.license_expiry || ''}
                            onChange={handleChange}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const val = e.target.value;
                                    if (val) {
                                        const year = parseInt(val.split('-')[0], 10);
                                        if (year < 1000 || year > 9999) {
                                            e.preventDefault();
                                            Swal.fire({
                                                icon: 'warning',
                                                title: 'Invalid Date',
                                                text: 'Please enter a valid 4-digit year (e.g. 2026).',
                                                confirmButtonText: 'OK'
                                            });
                                            return;
                                        }
                                        const selectedDate = new Date(val);
                                        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                                        if (selectedDate < todayStart) {
                                            e.preventDefault();
                                            Swal.fire({
                                                icon: 'warning',
                                                title: 'Invalid Date',
                                                text: 'License expiration date cannot be in the past.',
                                                confirmButtonText: 'OK'
                                            });
                                            return;
                                        }
                                    }
                                    e.preventDefault();
                                    focusNext('license_expiry');
                                } else if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    focusNext('license_expiry');
                                } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    focusPrev('license_expiry');
                                }
                            }}
                        />
                    </div>
                )}

                {isFieldVisible('aadhaar_number') && (
                    <div className="col-md-6 mb-3">
                        <label className="fw-semibold">
                            Aadhaar Number
                        </label>

                        <input
                            ref={fieldRefs.aadhaar_number}
                            type="text"
                            name="aadhaar_number"
                            className="form-control"
                            placeholder="123456789012"
                            value={formData.aadhaar_number || ''}
                            onChange={handleChange}
                            onKeyDown={(e) =>
                                handleEnter(e, 'aadhaar_number')
                            }
                        />
                    </div>
                )}

                {isFieldVisible('driver_status') && (
                    <div className="col-md-6 mb-3">
                        <label className="fw-semibold">
                            Driver Status
                        </label>

                        <select
                            ref={fieldRefs.driver_status}
                            name="driver_status"
                            className="form-control"
                            value={formData.driver_status || 'available'}
                            onChange={handleDriverStatusChange}
                            onKeyDown={(e) =>
                                handleSelectKeyDown(
                                    e,
                                    'driver_status'
                                )
                            }
                            onBlur={() =>
                                handleSelectBlur(
                                    'driver_status'
                                )
                            }
                        >
                            <option value="available">
                                Available
                            </option>
                            <option value="on_trip">
                                On Trip
                            </option>
                            <option value="unavailable">
                                Unavailable
                            </option>
                        </select>
                    </div>
                )}

                {isFieldVisible('upload_license') && (
                    <div className="col-md-6 mb-3">
                        <label className="fw-semibold">
                            Upload License
                        </label>

                        <input
                            ref={fieldRefs.upload_license}
                            type="file"
                            className="form-control"
                            accept="image/*"
                            onChange={handleFileChange}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    e.target.click();
                                } else if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    focusNext('upload_license');
                                } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    focusPrev('upload_license');
                                }
                            }}
                        />

                        {(formData.upload_license_preview ||
                            formData.upload_license) && (
                            <div className="mt-2">
                                <img
                                    src={
                                        formData.upload_license_preview ||
                                        formData.upload_license
                                    }
                                    alt="License Preview"
                                    style={{
                                        width: '120px',
                                        height: '90px',
                                        objectFit: 'cover',
                                        borderRadius: '8px',
                                        border: '1px solid #ddd',
                                    }}
                                />
                            </div>
                        )}
                    </div>
                )}

                {isFieldVisible('remarks') && (
                    <div className="col-md-12 mb-3">
                        <label className="fw-semibold">
                            Remarks
                        </label>

                        <textarea
                            ref={fieldRefs.remarks}
                            name="remarks"
                            className="form-control"
                            rows={3}
                            value={formData.remarks || ''}
                            onChange={handleChange}
                            onKeyDown={(e) => {
                                if (
                                    e.ctrlKey &&
                                    e.key === 'Enter'
                                ) {
                                    e.preventDefault();
                                    focusNext('remarks');
                                }
                            }}
                        />

                        <small className="text-muted">
                            Press Ctrl + Enter to move next
                        </small>
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

export default DriverForm;