import React, { useState, useEffect } from 'react';
import { Modal, Form, Button } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import { patchDepartment, getEmployees, formatFriendlyError } from '../../../../services/HRManagementService';

const selectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: '40px',
        borderColor: state.isFocused ? '#0a500f' : '#cbd5e1',
        borderRadius: '10px',
        fontSize: '14px',
        boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 80, 15,0.15)' : 'none',
        '&:hover': { borderColor: '#0a500f' },
    }),
    menu: (base) => ({ ...base, fontSize: '14px', zIndex: 9999 }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isSelected ? '#0a500f' : state.isFocused ? '#e8faf3' : 'white',
        color: state.isSelected ? 'white' : '#333',
    }),
    placeholder: (base) => ({ ...base, color: '#94a3b8', fontSize: '14px' }),
};

const DepartmentContactModal = ({ show, onHide, department, onSuccess }) => {
    const [contactPerson, setContactPerson] = useState('');
    const [contactNumber, setContactNumber] = useState('');
    const [saving, setSaving] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [loadingEmployees, setLoadingEmployees] = useState(false);

    useEffect(() => {
        if (show && department?.id) {
            // Reset first so stale values never flash
            setContactPerson('');
            setContactNumber('');
            // Fetch fresh data from API to ensure saved values are pre-filled
            import('../../../../services/HRManagementService').then(({ getDepartmentById }) => {
                getDepartmentById(department.id)
                    .then(fresh => {
                        setContactPerson(fresh.contact_person || '');
                        setContactNumber(fresh.contact_number || '');
                    })
                    .catch(() => {
                        // Fallback to prop values if API fails
                        setContactPerson(department.contact_person || '');
                        setContactNumber(department.contact_number || '');
                    });
            });
            // Fetch employees in this department
            setLoadingEmployees(true);
            getEmployees(department.id)
                .then(data => {
                    const list = Array.isArray(data) ? data : (data?.results || []);
                    setEmployees(list);
                })
                .catch(() => setEmployees([]))
                .finally(() => setLoadingEmployees(false));
        } else {
            // Reset everything on close
            setContactPerson('');
            setContactNumber('');
            setEmployees([]);
        }
    }, [show, department?.id]);


    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!department?.id) return;

        setSaving(true);
        try {
            const payload = {
                contact_person: contactPerson.trim() || null,
                contact_number: contactNumber.trim() || null,
            };
            const updated = await patchDepartment(department.id, payload);
            Swal.fire({
                icon: 'success',
                title: 'Saved',
                text: 'Department contact details updated successfully',
                timer: 2000,
                showConfirmButton: false,
            });
            if (onSuccess) onSuccess(updated);
            onHide();
        } catch (error) {
            const errorMsg = formatFriendlyError(error, 'Failed to update department contact details');
            Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            show={show}
            onHide={onHide}
            centered
            dialogClassName="dept-custom-modal modal-md"
            backdrop="static"
            keyboard={false}
        >
            <style>{`
                .dept-contact-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .dept-contact-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .dept-contact-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(2, 132, 199, 0.25);
                }
                .dept-contact-modal .modal-close-x {
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
                .dept-contact-modal .modal-close-x:hover { color: #555; }
                .dept-contact-modal .modal-body-custom { padding: 24px 28px; }
                .dept-contact-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .dept-contact-modal .form-label-custom {
                    font-size: 14px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 8px;
                }
                .dept-contact-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                    padding: 10px 14px;
                    font-size: 14px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .dept-contact-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0284c7;
                    box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
                }

                .dept-custom-modal .btn-close-custom,
                .dept-contact-modal .btn-close-custom {
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
                .dept-custom-modal .btn-close-custom:hover,
                .dept-contact-modal .btn-close-custom:hover { background-color: #bb2d3b !important; }
                .dept-custom-modal .btn-save-custom,
                .dept-contact-modal .btn-save-custom {
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
                .dept-custom-modal .btn-save-custom:hover,
                .dept-contact-modal .btn-save-custom:hover { background-color: #073d0b !important; }
                .dept-custom-modal .btn-save-custom:disabled,
                .dept-contact-modal .btn-save-custom:disabled { opacity: 0.65; cursor: not-allowed; }
            `}</style>

            <div className="dept-contact-modal">
                {/* Modal Header */}
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <i className="fa fa-address-book" style={{ fontSize: '20px', color: '#fff' }}></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                Contact Details
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Manage contact information for this department
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={onHide}>&times;</button>
                </div>

                <Form onSubmit={handleSubmit}>
                    <div className="modal-body-custom">
                        {/* Department Context Card */}
                        <div className="mb-4 p-3 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                            <div className="d-flex align-items-center gap-3">
                                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <i className="fa fa-building" style={{ color: '#0284c7', fontSize: '15px' }}></i>
                                </div>
                                <div>
                                    <div className="fw-bold" style={{ fontSize: '15px', color: '#1e293b' }}>
                                        {department?.name || '-'}
                                    </div>
                                    <div className="text-muted" style={{ fontSize: '12px' }}>
                                        Status: {department?.is_active ? <span className="text-success fw-semibold">Active</span> : <span className="text-danger fw-semibold">Inactive</span>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Contact Person */}
                        <Form.Group className="mb-3">
                            <Form.Label className="form-label-custom">
                                Contact Person
                            </Form.Label>
                            <Select
                                options={employees.map(emp => ({ value: emp.full_name, label: emp.full_name }))}
                                value={contactPerson ? { value: contactPerson, label: contactPerson } : null}
                                onChange={(opt) => setContactPerson(opt ? opt.value : '')}
                                placeholder={loadingEmployees ? 'Loading employees…' : 'Select an employee'}
                                isLoading={loadingEmployees}
                                isClearable
                                styles={selectStyles}
                                menuPortalTarget={document.body}
                                noOptionsMessage={() => 'No employees found in this department'}
                            />
                        </Form.Group>

                        {/* Contact Number */}
                        <Form.Group className="mb-2">
                            <Form.Label className="form-label-custom">
                                Contact Number
                            </Form.Label>
                            <Form.Control
                                type="tel"
                                className="form-control-custom"
                                value={contactNumber}
                                onChange={(e) => setContactNumber(e.target.value)}
                                placeholder="Enter phone or mobile number"
                            />
                        </Form.Group>
                    </div>

                    {/* Modal Footer */}
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={onHide} disabled={saving}>
                            Cancel
                        </Button>
                        <Button type="submit" className="btn-save-custom" disabled={saving}>
                            {saving ? (
                                <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</>
                            ) : (
                                'Save'
                            )}
                        </Button>
                    </div>
                </Form>
            </div>
        </Modal>
    );
};

export default DepartmentContactModal;
