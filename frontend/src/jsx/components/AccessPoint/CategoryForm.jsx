import React, { useState, useEffect, Fragment } from 'react';
import { Card, Modal, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { getGateCategories, createGateCategory, updateGateCategory, deleteGateCategory } from '../../../services/GateManagementService.js';
import { HuePicker } from 'react-color';
import { usePermission } from '../../../hooks/usePermission';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';

const CategoryForm = () => {
    const { can } = usePermission();
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState([]);
    const [editMode, setEditMode] = useState(false);
    const [editId, setEditId] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        category_no: '',
        narration: '',
        colour_code: '#9400D3' // Default to Violet from VIBGYOR
    });

    // Helper to generate a harmony of colors (2 tints, pure, 2 shades)
    const generateHarmony = (hex) => {
        const h = hexToHsl(hex);
        return [
            hslToHex(h[0], h[1], Math.min(h[2] + 40, 95)), // Tint 2
            hslToHex(h[0], h[1], Math.min(h[2] + 20, 85)), // Tint 1
            hex, // Pure
            hslToHex(h[0], h[1], Math.max(h[2] - 20, 15)), // Shade 1
            hslToHex(h[0], h[1], Math.max(h[2] - 40, 5))  // Shade 2
        ];
    };

    // Color conversion utilities
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

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const data = await getGateCategories();
            setCategories(data || []);
        } catch (error) {
            console.error("Error fetching categories", error);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleEdit = (cat) => {
        setEditMode(true);
        setEditId(cat.id);
        setFormData({
            name: cat.name || '',
            category_no: cat.category_no || '',
            colour_code: cat.colour_code || '#9400D3',
            narration: cat.narration || ''
        });
        setShowModal(true);
    };

    const resetForm = () => {
        setEditMode(false);
        setEditId(null);
        setFormData({ name: '', category_no: '', narration: '', colour_code: '#9400D3' });
        setShowModal(false);
        setTimeout(() => {
            if (document.activeElement && typeof document.activeElement.blur === 'function') {
                document.activeElement.blur();
            }
        }, 100);
    };

    useEffect(() => {
        if (showModal) {
            const timer = setTimeout(() => {
                const inputs = Array.from(
                    document.querySelectorAll('.gate-custom-modal input:not([disabled]):not([readonly]), .gate-custom-modal textarea:not([disabled]):not([readonly])')
                ).filter(el => el.offsetParent !== null && el.type !== 'hidden');
                if (inputs.length > 0) {
                    inputs[0].focus();
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [showModal]);

    const getFocusable = () => {
        const modal = document.querySelector('.gate-custom-modal');
        if (!modal) return [];
        return Array.from(
            modal.querySelectorAll(
                '.form-control-custom, button[type="submit"]:not([disabled])'
            )
        ).filter(el => el.offsetParent !== null && !el.disabled);
    };

    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        if (e.target.tagName.toLowerCase() === 'textarea' && e.shiftKey) return;

        const all = getFocusable();
        const index = all.indexOf(document.activeElement);
        if (index > -1 && index < all.length - 1) {
            e.preventDefault();
            if (index === all.length - 2) {
                all[all.length - 1].click();
            } else {
                all[index + 1].focus();
            }
        }
    };

    const handleFocus = (e) => {
        if (e.target.tagName === 'INPUT' && (e.target.type === 'number' || e.target.type === 'text')) {
            e.target.select();
        }
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Category?',
            text: `Are you sure you want to delete "${name || 'this category'}"? All linked sub-categories and tags will be affected!`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deleteGateCategory(id);
                Swal.fire({
                    title: 'Deleted!',
                    text: 'Category has been deleted.',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false,
                    returnFocus: false
                });
                fetchCategories();
            } catch (error) {
                Swal.fire({
                    title: 'Error!',
                    text: 'Failed to delete category.',
                    icon: 'error',
                    returnFocus: false
                });
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const trimmedName = (formData.name || '').trim().toLowerCase();
        const trimmedNo = (formData.category_no || '').trim().toLowerCase();
        const trimmedColor = (formData.colour_code || '').trim().toLowerCase();

        const duplicateName = categories.some(cat => {
            if (editMode && cat.id === editId) return false;
            return (cat.name || '').trim().toLowerCase() === trimmedName;
        });

        if (duplicateName) {
            Swal.fire({
                icon: 'warning',
                title: 'Duplicate Name',
                text: 'A category with this name already exists!',
                returnFocus: false
            });
            return;
        }

        if (trimmedNo) {
            const duplicateCode = categories.some(cat => {
                if (editMode && cat.id === editId) return false;
                return (cat.category_no || '').trim().toLowerCase() === trimmedNo;
            });

            if (duplicateCode) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Duplicate Code',
                    text: 'A category with this Category No / Code already exists!',
                    returnFocus: false
                });
                return;
            }
        }

        if (trimmedColor) {
            const duplicateColor = categories.some(cat => {
                if (editMode && cat.id === editId) return false;
                return (cat.colour_code || '').trim().toLowerCase() === trimmedColor;
            });

            if (duplicateColor) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Duplicate Color',
                    text: 'A category with this color code already exists! Please select a different color.',
                    returnFocus: false
                });
                return;
            }
        }

        try {
            setLoading(true);
            if (editMode) {
                await updateGateCategory(editId, formData);
                Swal.fire({
                    icon: 'success',
                    title: 'Updated',
                    text: 'Category updated successfully',
                    timer: 2000,
                    showConfirmButton: false,
                    returnFocus: false
                });
            } else {
                await createGateCategory(formData);
                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: 'Category created successfully',
                    timer: 2000,
                    showConfirmButton: false,
                    returnFocus: false
                });
            }
            resetForm();
            fetchCategories();
        } catch (error) {
            console.error("Error saving category:", error);
            const errorMsg = error.response?.data?.name?.[0] ||
                error.response?.data?.category_no?.[0] ||
                error.response?.data?.colour_code?.[0] ||
                error.response?.data?.detail ||
                `Failed to ${editMode ? 'update' : 'create'} category.`;
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: errorMsg,
                returnFocus: false
            });
        } finally {
            setLoading(false);
            setTimeout(() => {
                if (document.activeElement && typeof document.activeElement.blur === 'function') {
                    document.activeElement.blur();
                }
            }, 100);
        }
    };

    const filteredCategories = categories.filter(cat =>
        (cat.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cat.category_no || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cat.narration || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="container-fluid">
            <div className="page-titles">
                <button
                    onClick={() => window.history.back()}
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div>

            <div className="row">
                <div className="col-xl-12">
                    <Card>
                        <Card.Header className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 border-0 pb-0">
                            <Card.Title className="mb-0 text-nowrap">Visitor Categories</Card.Title>
                            <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-3 flex-grow-1 justify-content-md-end">
                                <div className="search-bar-container w-100 m-0" style={{ maxWidth: '250px' }}>
                                    <span className="search-icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                    </span>
                                    <input
                                        type="text"
                                        className="search-input"
                                        placeholder="Search Category..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                            }
                                        }}
                                    />
                                </div>
                                <div className="d-flex gap-2 align-items-center justify-content-start flex-shrink-0">
                                    <CreateButton
                                        module="access_categories"
                                        onClick={() => {
                                            resetForm();
                                            setShowModal(true);
                                        }}
                                    >
                                        Category
                                    </CreateButton>
                                </div>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            {loading && categories.length === 0 ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-responsive-md">
                                        <thead>
                                            <tr>
                                                <th><strong>NAME</strong></th>
                                                <th><strong>CODE</strong></th>
                                                <th><strong>COLOR</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredCategories.length === 0 ? (
                                                <tr>
                                                    <td colSpan="4" className="text-center py-4 text-muted">
                                                        No entries
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredCategories.map((cat) => (
                                                    <tr key={cat.id}>
                                                        <td><strong>{cat.name || '-'}</strong></td>
                                                        <td>{cat.category_no || '-'}</td>
                                                        <td>
                                                            <span className="d-flex align-items-center gap-2">
                                                                <i className="fa fa-stop" style={{ color: cat.colour_code, fontSize: '1.2rem', filter: `drop-shadow(0 0 5px ${cat.colour_code})` }}></i>
                                                                <small className="text-muted" style={{ fontSize: '12px', fontFamily: 'monospace' }}>{cat.colour_code}</small>
                                                            </span>
                                                        </td>
                                                        <td className="text-end">
                                                            {can('access-point-categories', 'edit') || can('access-point-categories', 'delete') ? (
                                                                <div className="d-flex justify-content-end">
                                                                    <EditButton
                                                                        module="access_categories"
                                                                        onClick={() => handleEdit(cat)}
                                                                        className="me-1"
                                                                    />
                                                                    <DeleteButton
                                                                        module="access_categories"
                                                                        onClick={() => handleDelete(cat.id, cat.name)}
                                                                    />
                                                                </div>
                                                            ) : null}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {/* Custom Styled Popup Modal matching StockItem and Gate modal style */}
            <Modal
                show={showModal}
                onHide={resetForm}
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
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM10 19H5V5H10V19ZM19 19H12V5H19V19Z" fill="white" />
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editMode ? 'Edit Category' : 'Save'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage visitor category
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={resetForm}>
                        &times;
                    </button>
                </div>

                <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown} onFocus={handleFocus}>
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
                        <button type="button" className="btn-close-custom" onClick={resetForm}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-save-custom" disabled={loading}>
                            {loading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                    Saving...
                                </>
                            ) : (
                                editMode ? 'Update Category' : 'Save'
                            )}
                        </button>
                    </div>
                </Form>
            </Modal>

            <style dangerouslySetInnerHTML={{
                __html: `
                .gate-custom-modal .modal-content {
                    border: none;
                    border-radius: 16px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
                    overflow: hidden;
                }
                .gate-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .gate-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #2ece8a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
                }
                .gate-custom-modal .modal-close-x {
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
                .gate-custom-modal .modal-close-x:hover {
                    color: #555;
                }
                .gate-custom-modal .modal-body-custom {
                    padding: 24px 28px;
                    max-height: 70vh;
                    overflow-y: auto;
                }
                .gate-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .gate-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .gate-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .gate-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                }
                .gate-custom-modal .form-control-custom::placeholder {
                    color: #94a3b8;
                }
                .gate-custom-modal .btn-close-custom {
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
                .gate-custom-modal .btn-close-custom:hover {
                    background-color: #6357a7 !important;
                }
                .gate-custom-modal .btn-save-custom {
                    background-color: #2ece8a !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s;
                    display: inline-flex;
                    align-items: center;
                }
                .gate-custom-modal .btn-save-custom:hover:not(:disabled) {
                    background-color: #25a870 !important;
                }
                .gate-custom-modal .btn-save-custom:disabled {
                    opacity: 0.65;
                    cursor: not-allowed;
                }
                .gem-node {
                    width: 28px; height: 28px; border-radius: 50%; cursor: pointer; position: relative;
                    transition: all 0.3s ease;
                    background: var(--gem-color);
                    border: 2px solid rgba(0,0,0,0.15);
                }
                .gem-inner {
                    position: absolute; top: 15%; left: 15%; width: 70%; height: 70%;
                    background: linear-gradient(135deg, rgba(255,255,255,0.6) 0%, transparent 100%);
                    border-radius: 50%;
                }
                .gem-node.active { transform: scale(1.2); border: 2px solid #2ece8a; box-shadow: 0 0 8px var(--gem-color); }
                `
            }} />
        </div>
    );
};

export default CategoryForm;
