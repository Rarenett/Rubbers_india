import React, { useState, useRef } from 'react';
import { Modal, Form, Row, Col } from 'react-bootstrap';
import { Trash2 } from 'lucide-react';

/**
 * Modal form for creating/editing a Task.
 * `formData.task_type` is one of 'individual' | 'group', selected via radio buttons.
 * `formData.subcategory` is the id of a TaskSubCategory (optional).
 * `formData.description` is free text (optional).
 * `formData.newAttachments` is an array of File objects staged for upload.
 * `formData.existingAttachments` is an array of already-saved attachment
 *   objects ({ id, file, original_filename }) — only populated in edit mode.
 *
 * `subcategories` — list of TaskSubCategory objects ({ id, subcategory_name, category_name })
 *   used to populate the dropdown.
 * `onDeleteExistingAttachment(attachmentId)` — called when the user removes
 *   an already-saved attachment while editing.
 */
const TaskForm = ({
    show,
    onHide,
    editId,
    formData,
    setFormData,
    subcategories = [],
    onSubmit,
    saving,
    onDeleteExistingAttachment
}) => {
    // Remounting the <input type="file"> after every selection (via this
    // changing key) avoids browser/webview quirks where reusing the same
    // input element after resetting its value silently fails to reopen the
    // picker or to fire onChange for a second, different selection —
    // guaranteeing each click is always a fresh, independent file dialog.
    const [fileInputKey, setFileInputKey] = useState(0);
    const fileInputRef = useRef(null);

    const handleAddFilesClick = () => {
        fileInputRef.current?.click();
    };

    const handleChange = (e) => {
        const { name, value, type, checked, files } = e.target;

        if (type === 'file') {
            setFormData(prev => ({
                ...prev,
                newAttachments: [...(prev.newAttachments || []), ...Array.from(files)]
            }));
            // Force a full remount of the file input for the next pick,
            // instead of resetting its value — more reliable across browsers.
            setFileInputKey(k => k + 1);
            return;
        }

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleRemoveNewAttachment = (index) => {
        setFormData(prev => ({
            ...prev,
            newAttachments: (prev.newAttachments || []).filter((_, i) => i !== index)
        }));
    };

    const existingAttachments = formData.existingAttachments || [];
    const newAttachments = formData.newAttachments || [];

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
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="white" />
                        </svg>
                    </div>
                    <div>
                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                            {editId ? 'Edit Task' : 'Add Task'}
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            Enter details to manage task
                        </p>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={onHide}>
                    &times;
                </button>
            </div>

            <Form onSubmit={onSubmit}>
                <div className="modal-body-custom">
                    <Row className="mb-3">
                        <Col xs={6}>
                            <Form.Label className="form-label-custom">
                                Task Name <span className="text-danger">*</span>
                            </Form.Label>
                            <Form.Control
                                type="text"
                                name="task_name"
                                className="form-control-custom"
                                value={formData.task_name || ''}
                                onChange={handleChange}
                                placeholder="e.g. Prepare monthly report"
                                required
                            />
                        </Col>
                        <Col xs={6}>
                            <Form.Label className="form-label-custom">
                                Sub-Category
                            </Form.Label>
                            <Form.Select
                                name="subcategory"
                                className="form-control-custom"
                                value={formData.subcategory || ''}
                                onChange={handleChange}
                            >
                                <option value="">None</option>
                                {subcategories.map((sc) => (
                                    <option key={sc.id} value={sc.id}>
                                        {sc.subcategory_name}
                                    </option>
                                ))}
                            </Form.Select>
                        </Col>
                    </Row>

                    <div className="mb-3">
                        <Form.Label className="form-label-custom d-block">
                            Task Type <span className="text-danger">*</span>
                        </Form.Label>
                        <div className="d-flex gap-4">
                            <Form.Check
                                type="radio"
                                id="task-type-individual"
                                name="task_type"
                                value="individual"
                                label="Individual"
                                checked={formData.task_type === 'individual'}
                                onChange={handleChange}
                            />
                            <Form.Check
                                type="radio"
                                id="task-type-group"
                                name="task_type"
                                value="group"
                                label="Group"
                                checked={formData.task_type === 'group'}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <Row className="mb-3">
                        <Col xs={6}>
                            <Form.Label className="form-label-custom">
                                Start Date
                            </Form.Label>
                            <Form.Control
                                type="date"
                                name="start_date"
                                className="form-control-custom"
                                value={formData.start_date || ''}
                                onChange={handleChange}
                            />
                        </Col>
                        <Col xs={6}>
                            <Form.Label className="form-label-custom">
                                End Date
                            </Form.Label>
                            <Form.Control
                                type="date"
                                name="due_date"
                                className="form-control-custom"
                                value={formData.due_date || ''}
                                onChange={handleChange}
                                min={formData.start_date || undefined}
                            />
                        </Col>
                    </Row>

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
                            placeholder="Optional details about this task"
                        />
                    </div>

                    <div className="mb-3">
                        <Form.Label className="form-label-custom">
                            Attachments
                        </Form.Label>
                        <div>
                            <input
                                key={fileInputKey}
                                ref={fileInputRef}
                                type="file"
                                name="attachments"
                                onChange={handleChange}
                                multiple
                                style={{ display: 'none' }}
                            />
                            <div
                                className="form-control-custom d-flex align-items-center"
                                role="button"
                                onClick={handleAddFilesClick}
                                style={{ cursor: 'pointer', padding: '0', overflow: 'hidden' }}
                            >
                                <span
                                    style={{
                                        padding: '8px 14px',
                                        backgroundColor: '#f1f5f9',
                                        borderRight: '1px solid #dee2e6',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        color: '#1e293b',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    Choose Files
                                </span>
                                <span
                                    style={{
                                        padding: '8px 14px',
                                        fontSize: '13px',
                                        color: (existingAttachments.length + newAttachments.length) > 0 ? '#1e293b' : '#6c757d',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {(existingAttachments.length + newAttachments.length) > 0
                                        ? `${existingAttachments.length + newAttachments.length} file${(existingAttachments.length + newAttachments.length) > 1 ? 's' : ''} attached`
                                        : 'No file chosen'}
                                </span>
                            </div>
                        </div>
                        

                        {existingAttachments.length > 0 && (
                            <ul className="list-unstyled mt-2 mb-0">
                                {existingAttachments.map((att) => (
                                    <li key={att.id} className="d-flex align-items-center justify-content-between py-1" style={{ fontSize: '13px' }}>
                                        <a href={att.file} target="_blank" rel="noopener noreferrer">
                                            {att.original_filename || 'Attachment'}
                                        </a>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-link text-danger p-0 ms-2"
                                            onClick={() => onDeleteExistingAttachment && onDeleteExistingAttachment(att.id)}
                                            title="Remove attachment"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {newAttachments.length > 0 && (
                            <ul className="list-unstyled mt-2 mb-0">
                                {newAttachments.map((file, idx) => (
                                    <li key={`${file.name}-${idx}`} className="d-flex align-items-center justify-content-between py-1" style={{ fontSize: '13px' }}>
                                        <span>{file.name}</span>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-link text-danger p-0 ms-2"
                                            onClick={() => handleRemoveNewAttachment(idx)}
                                            title="Remove attachment"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
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

export default TaskForm;