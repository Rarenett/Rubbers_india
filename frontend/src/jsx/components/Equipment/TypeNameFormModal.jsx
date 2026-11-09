import React, { useState, useEffect } from 'react';
import { Button, Modal, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { createTypeName } from '../../../services/MachineManagementService';
import { useFormConfig } from '../../../hooks/useFormConfig';
import { useEnterTraversal } from '../../../hooks/useEnterTraversal';

const TypeNameFormModal = ({ show, onHide, onSaved }) => {
    const [typename, setTypename] = useState('');
    const { isFieldVisible } = useFormConfig('machine_app_typename', 'TypeNameFormModal');
    const { handleFormKeyDown } = useEnterTraversal('.tnfm-modal');

    useEffect(() => {
        if (show) setTypename('');
    }, [show]);

    useEffect(() => {
        if (show) {
            const timer = setTimeout(() => {
                const input = document.querySelector('.tnfm-modal input:not([disabled]):not([readonly])');
                if (input) input.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [show]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isFieldVisible('typename') && !typename.trim()) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Type Name is required' });
            return;
        }
        try {
            const result = await createTypeName({ typename: typename.trim() });
            Swal.fire({ icon: 'success', title: 'Created', text: 'Type name created successfully', timer: 2000, showConfirmButton: false });
            if (onSaved) onSaved(result);
            onHide();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to create type name' });
        }
    };

    return (
        <>
            <style>{`
                .tnfm-modal .modal-content { border-radius: 16px !important; border: none !important; box-shadow: 0 10px 40px rgba(0,0,0,0.12) !important; overflow: hidden; }
                .tnfm-modal .modal-header-custom { display: flex; align-items: center; justify-content: space-between; padding: 24px 28px 16px 28px; border-bottom: 1px solid #f1f5f9; }
                .tnfm-modal .modal-icon-circle { width: 48px; height: 48px; background-color: #2ece8a; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(46,206,138,0.2); }
                .tnfm-modal .modal-close-x { border: none; background: transparent; font-size: 24px; color: #aaa; cursor: pointer; transition: color 0.2s; display: flex; align-items: center; justify-content: center; padding: 4px; }
                .tnfm-modal .modal-close-x:hover { color: #555; }
                .tnfm-modal .modal-body-custom { padding: 24px 28px; }
                .tnfm-modal .modal-footer-custom { display: flex; align-items: center; justify-content: flex-end; padding: 20px 28px 24px 28px; border-top: 1px solid #f1f5f9; background-color: #fafbfc; gap: 12px; }
                .tnfm-modal .form-label-custom { font-size: 14px; font-weight: 500; color: #4a5568; margin-bottom: 8px; }
                .tnfm-modal .form-control-custom { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px 16px; font-size: 14px; color: #334155; background-color: #fff; transition: border-color 0.2s, box-shadow 0.2s; width: 100%; }
                .tnfm-modal .form-control-custom:focus { outline: none; border-color: #2ece8a; box-shadow: 0 0 0 3px rgba(46,206,138,0.15); }
                .tnfm-modal .btn-close-custom { background-color: #7A70BA !important; color: white !important; border-radius: 8px !important; font-weight: 500 !important; font-size: 14px !important; padding: 10px 24px !important; border: none !important; cursor: pointer; }
                .tnfm-modal .btn-close-custom:hover { background-color: #6357a7 !important; }
                .tnfm-modal .btn-save-custom { background-color: #2ece8a !important; color: white !important; border-radius: 8px !important; font-weight: 500 !important; font-size: 14px !important; padding: 10px 24px !important; border: none !important; cursor: pointer; }
                .tnfm-modal .btn-save-custom:hover { background-color: #26b277 !important; }
            `}</style>
            <Modal show={show} onHide={onHide} dialogClassName="tnfm-modal modal-md" centered style={{ zIndex: 1060 }}>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 10h16M4 14h10M4 18h6" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                Create Type Name
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Quick add a new machine type</p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={onHide}>&times;</button>
                </div>
                <Form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown}>
                    <div className="modal-body-custom">
                        {isFieldVisible('typename') && (
                            <>
                                <Form.Label className="form-label-custom">Type Name <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    autoFocus
                                    type="text"
                                    className="form-control-custom"
                                    placeholder="e.g. Mechanical"
                                    value={typename}
                                    onChange={(e) => setTypename(e.target.value)}
                                    required
                                />
                            </>
                        )}
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={onHide}>Close</Button>
                        <Button type="submit" className="btn-save-custom">Save</Button>
                    </div>
                </Form>
            </Modal>
        </>
    );
};

export default TypeNameFormModal;
