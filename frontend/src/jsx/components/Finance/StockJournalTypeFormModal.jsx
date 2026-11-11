import React, { useState, useEffect, useRef } from 'react';
import { Button, Modal, Form } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import {
    createStockJournalType,
    updateStockJournalType,
} from '../../../services/FinanceService';

const MOVEMENT_OPTIONS = [
    { value: 'IN', label: 'Production' },
    { value: 'OUT', label: 'Consumption' },
    { value: 'IN & OUT', label: 'Production/Consumption' },
];

const EMPTY_FORM = {
    id: null,
    stock_journal_type: '',
    movement_type: '',
};

/**
 * StockJournalTypeFormModal
 *
 * Props:
 *  - show            {boolean}     - controls modal visibility
 *  - onHide          {function}    - called when modal should close
 *  - onSaved         {function}    - called after a successful save
 *  - editItem        {object|null} - pass a record to edit; null for create mode
 */
const StockJournalTypeFormModal = ({ show, onHide, onSaved, editItem = null }) => {
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [editMode, setEditMode] = useState(false);
    const currentSelectControlRef = useRef(null);

    // Populate form when editItem changes or modal opens
    useEffect(() => {
        if (show) {
            if (editItem) {
                setForm({
                    id: editItem.id,
                    stock_journal_type: editItem.stock_journal_type || '',
                    movement_type: editItem.movement_type || '',
                });
                setEditMode(true);
            } else {
                setForm({ ...EMPTY_FORM });
                setEditMode(false);
            }
        }
    }, [show, editItem]);

    // Auto-focus first input on open
    useEffect(() => {
        if (show) {
            const timer = setTimeout(() => {
                const inputs = Array.from(
                    document.querySelectorAll('.sjtfm-modal input:not([disabled]):not([readonly])')
                ).filter(el => el.offsetParent !== null && el.type !== 'hidden');
                if (inputs.length > 0) inputs[0].focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [show]);

    // ── Keyboard navigation ──────────────────────────────────────────────
    const getFocusable = () => {
        const modal = document.querySelector('.sjtfm-modal');
        if (!modal) return [];
        return Array.from(
            modal.querySelectorAll(
                '.form-control-custom, .react-select__control, button[type="submit"]:not([disabled])'
            )
        ).filter(el => el.offsetParent !== null && !el.disabled);
    };

    const focusNextFromControl = (control) => {
        const all = getFocusable();
        const index = all.indexOf(control);
        if (index > -1 && index < all.length - 1) {
            const next = all[index + 1];
            if (next.classList.contains('react-select__control')) {
                next.querySelector('input')?.focus();
            } else {
                next.focus();
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        const all = getFocusable();
        const index = all.indexOf(document.activeElement);
        if (index > -1 && index < all.length - 1) {
            e.preventDefault();
            const next = all[index + 1];
            if (index === all.length - 2) {
                all[all.length - 1].click();
            } else if (next.classList.contains('react-select__control')) {
                next.querySelector('input')?.focus();
            } else {
                next.focus();
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

    const handleFocus = (e) => {
        if (e.target.tagName === 'INPUT' && (e.target.type === 'number' || e.target.type === 'text')) {
            e.target.select();
        }
    };
    // ─────────────────────────────────────────────────────────────────────

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '38px',
            borderColor: state.isFocused ? '#6d4aff' : '#e0e0e0',
            boxShadow: state.isFocused ? '0 0 0 2px rgba(109,74,255,0.15)' : 'none',
            '&:hover': { borderColor: '#6d4aff' },
            borderRadius: '6px',
            fontSize: '0.875rem',
        }),
        menu: base => ({ ...base, zIndex: 99999, fontSize: '0.875rem' }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#6d4aff' : state.isFocused ? '#f0ecff' : 'white',
            color: state.isSelected ? 'white' : '#333',
            cursor: 'pointer',
        }),
    };

    const handleClose = () => {
        setForm({ ...EMPTY_FORM });
        onHide();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.stock_journal_type.trim()) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Stock Journal Type name is required.' });
            return;
        }
        if (!form.movement_type) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Movement Type is required.' });
            return;
        }

        try {
            const payload = {
                stock_journal_type: form.stock_journal_type.trim(),
                movement_type: form.movement_type,
            };

            let saved;
            if (editMode) {
                saved = await updateStockJournalType(form.id, payload);
                Swal.fire({ icon: 'success', title: 'Updated', text: 'Stock journal type updated successfully', timer: 2000, showConfirmButton: false });
            } else {
                saved = await createStockJournalType(payload);
                Swal.fire({ icon: 'success', title: 'Created', text: 'Stock journal type created successfully', timer: 2000, showConfirmButton: false });
            }

            handleClose();
            if (onSaved) onSaved(saved);
        } catch (error) {
            let errorMsg = `Failed to ${editMode ? 'update' : 'create'} stock journal type`;
            if (error.response && error.response.data) {
                const data = error.response.data;
                if (typeof data === 'object') {
                    errorMsg = Object.keys(data)
                        .map(key => `${key.replace(/_/g, ' ').toUpperCase()}: ${Array.isArray(data[key]) ? data[key].join(', ') : data[key]}`)
                        .join('\n');
                } else if (typeof data === 'string') {
                    errorMsg = data;
                }
            }
            Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
        }
    };

    const movementValue = MOVEMENT_OPTIONS.find(opt => opt.value === form.movement_type) || null;

    return (
        <>
            <style>{`
                .sjtfm-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .sjtfm-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .sjtfm-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: var(--form-icon-color, #0a500f);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .sjtfm-modal .modal-close-x {
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
                .sjtfm-modal .modal-close-x:hover { color: #555; }
                .sjtfm-modal .modal-body-custom { padding: 24px 28px; }
                .sjtfm-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .sjtfm-modal .form-label-custom {
                    font-size: 14px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 8px;
                }
                .sjtfm-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 12px 16px;
                    font-size: 14px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .sjtfm-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .sjtfm-modal .form-control-custom::placeholder { color: #94a3b8; }
                .sjtfm-modal .btn-close-custom {
                    background-color: var(--cancel-btn-color, #dc3545) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .sjtfm-modal .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .sjtfm-modal .btn-save-custom {
                    background-color: var(--save-btn-color, #0a500f) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .sjtfm-modal .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }
            `}</style>

            <Modal
                show={show}
                onHide={handleClose}
                dialogClassName="sjtfm-modal modal-md"
                centered
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" fill="white"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editMode ? 'Edit Stock Journal Type' : 'Create Stock Journal Type'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage stock journal type
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={handleClose}>&times;</button>
                </div>

                <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown} onFocus={handleFocus}>
                    <div className="modal-body-custom">
                        <div className="row">
                            <div className="col-md-12 mb-3">
                                <Form.Label className="form-label-custom">
                                    Stock Journal Type <span className="text-danger">*</span>
                                </Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    value={form.stock_journal_type}
                                    onChange={(e) => setForm({ ...form, stock_journal_type: e.target.value })}
                                    placeholder="Enter stock journal type"
                                    required
                                />
                            </div>
                            <div className="col-md-12 mb-3">
                                <Form.Label className="form-label-custom">
                                    Movement Type <span className="text-danger">*</span>
                                </Form.Label>
                                <Select
                                    classNamePrefix="react-select"
                                    options={MOVEMENT_OPTIONS}
                                    value={movementValue}
                                    onChange={(opt) => {
                                        setForm({ ...form, movement_type: opt ? opt.value : '' });
                                        if (opt) {
                                            const control = currentSelectControlRef.current;
                                            setTimeout(() => { if (control) focusNextFromControl(control); }, 50);
                                        }
                                    }}
                                    onFocus={handleSelectFocus}
                                    onKeyDown={handleSelectKeyDown}
                                    openMenuOnFocus={true}
                                    placeholder="Select movement type"
                                    styles={selectStyles}
                                    isClearable
                                />
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={handleClose}>Close</Button>
                        <Button type="submit" className="btn-save-custom">Save</Button>
                    </div>
                </Form>
            </Modal>
        </>
    );
};

export default StockJournalTypeFormModal;
