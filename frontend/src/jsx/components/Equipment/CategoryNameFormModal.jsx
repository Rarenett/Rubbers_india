import React, { useState, useEffect } from 'react';
import { Button, Modal, Form } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import { createCategoryName, getTypeNames } from '../../../services/MachineManagementService';
import TypeNameFormModal from './TypeNameFormModal';
import { useEnterTraversal } from '../../../hooks/useEnterTraversal';

const CategoryNameFormModal = ({ show, onHide, onSaved }) => {
    const [formData, setFormData] = useState({ categoryname: '', typename: '' });
    const [typeNames, setTypeNames] = useState([]);
    
    const [showTypeModal, setShowTypeModal] = useState(false);

    const { handleFormKeyDown, handleSelectFocus, handleSelectKeyDown, makeSelectChange } = useEnterTraversal('.cnfm-modal', setFormData);

    useEffect(() => {
        if (show) {
            setFormData({ categoryname: '', typename: '' });
            fetchTypeNames();
        }
    }, [show]);

    const fetchTypeNames = async () => {
        try {
            const data = await getTypeNames();
            setTypeNames(data);
        } catch (error) {
            console.error('Failed to fetch type names', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.categoryname.trim()) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Category Name is required' });
            return;
        }
        if (!formData.typename) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Please select a Type Name' });
            return;
        }
        try {
            const result = await createCategoryName({ categoryname: formData.categoryname.trim(), typename: formData.typename });
            Swal.fire({ icon: 'success', title: 'Created', text: 'Category name created successfully', timer: 2000, showConfirmButton: false });
            if (onSaved) onSaved(result);
            onHide();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to create category name' });
        }
    };

    const typeOptions = typeNames.map(t => ({ value: t.id, label: t.typename }));

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '44px',
            borderColor: state.isFocused ? '#0a500f' : '#cbd5e1',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 80, 15,0.15)' : 'none',
            '&:hover': { borderColor: '#0a500f' },
            borderRadius: '10px',
            fontSize: '14px',
        }),
        menu: base => ({ ...base, zIndex: 99999, fontSize: '14px' }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#0a500f' : state.isFocused ? '#eafff5' : 'white',
            color: state.isSelected ? 'white' : '#333',
            cursor: 'pointer',
        }),
    };

    return (
        <>
            <style>{`
                .cnfm-modal .modal-content { border-radius: 16px !important; border: none !important; box-shadow: 0 10px 40px rgba(0,0,0,0.12) !important; overflow: hidden; }
                .cnfm-modal .modal-header-custom { display: flex; align-items: center; justify-content: space-between; padding: 24px 28px 16px 28px; border-bottom: 1px solid #f1f5f9; }
                .cnfm-modal .modal-icon-circle { width: 48px; height: 48px; background-color: #0a500f; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(10, 80, 15,0.2); }
                .cnfm-modal .modal-close-x { border: none; background: transparent; font-size: 24px; color: #aaa; cursor: pointer; transition: color 0.2s; display: flex; align-items: center; justify-content: center; padding: 4px; }
                .cnfm-modal .modal-close-x:hover { color: #555; }
                .cnfm-modal .modal-body-custom { padding: 24px 28px; }
                .cnfm-modal .modal-footer-custom { display: flex; align-items: center; justify-content: flex-end; padding: 20px 28px 24px 28px; border-top: 1px solid #f1f5f9; background-color: #fafbfc; gap: 12px; }
                .cnfm-modal .form-label-custom { font-size: 14px; font-weight: 500; color: #4a5568; margin-bottom: 8px; }
                .cnfm-modal .form-control-custom { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px 16px; font-size: 14px; color: #334155; background-color: #fff; transition: border-color 0.2s, box-shadow 0.2s; width: 100%; }
                .cnfm-modal .form-control-custom:focus { outline: none; border-color: #0a500f; box-shadow: 0 0 0 3px rgba(10, 80, 15,0.15); }
                .cnfm-modal .btn-close-custom { background-color: #dc3545 !important; color: white !important; border-radius: 8px !important; font-weight: 500 !important; font-size: 14px !important; padding: 10px 24px !important; border: none !important; cursor: pointer; }
                .cnfm-modal .btn-close-custom:hover { background-color: #bb2d3b !important; }
                .cnfm-modal .btn-save-custom { background-color: #0a500f !important; color: white !important; border-radius: 8px !important; font-weight: 500 !important; font-size: 14px !important; padding: 10px 24px !important; border: none !important; cursor: pointer; }
                .cnfm-modal .btn-save-custom:hover { background-color: #073d0b !important; }
                .quick-add-btn {
                    display: inline-flex; align-items: center; justify-content: center;
                    width: 44px; height: 44px; border-radius: 8px;
                    background: linear-gradient(135deg, #0a500f, #073d0b); border: none;
                    color: white; font-size: 20px; font-weight: 400; line-height: 1;
                    cursor: pointer; flex-shrink: 0; transition: opacity 0.2s, transform 0.15s;
                    box-shadow: 0 2px 6px rgba(10, 80, 15,0.35);
                }
                .quick-add-btn:hover { opacity: 0.88; transform: scale(1.05); }
                .quick-add-btn:active { transform: scale(0.96); }
            `}</style>
            
            <Modal show={show} onHide={onHide} dialogClassName="cnfm-modal modal-md" centered style={{ zIndex: 1055 }}>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 7h18M3 12h12M3 17h8" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                Create Category Name
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Quick add a new machine category</p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={onHide}>&times;</button>
                </div>
                <Form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown}>
                    <div className="modal-body-custom">
                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Category Name <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                autoFocus
                                type="text"
                                className="form-control-custom"
                                placeholder="e.g. Engine Parts"
                                value={formData.categoryname}
                                onChange={(e) => setFormData({ ...formData, categoryname: e.target.value })}
                                required
                            />
                        </div>
                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Type Name <span className="text-danger">*</span></Form.Label>
                            <div className="d-flex align-items-center gap-2">
                                <div className="flex-grow-1">
                                    <Select
                                        classNamePrefix="react-select"
                                        openMenuOnFocus={true}
                                        options={typeOptions}
                                        value={typeOptions.find(opt => opt.value === formData.typename) || null}
                                        onChange={makeSelectChange('typename')}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        placeholder="Select Type Name"
                                        styles={selectStyles}
                                        isClearable
                                    />
                                </div>
                                <button type="button" className="quick-add-btn" onClick={() => setShowTypeModal(true)} title="Add New Type Name">+</button>
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={onHide}>Close</Button>
                        <Button type="submit" className="btn-save-custom">Save</Button>
                    </div>
                </Form>
            </Modal>

            {/* Quick Add Type Name Modal */}
            <TypeNameFormModal 
                show={showTypeModal} 
                onHide={() => setShowTypeModal(false)}
                onSaved={(newType) => {
                    fetchTypeNames();
                    setFormData({ ...formData, typename: newType.id });
                }}
            />
        </>
    );
};

export default CategoryNameFormModal;
