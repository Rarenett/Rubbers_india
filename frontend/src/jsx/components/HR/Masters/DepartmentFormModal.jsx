import React, { useState, useEffect } from 'react';
import { Modal, Form, Button } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    createDepartment,
    updateDepartment,
    formatFriendlyError
} from '../../../../services/HRManagementService';

const DepartmentFormModal = ({ show, onHide, onSuccess, editMode = false, department = null }) => {
    const [currentDept, setCurrentDept] = useState({ id: null, name: '', is_active: true, requires_visitor_approval: false, company: 1 });

    useEffect(() => {
        if (show) {
            if (department) {
                setCurrentDept({
                    ...department,
                    requires_visitor_approval: department.requires_visitor_approval || false,
                    company: department.company || 1
                });
            } else {
                setCurrentDept({ id: null, name: '', is_active: true, requires_visitor_approval: false, company: 1 });
            }
        }
    }, [show, department]);

    // Autofocus effect
    useEffect(() => {
        if (show) {
            const timer = setTimeout(() => {
                const inputs = Array.from(
                    document.querySelectorAll('.dept-custom-modal input:not([disabled]):not([readonly])')
                ).filter(el => el.offsetParent !== null && el.type !== 'hidden');
                if (inputs.length > 0) inputs[0].focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [show]);

    // Keyboard navigation
    const getFocusable = () => {
        const modal = document.querySelector('.dept-custom-modal');
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

    const handleDeptSubmit = async (e) => {
        e.preventDefault();
        if (!currentDept.name.trim()) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Department name is required' });
            return;
        }

        try {
            const payload = {
                name: (currentDept.name || '').trim().replace(/\b\w/g, c => c.toUpperCase()),
                is_active: currentDept.is_active,
                requires_visitor_approval: currentDept.requires_visitor_approval,
                company: currentDept.company || 1
            };
            let savedDept;
            if (editMode && currentDept.id) {
                savedDept = await updateDepartment(currentDept.id, payload);
                Swal.fire({ icon: 'success', title: 'Updated', text: 'Department updated successfully', timer: 2000, showConfirmButton: false });
            } else {
                savedDept = await createDepartment(payload);
                Swal.fire({ icon: 'success', title: 'Created', text: 'Department created successfully', timer: 2000, showConfirmButton: false });
            }
            if (onSuccess) onSuccess(savedDept);
            onHide();
        } catch (error) {
            const errorMsg = formatFriendlyError(error, `Failed to ${editMode ? 'update' : 'create'} department`);
            Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
        }
    };

    return (
        <Modal show={show} onHide={onHide} dialogClassName="dept-custom-modal modal-md" centered>
            <style>{`
                .dept-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .dept-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .dept-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #2ece8a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
                }
                .dept-custom-modal .modal-close-x {
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
                .dept-custom-modal .modal-close-x:hover { color: #555; }
                .dept-custom-modal .modal-body-custom { padding: 28px; }
                .dept-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .dept-custom-modal .form-label-custom {
                    font-size: 14px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 8px;
                }
                .dept-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 12px 16px;
                    font-size: 14px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .dept-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                }
                .dept-custom-modal .form-control-custom::placeholder { color: #94a3b8; }
                .dept-custom-modal .btn-close-custom {
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
                .dept-custom-modal .btn-close-custom:hover { background-color: #6357a7 !important; }
                .dept-custom-modal .btn-save-custom {
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
                .dept-custom-modal .btn-save-custom:hover { background-color: #26b277 !important; }
            `}</style>
            <div className="modal-header-custom">
                <div className="d-flex align-items-center gap-3">
                    <div className="modal-icon-circle">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" fill="white"/>
                        </svg>
                    </div>
                    <div>
                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                            {editMode ? 'Edit Department' : 'Add Department'}
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            Manage company department settings
                        </p>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={onHide}>&times;</button>
            </div>
            <Form onSubmit={handleDeptSubmit} onKeyDown={handleKeyDown}>
                <div className="modal-body-custom">
                    <Form.Group className="mb-3">
                        <Form.Label className="form-label-custom">Department Name <span className="text-danger">*</span></Form.Label>
                        <Form.Control
                            type="text"
                            className="form-control-custom"
                            value={currentDept.name}
                            onChange={(e) => setCurrentDept({ ...currentDept, name: e.target.value })}
                            placeholder="Enter department name"
                            required
                        />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Check
                            type="checkbox"
                            label="Active"
                            checked={currentDept.is_active}
                            onChange={(e) => setCurrentDept({ ...currentDept, is_active: e.target.checked })}
                            className="form-check-input-custom mb-2"
                        />
                        <Form.Check
                            type="checkbox"
                            label="Requires Visitor Approval"
                            checked={currentDept.requires_visitor_approval}
                            onChange={(e) => setCurrentDept({ ...currentDept, requires_visitor_approval: e.target.checked })}
                            className="form-check-input-custom text-info"
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

export default DepartmentFormModal;
