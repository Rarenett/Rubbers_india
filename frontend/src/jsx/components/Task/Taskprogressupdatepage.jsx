import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Card, Badge, Spinner, Row, Col, ProgressBar, Button, Form, Tabs, Tab } from 'react-bootstrap';
import Select, { components } from 'react-select';
import {
    FileText, ClipboardEdit, Clock, Lock, Paperclip,
    User, CalendarDays, Download, List, Users, CheckCircle2,
    Search, X, RotateCcw, Layers, ChevronDown, ChevronUp
} from 'lucide-react';
import Swal from 'sweetalert2';
import axiosInstance from '../../../services/AxiosInstance';
import { getTaskSubtasksOverview } from '../../../services/TaskService';
import { usePageTitle } from '../../../context/TitleContext';

// NOTE: adjust this prefix if the task_app router is mounted somewhere
// else in your root urls.py (it follows the same '/api/<app>/' pattern
// used for '/api/hr/...' elsewhere in this project).
const API_BASE = '/api/task/';

const getMyLeafAssignments = () =>
    axiosInstance.get(`${API_BASE}task-assignments/my-leaf-assignments/`).then(r => r.data);

const getProgressHistory = (assignmentId) =>
    axiosInstance
        .get(`${API_BASE}task-progress-updates/`, { params: { assignment: assignmentId } })
        .then(r => r.data);

const createProgressUpdate = (formData) =>
    axiosInstance
        .post(`${API_BASE}task-progress-updates/`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then(r => r.data);

const patchProgressUpdate = (id, formData) =>
    axiosInstance
        .patch(`${API_BASE}task-progress-updates/${id}/`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then(r => r.data);

const todayLabel = () =>
    new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const formatDate = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    return isNaN(date) ? d : date.toLocaleDateString();
};

const formatDateTime = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    return isNaN(date) ? d : date.toLocaleString();
};

const progressVariant = (pct) => {
    if (pct >= 100) return 'success';
    if (pct >= 50) return 'primary';
    return 'warning';
};

const getDueDatesCount = (item) => {
    if (!item) return 0;
    if (item.due_dates_count !== undefined && item.due_dates_count !== null) {
        return Number(item.due_dates_count);
    }
    const completed = Number(item.completed_percentage) || 0;
    if (completed < 100) return 0;

    const dueRaw = item.task_due_date || item.due_date || item.end_date || item.cutoff_date;
    const submissionRaw = item.submission_date;
    if (!dueRaw || !submissionRaw) return 0;

    const due = new Date(dueRaw);
    const submission = new Date(submissionRaw);
    if (isNaN(due.getTime()) || isNaN(submission.getTime())) return 0;

    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const submissionDay = new Date(submission.getFullYear(), submission.getMonth(), submission.getDate());
    const diffDays = Math.round((submissionDay - dueDay) / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
};

const getAssignmentStartDate = (assignment) => {
    if (!assignment) return null;
    const raw = assignment.task_start_date || assignment.start_date || assignment.subtask_start_date || assignment.subtask?.start_date || assignment.task?.start_date;
    if (!raw) return null;
    if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
        return raw.slice(0, 10);
    }
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const getAssignmentDueDate = (assignment) => {
    if (!assignment) return null;
    const raw = assignment.task_due_date || assignment.due_date || assignment.end_date || assignment.subtask_end_date || assignment.subtask?.end_date || assignment.task?.due_date;
    if (!raw) return null;
    if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
        return raw.slice(0, 10);
    }
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const getTimeRemainingInfo = (startRaw, dueRaw, createdRaw) => {
    if (!dueRaw) return null;
    const due = new Date(dueRaw);
    if (isNaN(due.getTime())) return null;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

    let startDay = null;
    if (startRaw) {
        const start = new Date(startRaw);
        if (!isNaN(start.getTime())) {
            startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        }
    }
    if (!startDay && createdRaw) {
        const created = new Date(createdRaw);
        if (!isNaN(created.getTime())) {
            startDay = new Date(created.getFullYear(), created.getMonth(), created.getDate());
        }
    }
    if (!startDay) {
        startDay = today < dueDay ? today : dueDay;
    }

    const totalDays = Math.max(1, Math.round((dueDay - startDay) / (1000 * 60 * 60 * 24)));
    const daysRemaining = Math.round((dueDay - today) / (1000 * 60 * 60 * 24));

    let pct = 0;
    if (daysRemaining > totalDays) {
        pct = 100;
    } else if (daysRemaining <= 0) {
        pct = 0;
    } else {
        pct = Math.max(0, Math.min(100, Math.round((daysRemaining / totalDays) * 100)));
    }

    let label = '';
    let variant = 'primary';
    let textColor = '#0369a1';

    if (daysRemaining > 1) {
        label = `${daysRemaining} days left`;
        if (pct >= 50) {
            variant = 'success';
            textColor = '#16a34a';
        } else if (pct >= 20) {
            variant = 'warning';
            textColor = '#d97706';
        } else {
            variant = 'danger';
            textColor = '#dc2626';
        }
    } else if (daysRemaining === 1) {
        label = `1 day left`;
        variant = 'warning';
        textColor = '#d97706';
    } else if (daysRemaining === 0) {
        label = `Due today`;
        variant = 'danger';
        textColor = '#dc2626';
    } else {
        const overdueDays = Math.abs(daysRemaining);
        label = `${overdueDays} ${overdueDays === 1 ? 'day' : 'days'} overdue`;
        variant = 'danger';
        textColor = '#dc2626';
    }

    return {
        percent: pct,
        label,
        variant,
        textColor,
        daysRemaining,
        totalDays,
    };
};

const EMPTY_FORM = {
    description_of_work: '',
    challenges_faced: '',
    pending_task: '',
    notes: '',
    percentage: '',
    document: null,
};

// ─── "Update Progress" modal — used for both new entries and same-day edits ─
const UpdateProgressModal = ({ show, onHide, assignment, editingEntry, formData, setFormData, onSubmit, saving, activeTab }) => {
    if (!show || !assignment) return null;

    const rollupVal = assignment.auto_rollup_percentage !== undefined && assignment.auto_rollup_percentage !== null
        ? assignment.auto_rollup_percentage
        : assignment.completed_percentage;
    const isPendingRollup = Boolean(
        assignment.has_subtasks ||
        (String(assignment.id).startsWith('vr_') && assignment.has_subtasks)
    );
    const remaining = Number(assignment.remaining_percentage ?? 100);
    const taskLabel = `${assignment.task_name || 'Task'} — ${assignment.subtask_name || ''}`;

    useEffect(() => {
        if (show && assignment && !editingEntry) {
            const val = assignment.auto_rollup_percentage !== undefined && assignment.auto_rollup_percentage !== null
                ? assignment.auto_rollup_percentage
                : assignment.completed_percentage;
            if (isPendingRollup) {
                setFormData(prev => ({
                    ...prev,
                    percentage: String(Number(val ?? 0))
                }));
            }
        }
    }, [show, assignment, editingEntry, isPendingRollup]);

    const handleChange = (e) => {
        const { name, value, type, files } = e.target;
        if (type === 'file') {
            setFormData(prev => ({ ...prev, document: files && files[0] ? files[0] : null }));
            return;
        }
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="modal-backdrop-custom" style={backdropStyle}>
            <div className="item-custom-modal" style={modalCardStyle}>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <ClipboardEdit size={20} color="#fff" />
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editingEntry ? 'Edit Progress Update' : 'Update Progress'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                {editingEntry
                                    ? 'You can edit this only on the day it was submitted.'
                                    : `Logging progress for ${todayLabel()}`}
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={onHide}>&times;</button>
                </div>

                <Form onSubmit={onSubmit}>
                    <div className="modal-body-custom">
                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Task Name</Form.Label>
                            <Form.Control
                                type="text"
                                className="form-control-custom"
                                value={taskLabel}
                                disabled
                                readOnly
                            />
                        </div>

                        <div className="mb-3">
                            <Form.Label className="form-label-custom">
                                Description <span className="text-danger">*</span>
                            </Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                name="description_of_work"
                                className="form-control-custom"
                                value={formData.description_of_work}
                                onChange={handleChange}
                                placeholder="What did you work on?"
                                required
                            />
                        </div>

                        <Row className="g-3 mb-3">
                            <Col xs={12} md={6}>
                                <Form.Label className="form-label-custom">Challenges Faced</Form.Label>
                                <Form.Control
                                    as="textarea"
                                    rows={2}
                                    name="challenges_faced"
                                    className="form-control-custom"
                                    value={formData.challenges_faced}
                                    onChange={handleChange}
                                    placeholder="Any blockers or challenges?"
                                />
                            </Col>
                            <Col xs={12} md={6}>
                                <Form.Label className="form-label-custom">Pending Task</Form.Label>
                                <Form.Control
                                    as="textarea"
                                    rows={2}
                                    name="pending_task"
                                    className="form-control-custom"
                                    value={formData.pending_task}
                                    onChange={handleChange}
                                    placeholder="What's still pending?"
                                />
                            </Col>
                        </Row>

                        {isPendingRollup ? (
                            <div className="mb-3">
                                <Form.Label className="form-label-custom">Overall Progress</Form.Label>
                                <div className="d-flex align-items-center justify-content-between p-2 px-3 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                    <span className="text-muted small">Progress automatically updated from split subtasks</span>
                                    <span className="fw-bold" style={{ color: '#0a500f', fontSize: '15px' }}>{Number(rollupVal ?? 0)}%</span>
                                </div>
                            </div>
                        ) : (
                            <div className="mb-3">
                                <Form.Label className="form-label-custom">
                                    % Completed (since last update) <span className="text-danger">*</span>
                                </Form.Label>
                                <Form.Control
                                    type="number"
                                    min="0"
                                    max={editingEntry ? 100 : (remaining || 100)}
                                    step="0.01"
                                    name="percentage"
                                    className="form-control-custom"
                                    value={formData.percentage}
                                    onChange={handleChange}
                                    placeholder={editingEntry ? 'e.g. 20' : `up to ${remaining}% left`}
                                    required
                                />
                                {!editingEntry && (
                                    <small className="text-muted d-block mt-1">
                                        {assignment.completed_percentage}% done so far · {remaining}% remaining
                                    </small>
                                )}
                            </div>
                        )}

                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Additional Notes</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                name="notes"
                                className="form-control-custom"
                                value={formData.notes}
                                onChange={handleChange}
                                placeholder="Anything else worth noting..."
                            />
                        </div>

                        <div className="mb-2">
                            <Form.Label className="form-label-custom d-flex align-items-center gap-1">
                                <Paperclip size={14} /> Document
                            </Form.Label>
                            <Form.Control
                                type="file"
                                name="document"
                                className="form-control-custom"
                                onChange={handleChange}
                            />
                            {editingEntry?.document_name && !formData.document && (
                                <small className="text-muted d-block mt-1">
                                    Current file: {editingEntry.document_name} (choose a new file to replace it)
                                </small>
                            )}
                        </div>
                    </div>

                    <div className="modal-footer-custom" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
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
                                editingEntry ? 'Save Changes' : 'Submit Update'
                            )}
                        </button>
                    </div>
                </Form>
            </div>
        </div>
    );
};

