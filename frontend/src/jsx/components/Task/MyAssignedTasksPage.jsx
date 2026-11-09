import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Card, Badge, Spinner, Row, Col, ProgressBar, Button, Modal } from 'react-bootstrap';
import { FileText, Users, ListChecks, SplitSquareHorizontal, Layers, ChevronDown, ChevronUp, CheckCircle2, Clock } from 'lucide-react';
import Swal from 'sweetalert2';
import {
    getMyAssignedTasks,
    getMyAssignedSubtasks,
    createSubtask,
    getTeamForTask,
} from '../../../services/TaskService';
import SubtaskForm from './SubtaskForm';
import CreateTeamForm from './CreateTeamForm';

const formatDate = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    return isNaN(date) ? d : date.toLocaleDateString();
};

const calcProgress = () => 0;

const progressVariant = (pct, dueDate) => {
    const overdue = dueDate && Date.now() > new Date(dueDate).getTime();
    if (overdue && pct >= 100) return 'danger';
    if (pct >= 70) return 'warning';
    return 'success';
};

const EMPTY_SUBTASK_FORM = {
    subtask_name: '',
    description: '',
    task_type: 'individual',
    start_date: '',
    end_date: '',
    newAttachments: [],
    existingAttachments: [],
};

// ─── Subtask Assignment Card ────────────────────────────────────────────────
// Shown for Anu (group subtask), John (individual), Aleena (sub-subtask), etc.
const SubtaskAssignmentCard = ({ assignment, isOpen, onToggle, onSubtask, onTeam, onAssign }) => {
    const [showDescModal, setShowDescModal] = useState(false);
    const isGroup = String(assignment.task_type || '').toLowerCase() === 'group';
    const teamInfo = assignment.team;
    const memberCount = teamInfo?.members?.length || 0;
    const teamLead = teamInfo?.team_lead_name || assignment.team_lead_name || '—';
    const assignedBy = assignment.assigned_by_name || assignment.team_lead_name || '—';

    return (
        <Col md={6} lg={4} style={{ alignSelf: 'flex-start' }}>
            <Card
                className="border-0 shadow-sm"
                style={{
                    borderRadius: '16px',
                    border: '1px solid #eef2f6',
                    overflow: 'hidden',
                    background: '#fff',
                    transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                }}
            >
                {/* Header */}
                <div
                    className="d-flex align-items-center justify-content-between p-3"
                    style={{ cursor: 'pointer', background: '#fff', userSelect: 'none' }}
                    onClick={onToggle}
                >
                    <div className="d-flex align-items-center gap-3">
                        <div
                            style={{
                                width: '44px',
                                height: '44px',
                                borderRadius: '12px',
                                background: '#e8fbf3',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 2px 8px rgba(34, 197, 94, 0.15)',
                                flexShrink: 0,
                            }}
                        >
                            <Layers size={22} color="#10b981" />
                        </div>
                        <div>
                            <h6 className="fw-bold mb-1" style={{ color: '#1e293b', fontSize: '15px' }}>
                                {assignment.subtask_name || '—'}
                            </h6>
                            <span
                                style={{
                                    background: '#ecfdf5',
                                    color: '#16a34a',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                    display: 'inline-block',
                                }}
                            >
                                {assignment.task_type_display || assignment.task_type || 'SUBTASK'}
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#64748b',
                            padding: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '8px',
                            cursor: 'pointer',
                        }}
                        aria-label="Toggle details"
                    >
                        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                </div>

                {/* Collapsible Body */}
                {isOpen && (
                    <Card.Body className="pt-3 pb-3 px-3 d-flex flex-column" style={{ borderTop: '1px solid #f1f5f9' }}>
                        {/* Subtask Item Container */}
                        <div
                            style={{
                                background: '#f8fafc',
                                border: '1px solid #f1f5f9',
                                borderRadius: '12px',
                                padding: '12px 16px',
                                marginBottom: '14px',
                            }}
                        >
                            <div className="d-flex align-items-center justify-content-between gap-2">
                                <div className="d-flex align-items-center gap-2">
                                    <span
                                        style={{
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '50%',
                                            backgroundColor: '#22c55e',
                                            flexShrink: 0,
                                        }}
                                    />
                                    <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '13.5px' }}>
                                        {assignment.subtask_name}
                                    </span>
                                </div>
                                {assignment.description && (
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                                        style={{
                                            fontSize: '11.5px',
                                            padding: '2px 9px',
                                            borderRadius: '6px',
                                            fontWeight: 500,
                                            whiteSpace: 'nowrap',
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowDescModal(true);
                                        }}
                                        title="View Description"
                                    >
                                        <FileText size={12} /> View Description
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Team lead */}
                        <div className="d-flex align-items-center justify-content-between py-1 mb-2">
                            <span className="text-muted small fw-semibold text-uppercase" style={{ fontSize: '11.5px', letterSpacing: '0.04em' }}>
                                Team Lead
                            </span>
                            <span className="badge bg-light text-dark border fw-semibold" style={{ borderRadius: '6px' }}>
                                {teamLead}
                            </span>
                        </div>

                        {/* Assigned By */}
                        {assignedBy && (
                            <div className="d-flex align-items-center justify-content-between py-1 mb-2">
                                <span className="text-muted small fw-semibold text-uppercase" style={{ fontSize: '11.5px', letterSpacing: '0.04em' }}>
                                    Assigned By
                                </span>
                                <span className="badge bg-light text-dark border fw-semibold" style={{ borderRadius: '6px' }}>
                                    {assignedBy}
                                </span>
                            </div>
                        )}

                        {/* Start Date */}
                        {(assignment.start_date || assignment.end_date) && (
                            <div className="d-flex align-items-center justify-content-between py-1 mb-2">
                                <span className="text-muted small fw-semibold text-uppercase" style={{ fontSize: '11.5px', letterSpacing: '0.04em' }}>
                                    Start Date
                                </span>
                                <span className="small text-dark fw-medium">
                                    {formatDate(assignment.start_date)}
                                </span>
                            </div>
                        )}

                        {/* End Date */}
                        {(assignment.start_date || assignment.end_date) && (
                            <div className="d-flex align-items-center justify-content-between py-1 mb-2">
                                <span className="text-muted small fw-semibold text-uppercase" style={{ fontSize: '11.5px', letterSpacing: '0.04em' }}>
                                    End Date
                                </span>
                                <span className="small text-dark fw-medium">
                                    {formatDate(assignment.end_date)}
                                </span>
                            </div>
                        )}

                        {/* Progress */}
                        <div className="mb-2">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                                <label className="text-muted small fw-semibold text-uppercase mb-0" style={{ fontSize: '11px', letterSpacing: '0.04em' }}>
                                    Progress
                                </label>
                                <span className="small fw-bold text-dark">{Number(assignment.completed_percentage || 0)}%</span>
                            </div>
                            <ProgressBar
                                now={Number(assignment.completed_percentage || 0)}
                                variant={progressVariant(Number(assignment.completed_percentage || 0), assignment.end_date || assignment.due_date)}
                                style={{ height: '6px', borderRadius: '10px' }}
                            />
                        </div>

                        {/* Attachments */}
                        {assignment.attachments && assignment.attachments.length > 0 && (
                            <div className="mb-3">
                                <label className="text-muted small fw-semibold text-uppercase mb-1 d-flex align-items-center gap-1" style={{ fontSize: '11px', letterSpacing: '0.04em' }}>
                                    <FileText size={12} /> Documents
                                </label>
                                <ul className="list-unstyled mb-0 small">
                                    {assignment.attachments.map((att) => (
                                        <li key={att.id} className="py-0.5">
                                            <a href={att.file} target="_blank" rel="noopener noreferrer" className="text-primary d-inline-flex align-items-center gap-1">
                                                <FileText size={12} /> {att.original_filename || 'Attachment'}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Team status */}
                        <div className="mb-3">
                            <label className="text-muted small fw-semibold text-uppercase mb-1 d-flex align-items-center gap-1" style={{ fontSize: '11px', letterSpacing: '0.04em' }}>
                                <Users size={12} /> Team
                            </label>
                            {memberCount === 0 ? (
                                <p className="text-muted small mb-0">No team created yet.</p>
                            ) : (
                                <p className="text-success small fw-semibold mb-0">
                                    Team created ({memberCount} member{memberCount === 1 ? '' : 's'})
                                </p>
                            )}
                        </div>

                        {/* Action buttons — only for group subtasks */}
                        {isGroup && (
                            <div className="mt-auto d-flex gap-2 pt-2 border-top flex-wrap">
                                <Button
                                    variant="outline-primary"
                                    size="sm"
                                    className="d-flex align-items-center gap-1 shadow-sm"
                                    style={{ borderRadius: '8px', fontSize: '12px' }}
                                    onClick={() => onSubtask(assignment)}
                                >
                                    <ListChecks size={14} /> Subtask
                                </Button>
                                <Button
                                    variant="outline-success"
                                    size="sm"
                                    className="d-flex align-items-center gap-1 shadow-sm"
                                    style={{ borderRadius: '8px', fontSize: '12px' }}
                                    onClick={() => onTeam(assignment)}
                                >
                                    <Users size={14} />
                                    {memberCount > 0 ? `Manage Team (${memberCount})` : 'Create Team'}
                                </Button>
                                <Button
                                    variant="outline-warning"
                                    size="sm"
                                    className="d-flex align-items-center gap-1 shadow-sm"
                                    style={{ borderRadius: '8px', fontSize: '12px' }}
                                    onClick={() => onAssign(assignment)}
                                >
                                    <SplitSquareHorizontal size={14} /> Assign Task
                                </Button>
                            </div>
                        )}
                    </Card.Body>
                )}
            </Card>
            {/* Description Modal */}
            <Modal
                show={showDescModal}
                onHide={() => setShowDescModal(false)}
                centered
            >
                <Modal.Header closeButton>
                    <Modal.Title style={{ fontSize: '16px', fontWeight: 600 }}>
                        {assignment.subtask_name} — Description
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div
                        style={{
                            background: '#f8fafc',
                            border: '1px solid #f1f5f9',
                            borderRadius: '8px',
                            padding: '14px',
                            fontSize: '13.5px',
                            color: '#334155',
                            whiteSpace: 'pre-wrap',
                            lineHeight: '1.6',
                        }}
                    >
                        {assignment.description || 'No description provided.'}
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" size="sm" onClick={() => setShowDescModal(false)}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>
        </Col>
    );
};

// ─── Task Collapsible Card ──────────────────────────────────────────────────
// Shown for VoteRequest level tasks (e.g. Aswathy level)
const TaskCollapsibleCard = ({
    vr,
    team,
    teamLoading,
    isOpen,
    onToggle,
    onAddSubtask,
    onCreateTeam,
    onAssign,
}) => {
    const [descTargetSubtask, setDescTargetSubtask] = useState(null);
    const [showTaskDescModal, setShowTaskDescModal] = useState(false);
    const progress = vr.completed_percentage !== undefined ? Number(vr.completed_percentage) : 0;
    const memberCount = team?.members?.length || 0;
    const teamLeadName = vr.team_lead_name || team?.team_lead_name || vr.created_by_name || '—';
    const assignedByName = vr.created_by_name || vr.team_lead_name || '—';
    const assignedSubtasks = vr.my_assigned_subtasks || [];
    const isGroup = String(vr.task_type || '').toLowerCase() === 'group';

    return (
        <Col md={6} lg={4} style={{ alignSelf: 'flex-start' }}>
            <Card
                className="border-0 shadow-sm"
                style={{
                    borderRadius: '16px',
                    border: '1px solid #eef2f6',
                    overflow: 'hidden',
                    background: '#fff',
                    transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                }}
            >
                {/* Header */}
                <div
                    className="d-flex align-items-center justify-content-between p-3"
                    style={{ cursor: 'pointer', background: '#fff', userSelect: 'none' }}
                    onClick={onToggle}
                >
                    <div className="d-flex align-items-center gap-3">
                        <div
                            style={{
                                width: '44px',
                                height: '44px',
                                borderRadius: '12px',
                                background: '#e8fbf3',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 2px 8px rgba(34, 197, 94, 0.15)',
                                flexShrink: 0,
                            }}
                        >
                            <Layers size={22} color="#10b981" />
                        </div>
                        <div>
                            <h6 className="fw-bold mb-1" style={{ color: '#1e293b', fontSize: '15px' }}>
                                {vr.task_name || '—'}
                            </h6>
                            <span
                                style={{
                                    background: '#ecfdf5',
                                    color: '#16a34a',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                    display: 'inline-block',
                                }}
                            >
                                {vr.task_type_display || vr.task_type || 'TASK'}
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#64748b',
                            padding: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '8px',
                            cursor: 'pointer',
                        }}
                        aria-label="Toggle details"
                    >
                        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                </div>

                {/* Collapsible Body */}
                {isOpen && (
                    <Card.Body className="pt-3 pb-3 px-3 d-flex flex-column" style={{ borderTop: '1px solid #f1f5f9' }}>
                        {/* Assigned subtasks list container (Matches user's design) */}
                        {assignedSubtasks.length > 0 && (
                            <div className="mb-3">
                                {assignedSubtasks.map((st) => (
                                    <div
                                        key={st.id}
                                        style={{
                                            background: '#f8fafc',
                                            border: '1px solid #f1f5f9',
                                            borderRadius: '12px',
                                            padding: '12px 16px',
                                            marginBottom: '8px',
                                        }}
                                    >
                                        <div className="d-flex align-items-center justify-content-between gap-2">
                                            <div className="d-flex align-items-center gap-2">
                                                <span
                                                    style={{
                                                        width: '8px',
                                                        height: '8px',
                                                        borderRadius: '50%',
                                                        backgroundColor: '#22c55e',
                                                        flexShrink: 0,
                                                    }}
                                                />
                                                <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '13.5px' }}>
                                                    {st.subtask_name}
                                                </span>
                                                <span
                                                    style={{
                                                        background: '#ecfdf5',
                                                        color: '#16a34a',
                                                        borderRadius: '6px',
                                                        fontSize: '11px',
                                                        fontWeight: 700,
                                                        padding: '2px 8px',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.04em',
                                                    }}
                                                >
                                                    {st.task_type_display || st.task_type || 'SUBTASK'}
                                                </span>
                                            </div>
                                            {st.description && (
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                                                    style={{
                                                        fontSize: '11px',
                                                        padding: '2px 8px',
                                                        borderRadius: '6px',
                                                        fontWeight: 500,
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDescTargetSubtask(st);
                                                    }}
                                                    title="View Description"
                                                >
                                                    <FileText size={12} /> View Description
                                                </button>
                                            )}
                                        </div>
                                        {st.start_date && (
                                            <div className="small text-muted mt-1" style={{ fontSize: '12px', paddingLeft: '16px' }}>
                                                <span className="fw-semibold text-secondary">Start Date:</span> {formatDate(st.start_date)}
                                            </div>
                                        )}
                                        {st.end_date && (
                                            <div className="small text-muted mt-1" style={{ fontSize: '12px', paddingLeft: '16px' }}>
                                                <span className="fw-semibold text-secondary">End Date:</span> {formatDate(st.end_date)}
                                            </div>
                                        )}
                                        {st.attachments && st.attachments.length > 0 && (
                                            <ul className="list-unstyled mb-0 small mt-2" style={{ paddingLeft: '16px' }}>
                                                {st.attachments.map((att) => (
                                                    <li key={att.id}>
                                                        <a
                                                            href={att.file}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-primary d-inline-flex align-items-center gap-1"
                                                        >
                                                            <FileText size={12} /> {att.original_filename || 'Attachment'}
                                                        </a>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Team Lead */}
                        <div className="d-flex align-items-center justify-content-between py-1 mb-2">
                            <span className="text-muted small fw-semibold text-uppercase" style={{ fontSize: '11.5px', letterSpacing: '0.04em' }}>
                                Team Lead
                            </span>
                            <span className="badge bg-light text-dark border fw-semibold" style={{ borderRadius: '6px' }}>
                                {teamLeadName}
                            </span>
                        </div>

                        {/* Assigned By */}
                        {assignedByName && (
                            <div className="d-flex align-items-center justify-content-between py-1 mb-2">
                                <span className="text-muted small fw-semibold text-uppercase" style={{ fontSize: '11.5px', letterSpacing: '0.04em' }}>
                                    Assigned By
                                </span>
                                <span className="badge bg-light text-dark border fw-semibold" style={{ borderRadius: '6px' }}>
                                    {assignedByName}
                                </span>
                            </div>
                        )}

                        {/* Task description — View Description button */}
                        {vr.task_description && (
                            <div className="d-flex align-items-center justify-content-between py-1 mb-2">
                                <span className="text-muted small fw-semibold text-uppercase" style={{ fontSize: '11.5px', letterSpacing: '0.04em' }}>
                                    Description
                                </span>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                                    style={{
                                        fontSize: '11.5px',
                                        padding: '2px 9px',
                                        borderRadius: '6px',
                                        fontWeight: 500,
                                        whiteSpace: 'nowrap',
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowTaskDescModal(true);
                                    }}
                                    title="View Description"
                                >
                                    <FileText size={12} /> View Description
                                </button>
                            </div>
                        )}

                        {/* Dates & Progress */}
                        <Row className="g-2 mb-2">
                            <Col xs={6}>
                                <label className="text-muted small fw-semibold text-uppercase mb-0 d-block" style={{ fontSize: '11px', letterSpacing: '0.04em' }}>
                                    Start Date
                                </label>
                                <span className="small text-dark fw-medium">{formatDate(vr.task_start_date)}</span>
                            </Col>
                            <Col xs={6}>
                                <label className="text-muted small fw-semibold text-uppercase mb-0 d-block" style={{ fontSize: '11px', letterSpacing: '0.04em' }}>
                                    Due Date
                                </label>
                                <span className="small text-dark fw-medium">{formatDate(vr.task_due_date)}</span>
                            </Col>
                        </Row>

                        <div className="mb-2">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                                <label className="text-muted small fw-semibold text-uppercase mb-0" style={{ fontSize: '11px', letterSpacing: '0.04em' }}>
                                    Progress
                                </label>
                                <span className="small fw-bold text-dark">{progress}%</span>
                            </div>
                            <ProgressBar
                                now={progress}
                                variant={progressVariant(progress, vr.task_due_date)}
                                style={{ height: '6px', borderRadius: '10px' }}
                            />
                        </div>

                        {/* Attachments */}
                        {vr.task_attachments && vr.task_attachments.length > 0 && (
                            <div className="mb-3">
                                <label className="text-muted small fw-semibold text-uppercase mb-1 d-flex align-items-center gap-1" style={{ fontSize: '11px', letterSpacing: '0.04em' }}>
                                    <FileText size={12} /> Documents
                                </label>
                                <ul className="list-unstyled mb-0 small">
                                    {vr.task_attachments.map((att) => (
                                        <li key={att.id} className="py-0.5">
                                            <a
                                                href={att.file}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-primary d-inline-flex align-items-center gap-1"
                                            >
                                                <FileText size={12} /> {att.original_filename || 'Attachment'}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Team */}
                        <div className="mb-3">
                            <label className="text-muted small fw-semibold text-uppercase mb-1 d-flex align-items-center gap-1" style={{ fontSize: '11px', letterSpacing: '0.04em' }}>
                                <Users size={12} /> Team
                            </label>
                            {teamLoading ? (
                                <Spinner animation="border" size="sm" />
                            ) : memberCount === 0 ? (
                                <p className="text-muted small mb-0">No team assigned yet.</p>
                            ) : (
                                <p className="text-success small fw-semibold mb-0">
                                    Team created ({memberCount} member{memberCount === 1 ? '' : 's'})
                                </p>
                            )}
                        </div>

                        {/* Action buttons — only for group tasks */}
                        {isGroup && (
                            <div className="mt-auto d-flex gap-2 pt-2 border-top flex-wrap">
                                <Button
                                    variant="outline-primary"
                                    size="sm"
                                    className="d-flex align-items-center gap-1 shadow-sm"
                                    style={{ borderRadius: '8px', fontSize: '12px' }}
                                    onClick={() => onAddSubtask(vr)}
                                >
                                    <ListChecks size={14} /> Subtask
                                </Button>
                                <Button
                                    variant="outline-success"
                                    size="sm"
                                    className="d-flex align-items-center gap-1 shadow-sm"
                                    style={{ borderRadius: '8px', fontSize: '12px' }}
                                    onClick={() => onCreateTeam(vr)}
                                >
                                    <Users size={14} />
                                    {memberCount > 0 ? `Manage Team (${memberCount})` : 'Create Team'}
                                </Button>
                                <Button
                                    variant="outline-warning"
                                    size="sm"
                                    className="d-flex align-items-center gap-1 shadow-sm"
                                    style={{ borderRadius: '8px', fontSize: '12px' }}
                                    onClick={() => onAssign(vr)}
                                >
                                    <SplitSquareHorizontal size={14} /> Assign Task
                                </Button>
                            </div>
                        )}
                    </Card.Body>
                )}
            </Card>
            {/* Subtask Description Modal */}
            <Modal
                show={!!descTargetSubtask}
                onHide={() => setDescTargetSubtask(null)}
                centered
            >
                <Modal.Header closeButton>
                    <Modal.Title style={{ fontSize: '16px', fontWeight: 600 }}>
                        {descTargetSubtask?.subtask_name} — Description
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div
                        style={{
                            background: '#f8fafc',
                            border: '1px solid #f1f5f9',
                            borderRadius: '8px',
                            padding: '14px',
                            fontSize: '13.5px',
                            color: '#334155',
                            whiteSpace: 'pre-wrap',
                            lineHeight: '1.6',
                        }}
                    >
                        {descTargetSubtask?.description || 'No description provided.'}
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" size="sm" onClick={() => setDescTargetSubtask(null)}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Task Description Modal */}
            <Modal
                show={showTaskDescModal}
                onHide={() => setShowTaskDescModal(false)}
                centered
            >
                <Modal.Header closeButton>
                    <Modal.Title style={{ fontSize: '16px', fontWeight: 600 }}>
                        {vr.task_name} — Description
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div
                        style={{
                            background: '#f8fafc',
                            border: '1px solid #f1f5f9',
                            borderRadius: '8px',
                            padding: '14px',
                            fontSize: '13.5px',
                            color: '#334155',
                            whiteSpace: 'pre-wrap',
                            lineHeight: '1.6',
                        }}
                    >
                        {vr.task_description || 'No description provided.'}
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" size="sm" onClick={() => setShowTaskDescModal(false)}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>
        </Col>
    );
};

// ─── Main Page ───────────────────────────────────────────────────────────────
const MyAssignedTasksPage = () => {
    const navigate = useNavigate();
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

    // Level-1 tasks: VoteRequest-based (Aswathy sees her full task here)
    const [tasks, setTasks] = useState([]);
    // Level-2+ subtask assignments: TaskAssignment-based (Anu, John, Aleena)
    const [subtaskAssignments, setSubtaskAssignments] = useState([]);

    const [loading, setLoading] = useState(false);

    // Accordion state: only clicked card opens, previous card closes
    const [expandedCardId, setExpandedCardId] = useState(null);
    const handleToggleCard = (cardId) => {
        setExpandedCardId((prev) => (prev === cardId ? null : cardId));
    };

    // Tab state: 'assigned' (pending 0%), 'in_progress' (>0% & <100%), 'completed' (>= 100%)
    const [activeTab, setActiveTab] = useState('assigned');
    const handleTabChange = (tabKey) => {
        setActiveTab(tabKey);
        setExpandedCardId(null);
    };

    const getProgress = (item) => Number(Number(item?.completed_percentage || 0).toFixed(2));
    const isTaskCompleted = (item) => getProgress(item) >= 100;
    const isTaskInProgress = (item) => {
        const p = getProgress(item);
        return p > 0 && p < 100;
    };
    const isTaskPending = (item) => getProgress(item) <= 0;

    const pendingTasks = tasks.filter((vr) => isTaskPending(vr));
    const pendingSubtasks = subtaskAssignments.filter((a) => isTaskPending(a));

    const inProgressTasks = tasks.filter((vr) => isTaskInProgress(vr));
    const inProgressSubtasks = subtaskAssignments.filter((a) => isTaskInProgress(a));

    const completedTasks = tasks.filter((vr) => isTaskCompleted(vr));
    const completedSubtasks = subtaskAssignments.filter((a) => isTaskCompleted(a));

    let currentTasks = pendingTasks;
    let currentSubtasks = pendingSubtasks;
    if (activeTab === 'in_progress') {
        currentTasks = inProgressTasks;
        currentSubtasks = inProgressSubtasks;
    } else if (activeTab === 'completed') {
        currentTasks = completedTasks;
        currentSubtasks = completedSubtasks;
    }

    const totalPendingCount = pendingTasks.length + pendingSubtasks.length;
    const totalInProgressCount = inProgressTasks.length + inProgressSubtasks.length;
    const totalCompletedCount = completedTasks.length + completedSubtasks.length;

    // Subtask creation modal
    const [showSubtaskModal, setShowSubtaskModal] = useState(false);
    const [savingSubtask, setSavingSubtask] = useState(false);
    const [subtaskFormData, setSubtaskFormData] = useState(EMPTY_SUBTASK_FORM);
    // Context for the subtask modal: which task or parent_subtask to link to
    const [subtaskContext, setSubtaskContext] = useState({ taskId: null, parentSubtaskId: null });

    // Team modal
    const [showTeamModal, setShowTeamModal] = useState(false);
    const [teamTask, setTeamTask] = useState(null);
    const [teamSubtaskId, setTeamSubtaskId] = useState(null);
    const [teamSubtaskName, setTeamSubtaskName] = useState(null);
    const [teamLeadEmployeeId, setTeamLeadEmployeeId] = useState(null);
    const [teamLeadDepartmentId, setTeamLeadDepartmentId] = useState(null);

    // Team rosters keyed by task id (for VoteRequest cards only)
    const [teamsByTaskId, setTeamsByTaskId] = useState({});
    const [loadingTeamTaskIds, setLoadingTeamTaskIds] = useState(() => new Set());

    // ── Data loading ──────────────────────────────────────────────────────────
    const loadAll = useCallback(() => {
        setLoading(true);
        Promise.all([
            getMyAssignedTasks().catch(() => []),
            getMyAssignedSubtasks().catch(() => []),
        ]).then(([tasksData, subtaskData]) => {
            setTasks(tasksData.results || tasksData || []);
            setSubtaskAssignments(subtaskData.results || subtaskData || []);
        }).finally(() => setLoading(false));
    }, []);

    useEffect(() => { loadAll(); }, [loadAll]);

    const loadTeamForTask = useCallback((taskId) => {
        if (!taskId) return;
        setLoadingTeamTaskIds(prev => new Set(prev).add(taskId));
        getTeamForTask(taskId)
            .then(data => {
                const teams = data.results || data || [];
                setTeamsByTaskId(prev => ({ ...prev, [taskId]: teams[0] || null }));
            })
            .catch(() => {
                setTeamsByTaskId(prev => ({ ...prev, [taskId]: prev[taskId] ?? null }));
            })
            .finally(() => {
                setLoadingTeamTaskIds(prev => {
                    const next = new Set(prev);
                    next.delete(taskId);
                    return next;
                });
            });
    }, []);

    useEffect(() => {
        tasks.forEach(vr => {
            if (vr.task && !(vr.task in teamsByTaskId) && !loadingTeamTaskIds.has(vr.task)) {
                loadTeamForTask(vr.task);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tasks]);

    // ── Subtask modal ─────────────────────────────────────────────────────────
    // For VoteRequest task cards (Aswathy level)
    const handleAddSubtaskForTask = (vr) => {
        setSubtaskFormData(EMPTY_SUBTASK_FORM);
        setSubtaskContext({ taskId: vr.task, parentSubtaskId: null });
        setShowSubtaskModal(true);
    };

    // For subtask assignment cards (Anu/Aleena level)
    // The new sub-subtask's parent_subtask = the subtask they were assigned
    const handleAddSubtaskForAssignment = (assignment) => {
        setSubtaskFormData(EMPTY_SUBTASK_FORM);
        setSubtaskContext({ taskId: null, parentSubtaskId: assignment.subtask });
        setShowSubtaskModal(true);
    };

    const handleCloseSubtaskModal = () => {
        setShowSubtaskModal(false);
        setSubtaskFormData(EMPTY_SUBTASK_FORM);
        setSubtaskContext({ taskId: null, parentSubtaskId: null });
    };

    const handleSubtaskSubmit = async (e) => {
        e.preventDefault();
        setSavingSubtask(true);
        try {
            const payload = new FormData();
            payload.append('subtask_name', subtaskFormData.subtask_name || '');
            payload.append('description', subtaskFormData.description || '');
            payload.append('task_type', subtaskFormData.task_type || 'individual');
            if (subtaskFormData.start_date) {
                payload.append('start_date', subtaskFormData.start_date);
            }
            if (subtaskFormData.end_date) {
                payload.append('end_date', subtaskFormData.end_date);
            }
            if (subtaskContext.taskId) {
                payload.append('task', subtaskContext.taskId);
            }
            if (subtaskContext.parentSubtaskId) {
                payload.append('parent_subtask', subtaskContext.parentSubtaskId);
            }
            (subtaskFormData.newAttachments || []).forEach((file) => {
                payload.append('attachments', file);
            });
            await createSubtask(payload);
            Swal.fire('Created', 'Subtask created successfully', 'success');
            handleCloseSubtaskModal();
            loadAll();
        } catch (err) {
            console.error('Error saving subtask', err.response?.data || err.message);
            const apiError =
                err.response?.data?.subtask_name?.[0] ||
                err.response?.data?.detail ||
                'Operation failed. Please check the form and try again.';
            Swal.fire('Error', apiError, 'error');
        } finally {
            setSavingSubtask(false);
        }
    };

    // ── Team modal ────────────────────────────────────────────────────────────
    const handleCreateTeamForTask = (vr) => {
        setTeamTask(vr);
        setTeamSubtaskId(null);
        setTeamSubtaskName(null);
        setTeamLeadEmployeeId(vr?.assigned_employee || null);
        setTeamLeadDepartmentId(vr?.assigned_department || null);
        setShowTeamModal(true);
    };

    const handleCreateTeamForAssignment = (assignment) => {
        // No parent task context needed — team belongs to the subtask directly
        setTeamTask(null);
        setTeamSubtaskId(assignment.subtask);
        setTeamSubtaskName(assignment.subtask_name);
        setTeamLeadEmployeeId(assignment?.employee || null);
        setTeamLeadDepartmentId(assignment?.employee_department || null);
        setShowTeamModal(true);
    };

    const handleCloseTeamModal = () => {
        setShowTeamModal(false);
        setTeamTask(null);
        setTeamSubtaskId(null);
        setTeamSubtaskName(null);
        setTeamLeadEmployeeId(null);
        setTeamLeadDepartmentId(null);
    };

    // ── Assign Task navigation ────────────────────────────────────────────────
    // For VoteRequest cards: navigate by task id
    const handleAssignForTask = (vr) => navigate(`/task/assign-task/${vr.task}`);
    // For subtask assignment cards: navigate by subtask id as parent_subtask context
    const handleAssignForAssignment = (assignment) =>
        navigate(`/task/assign-task/${assignment.subtask}?parent_subtask=${assignment.subtask}`);

    // ── Render ────────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <Card className="p-4">
                <div className="text-center py-5"><Spinner animation="border" /></div>
            </Card>
        );
    }

    const hasCurrentItems = currentTasks.length > 0 || currentSubtasks.length > 0;

    return (
        <>
            <Card className="p-4">
                <h4 className="mb-3">{isSuperuser ? 'All Tasks & Subtasks' : 'My Assigned Tasks'}</h4>

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
                        onClick={() => handleTabChange('assigned')}
                        style={{
                            border: 'none',
                            borderRadius: '50px',
                            padding: '8px 22px',
                            fontSize: '13.5px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: activeTab === 'assigned' ? '#fff' : 'transparent',
                            color: activeTab === 'assigned' ? '#10b981' : '#64748b',
                            boxShadow: activeTab === 'assigned' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer',
                        }}
                    >
                        <ListChecks size={16} />
                        {isSuperuser ? 'Assigned Tasks' : 'My Assigned Tasks'}
                        <span
                            className="badge rounded-pill ms-1"
                            style={{
                                background: activeTab === 'assigned' ? '#e8fbf3' : '#e2e8f0',
                                color: activeTab === 'assigned' ? '#10b981' : '#64748b',
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '3px 8px',
                            }}
                        >
                            {totalPendingCount}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleTabChange('in_progress')}
                        style={{
                            border: 'none',
                            borderRadius: '50px',
                            padding: '8px 22px',
                            fontSize: '13.5px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: activeTab === 'in_progress' ? '#fff' : 'transparent',
                            color: activeTab === 'in_progress' ? '#10b981' : '#64748b',
                            boxShadow: activeTab === 'in_progress' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer',
                        }}
                    >
                        <Clock size={16} />
                        Task in Progress
                        <span
                            className="badge rounded-pill ms-1"
                            style={{
                                background: activeTab === 'in_progress' ? '#e8fbf3' : '#e2e8f0',
                                color: activeTab === 'in_progress' ? '#10b981' : '#64748b',
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '3px 8px',
                            }}
                        >
                            {totalInProgressCount}
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
                            {totalCompletedCount}
                        </span>
                    </button>
                </div>

                {!hasCurrentItems ? (
                    <div className="text-center py-5">
                        <p className="text-muted mb-0">
                            {activeTab === 'completed'
                                ? 'No completed tasks yet'
                                : activeTab === 'in_progress'
                                ? 'No tasks in progress currently'
                                : 'No assigned tasks yet'}
                        </p>
                    </div>
                ) : (
                    <Row className="g-3 align-items-start">
                        {/* ── VoteRequest task cards (Aswathy level) ── */}
                        {currentTasks.map((vr) => (
                            <TaskCollapsibleCard
                                key={`task-${vr.id}`}
                                vr={vr}
                                team={teamsByTaskId[vr.task]}
                                teamLoading={loadingTeamTaskIds.has(vr.task)}
                                isOpen={expandedCardId === `task-${vr.id}`}
                                onToggle={() => handleToggleCard(`task-${vr.id}`)}
                                onAddSubtask={handleAddSubtaskForTask}
                                onCreateTeam={handleCreateTeamForTask}
                                onAssign={handleAssignForTask}
                            />
                        ))}

                        {/* ── Subtask Assignment cards (Anu / John / Aleena levels) ── */}
                        {currentSubtasks.map((assignment) => (
                            <SubtaskAssignmentCard
                                key={`assign-${assignment.id}`}
                                assignment={assignment}
                                isOpen={expandedCardId === `assign-${assignment.id}`}
                                onToggle={() => handleToggleCard(`assign-${assignment.id}`)}
                                onSubtask={handleAddSubtaskForAssignment}
                                onTeam={handleCreateTeamForAssignment}
                                onAssign={handleAssignForAssignment}
                            />
                        ))}
                    </Row>
                )}
            </Card>

            {/* Subtask creation modal */}
            <SubtaskForm
                show={showSubtaskModal}
                onHide={handleCloseSubtaskModal}
                editId={null}
                formData={subtaskFormData}
                setFormData={setSubtaskFormData}
                onSubmit={handleSubtaskSubmit}
                saving={savingSubtask}
                onDeleteExistingAttachment={() => { }}
            />

            {/* Team creation / management modal */}
            <CreateTeamForm
                show={showTeamModal}
                onHide={handleCloseTeamModal}
                task={teamTask}
                subtaskId={teamSubtaskId}
                subtaskName={teamSubtaskName}
                leadEmployeeId={teamLeadEmployeeId}
                leadDepartmentId={teamLeadDepartmentId}
                onCreated={() => {
                    if (teamTask?.task) loadTeamForTask(teamTask.task);
                    loadAll();
                }}
            />
        </>
    );
};

export default MyAssignedTasksPage;