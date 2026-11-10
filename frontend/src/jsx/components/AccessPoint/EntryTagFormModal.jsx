import React, { useState, useEffect } from 'react';
import { Modal, Form } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import { createEntryTag, getGateCategories, getGateSubCategories } from '../../../services/GateManagementService';
import './AccessPoint.css';

const selectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: '38px',
        height: '38px',
        borderRadius: '10px',
        borderColor: state.isFocused ? '#0a500f' : '#cbd5e1',
        boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 80, 15, 0.15)' : 'none',
        '&:hover': {
            borderColor: state.isFocused ? '#0a500f' : '#94a3b8'
        },
        fontSize: '13px'
    }),
    valueContainer: (base) => ({
        ...base,
        padding: '0 12px',
        height: '36px'
    }),
    input: (base) => ({
        ...base,
        margin: '0',
        padding: '0'
    }),
    indicatorsContainer: (base) => ({
        ...base,
        height: '36px'
    }),
    menu: (base) => ({
        ...base,
        zIndex: 9999,
        borderRadius: '10px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)'
    }),
    option: (base, state) => ({
        ...base,
        fontSize: '13px',
        backgroundColor: state.isSelected ? '#0a500f' : state.isFocused ? 'rgba(10, 80, 15, 0.1)' : 'transparent',
        color: state.isSelected ? 'white' : '#334155',
        '&:active': {
            backgroundColor: '#0a500f',
            color: 'white'
        }
    })
};