const backdropStyle = {
    position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)',
    backdropFilter: 'blur(3px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, padding: '16px',
};
const modalCardStyle = {
    background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '640px',
    maxHeight: '90vh', overflowY: 'auto',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.16)',
};

// ─── Detail view modal (shown when View is clicked in the history table) ─────
const ViewDetailModal = ({ show, onHide, entry }) => {
    if (!show || !entry) return null;
    const cumulative = Number(entry.cumulative_percentage) || 0;
    return (
        <div className="modal-backdrop-custom" style={{ ...backdropStyle, zIndex: 1100 }}>
            <div className="item-custom-modal" style={{ ...modalCardStyle, maxWidth: '560px', width: '100%', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.28)' }}>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <FileText size={20} color="#fff" />
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                Update Details
                            </h4>
                            <p className="text-muted mb-0 d-flex align-items-center gap-1 flex-wrap" style={{ fontSize: '13px' }}>
                                <Clock size={12} className="text-muted" />
                                <span>{formatDateTime(entry.created_at)}</span>
                                {entry.assigned_to_name && (
                                    <>
                                        <span className="mx-1">•</span>
                                        <span className="text-muted" style={{ fontSize: '12px' }}>Assigned to:</span>
                                        <span className="badge" style={{ background: '#f0fdf4', color: '#16a34a', fontWeight: 600 }}>{entry.assigned_to_name}</span>
                                    </>
                                )}
                                {entry.created_by_name && (
                                    <>
                                        <span className="mx-1">•</span>
                                        <User size={12} className="text-muted" />
                                        <span>Submitted by:</span>
                                        <span className="fw-semibold text-dark">{entry.created_by_name}</span>
                                    </>
                                )}
                                {(entry.subtask_name || entry.task_name) && (
                                    <>
                                        <span className="mx-1">•</span>
                                        <span style={{ background: '#e0e7ff', color: '#4338ca', borderRadius: '4px', fontSize: '11px', fontWeight: 600, padding: '2px 8px' }}>
                                            {entry.subtask_name || entry.task_name}
                                        </span>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={onHide} aria-label="Close">&times;</button>
                </div>

                <div className="modal-body-custom">
                    {/* Progress Summary Card */}
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 18px', marginBottom: '18px' }}>
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="text-muted fw-semibold" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Progress</span>
                            <span className="d-flex align-items-center gap-2">
                                <Badge bg={progressVariant(cumulative)} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px' }}>
                                    +{Number(entry.percentage)}%
                                </Badge>
                                {entry.is_editable ? (
                                    <span style={{ background: '#d1fae5', color: '#065f46', borderRadius: '20px', fontSize: '11px', fontWeight: 600, padding: '3px 10px' }}>Editable</span>
                                ) : (
                                    <span style={{ background: '#fee2e2', color: '#991b1b', borderRadius: '20px', fontSize: '11px', fontWeight: 600, padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                        <Lock size={10} /> Locked
                                    </span>
                                )}
                            </span>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                            <ProgressBar now={cumulative} variant={progressVariant(cumulative)} style={{ height: '7px', flex: 1, borderRadius: '10px' }} />
                            <span className="fw-bold" style={{ minWidth: '40px', fontSize: '13px', color: '#1e293b' }}>{cumulative}%</span>
                        </div>
                    </div>

                    {/* Detail Fields */}
                    <div className="d-flex flex-column gap-3">
                        <div>
                            <div className="form-label-custom text-uppercase" style={{ fontSize: '11.5px', letterSpacing: '0.04em', color: '#64748b' }}>Work Done</div>
                            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', fontSize: '13.5px', color: '#1e293b', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                                {entry.description_of_work || '—'}
                            </div>
                        </div>

                        {entry.challenges_faced && (
                            <div>
                                <div className="form-label-custom text-uppercase" style={{ fontSize: '11.5px', letterSpacing: '0.04em', color: '#b45309' }}>Challenges Faced</div>
                                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 14px', fontSize: '13.5px', color: '#92400e', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                                    {entry.challenges_faced}
                                </div>
                            </div>
                        )}

                        {entry.pending_task && (
                            <div>
                                <div className="form-label-custom text-uppercase" style={{ fontSize: '11.5px', letterSpacing: '0.04em', color: '#64748b' }}>Pending Task</div>
                                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', fontSize: '13.5px', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                                    {entry.pending_task}
                                </div>
                            </div>
                        )}

                        {entry.notes && (
                            <div>
                                <div className="form-label-custom text-uppercase" style={{ fontSize: '11.5px', letterSpacing: '0.04em', color: '#64748b' }}>Notes</div>
                                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', fontSize: '13.5px', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                                    {entry.notes}
                                </div>
                            </div>
                        )}

                        {entry.document && (
                            <div>
                                <div className="form-label-custom text-uppercase" style={{ fontSize: '11.5px', letterSpacing: '0.04em', color: '#64748b' }}>Attached Document</div>
                                <div>
                                    <a
                                        href={entry.document}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-sm btn-outline-primary shadow-sm"
                                        style={{ borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 14px' }}
                                    >
                                        <Download size={13} /> {entry.document_name || 'Download Attachment'}
                                    </a>
                                </div>
                            </div>
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
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Custom Option with Checkbox for Subtasks Multi-Select Dropdown ───────────
const SubtaskCheckboxOption = (props) => {
    const isAllOption = props.data.value === '__ALL__';
    const isChecked = isAllOption
        ? (!props.selectProps.value || props.selectProps.value.length === 0)
        : props.isSelected;

    return (
        <components.Option {...props}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => null}
                    style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '12.5px', color: '#1e293b', fontWeight: isAllOption ? 600 : 400 }}>
                    {props.label}
                </span>
            </div>
        </components.Option>
    );
};

const subtaskSelectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: '34px',
        fontSize: '12px',
        borderRadius: '20px',
        borderColor: state.isFocused ? '#6366f1' : '#cbd5e1',
        boxShadow: state.isFocused ? '0 0 0 2px rgba(99, 102, 241, 0.2)' : 'none',
        '&:hover': { borderColor: '#6366f1' },
        cursor: 'pointer',
        padding: '0 4px',
        backgroundColor: '#fff',
    }),
    placeholder: (base) => ({
        ...base,
        color: '#475569',
        fontWeight: 500,
        fontSize: '12px',
    }),
    valueContainer: (base) => ({
        ...base,
        padding: '2px 6px',
        gap: '4px',
    }),
    multiValue: (base) => ({
        ...base,
        backgroundColor: '#eef2ff',
        borderRadius: '12px',
        padding: '1px 3px',
    }),
    multiValueLabel: (base) => ({
        ...base,
        color: '#4338ca',
        fontWeight: 600,
        fontSize: '11px',
    }),
    multiValueRemove: (base) => ({
        ...base,
        color: '#6366f1',
        borderRadius: '50%',
        ':hover': {
            backgroundColor: '#c7d2fe',
            color: '#312e81',
        },
    }),
    menuPortal: (base) => ({
        ...base,
        zIndex: 99999,
    }),
    menu: (base) => ({
        ...base,
        borderRadius: '10px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        zIndex: 99999,
    }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isFocused ? '#f1f5f9' : '#fff',
        cursor: 'pointer',
        padding: '8px 12px',
    }),
};

// ─── Progress History Modal (table layout) ───────────────────────────────────
const ProgressHistoryModal = ({ show, onHide, assignment, history, overview, loading, onEdit }) => {
    const [viewEntry, setViewEntry] = useState(null);
    const [subtaskFilter, setSubtaskFilter] = useState([]);

    useEffect(() => {
        setSubtaskFilter([]);
    }, [assignment?.id]);

    if (!show || !assignment) return null;

    const subtasks = overview?.subtasks || [];
    const taskInfo = overview?.task || {};

    const filteredHistory = history.filter(entry => {
        if (!subtaskFilter || subtaskFilter.length === 0) return true;
        return subtaskFilter.some(
            name => String(entry.subtask_name || '').trim().toLowerCase() === String(name).trim().toLowerCase()
        );
    });

    const toggleSubtaskFilter = (subtaskName) => {
        setSubtaskFilter(prev => {
            const arr = Array.isArray(prev) ? prev : [];
            const exists = arr.some(
                name => String(name).trim().toLowerCase() === String(subtaskName).trim().toLowerCase()
            );
            if (exists) {
                return arr.filter(
                    name => String(name).trim().toLowerCase() !== String(subtaskName).trim().toLowerCase()
                );
            } else {
                return [...arr, subtaskName];
            }
        });
    };

    const subtaskOptions = [
        { value: '__ALL__', label: `All Updates (${history.length})` },
        ...subtasks.map(st => {
            const count = history.filter(h =>
                String(h.subtask_name || '').trim().toLowerCase() === String(st.subtask_name).trim().toLowerCase()
            ).length;
            return {
                value: st.subtask_name,
                label: `${st.subtask_name} (${count})`,
            };
        })
    ];

    const selectValue = subtaskOptions.filter(opt =>
        opt.value !== '__ALL__' &&
        Array.isArray(subtaskFilter) &&
        subtaskFilter.some(name => String(name).trim().toLowerCase() === String(opt.value).trim().toLowerCase())
    );

    const handleSubtaskSelectChange = (selected, actionMeta) => {
        if (!selected || selected.length === 0) {
            setSubtaskFilter([]);
            return;
        }
        if (actionMeta?.option?.value === '__ALL__') {
            setSubtaskFilter([]);
            return;
        }
        const values = selected
            .filter(opt => opt.value !== '__ALL__')
            .map(opt => opt.value);
        setSubtaskFilter(values);
    };

    const totalTaskPct = taskInfo?.completed_percentage !== undefined
        ? taskInfo.completed_percentage
        : (assignment.completed_percentage || 0);

    const modalDueDatesCount = getDueDatesCount({
        ...assignment,
        due_dates_count: assignment.due_dates_count ?? taskInfo?.due_dates_count,
        cutoff_date: assignment.cutoff_date || taskInfo?.cutoff_date,
        submission_date: assignment.submission_date || taskInfo?.submission_date,
        completed_percentage: totalTaskPct,
    });

    return (
        <>
            <div className="modal-backdrop-custom" style={backdropStyle}>
                <div className="item-custom-modal" style={{ ...modalCardStyle, maxWidth: '96vw', width: '1150px' }}>
                    <div className="modal-header-custom" style={{ padding: '16px 24px' }}>
                        <div className="d-flex align-items-center gap-3">
                            <div className="modal-icon-circle">
                                <Clock size={20} color="#fff" />
                            </div>
                            <div>
                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                    <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                        {assignment.subtask_name || taskInfo.task_name}
                                    </h4>
                                    {assignment.task_name && assignment.task_name !== assignment.subtask_name && (
                                        <span className="badge" style={{ background: '#f1f5f9', color: '#475569', fontSize: '12px' }}>
                                            {assignment.task_name}
                                        </span>
                                    )}
                                    <Badge bg={progressVariant(totalTaskPct)} style={{ fontSize: '12px', padding: '4px 10px' }}>
                                        {totalTaskPct}% Overall Progress
                                    </Badge>
                                </div>
                                <div className="text-muted d-flex align-items-center gap-3 mt-1 flex-wrap" style={{ fontSize: '12.5px' }}>
                                    {(assignment.assigned_to_name || taskInfo.assigned_employee_name) && (
                                        <span className="d-inline-flex align-items-center gap-1">
                                            <User size={13} className="text-primary" />
                                            <span>Assignee:</span>
                                            <strong className="text-dark">{assignment.assigned_to_name || taskInfo.assigned_employee_name}</strong>
                                        </span>
                                    )}
                                    {(assignment.assigned_by_name || taskInfo.created_by_name) && (
                                        <span className="d-inline-flex align-items-center gap-1">
                                            <span>Assigned by:</span>
                                            <span className="text-dark">{assignment.assigned_by_name || taskInfo.created_by_name}</span>
                                        </span>
                                    )}
                                    {(assignment.task_start_date || assignment.start_date || taskInfo.start_date) && (
                                        <span className="d-inline-flex align-items-center gap-1">
                                            <CalendarDays size={13} className="text-secondary" />
                                            <span>Start:</span>
                                            <span className="text-dark">{formatDate(assignment.task_start_date || assignment.start_date || taskInfo.start_date)}</span>
                                        </span>
                                    )}
                                    {assignment.task_due_date && (
                                        <span className="d-inline-flex align-items-center gap-1">
                                            <CalendarDays size={13} className="text-danger" />
                                            <span>Due:</span>
                                            <span className="text-dark">{formatDate(assignment.task_due_date)}</span>
                                        </span>
                                    )}
                                    {assignment.cutoff_date && assignment.cutoff_date !== assignment.task_due_date && (
                                        <span className="d-inline-flex align-items-center gap-1">
                                            <CalendarDays size={13} className="text-warning" />
                                            <span>Cutoff:</span>
                                            <span className="text-dark">{formatDateTime(assignment.cutoff_date)}</span>
                                        </span>
                                    )}
                                    {totalTaskPct >= 100 && (assignment.submission_date || taskInfo?.submission_date) && (
                                        <span className="d-inline-flex align-items-center gap-1">
                                            <CalendarDays size={13} className="text-success" />
                                            <span>Submitted:</span>
                                            <span className="text-dark">{formatDateTime(assignment.submission_date || taskInfo?.submission_date)}</span>
                                        </span>
                                    )}
                                    {totalTaskPct >= 100 && modalDueDatesCount > 0 && (
                                        <span className="d-inline-flex align-items-center gap-1">
                                            <Clock size={13} className="text-danger" />
                                            <span className="text-danger fw-semibold">Due Dates Count:</span>
                                            <span className="badge bg-danger text-white">{modalDueDatesCount} {modalDueDatesCount === 1 ? 'day' : 'days'}</span>
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button type="button" className="modal-close-x" onClick={onHide} aria-label="Close">&times;</button>
                    </div>

                    <div className="modal-body-custom" style={{ backgroundColor: '#fff', padding: '20px 24px', maxHeight: '78vh', overflowY: 'auto' }}>
                        {loading ? (
                            <div className="text-center py-5"><Spinner animation="border" size="sm" /></div>
                        ) : (
                            <>
                                {/* ── Section 1: Subtasks & Assigned Persons ── */}
                                {subtasks.length > 0 && (
                                    <div className="mb-4">
                                        <div className="d-flex align-items-center justify-content-between mb-2">
                                            <h6 className="fw-bold mb-0 text-uppercase d-flex align-items-center gap-2" style={{ fontSize: '13px', letterSpacing: '0.04em', color: '#4338ca' }}>
                                                <Users size={16} /> Subtasks &amp; Assigned Persons ({subtasks.length})
                                            </h6>
                                            <span className="text-muted" style={{ fontSize: '12px' }}>
                                                Click any subtask to filter updates
                                            </span>
                                        </div>
                                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                                <thead>
                                                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                        <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Subtask Name</th>
                                                        <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Assigned Person</th>
                                                        <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Parent / Level</th>
                                                        <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'center' }}>Weight</th>
                                                        <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Progress</th>
                                                        <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'center' }}>Updates</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {subtasks.map((st) => {
                                                        const stUpdatesCount = history.filter(h =>
                                                            String(h.subtask_name || '').trim().toLowerCase() === String(st.subtask_name).trim().toLowerCase()
                                                        ).length;
                                                        const isSelected = Array.isArray(subtaskFilter) && subtaskFilter.some(
                                                            name => String(name).trim().toLowerCase() === String(st.subtask_name).trim().toLowerCase()
                                                        );
                                                        return (
                                                            <tr
                                                                key={st.id}
                                                                style={{
                                                                    borderBottom: '1px solid #f1f5f9',
                                                                    cursor: 'pointer',
                                                                    background: isSelected ? '#f5f3ff' : '#fff',
                                                                    transition: 'background 0.15s ease'
                                                                }}
                                                                onClick={() => toggleSubtaskFilter(st.subtask_name)}
                                                            >
                                                                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b' }}>
                                                                    <div className="d-flex align-items-center gap-2 flex-wrap">
                                                                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#6366f1' }}></span>
                                                                        <span>{st.subtask_name}</span>
                                                                        {isSelected && (
                                                                            <span className="badge bg-primary" style={{ fontSize: '10px' }}>Selected</span>
                                                                        )}
                                                                        {Number(st.completed_percentage) >= 100 && (st.due_dates_count > 0 || getDueDatesCount(st) > 0) && (
                                                                            <span className="badge bg-danger text-white ms-1" style={{ fontSize: '10px' }}>
                                                                                Due Dates Count: {st.due_dates_count || getDueDatesCount(st)} {(st.due_dates_count || getDueDatesCount(st)) === 1 ? 'day' : 'days'}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td style={{ padding: '10px 14px' }}>
                                                                    <span
                                                                        className="badge"
                                                                        style={{
                                                                            background: '#f0fdf4',
                                                                            color: '#16a34a',
                                                                            fontWeight: 600,
                                                                            fontSize: '11.5px',
                                                                            padding: '4px 10px',
                                                                            borderRadius: '20px',
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px',
                                                                        }}
                                                                    >
                                                                        <User size={12} />
                                                                        {st.employee_name || '—'}
                                                                    </span>
                                                                </td>
                                                                <td style={{ padding: '10px 14px', color: '#64748b' }}>
                                                                    {st.parent_subtask_name ? (
                                                                        <span className="badge bg-light text-secondary border" style={{ fontSize: '11px' }}>
                                                                            ↳ {st.parent_subtask_name}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="badge bg-light text-muted border" style={{ fontSize: '11px' }}>Top-level Subtask</span>
                                                                    )}
                                                                </td>
                                                                <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: '#334155' }}>
                                                                    {st.percentage}%
                                                                </td>
                                                                <td style={{ padding: '10px 14px', minWidth: '150px' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <ProgressBar
                                                                            now={st.completed_percentage}
                                                                            variant={progressVariant(st.completed_percentage)}
                                                                            style={{ height: '6px', flex: 1, borderRadius: '10px' }}
                                                                        />
                                                                        <span className="fw-bold" style={{ fontSize: '12px', minWidth: '35px' }}>
                                                                            {st.completed_percentage}%
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                                                                    <button
                                                                        type="button"
                                                                        className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline-primary'}`}
                                                                        style={{
                                                                            borderRadius: '20px',
                                                                            padding: '3px 12px',
                                                                            fontSize: '11.5px',
                                                                            fontWeight: 600,
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px',
                                                                            cursor: 'pointer',
                                                                            transition: 'all 0.15s ease-in-out',
                                                                        }}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            toggleSubtaskFilter(st.subtask_name);
                                                                        }}
                                                                        title={isSelected ? 'Clear filter' : `Filter updates for ${st.subtask_name}`}
                                                                    >
                                                                        {stUpdatesCount} {stUpdatesCount === 1 ? 'update' : 'updates'}
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* ── Section 2: Progress Updates History ── */}
                                <div>
                                    <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                                        <h6 className="fw-bold mb-0 text-uppercase d-flex align-items-center gap-2" style={{ fontSize: '13px', letterSpacing: '0.04em', color: '#1e293b' }}>
                                            <FileText size={16} color="#6366f1" /> Progress Updates History ({filteredHistory.length})
                                        </h6>
                                        {subtasks.length > 0 && (
                                            <div style={{ minWidth: '260px', maxWidth: '380px' }}>
                                                <Select
                                                    isMulti
                                                    options={subtaskOptions}
                                                    value={selectValue}
                                                    onChange={handleSubtaskSelectChange}
                                                    placeholder={`All Updates (${history.length})`}
                                                    classNamePrefix="subtask-select"
                                                    closeMenuOnSelect={false}
                                                    hideSelectedOptions={false}
                                                    isClearable={true}
                                                    components={{ Option: SubtaskCheckboxOption }}
                                                    styles={subtaskSelectStyles}
                                                    menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                                    menuPosition="fixed"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {filteredHistory.length === 0 ? (
                                        <div className="text-center py-4 text-muted" style={{ background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                                            <Clock size={24} className="mb-2 text-muted" />
                                            <p className="mb-0 small">No progress updates logged {Array.isArray(subtaskFilter) && subtaskFilter.length > 0 ? `for selected subtask${subtaskFilter.length > 1 ? 's' : ''}` : 'yet for this task'}.</p>
                                        </div>
                                    ) : (
                                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflowX: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                                                <thead>
                                                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                                        <th style={{ padding: '12px 14px', fontSize: '11.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>SL.NO</th>
                                                        <th style={{ padding: '12px 14px', fontSize: '11.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Date &amp; Time</th>
                                                        <th style={{ padding: '12px 14px', fontSize: '11.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Task / Subtask</th>
                                                        <th style={{ padding: '12px 14px', fontSize: '11.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Assigned Person</th>
                                                        <th style={{ padding: '12px 14px', fontSize: '11.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Submitted By</th>
                                                        <th style={{ padding: '12px 14px', fontSize: '11.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'center' }}>% Added</th>
                                                        <th style={{ padding: '12px 14px', fontSize: '11.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', minWidth: '150px' }}>Total Progress</th>
                                                        <th style={{ padding: '12px 14px', fontSize: '11.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredHistory.map((entry, idx) => {
                                                        const cumulative = Number(entry.cumulative_percentage) || 0;
                                                        return (
                                                            <tr
                                                                key={entry.id}
                                                                style={{ borderBottom: '1px solid #f1f5f9' }}
                                                                onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                                                                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                                                            >
                                                                <td style={{ padding: '12px 14px', color: '#64748b', fontWeight: 500 }}>{idx + 1}</td>
                                                                <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1e293b', fontSize: '13px' }}>
                                                                        <Clock size={12} style={{ color: '#94a3b8' }} />
                                                                        {formatDateTime(entry.created_at)}
                                                                    </div>
                                                                </td>
                                                                <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                                                    {entry.subtask_name ? (
                                                                        <span style={{ background: '#e0e7ff', color: '#4338ca', borderRadius: '6px', fontSize: '12px', fontWeight: 600, padding: '3px 8px', display: 'inline-block' }}>
                                                                            {entry.subtask_name}
                                                                        </span>
                                                                    ) : (
                                                                        <span style={{ background: '#f1f5f9', color: '#475569', borderRadius: '6px', fontSize: '12px', fontWeight: 600, padding: '3px 8px', display: 'inline-block' }}>
                                                                            {entry.task_name || 'Task'}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td style={{ padding: '12px 14px' }}>
                                                                    {entry.assigned_to_name ? (
                                                                        <span className="badge" style={{ background: '#f0fdf4', color: '#16a34a', fontWeight: 600, fontSize: '11px', borderRadius: '20px', padding: '3px 8px' }}>
                                                                            {entry.assigned_to_name}
                                                                        </span>
                                                                    ) : '—'}
                                                                </td>
                                                                <td style={{ padding: '12px 14px', fontWeight: 600, color: '#1e293b' }}>
                                                                    {entry.created_by_name || '—'}
                                                                </td>
                                                                <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                                                    <Badge bg={progressVariant(cumulative)}>+{Number(entry.percentage)}%</Badge>
                                                                </td>
                                                                <td style={{ padding: '12px 14px' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <ProgressBar now={cumulative} variant={progressVariant(cumulative)} style={{ height: '6px', flex: 1, minWidth: '70px', borderRadius: '10px' }} />
                                                                        <span className="fw-bold" style={{ minWidth: '34px', fontSize: '12.5px' }}>{cumulative}%</span>
                                                                    </div>
                                                                </td>
                                                                <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                                                                    <div className="d-flex justify-content-end align-items-center gap-1">
                                                                        <Button
                                                                            variant="outline-info"
                                                                            size="sm"
                                                                            className="shadow-sm"
                                                                            style={{
                                                                                width: '28px', height: '28px',
                                                                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                                                padding: '0', fontSize: '12px', borderRadius: '6px',
                                                                            }}
                                                                            onClick={() => setViewEntry(entry)}
                                                                            title="View details"
                                                                        >
                                                                            <i className="fa fa-eye"></i>
                                                                        </Button>
                                                                        {entry.is_editable && (
                                                                            <Button
                                                                                variant="outline-primary"
                                                                                size="sm"
                                                                                className="shadow-sm"
                                                                                style={{
                                                                                    width: '28px', height: '28px',
                                                                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                                                    padding: '0', fontSize: '12px', borderRadius: '6px',
                                                                                }}
                                                                                onClick={() => onEdit(entry)}
                                                                                title="Edit this update"
                                                                            >
                                                                                <i className="fa fa-pencil-alt"></i>
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="modal-footer-custom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px' }}>
                        <div style={{ color: '#94a3b8', fontSize: '13px' }}>
                            Showing {filteredHistory.length} of {history.length} {history.length === 1 ? 'entry' : 'entries'}
                        </div>
                        <button
                            type="button"
                            className="btn-close-custom btn-cancel-custom"
                            style={{ backgroundColor: "var(--cancel-btn-color, #dc3545)", borderColor: "var(--cancel-btn-color, #dc3545)", color: "#ffffff" }}
                            onClick={onHide}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
            <ViewDetailModal show={!!viewEntry} onHide={() => setViewEntry(null)} entry={viewEntry} />
        </>
    );
};


// ─── Avatar colour palette (cycles by index) ────────────────────────────────
const AVATAR_COLORS = [
    { bg: '#e8f5e9', text: '#2e7d32' },
    { bg: '#e3f2fd', text: '#1565c0' },
    { bg: '#f3e5f5', text: '#6a1b9a' },
    { bg: '#fff3e0', text: '#e65100' },
    { bg: '#fce4ec', text: '#880e4f' },
    { bg: '#e0f7fa', text: '#006064' },
];

const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
};

// ─── One assigned-task card (My Assigned Tasks style) ───────────────────────
const TaskCard = ({ assignment, onUpdate, onDetails, colorIndex = 0, isOpen, onToggle }) => {
    const completed = Number(assignment.completed_percentage) || 0;
    const isDelegatedTab = !!assignment.is_delegated_by_me;
    const canUpdate = !isDelegatedTab && (assignment.can_update_progress !== false);
    const color = AVATAR_COLORS[colorIndex % AVATAR_COLORS.length];
    const initials = getInitials(assignment.subtask_name);
    const dueDatesCount = getDueDatesCount(assignment);
    const startDate = assignment.task_start_date || assignment.start_date || assignment.subtask_start_date || assignment.subtask?.start_date || assignment.task?.start_date;
    const dueDate = assignment.task_due_date || assignment.due_date || assignment.end_date || assignment.subtask_end_date || assignment.subtask?.end_date || assignment.task?.due_date;
    const timeRemaining = getTimeRemainingInfo(startDate, dueDate, assignment.created_at);

    let statusBadgeText = 'Pending';
    let statusBadgeBg = '#ede9fe';
    let statusBadgeColor = '#6f42c1';

    if (isDelegatedTab) {
        statusBadgeText = 'Delegated';
        statusBadgeBg = '#e8f5e9';
        statusBadgeColor = '#2e7d32';
    } else if (completed >= 100) {
        statusBadgeText = 'Completed';
        statusBadgeBg = '#dcfce7';
        statusBadgeColor = '#15803d';
    } else if (completed > 0) {
        statusBadgeText = 'In Progress';
        statusBadgeBg = '#e0f2fe';
        statusBadgeColor = '#0369a1';
    } else {
        statusBadgeText = 'Pending';
        statusBadgeBg = '#ede9fe';
        statusBadgeColor = '#6f42c1';
    }

    return (
        <Col md={6} lg={4} style={{ alignSelf: 'flex-start' }}>
            <Card className="shadow-sm border-0 mb-0" style={{ borderRadius: '12px', overflow: 'hidden' }}>
                {/* ── Card Header (Click to expand / collapse) ── */}
                <div
                    className="d-flex align-items-center justify-content-between px-3 py-3"
                    style={{
                        background: '#fff',
                        borderBottom: isOpen ? '1px solid #f1f5f9' : 'none',
                        cursor: 'pointer',
                        userSelect: 'none',
                    }}
                    onClick={onToggle}
                >
                    <div className="d-flex align-items-center gap-3">
                        <div>
                            <h6 className="fw-bold mb-0" style={{ color: '#1e293b', fontSize: '14px' }}>
                                {assignment.subtask_name || '—'}
                            </h6>
                            {assignment.task_name && assignment.task_name !== assignment.subtask_name && (
                                <span className="text-muted" style={{ fontSize: '12px' }}>
                                    {assignment.parent_subtask_name ? `${assignment.parent_subtask_name} • ${assignment.task_name}` : assignment.task_name}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        {/* Status badge */}
                        <span
                            className="badge"
                            style={{
                                background: statusBadgeBg,
                                color: statusBadgeColor,
                                fontWeight: 600, fontSize: '11px', borderRadius: '20px',
                                padding: '4px 10px',
                            }}
                        >
                            {statusBadgeText}
                        </span>
                        <button
                            type="button"
                            style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#64748b',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '6px',
                                cursor: 'pointer',
                            }}
                            aria-label="Toggle details"
                        >
                            {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                    </div>
                </div>

                {/* ── Collapsible Body ── */}
                {isOpen && (
                    <>
                <div style={{ padding: '4px 16px 8px' }}>
                    {/* Assigned By / Assigned To */}
                    {isDelegatedTab ? (
                        <>
                            {assignment.assigned_to_name && (
                                <div className="d-flex align-items-center justify-content-between py-2">
                                    <div className="d-flex align-items-center gap-2 text-muted" style={{ fontSize: '12px' }}>
                                        <User size={13} />
                                        <span>Assigned to</span>
                                    </div>
                                    <span
                                        className="badge"
                                        style={{
                                            background: '#f0fdf4', color: '#16a34a',
                                            fontWeight: 600, fontSize: '11px', borderRadius: '20px',
                                        }}
                                    >
                                        {assignment.assigned_to_name}
                                    </span>
                                </div>
                            )}
                            {assignment.assigned_by_name && (
                                <div className="d-flex align-items-center justify-content-between py-2">
                                    <div className="d-flex align-items-center gap-2 text-muted" style={{ fontSize: '12px' }}>
                                        <User size={13} />
                                        <span>Assigned by</span>
                                    </div>
                                    <span
                                        className="badge"
                                        style={{
                                            background: '#f8fafc', color: '#475569',
                                            fontWeight: 600, fontSize: '11px', borderRadius: '20px',
                                            border: '1px solid #e2e8f0',
                                        }}
                                    >
                                        {assignment.assigned_by_name}
                                    </span>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            {assignment.assigned_to_name && (
                                <div className="d-flex align-items-center justify-content-between py-2">
                                    <div className="d-flex align-items-center gap-2 text-muted" style={{ fontSize: '12px' }}>
                                        <User size={13} />
                                        <span>Assigned to</span>
                                    </div>
                                    <span
                                        className="badge"
                                        style={{
                                            background: '#f0fdf4', color: '#16a34a',
                                            fontWeight: 600, fontSize: '11px', borderRadius: '20px',
                                        }}
                                    >
                                        {assignment.assigned_to_name}
                                    </span>
                                </div>
                            )}
                            {assignment.assigned_by_name && (
                                <div className="d-flex align-items-center justify-content-between py-2">
                                    <div className="d-flex align-items-center gap-2 text-muted" style={{ fontSize: '12px' }}>
                                        <User size={13} />
                                        <span>Assigned by</span>
                                    </div>
                                    <span
                                        className="badge"
                                        style={{
                                            background: '#f0fdf4', color: '#16a34a',
                                            fontWeight: 600, fontSize: '11px', borderRadius: '20px',
                                        }}
                                    >
                                        {assignment.assigned_by_name}
                                    </span>
                                </div>
                            )}
                        </>
                    )}

                    {/* Start Date */}
                    <div className="d-flex align-items-center justify-content-between py-1">
                        <div className="d-flex align-items-center gap-2 text-muted" style={{ fontSize: '12px' }}>
                            <CalendarDays size={13} />
                            <span>Start Date</span>
                        </div>
                        <span
                            className="badge"
                            style={{
                                background: '#f8fafc', color: '#475569',
                                fontWeight: 600, fontSize: '11px', borderRadius: '20px',
                                border: '1px solid #e2e8f0',
                            }}
                        >
                            {formatDate(startDate)}
                        </span>
                    </div>

                    {/* Timeline Progress Bar (between Start Date and Ending Date) */}
                    {timeRemaining && (
                        <div className="py-2">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                                <span className="text-muted d-flex align-items-center gap-1" style={{ fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.04em' }}>
                                    <Clock size={11} /> TIME REMAINING
                                </span>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: timeRemaining.textColor }}>
                                    {timeRemaining.label}
                                </span>
                            </div>
                            <ProgressBar
                                now={timeRemaining.percent}
                                variant={timeRemaining.variant}
                                style={{ height: '6px', borderRadius: '10px' }}
                            />
                        </div>
                    )}

                    {/* Due Date */}
                    <div className="d-flex align-items-center justify-content-between py-1">
                        <div className="d-flex align-items-center gap-2 text-muted" style={{ fontSize: '12px' }}>
                            <CalendarDays size={13} />
                            <span>Due Date</span>
                        </div>
                        <span
                            className="badge"
                            style={{
                                background: '#fff7ed', color: '#c2410c',
                                fontWeight: 600, fontSize: '11px', borderRadius: '20px',
                            }}
                        >
                            {formatDate(dueDate)}
                        </span>
                    </div>


                    {/* Submission Date (when completed) */}
                    {completed >= 100 && assignment.submission_date && (
                        <div className="d-flex align-items-center justify-content-between py-2">
                            <div className="d-flex align-items-center gap-2 text-muted" style={{ fontSize: '12px' }}>
                                <CalendarDays size={13} className="text-success" />
                                <span>Submission Date</span>
                            </div>
                            <span
                                className="badge"
                                style={{
                                    background: '#f0fdf4', color: '#16a34a',
                                    fontWeight: 600, fontSize: '11px', borderRadius: '20px',
                                }}
                            >
                                {formatDateTime(assignment.submission_date)}
                            </span>
                        </div>
                    )}

                    {/* Due Dates Count (when cutoff date passed and task completed) */}
                    {completed >= 100 && dueDatesCount > 0 && (
                        <div className="d-flex align-items-center justify-content-between py-2">
                            <div className="d-flex align-items-center gap-2 text-muted" style={{ fontSize: '12px' }}>
                                <Clock size={13} className="text-danger" />
                                <span className="text-danger fw-semibold">Due Dates Count</span>
                            </div>
                            <span
                                className="badge"
                                style={{
                                    background: '#fef2f2', color: '#dc2626',
                                    fontWeight: 700, fontSize: '11px', borderRadius: '20px',
                                    border: '1px solid #fecaca',
                                }}
                            >
                                {dueDatesCount} {dueDatesCount === 1 ? 'day' : 'days'}
                            </span>
                        </div>
                    )}

                    {/* Progress */}
                    <div className="pt-1 pb-2">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                            <span className="text-muted" style={{ fontSize: '11px', fontWeight: 600 }}>PROGRESS</span>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>{completed}%</span>
                        </div>
                        <ProgressBar
                            now={completed}
                            variant={progressVariant(completed)}
                            style={{ height: '6px', borderRadius: '10px' }}
                        />
                    </div>
                </div>

                {/* â”€â”€ Action Buttons â”€â”€ */}
                <div className="d-flex gap-2 px-3 py-2 justify-content-end" style={{ background: '#fff', borderTop: '1px solid #f1f5f9', borderRadius: '0 0 12px 12px' }}>
                    <button
                        onClick={() => onDetails(assignment)}
                        style={{
                            border: '1.5px solid #6f42c1', borderRadius: '7px',
                            background: '#fff', color: '#6f42c1', fontWeight: 600,
                            fontSize: '12px', padding: '5px 14px', display: 'flex',
                            alignItems: 'center', gap: '5px',
                            cursor: 'pointer', transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f5f0ff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                    >
                        <FileText size={13} /> Details
                    </button>
                    {canUpdate && (
                        <button
                            onClick={() => onUpdate(assignment)}
                            disabled={completed >= 100}
                            style={{
                                border: 'none', borderRadius: '7px',
                                background: completed >= 100 ? '#c4b5fd' : '#6f42c1',
                                color: '#fff', fontWeight: 600, fontSize: '12px',
                                padding: '5px 14px', display: 'flex',
                                alignItems: 'center', gap: '5px',
                                cursor: completed >= 100 ? 'not-allowed' : 'pointer',
                                transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={e => { if (completed < 100) e.currentTarget.style.background = '#5a32a3'; }}
                            onMouseLeave={e => { if (completed < 100) e.currentTarget.style.background = '#6f42c1'; }}
                        >
                            <ClipboardEdit size={13} />
                            {completed >= 100 ? 'Completed' : 'Update'}
                        </button>
                    )}
                </div>
            </>
                )}
            </Card>
        </Col>
    );
};



// ─── Main Page ───────────────────────────────────────────────────────────────
const TaskProgressUpdatePage = () => {
    usePageTitle('Task Progress');
    const auth = useSelector((state) => state.auth);
    const localRole = (localStorage.getItem('role') || '').toLowerCase();
    const localUser = (localStorage.getItem('username') || '').toLowerCase();
    const isSuperuser = Boolean(
        auth?.user?.is_superuser ||
        (auth?.user?.role_name && String(auth.user.role_name).toLowerCase().includes('admin')) ||
        (auth?.user?.username && String(auth.user.username).toLowerCase().startsWith('admin')) ||
        localRole.includes('admin') ||
        localUser.startsWith('admin')
    );

    const [assignments, setAssignments] = useState([]);
    const [loadingAssignments, setLoadingAssignments] = useState(false);

    const [activeTab, setActiveTab] = useState('pending');
    const [expandedCardId, setExpandedCardId] = useState(null);
    const handleToggleCard = (cardId) => {
        setExpandedCardId((prev) => (prev === cardId ? null : cardId));
    };

    const handleTabChange = (tabKey) => {
        setActiveTab(tabKey);
        setExpandedCardId(null);
    };
    const [searchTerm, setSearchTerm] = useState('');
    const [startDateFilter, setStartDateFilter] = useState('');
    const [dueDateFilter, setDueDateFilter] = useState('');

    const [showModal, setShowModal] = useState(false);
    const [activeAssignment, setActiveAssignment] = useState(null);
    const [editingEntry, setEditingEntry] = useState(null);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    // History & Overview Modal State
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyAssignment, setHistoryAssignment] = useState(null);
    const [history, setHistory] = useState([]);
    const [subtasksOverview, setSubtasksOverview] = useState(null);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [loadingOverview, setLoadingOverview] = useState(false);

    const loadAssignments = useCallback(() => {
        setLoadingAssignments(true);
        getMyLeafAssignments()
            .then((data) => setAssignments(data.results || data || []))
            .catch((err) => {
                console.error('Failed to load assigned tasks:', err?.response || err);
                setAssignments([]);
            })
            .finally(() => setLoadingAssignments(false));
    }, []);

    useEffect(() => { loadAssignments(); }, [loadAssignments]);

    const loadDetails = useCallback((assignmentId) => {
        if (!assignmentId) {
            setHistory([]);
            setSubtasksOverview(null);
            return;
        }
        setLoadingHistory(true);
        setLoadingOverview(true);
        getProgressHistory(assignmentId)
            .then((data) => setHistory(data.results || data || []))
            .catch((err) => {
                console.error('Failed to load update history:', err?.response || err);
                setHistory([]);
            })
            .finally(() => setLoadingHistory(false));

        getTaskSubtasksOverview(assignmentId)
            .then((data) => setSubtasksOverview(data))
            .catch((err) => {
                console.error('Failed to load subtasks overview:', err?.response || err);
                setSubtasksOverview(null);
            })
            .finally(() => setLoadingOverview(false));
    }, []);

    // ── Modal open/close ────────────────────────────────────────────────────
    const openCreateModal = (assignment) => {
        setActiveAssignment(assignment);
        setEditingEntry(null);
        const rollupVal = assignment.auto_rollup_percentage !== undefined && assignment.auto_rollup_percentage !== null
            ? assignment.auto_rollup_percentage
            : assignment.completed_percentage;
        const isPendingRollup = Boolean(
            assignment.has_subtasks ||
            (String(assignment.id).startsWith('vr_') && assignment.has_subtasks)
        );
        const autoFillPct = isPendingRollup ? String(Number(rollupVal ?? 0)) : '';
        setFormData({
            ...EMPTY_FORM,
            percentage: autoFillPct,
        });
        setShowModal(true);
    };

    const openDetailsModal = (assignment) => {
        setHistoryAssignment(assignment);
        setShowHistoryModal(true);
        loadDetails(assignment.id);
    };

    const closeDetailsModal = () => {
        setShowHistoryModal(false);
        setHistoryAssignment(null);
        setSubtasksOverview(null);
    };

    const openEditModal = (entry) => {
        // Close history modal if it's open, so they don't overlap awkwardly
        closeDetailsModal();

        const assignment = assignments.find(a => String(a.id) === String(entry.assignment)) || {
            id: entry.assignment,
            task_name: entry.task_name,
            subtask_name: entry.subtask_name,
            completed_percentage: entry.cumulative_percentage,
            remaining_percentage: 100 - Number(entry.cumulative_percentage || 0),
        };
        setActiveAssignment(assignment);
        setEditingEntry(entry);
        setFormData({
            description_of_work: entry.description_of_work || '',
            challenges_faced: entry.challenges_faced || '',
            pending_task: entry.pending_task || '',
            notes: entry.notes || '',
            percentage: entry.percentage || '',
            document: null,
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setActiveAssignment(null);
        setEditingEntry(null);
        setFormData(EMPTY_FORM);
    };

    // ── Submit (create or edit) ─────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();

        const rollupVal = activeAssignment?.auto_rollup_percentage !== undefined && activeAssignment?.auto_rollup_percentage !== null
            ? activeAssignment.auto_rollup_percentage
            : activeAssignment?.completed_percentage;
        const isPendingRollup = Boolean(
            activeAssignment?.has_subtasks ||
            (String(activeAssignment?.id).startsWith('vr_') && activeAssignment?.has_subtasks)
        );

        let pct = Number(formData.percentage);
        if (isPendingRollup) {
            pct = Number(rollupVal ?? 0);
        } else {
            if (formData.percentage === '' || isNaN(pct) || pct < 0) {
                Swal.fire('Missing %', 'Enter the % completed for this update.', 'warning');
                return;
            }
        }

        const payload = new FormData();
        payload.append('description_of_work', formData.description_of_work || '');
        payload.append('challenges_faced', formData.challenges_faced || '');
        payload.append('pending_task', formData.pending_task || '');
        payload.append('notes', formData.notes || '');
        payload.append('percentage', pct);
        if (isPendingRollup) {
            payload.append('is_cumulative', 'true');
        }
        if (formData.document) {
            payload.append('document', formData.document);
        }

        setSaving(true);
        try {
            if (editingEntry) {
                await patchProgressUpdate(editingEntry.id, payload);
                Swal.fire('Saved', 'Your update has been changed.', 'success');
            } else {
                payload.append('assignment', activeAssignment.id);
                await createProgressUpdate(payload);
                Swal.fire('Submitted', 'Your progress update has been recorded.', 'success');
            }
            closeModal();
            loadAssignments();
        } catch (err) {
            const data = err?.response?.data;
            const apiError =
                (Array.isArray(data?.percentage) && data.percentage[0]) ||
                (Array.isArray(data?.non_field_errors) && data.non_field_errors[0]) ||
                data?.detail ||
                (typeof data === 'string' ? data : null) ||
                'Could not save this update.';
            Swal.fire('Error', apiError, 'error');
        } finally {
            setSaving(false);
        }
    };

    const isTaskCompleted = (item) => Number(Number(item?.completed_percentage || 0).toFixed(2)) >= 100;

    const hasActiveFilter = Boolean(searchTerm.trim() || startDateFilter || dueDateFilter);

    const handleResetFilters = () => {
        setSearchTerm('');
        setStartDateFilter('');
        setDueDateFilter('');
        setExpandedCardId(null);
    };

    const filteredAssignments = useMemo(() => {
        let result = assignments || [];

        if (searchTerm.trim()) {
            const q = searchTerm.trim().toLowerCase();
            result = result.filter(a => {
                const subtask = (a.subtask_name || '').toLowerCase();
                const task = (a.task_name || '').toLowerCase();
                const parentSubtask = (a.parent_subtask_name || '').toLowerCase();
                const assignedBy = (a.assigned_by_name || '').toLowerCase();
                const assignedTo = (a.assigned_to_name || '').toLowerCase();
                return (
                    subtask.includes(q) ||
                    task.includes(q) ||
                    parentSubtask.includes(q) ||
                    assignedBy.includes(q) ||
                    assignedTo.includes(q)
                );
            });
        }

        if (startDateFilter) {
            result = result.filter(a => {
                const sDate = getAssignmentStartDate(a);
                const dDate = getAssignmentDueDate(a);
                if (sDate) return sDate >= startDateFilter;
                if (dDate) return dDate >= startDateFilter;
                return false;
            });
        }

        if (dueDateFilter) {
            result = result.filter(a => {
                const sDate = getAssignmentStartDate(a);
                const dDate = getAssignmentDueDate(a);
                if (dDate) return dDate <= dueDateFilter;
                if (sDate) return sDate <= dueDateFilter;
                return false;
            });
        }

        return result;
    }, [assignments, searchTerm, startDateFilter, dueDateFilter]);

    const pendingLeafAssignments = filteredAssignments.filter(a => !a.is_delegated_by_me && !isTaskCompleted(a));
    const completedLeafAssignments = filteredAssignments.filter(a => !a.is_delegated_by_me && isTaskCompleted(a));

    const pendingDelegatedAssignments = filteredAssignments.filter(a => !!a.is_delegated_by_me && !isTaskCompleted(a));
    const completedDelegatedAssignments = filteredAssignments.filter(a => !!a.is_delegated_by_me && isTaskCompleted(a));

    return (
        <div className="container-fluid py-3">
            <style>{`
                .item-custom-modal {
                    background: #fff;
                    border-radius: 16px !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.16) !important;
                    overflow: hidden;
                    border: none !important;
                }
                .item-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 20px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                    background: #fff;
                }
                .item-custom-modal .modal-icon-circle {
                    width: 44px;
                    height: 44px;
                    background-color: var(--form-icon-color, #0a500f);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                    flex-shrink: 0;
                }
                .item-custom-modal .modal-close-x {
                    border: none;
                    background: transparent;
                    font-size: 24px;
                    color: #94a3b8;
                    cursor: pointer;
                    transition: color 0.2s, background-color 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 4px;
                    width: 32px;
                    height: 32px;
                    border-radius: 6px;
                    line-height: 1;
                }
                .item-custom-modal .modal-close-x:hover {
                    color: #1e293b;
                    background-color: #f1f5f9;
                }
                .item-custom-modal .modal-body-custom {
                    padding: 22px 28px;
                    max-height: 70vh;
                    overflow-y: auto;
                }
                .item-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 18px 28px 20px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .item-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .item-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .item-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .item-custom-modal .form-check-input:checked {
                    background-color: #0a500f;
                    border-color: #0a500f;
                }
                .item-custom-modal .btn-close-custom {
                    background-color: var(--cancel-btn-color, #dc3545) !important;
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
                    justify-content: center;
                }
                .item-custom-modal .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .item-custom-modal .btn-save-custom {
                    background-color: var(--save-btn-color, #0a500f) !important;
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
                    justify-content: center;
                }
                .item-custom-modal .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }
                .item-custom-modal .btn-save-custom:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
            `}</style>
        <Card className="p-4">
            <h4 className="mb-3">{isSuperuser ? 'All Tasks & Subtasks' : 'Task Progress'}</h4>

            {/* ── Tabs Navigation ── */}
            <div
                className="d-inline-flex mb-4 flex-wrap"
                style={{
                    background: '#f1f5f9',
                    borderRadius: '50px',
                    padding: '5px',
                    border: '1px solid #e2e8f0',
                    alignSelf: 'flex-start',
                    gap: '4px',
                }}
            >
                <button
                    type="button"
                    onClick={() => handleTabChange('pending')}
                    style={{
                        border: 'none',
                        borderRadius: '50px',
                        padding: '8px 22px',
                        fontSize: '13.5px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: activeTab === 'pending' ? '#fff' : 'transparent',
                        color: activeTab === 'pending' ? '#10b981' : '#64748b',
                        boxShadow: activeTab === 'pending' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer',
                    }}
                >
                    <List size={16} />
                    {isSuperuser ? 'All Tasks' : 'My Pending Tasks'}
                    <span
                        className="badge rounded-pill ms-1"
                        style={{
                            background: activeTab === 'pending' ? '#e8fbf3' : '#e2e8f0',
                            color: activeTab === 'pending' ? '#10b981' : '#64748b',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                        }}
                    >
                        {pendingLeafAssignments.length}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => handleTabChange('delegated')}
                    style={{
                        border: 'none',
                        borderRadius: '50px',
                        padding: '8px 22px',
                        fontSize: '13.5px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: activeTab === 'delegated' ? '#fff' : 'transparent',
                        color: activeTab === 'delegated' ? '#10b981' : '#64748b',
                        boxShadow: activeTab === 'delegated' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer',
                    }}
                >
                    <Users size={16} />
                    Delegated Tasks
                    <span
                        className="badge rounded-pill ms-1"
                        style={{
                            background: activeTab === 'delegated' ? '#e8fbf3' : '#e2e8f0',
                            color: activeTab === 'delegated' ? '#10b981' : '#64748b',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                        }}
                    >
                        {pendingDelegatedAssignments.length}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => handleTabChange('completed')}
                    style={{
                        border: 'none',
                        borderRadius: '50px',
                        padding: '8px 22px',
                        fontSize: '13.5px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: activeTab === 'completed' ? '#fff' : 'transparent',
                        color: activeTab === 'completed' ? '#10b981' : '#64748b',
                        boxShadow: activeTab === 'completed' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer',
                    }}
                >
                    <CheckCircle2 size={16} />
                    Completed Tasks
                    <span
                        className="badge rounded-pill ms-1"
                        style={{
                            background: activeTab === 'completed' ? '#e8fbf3' : '#e2e8f0',
                            color: activeTab === 'completed' ? '#10b981' : '#64748b',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                        }}
                    >
                        {completedLeafAssignments.length}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => handleTabChange('completed_delegated')}
                    style={{
                        border: 'none',
                        borderRadius: '50px',
                        padding: '8px 22px',
                        fontSize: '13.5px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: activeTab === 'completed_delegated' ? '#fff' : 'transparent',
                        color: activeTab === 'completed_delegated' ? '#10b981' : '#64748b',
                        boxShadow: activeTab === 'completed_delegated' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer',
                    }}
                >
                    <CheckCircle2 size={16} />
                    Completed Delegations
                    <span
                        className="badge rounded-pill ms-1"
                        style={{
                            background: activeTab === 'completed_delegated' ? '#e8fbf3' : '#e2e8f0',
                            color: activeTab === 'completed_delegated' ? '#10b981' : '#64748b',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                        }}
                    >
                        {completedDelegatedAssignments.length}
                    </span>
                </button>
            </div>

            {/* Search and Date Filter Bar */}
            <div
                className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4 p-3 rounded"
                style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                }}
            >
                {/* Search input */}
                <div style={{ position: 'relative', minWidth: '260px', flex: '1 1 300px', maxWidth: '420px' }}>
                    <Search
                        size={15}
                        className="text-muted"
                        style={{
                            position: 'absolute',
                            left: '13px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            pointerEvents: 'none',
                        }}
                    />
                    <Form.Control
                        type="text"
                        placeholder="Search by task name or assigned by..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            height: '38px',
                            paddingLeft: '36px',
                            paddingRight: searchTerm ? '32px' : '12px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '13px',
                            background: '#ffffff',
                        }}
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => setSearchTerm('')}
                            style={{
                                position: 'absolute',
                                right: '8px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'transparent',
                                border: 'none',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                            title="Clear search"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* Date Filters & Reset Button */}
                <div className="d-flex align-items-center flex-wrap gap-2">
                    <div
                        className="d-flex align-items-center gap-2 px-3 py-1 rounded"
                        style={{
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            height: '38px',
                        }}
                    >
                        <CalendarDays size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>
                            Start Date:
                        </span>
                        <input
                            type="date"
                            value={startDateFilter}
                            max={dueDateFilter || undefined}
                            onChange={(e) => setStartDateFilter(e.target.value)}
                            style={{
                                border: 'none',
                                background: 'transparent',
                                fontSize: '12.5px',
                                color: '#1e293b',
                                outline: 'none',
                                width: '130px',
                            }}
                            title="Filter by Start Date"
                        />
                        {startDateFilter && (
                            <button
                                type="button"
                                onClick={() => setStartDateFilter('')}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    padding: '0 2px',
                                }}
                                title="Clear Start Date"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    <div
                        className="d-flex align-items-center gap-2 px-3 py-1 rounded"
                        style={{
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            height: '38px',
                        }}
                    >
                        <CalendarDays size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>
                            Due Date:
                        </span>
                        <input
                            type="date"
                            value={dueDateFilter}
                            min={startDateFilter || undefined}
                            onChange={(e) => setDueDateFilter(e.target.value)}
                            style={{
                                border: 'none',
                                background: 'transparent',
                                fontSize: '12.5px',
                                color: '#1e293b',
                                outline: 'none',
                                width: '130px',
                            }}
                            title="Filter by Due Date"
                        />
                        {dueDateFilter && (
                            <button
                                type="button"
                                onClick={() => setDueDateFilter('')}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    padding: '0 2px',
                                }}
                                title="Clear Due Date"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    {hasActiveFilter && (
                        <button
                            type="button"
                            onClick={handleResetFilters}
                            className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                            style={{
                                height: '38px',
                                borderRadius: '8px',
                                fontSize: '12.5px',
                                fontWeight: 500,
                                padding: '0 12px',
                            }}
                            title="Reset all filters"
                        >
                            <RotateCcw size={13} /> Reset
                        </button>
                    )}
                </div>
            </div>

            <div>
                {activeTab === 'pending' && (
                    <>
                        {loadingAssignments ? (
                            <div className="text-center py-4"><Spinner animation="border" size="sm" /></div>
                        ) : pendingLeafAssignments.length === 0 ? (
                            hasActiveFilter ? (
                                <div className="text-center py-5">
                                    <p className="text-muted mb-2">No pending tasks match your search or date filter.</p>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-primary"
                                        onClick={handleResetFilters}
                                        style={{ borderRadius: '6px' }}
                                    >
                                        Clear Filters
                                    </button>
                                </div>
                            ) : (
                                <p className="text-muted small">You don't have any pending tasks to update right now.</p>
                            )
                        ) : (
                            <Row className="g-3 mb-4">
                                {pendingLeafAssignments.map((a, i) => (
                                    <TaskCard
                                        key={a.id}
                                        assignment={a}
                                        onUpdate={openCreateModal}
                                        onDetails={openDetailsModal}
                                        colorIndex={i}
                                        isOpen={expandedCardId === a.id}
                                        onToggle={() => handleToggleCard(a.id)}
                                    />
                                ))}
                            </Row>
                        )}
                    </>
                )}
                {activeTab === 'completed' && (
                    <>
                        {loadingAssignments ? (
                            <div className="text-center py-4"><Spinner animation="border" size="sm" /></div>
                        ) : completedLeafAssignments.length === 0 ? (
                            hasActiveFilter ? (
                                <div className="text-center py-5">
                                    <p className="text-muted mb-2">No completed tasks match your search or date filter.</p>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-primary"
                                        onClick={handleResetFilters}
                                        style={{ borderRadius: '6px' }}
                                    >
                                        Clear Filters
                                    </button>
                                </div>
                            ) : (
                                <p className="text-muted small">You don't have any completed tasks yet.</p>
                            )
                        ) : (
                            <Row className="g-3 mb-4">
                                {completedLeafAssignments.map((a, i) => (
                                    <TaskCard
                                        key={a.id}
                                        assignment={a}
                                        onUpdate={openCreateModal}
                                        onDetails={openDetailsModal}
                                        colorIndex={i}
                                        isOpen={expandedCardId === a.id}
                                        onToggle={() => handleToggleCard(a.id)}
                                    />
                                ))}
                            </Row>
                        )}
                    </>
                )}
                {activeTab === 'delegated' && (
                    <>
                        {loadingAssignments ? (
                            <div className="text-center py-4"><Spinner animation="border" size="sm" /></div>
                        ) : pendingDelegatedAssignments.length === 0 ? (
                            hasActiveFilter ? (
                                <div className="text-center py-5">
                                    <p className="text-muted mb-2">No delegated tasks match your search or date filter.</p>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-primary"
                                        onClick={handleResetFilters}
                                        style={{ borderRadius: '6px' }}
                                    >
                                        Clear Filters
                                    </button>
                                </div>
                            ) : (
                                <p className="text-muted small">You don't have any pending delegated tasks right now.</p>
                            )
                        ) : (
                            <Row className="g-3 mb-4">
                                {pendingDelegatedAssignments.map((a, i) => (
                                    <TaskCard
                                        key={a.id}
                                        assignment={a}
                                        onUpdate={openCreateModal}
                                        onDetails={openDetailsModal}
                                        colorIndex={i}
                                        isOpen={expandedCardId === a.id}
                                        onToggle={() => handleToggleCard(a.id)}
                                    />
                                ))}
                            </Row>
                        )}
                    </>
                )}
                {activeTab === 'completed_delegated' && (
                    <>
                        {loadingAssignments ? (
                            <div className="text-center py-4"><Spinner animation="border" size="sm" /></div>
                        ) : completedDelegatedAssignments.length === 0 ? (
                            hasActiveFilter ? (
                                <div className="text-center py-5">
                                    <p className="text-muted mb-2">No completed delegations match your search or date filter.</p>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-primary"
                                        onClick={handleResetFilters}
                                        style={{ borderRadius: '6px' }}
                                    >
                                        Clear Filters
                                    </button>
                                </div>
                            ) : (
                                <p className="text-muted small">You don't have any completed delegations yet.</p>
                            )
                        ) : (
                            <Row className="g-3 mb-4">
                                {completedDelegatedAssignments.map((a, i) => (
                                    <TaskCard
                                        key={a.id}
                                        assignment={a}
                                        onUpdate={openCreateModal}
                                        onDetails={openDetailsModal}
                                        colorIndex={i}
                                        isOpen={expandedCardId === a.id}
                                        onToggle={() => handleToggleCard(a.id)}
                                    />
                                ))}
                            </Row>
                        )}
                    </>
                )}
            </div>
        </Card>

            <UpdateProgressModal
                show={showModal}
                onHide={closeModal}
                assignment={activeAssignment}
                editingEntry={editingEntry}
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleSubmit}
                saving={saving}
                activeTab={activeTab}
            />

            <ProgressHistoryModal
                show={showHistoryModal}
                onHide={closeDetailsModal}
                assignment={historyAssignment}
                history={history}
                overview={subtasksOverview}
                loading={loadingHistory || loadingOverview}
                onEdit={openEditModal}
            />
        </div>
    );
};

export default TaskProgressUpdatePage;