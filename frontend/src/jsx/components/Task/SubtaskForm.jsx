import React, { useState } from 'react';
import { Modal, Form, Row, Col } from 'react-bootstrap';
import { Trash2 } from 'lucide-react';

/**
 * Modal form for creating/editing a Subtask.
 * `formData.task_type` is one of 'individual' | 'group', selected via radio buttons.
 * `formData.newAttachments` is an array of File objects staged for upload.
 * `formData.existingAttachments` is an array of already-saved attachment
 *   objects ({ id, file, original_filename }) — only populated in edit mode.
 * No active/status field for subtasks.
 *
 * `onDeleteExistingAttachment(attachmentId)` — called when the user removes
 *   an already-saved attachment while editing.
 */
const SubtaskForm = ({ show, onHide, editId, formData, setFormData, onSubmit, saving, onDeleteExistingAttachment }) => {
    // Remounting the file input (via a changing key) after every pick is the
    // reliable way to make it selectable again. Resetting e.target.value
    // directly can leave the native picker unresponsive to a second click
    // in some browsers, which is what was blocking repeat selections.
    const [fileInputKey, setFileInputKey] = useState(0);

    const handleChange = (e) => {
        const { name, value, type, files } = e.target;

        if (type === 'file') {
            setFormData(prev => ({
                ...prev,
                newAttachments: [...(prev.newAttachments || []), ...Array.from(files)]
            }));
            // Force a fresh <input type="file"> next render so "Choose Files"
            // reliably opens the picker again for the next selection.
            setFileInputKey(k => k + 1);
            return;
        }

        setFormData(prev => ({
            ...prev,
            [name]: value
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
                            {editId ? 'Edit Subtask' : 'Add Subtask'}
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            Enter details to manage subtask
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
                            Subtask Name <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                            type="text"
                            name="subtask_name"
                            className="form-control-custom"
                            value={formData.subtask_name || ''}
                            onChange={handleChange}
                            placeholder="e.g. Collect vendor quotes"
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
                            placeholder="Add any extra detail about this subtask"
                        />
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
                                name="end_date"
                                className="form-control-custom"
                                value={formData.end_date || ''}
                                onChange={handleChange}
                                min={formData.start_date || undefined}
                            />
                        </Col>
                    </Row>

                    <div className="mb-2">
                        <Form.Label className="form-label-custom d-block">
                            Task Type <span className="text-danger">*</span>
                        </Form.Label>
                        <div className="d-flex gap-4">
                            <Form.Check
                                type="radio"
                                id="subtask-type-individual"
                                name="task_type"
                                value="individual"
                                label="Individual"
                                checked={formData.task_type === 'individual'}
                                onChange={handleChange}
                            />
                            <Form.Check
                                type="radio"
                                id="subtask-type-group"
                                name="task_type"
                                value="group"
                                label="Group"
                                checked={formData.task_type === 'group'}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="mb-3">
                        <Form.Label className="form-label-custom">
                            Attachments
                        </Form.Label>
                        <Form.Control
                            key={fileInputKey}
                            type="file"
                            name="attachments"
                            className="form-control-custom"
                            onChange={handleChange}
                            multiple
                        />
                        <small className="text-muted d-block mt-1">
                            You can select multiple files at once, mixing formats — PDF, Word, Excel, images, etc.
                        </small>

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
                                            aria-label="Remove attachment"
                                        >
                                            <Trash2 size={15} />
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
                                            aria-label="Remove attachment"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                <div className="modal-footer-custom" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button type="button" className="btn-close-custom" onClick={onHide}>
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

export default SubtaskForm;