const EntryTagFormModal = ({ show, onHide, onSaved, existingCategories = [] }) => {
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubCategories] = useState([]);
    const [formData, setFormData] = useState({
        tag_type: '',
        tag_code: '',
        category: '',
        subcategory: '',
        sl_no_from: '',
        sl_no_to: ''
    });

    useEffect(() => {
        if (show) {
            setFormData({
                tag_type: '',
                tag_code: '',
                category: '',
                subcategory: '',
                sl_no_from: '',
                sl_no_to: ''
            });
            fetchCategories();
        }
    }, [show]);

    const fetchCategories = async () => {
        try {
            const cats = await getGateCategories();
            setCategories(Array.isArray(cats) ? cats : []);
        } catch (err) {
            console.error("Error loading categories:", err);
            setCategories(existingCategories);
        }
    };

    const handleCategoryChange = async (sel) => {
        const catId = sel ? sel.value : '';
        setFormData(prev => ({ ...prev, category: catId, subcategory: '' }));
        if (catId) {
            try {
                const subs = await getGateSubCategories(catId);
                setSubCategories(Array.isArray(subs) ? subs : []);
            } catch (err) {
                console.error("Error loading subcategories:", err);
                setSubCategories([]);
            }
        } else {
            setSubCategories([]);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.tag_type || !formData.tag_type.trim()) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Tag Type is required.', returnFocus: false });
            return;
        }
        if (!formData.category) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Visitor Category is required.', returnFocus: false });
            return;
        }
        if (!formData.sl_no_from || !formData.sl_no_to) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Serial No From and To are required.', returnFocus: false });
            return;
        }
        if (parseInt(formData.sl_no_from) > parseInt(formData.sl_no_to)) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Serial No From cannot be greater than Serial No To.', returnFocus: false });
            return;
        }

        try {
            setLoading(true);
            const res = await createEntryTag(formData);
            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: 'Entry tags generated successfully',
                timer: 1500,
                showConfirmButton: false,
                returnFocus: false
            });
            if (onSaved) onSaved(res);
            if (onHide) onHide();
        } catch (error) {
            console.error("Error creating entry tags:", error);
            let errorMsg = 'Failed to generate entry tags.';
            if (error.response?.data) {
                const data = error.response.data;
                errorMsg = data.detail || data.message || errorMsg;
                if (Array.isArray(errorMsg)) errorMsg = errorMsg.join(' ');
            }
            Swal.fire({ icon: 'error', title: 'Error', text: errorMsg, returnFocus: false });
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            const swalContainer = document.querySelector('.swal2-container');
            if (swalContainer) {
                e.preventDefault();
                const okBtn = swalContainer.querySelector('.swal2-confirm');
                if (okBtn) okBtn.click();
                return;
            }
            if (e.target.tagName === 'TEXTAREA' && !e.ctrlKey) return;
            const focusable = Array.from(
                document.querySelectorAll('.gate-custom-modal input, .gate-custom-modal select, .gate-custom-modal textarea, .gate-custom-modal button[type="submit"]')
            ).filter(el => !el.disabled && el.offsetParent !== null && el.tabIndex !== -1);
            const idx = focusable.indexOf(document.activeElement);
            if (idx > -1 && idx < focusable.length - 1) {
                e.preventDefault();
                const next = focusable[idx + 1];
                if (next.type === 'submit') {
                    next.click();
                } else {
                    next.focus();
                    if (next.classList.contains('react-select__control')) {
                        const inp = next.querySelector('input');
                        if (inp) inp.focus();
                    }
                }
            }
        }
    };

    const catOptions = categories.map(c => ({ value: c.id, label: c.name }));
    const subOptions = subcategories.map(s => ({ value: s.id, label: s.name }));

    return (
        <Modal
            show={show}
            onHide={onHide}
            dialogClassName="gate-custom-modal"
            backdrop="static"
            keyboard={false}
            restoreFocus={false}
            size="md"
            centered
        >
            <div className="modal-header-custom">
                <div className="d-flex align-items-center gap-3">
                    <div className="modal-icon-circle">
                        <i className="fa fa-id-badge text-white" style={{ fontSize: '18px' }}></i>
                    </div>
                    <div>
                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                            Generate Entry Tags
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            Enter details to generate tag 
                        </p>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={onHide}>
                    &times;
                </button>
            </div>

            <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
                <div className="modal-body-custom">
                    <div className="row mb-3">
                        <div className="col-md-6">
                            <Form.Label className="form-label-custom">Tag Type <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                type="text"
                                name="tag_type"
                                className="form-control-custom"
                                value={formData.tag_type}
                                onChange={handleChange}
                                placeholder="e.g. Visitor Tag"
                                autoFocus
                                required
                            />
                        </div>
                        <div className="col-md-6">
                            <Form.Label className="form-label-custom">Tag Code</Form.Label>
                            <Form.Control
                                type="text"
                                name="tag_code"
                                className="form-control-custom"
                                value={formData.tag_code}
                                onChange={handleChange}
                                placeholder="e.g. VISTAG"
                            />
                        </div>
                    </div>

                    <div className="mb-3">
                        <Form.Label className="form-label-custom">Visitor Category <span className="text-danger">*</span></Form.Label>
                        <Select
                            classNamePrefix="react-select"
                            options={catOptions}
                            value={catOptions.find(o => String(o.value) === String(formData.category)) || null}
                            onChange={handleCategoryChange}
                            placeholder="Select Category..."
                            isClearable
                            styles={selectStyles}
                        />
                    </div>

                    <div className="mb-3">
                        <Form.Label className="form-label-custom">Sub-Category (Optional)</Form.Label>
                        <Select
                            classNamePrefix="react-select"
                            options={subOptions}
                            value={subOptions.find(o => String(o.value) === String(formData.subcategory)) || null}
                            onChange={(sel) => setFormData(prev => ({ ...prev, subcategory: sel ? sel.value : '' }))}
                            placeholder="Select Sub-Category..."
                            isClearable
                            styles={selectStyles}
                            isDisabled={!formData.category}
                        />
                    </div>

                    <div className="row mb-3">
                        <div className="col-md-6">
                            <Form.Label className="form-label-custom">Serial No From <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                type="number"
                                name="sl_no_from"
                                className="form-control-custom"
                                value={formData.sl_no_from}
                                onChange={handleChange}
                                placeholder="e.g. 100"
                                required
                            />
                        </div>
                        <div className="col-md-6">
                            <Form.Label className="form-label-custom">Serial No To <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                type="number"
                                name="sl_no_to"
                                className="form-control-custom"
                                value={formData.sl_no_to}
                                onChange={handleChange}
                                placeholder="e.g. 200"
                                required
                            />
                        </div>
                    </div>
                </div>

                <div className="modal-footer-custom">
                    <button type="button" className="btn-close-custom" onClick={onHide}>
                        Cancel
                    </button>
                    <button type="submit" className="btn-save-custom" disabled={loading}>
                        {loading ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                Generating...
                            </>
                        ) : (
                            'Generate Tags'
                        )}
                    </button>
                </div>
            </Form>
        </Modal>
    );
};

export default EntryTagFormModal;
