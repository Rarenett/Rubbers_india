import React, { useState, useEffect } from 'react';
import { Modal, Form } from 'react-bootstrap';
import { HuePicker } from 'react-color';
import Swal from 'sweetalert2';
import { createGateCategory, updateGateCategory } from '../../../services/GateManagementService';
import './AccessPoint.css';

const generateHarmony = (hex) => {
    const h = hexToHsl(hex);
    return [
        hslToHex(h[0], h[1], Math.min(h[2] + 40, 95)),
        hslToHex(h[0], h[1], Math.min(h[2] + 20, 85)),
        hex,
        hslToHex(h[0], h[1], Math.max(h[2] - 20, 15)),
        hslToHex(h[0], h[1], Math.max(h[2] - 40, 5))
    ];
};

function hexToHsl(hex) {
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) h = s = 0;
    else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
            default: break;
        }
        h /= 6;
    }
    return [h * 360, s * 100, l * 100];
}

function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

const CategoryFormModal = ({ show, onHide, onSaved, editCategory = null }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        category_no: '',
        narration: '',
        colour_code: '#9400D3'
    });

    useEffect(() => {
        if (show) {
            if (editCategory) {
                setFormData({
                    name: editCategory.name || '',
                    category_no: editCategory.category_no || '',
                    narration: editCategory.narration || '',
                    colour_code: editCategory.colour_code || '#9400D3'
                });
            } else {
                setFormData({
                    name: '',
                    category_no: '',
                    narration: '',
                    colour_code: '#9400D3'
                });
            }
        }
    }, [show, editCategory]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name || !formData.name.trim()) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Category Name is required.',
                returnFocus: false
            });
            return;
        }

        try {
            setLoading(true);
            let response;
            if (editCategory && editCategory.id) {
                response = await updateGateCategory(editCategory.id, formData);
            } else {
                response = await createGateCategory(formData);
            }

            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: editCategory ? 'Category updated successfully' : 'Category created successfully',
                timer: 1500,
                showConfirmButton: false,
                returnFocus: false
            });

            if (onSaved) {
                onSaved(response);
            }
            if (onHide) {
                onHide();
            }
        } catch (error) {
            console.error("Error saving category", error);
            let errorMsg = 'Failed to save category.';
            if (error.response && error.response.data) {
                const data = error.response.data;
                errorMsg = data.detail || data.name || data.message || errorMsg;
                if (Array.isArray(errorMsg)) errorMsg = errorMsg.join(' ');
            }
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: errorMsg,
                returnFocus: false
            });
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
            if (e.target.tagName === 'TEXTAREA' && !e.ctrlKey) {
                return;
            }
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
                }
            }
        }
    };

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
                        <i className="fa fa-tags text-white" style={{ fontSize: '18px' }}></i>
                    </div>
                    <div>
                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                            {editCategory ? 'Edit Category' : 'Create Category'}
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            Enter details to manage visitor category
                        </p>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={onHide}>
                    &times;
                </button>
            </div>

            <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
                <div className="modal-body-custom">
                    <div className="mb-3">
                        <Form.Label className="form-label-custom">Category Name <span className="text-danger">*</span></Form.Label>
                        <Form.Control
                            type="text"
                            name="name"
                            className="form-control-custom"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="e.g. Vendor, Client"
                            autoFocus
                            required
                        />
                    </div>

                    <div className="mb-3">
                        <Form.Label className="form-label-custom">Category No</Form.Label>
                        <Form.Control
                            type="text"
                            name="category_no"
                            className="form-control-custom"
                            value={formData.category_no}
                            onChange={handleChange}
                            placeholder="e.g. CAT-01"
                        />
                    </div>

                    <div className="mb-3">
                        <div className="prism-harmony-outer p-3 rounded-3 position-relative overflow-hidden" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <span className="text-uppercase fw-bold" style={{ fontSize: '11px', color: '#64748b' }}>Color Harmony</span>
                                <div className="font-monospace fw-bold" style={{ color: formData.colour_code, fontSize: '12px' }}>
                                    {formData.colour_code.toUpperCase()}
                                </div>
                            </div>

                            <div className="mb-3">
                                <HuePicker
                                    color={formData.colour_code}
                                    onChange={(color) => setFormData({ ...formData, colour_code: color.hex })}
                                    width="100%"
                                />
                            </div>

                            <div className="d-flex justify-content-between align-items-center px-2">
                                {generateHarmony(formData.colour_code).map((hex, i) => (
                                    <div key={i} className="harmony-column text-center">
                                        <div
                                            onClick={() => setFormData({ ...formData, colour_code: hex })}
                                            className={`gem-node ${formData.colour_code.toLowerCase() === hex.toLowerCase() ? 'active' : ''}`}
                                            style={{ '--gem-color': hex }}
                                        >
                                            <div className="gem-inner"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="mb-3">
                        <Form.Label className="form-label-custom">Narration</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={2}
                            name="narration"
                            className="form-control-custom"
                            value={formData.narration}
                            onChange={handleChange}
                            placeholder="Enter narration or description"
                        />
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
                                Saving...
                            </>
                        ) : (
                            editCategory ? 'Update Category' : 'Create Category'
                        )}
                    </button>
                </div>
            </Form>
        </Modal>
    );
};

export default CategoryFormModal;
