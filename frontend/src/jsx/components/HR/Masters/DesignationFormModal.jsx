import React, { useState, useEffect } from 'react';
import { Modal, Form, Button } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    createDesignation,
    updateDesignation,
    formatFriendlyError
} from '../../../../services/HRManagementService';

const DesignationFormModal = ({ show, onHide, onSuccess, editMode = false, designation = null }) => {
    const [currentDesig, setCurrentDesig] = useState({
        id: null,
        title: '',
        name: '',
        level: 1,
        is_active: true,
        company: 1
    });

    useEffect(() => {
        if (show) {
            if (designation) {
                setCurrentDesig({
                    ...designation,
                    name: designation.name || designation.title || ''
                });
            } else {
                setCurrentDesig({
                    id: null,
                    title: '',
                    name: '',
                    level: 1,
                    is_active: true,
                    company: 1
                });
            }
        }
    }, [show, designation]);

    // Autofocus effect
    useEffect(() => {
        if (show) {
            const timer = setTimeout(() => {
                const inputs = Array.from(
                    document.querySelectorAll('.desig-custom-modal input:not([disabled]):not([readonly])')
                ).filter(el => el.offsetParent !== null && el.type !== 'hidden');
                if (inputs.length > 0) inputs[0].focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [show]);

    // Keyboard navigation
    const getFocusable = () => {
        const modal = document.querySelector('.desig-custom-modal');
        if (!modal) return [];
        return Array.from(
            modal.querySelectorAll(
                '.form-control-custom, input[type="checkbox"]:not([disabled]), button[type="submit"]:not([disabled])'
            )
        ).filter(el => el.offsetParent !== null && !el.disabled);
    };

    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        const activeEl = document.activeElement;
        const all = getFocusable();
        const index = all.indexOf(activeEl);
        if (index > -1 && index < all.length - 1) {
            e.preventDefault();
            if (index === all.length - 2) {
                all[all.length - 1].click();
            } else {
                all[index + 1].focus();
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const desigName = currentDesig.name || currentDesig.title;
        if (!desigName.trim()) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Designation name is required' });
            return;
        }

        const formattedName = desigName.trim().replace(/\b\w/g, c => c.toUpperCase());
        try {
            const data = {
                title: formattedName,
                name: formattedName,
                level: currentDesig.level,
                is_active: currentDesig.is_active,
                company: currentDesig.company || 1
            };

            let savedDesig;
            if (editMode && currentDesig.id) {
                savedDesig = await updateDesignation(currentDesig.id, data);
                Swal.fire({ icon: 'success', title: 'Updated', text: 'Designation updated successfully', timer: 2000, showConfirmButton: false });
            } else {
                savedDesig = await createDesignation(data);
                Swal.fire({ icon: 'success', title: 'Created', text: 'Designation created successfully', timer: 2000, showConfirmButton: false });
            }
            if (onSuccess) onSuccess(savedDesig);
            onHide();
        } catch (error) {
            const errorMsg = formatFriendlyError(error, `Failed to ${editMode ? 'update' : 'create'} designation`);
            Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
        }
    };

    return (
        <Modal show={show} onHide={onHide} dialogClassName="desig-custom-modal modal-md" centered>
            <style>{`
                .desig-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .desig-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .desig-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #0a500f;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .desig-custom-modal .modal-close-x {
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
                .desig-custom-modal .modal-close-x:hover { color: #555; }
                .desig-custom-modal .modal-body-custom { padding: 28px; }
                .desig-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .desig-custom-modal .form-label-custom {
                    font-size: 14px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 8px;
                }
                .desig-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 12px 16px;
                    font-size: 14px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .desig-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .desig-custom-modal .form-control-custom::placeholder { color: #94a3b8; }
                .desig-custom-modal .btn-close-custom {
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
                .desig-custom-modal .btn-close-custom:hover { background-color: #bb2d3b !important; }
                .desig-custom-modal .btn-save-custom {
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
                .desig-custom-modal .btn-save-custom:hover { background-color: #073d0b !important; }
            `}</style>
            <div className="modal-header-custom">
                <div className="d-flex align-items-center gap-3">
                    <div className="modal-icon-circle">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="white"/>
                        </svg>
                    </div>
                    <div>
                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                            {editMode ? 'Edit Designation' : 'Add Designation'}
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            Manage company designation settings
                        </p>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={onHide}>&times;</button>
            </div>
            <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
                <div className="modal-body-custom">
                    <Form.Group className="mb-3">
                        <Form.Label className="form-label-custom">Designation Name <span className="text-danger">*</span></Form.Label>
                        <Form.Control
                            type="text"
                            className="form-control-custom"
                            value={currentDesig.name || currentDesig.title}
                            onChange={(e) => setCurrentDesig({ ...currentDesig, name: e.target.value, title: e.target.value })}
                            placeholder="Enter designation name"
                            required
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Check
                            type="checkbox"
                            label="Active"
                            checked={currentDesig.is_active}
                            onChange={(e) => setCurrentDesig({ ...currentDesig, is_active: e.target.checked })}
                            className="form-check-input-custom"
                        />
                    </Form.Group>
                </div>
                <div className="modal-footer-custom">
                    <Button type="button" className="btn-close-custom" onClick={onHide}>Cancel</Button>
                    <Button type="submit" className="btn-save-custom">Save</Button>
                </div>
            </Form>
        </Modal>
    );
};

export default DesignationFormModal;
