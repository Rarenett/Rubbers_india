import React from 'react';
import { Button, Modal, Form } from 'react-bootstrap';

const TaskCategoryForm = ({ show, onHide, editId, formData, setFormData, onSubmit }) => {
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
                            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 10H9v-2h6v2zm3-4H6V8h12v2z" fill="white"/>
                        </svg>
                    </div>
                    <div>
                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                            {editId ? 'Edit Task Category' : 'Add New Task Category'}
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            Enter details to manage task category
                        </p>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={onHide}>
                    &times;
                </button>
            </div>

            <Form onSubmit={onSubmit}>
                <div className="modal-body-custom">
                    <Form.Group className="mb-4">
                        <Form.Label className="form-label-custom">Category Name <span className="text-danger">*</span></Form.Label>
                        <Form.Control
                            required
                            type="text"
                            className="form-control-custom"
                            value={formData.category_name}
                            onChange={e => setFormData({ ...formData, category_name: e.target.value })}
                            placeholder="e.g. Development"
                        />
                    </Form.Group>

                    <Form.Group className="mb-4">
                        <Form.Label className="form-label-custom">Description</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={3}
                            className="form-control-custom"
                            value={formData.description || ''}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Optional description for this category"
                        />
                    </Form.Group>

                </div>
                <div className="modal-footer-custom">
                    <Button type="button" className="btn-close-custom" onClick={onHide}>
                        Close
                    </Button>
                    <Button type="submit" className="btn-save-custom">
                        {editId ? 'Update' : 'Save'}
                    </Button>
                </div>
            </Form>
        </Modal>
    );
};

export default TaskCategoryForm;