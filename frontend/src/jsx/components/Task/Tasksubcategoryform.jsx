import React from 'react';
import { Modal, Form } from 'react-bootstrap';

/**
 * Modal form for creating/editing a Task Sub-Category.
 * `categories` — list of TaskCategory objects ({ id, category_name }) used to populate the dropdown.
 */
const TaskSubCategoryForm = ({ show, onHide, editId, formData, setFormData, categories, onSubmit, saving }) => {

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    return (
        <Modal
            show={show}
            onHide={onHide}
            dialogClassName="item-custom-modal"
            backdrop="static"
            keyboard={false}
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
                            {editId ? 'Edit Sub-Category' : 'Add Sub-Category'}
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            Enter details to manage task sub-category
                        </p>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={onHide}>
                    &times;
                </button>
            </div>

            <Form onSubmit={onSubmit}>
                <div className="modal-body-custom">
                    <div className="mb-3">
                        <Form.Label className="form-label-custom">
                            Category <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Select
                            name="category"
                            className="form-control-custom"
                            value={formData.category || ''}
                            onChange={handleChange}
                            required
                        >
                            <option value="">Select category...</option>
                            {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                    {cat.category_name}
                                </option>
                            ))}
                        </Form.Select>
                    </div>

                    <div className="mb-3">
                        <Form.Label className="form-label-custom">
                            Sub-Category Name <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                            type="text"
                            name="subcategory_name"
                            className="form-control-custom"
                            value={formData.subcategory_name || ''}
                            onChange={handleChange}
                            placeholder="e.g. Frontend, Backend, QA"
                            required
                        />
                    </div>

                    <div className="mb-3">
                        <Form.Label className="form-label-custom">
                            Description
                        </Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={3}
                            name="description"
                            className="form-control-custom"
                            value={formData.description || ''}
                            onChange={handleChange}
                            placeholder="Optional description for this sub-category"
                        />
                    </div>

                </div>

                <div className="modal-footer-custom">
                    <button
                        type="button"
                        className="btn-close-custom btn-cancel-custom"
                        style={{ backgroundColor: "var(--cancel-btn-color, #dc3545)", borderColor: "var(--cancel-btn-color, #dc3545)", color: "#ffffff" }}
                        onClick={onHide}
                    >
                        Cancel
                    </button>
                    <button type="submit" className="btn-save-custom" disabled={saving}>
                        {saving ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                Saving...
                            </>
                        ) : (
                            editId ? 'Update' : 'Save'
                        )}
                    </button>
                </div>
            </Form>
        </Modal>
    );
};

export default TaskSubCategoryForm;