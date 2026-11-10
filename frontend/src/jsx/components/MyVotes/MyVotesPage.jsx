import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Table, Button, Modal, Spinner, Form, Row, Col, Alert } from 'react-bootstrap';
import {
    Eye,
    RefreshCw,
    Layers,
    ClipboardList,
    Wrench,
    MessageSquare,
    Calendar,
    CheckCircle2,
    Clock,
    XCircle,
    Inbox,
    Check,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import Swal from 'sweetalert2';
import { useSelector } from 'react-redux';

import { usePageTitle } from '../../../context/TitleContext';
import { getMyPendingVotes, castVote } from '../../../services/TaskService';
import {
    getReceivedRepairRequests,
    submitRepairRequestDecision,
    getRepairRequests,
    adminUpdateRepairRequestStatus
} from '../../../services/MachineManagementService';
import ComplaintService from '../../../services/ComplaintService';
import AppointmentService from '../../../services/AppointmentService';
import './MyVotes.css';

/* ------------------------------------------------------------------ */
/*  Module metadata                                                    */
/* ------------------------------------------------------------------ */

const MODULES = {
    task: { label: 'Task', color: '#2563eb', icon: ClipboardList },
    equipment: { label: 'Equipment', color: '#7c3aed', icon: Wrench },
    feedback: { label: 'Feedback', color: '#e11d48', icon: MessageSquare },
    appointment: { label: 'Appointment', color: '#ea580c', icon: Calendar },
};

const TAB_COLUMNS = {
    all: {
        type: 'Type',
        request: 'Request',
        from: 'From',
        deadline: 'Deadline',
        status: 'Status',
        action: 'Action',
    },
    task: {
        type: 'Type',
        request: 'Task Name',
        from: 'Assigned By',
        deadline: 'Cutoff Date',
        status: 'Vote Status',
        action: 'Action',
    },
    equipment: {
        type: 'Type',
        request: 'Equipment Name',
        from: 'Raised By',
        deadline: 'Due Date',
        status: 'Status',
        action: 'Action',
    },
    feedback: {
        type: 'Type',
        request: 'Complaint / Feedback',
        from: 'Raised By',
        deadline: 'Cutoff Date',
        status: 'Status',
        action: 'Action',
    },
    appointment: {
        type: 'Type',
        request: 'Visitor / Purpose',
        from: 'Requested By',
        deadline: 'Scheduled Date & Time',
        status: 'Status',
        action: 'Action',
    },
};

const tint = (hex, alpha = 0.14) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */

const asList = (data) => (Array.isArray(data) ? data : data?.results || []);

// 'YYYY-MM-DD' -> Date at the END of that day (a date-only cutoff stays open all day)
const endOfDay = (ymd) => {
    if (!ymd) return null;
    const [y, m, d] = String(ymd).split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 23, 59, 59);
};

const formatDateTime = (d) => {
    if (!d) return '—';
    const dt = d instanceof Date ? d : new Date(d);
    return isNaN(dt.getTime()) ? String(d) : dt.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatDateOnly = (d) => {
    if (!d) return '—';
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
        const [y, m, day] = d.split('-');
        return `${day}/${m}/${y}`;
    }
    const dt = d instanceof Date ? d : new Date(d);
    return isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const hoursLeft = (d) => (d ? (d.getTime() - Date.now()) / 36e5 : null);

const getInitials = (str) => {
    if (!str || str === '—' || str === 'System') return '—';
    const parts = str.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const Badge = ({ color, children }) => (
    <span style={{
        backgroundColor: tint(color), color, fontWeight: 600, fontSize: '12px',
        padding: '4px 10px', borderRadius: '4px', display: 'inline-block', whiteSpace: 'nowrap',
    }}>
        {children}
    </span>
);

const DECISION_COLORS = { approved: '#198754', rejected: '#dc3545', neutral: '#6c757d', pending: '#b58105' };

const Label = ({ children }) => (
    <label className="text-muted small fw-bold mb-1 d-block">{children}</label>
);

const Field = ({ label, children, md = 6 }) => (
    <Col md={md}>
        <Label>{label}</Label>
        <div className="fw-semibold text-break">{children || '—'}</div>
    </Col>
);

/* ------------------------------------------------------------------ */
/*  Normalisers – turn each module's record into one common shape      */
/*  (the raw record is kept in `raw` for the module-specific panel)    */
/* ------------------------------------------------------------------ */

const fromTask = (vr) => {
    const isPastCutoff = vr.cutoff_date ? new Date() > new Date(vr.cutoff_date) : false;
    const isDecided = vr.result_status === 'approved' || vr.result_status === 'rejected';
    const isClosed = vr.is_open === false || isPastCutoff || isDecided;
    return {
        key: `task-${vr.id}`,
        module: 'task',
        id: vr.id,
        title: vr.task_name || 'Task',
        from: vr.created_by_name || '—',
        deadline: vr.cutoff_date ? new Date(vr.cutoff_date) : null,
        deadlineHasTime: true,
        done: isClosed,
        decision: vr.my_vote === 'yes' || vr.my_vote === 'no'
            ? { text: 'Voted', tone: 'approved' }
            : { text: 'Not voted yet', tone: 'pending' },
        raw: vr,
    };
};

const equipmentInactive = (req) => {
    if (['Accepted', 'Rejected', 'Hold'].includes(req.status)) return true;
    const due = endOfDay(req.duedate);
    return due ? due < new Date(new Date().setHours(0, 0, 0, 0)) : false;
};

const fromEquipment = (req, myId, role = 'responder') => {
    const isEvaluator = role === 'evaluator';
    if (isEvaluator) {
        const evaluated = ['Accepted', 'Rejected', 'Hold'].includes(req.status);
        return {
            key: `equipment-eval-${req.id}`,
            module: 'equipment',
            id: req.id,
            title: req.part_details ? `[Final Evaluation] ${req.part_details}` : `Repair request #${req.id} (Evaluation)`,
            from: req.created_by_name || '—',
            deadline: endOfDay(req.duedate),
            deadlineHasTime: false,
            done: evaluated,
            decision: evaluated ? { text: 'Voted', tone: 'approved' } : { text: 'Not voted yet', tone: 'pending' },
            raw: req,
            role: 'evaluator',
        };
    }

    const mine = (req.feedbacks || []).find((f) => f.user === myId);
    const isInactive = equipmentInactive(req);
    const isVoted = !!mine;
    return {
        key: `equipment-${req.id}`,
        module: 'equipment',
        id: req.id,
        title: req.part_details ? req.part_details : `Repair request #${req.id}`,
        from: req.created_by_name || '—',
        deadline: endOfDay(req.duedate),
        deadlineHasTime: false,
        done: isInactive,
        decision: isVoted ? { text: 'Voted', tone: 'approved' } : { text: 'Not voted yet', tone: 'pending' },
        raw: req,
        myFeedback: mine || null,
        role: 'responder',
    };
};

const complaintBlocked = (c) => {
    const finalized = c.status === 'Closed' || c.status === 'Resolved' || (c.admin_decision && c.admin_decision !== 'Pending');
    const cutoff = endOfDay(c.cutoff_date);
    const pastCutoff = cutoff ? cutoff < new Date() : false;
    return finalized || pastCutoff;
};

const fromComplaint = (c, myId, role = 'responder') => {
    const isEvaluator = role === 'evaluator';
    const reporter = `${c.user_details?.first_name || ''} ${c.user_details?.last_name || ''}`.trim() || c.user_details?.email || '—';
    
    if (isEvaluator) {
        const evaluated = (c.admin_decision && c.admin_decision !== 'Pending') || c.status === 'Closed' || c.status === 'Resolved';
        return {
            key: `feedback-eval-${c.id}`,
            module: 'feedback',
            id: c.id,
            title: c.title ? `[Final Evaluation] ${c.title}` : `Complaint CMP-${c.id} (Evaluation)`,
            from: reporter,
            deadline: endOfDay(c.cutoff_date),
            deadlineHasTime: false,
            done: evaluated,
            decision: evaluated ? { text: 'Voted', tone: 'approved' } : { text: 'Not voted yet', tone: 'pending' },
            raw: c,
            role: 'evaluator',
        };
    }

    const mine = (c.actions || []).find((a) => a.created_by === myId);
    const isBlocked = complaintBlocked(c);
    const isVoted = !!mine;
    return {
        key: `feedback-${c.id}`,
        module: 'feedback',
        id: c.id,
        title: c.title || `Complaint CMP-${c.id}`,
        from: reporter,
        deadline: endOfDay(c.cutoff_date),
        deadlineHasTime: false,
        done: isBlocked,
        decision: isVoted ? { text: 'Voted', tone: 'approved' } : { text: 'Not voted yet', tone: 'pending' },
        raw: c,
        myAction: mine || null,
        role: 'responder',
    };
};

const fromAppointment = (a) => {
    const when = a.appointment_date
        ? new Date(`${a.appointment_date}T${a.appointment_time || '00:00:00'}`)
        : null;
    const done = a.status !== 'pending';
    return {
        key: `appointment-${a.id}`,
        module: 'appointment',
        id: a.id,
        title: `Visit: ${a.visitor_name || a.vehicle_number || 'Visitor'}`,
        from: a.created_by_name || a.department_name || '—',
        deadline: when,
        deadlineHasTime: true,
        done,
        decision: { text: done ? 'Voted' : 'Not voted yet', tone: done ? 'approved' : 'pending' },
        raw: a,
    };
};

/* ------------------------------------------------------------------ */
/*  Module panels (shown inside the modal).                            */
/*  Each one calls the SAME endpoint the original screen uses.         */
/* ------------------------------------------------------------------ */

const TaskPanel = ({ item, onClose, onSaved }) => {
    const vr = item.raw;
    const [remarks, setRemarks] = useState(vr.my_remarks || '');
    const [busy, setBusy] = useState(false);

    const vote = async (value) => {
        setBusy(true);
        try {
            await castVote(vr.id, value, remarks);
            await Swal.fire('Success', `Your task has been ${value === 'yes' ? 'Approved' : 'Rejected'}.`, 'success');
            onSaved();
        } catch (err) {
            Swal.fire('Error', err.response?.data?.detail || 'Failed to cast your vote.', 'error');
        } finally {
            setBusy(false);
        }
    };

    const isDecided = vr.result_status === 'approved' || vr.result_status === 'rejected';
    const isVotingActive = vr.is_open && !isDecided;

    return (
        <>
            <Modal.Body className="p-4">
                <div className="d-flex justify-content-between align-items-start mb-3">
                    <h4 className="fw-bold mb-0">{vr.task_name || 'Task Vote Request'}</h4>
                    <div className="d-flex gap-2">
                        {vr.approval_type && (
                            <span className="badge bg-light text-primary border text-uppercase" style={{ fontSize: '11px', padding: '5px 9px' }}>
                                {vr.approval_type}
                            </span>
                        )}
                        <span className={`badge ${isVotingActive ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'} border`} style={{ fontSize: '11px', padding: '5px 9px' }}>
                            {isVotingActive ? 'Open for voting' : (isDecided ? (vr.result_status === 'approved' ? 'Approved' : 'Rejected') : 'Closed')}
                        </span>
                    </div>
                </div>

                {vr.task_description && (
                    <div className="mb-3">
                        <Label>Task Description</Label>
                        <p className="mb-0 bg-light p-3 rounded" style={{ whiteSpace: 'pre-line', fontSize: '13px' }}>{vr.task_description}</p>
                    </div>
                )}

                <Row className="g-3 mb-3">
                    <Field label="Start Date" md={4}>{formatDateOnly(vr.task_start_date)}</Field>
                    <Field label="Due Date (End Date)" md={4}>{formatDateOnly(vr.task_due_date)}</Field>
                    <Field label="Voting Cutoff" md={4}>{formatDateTime(vr.cutoff_date)}</Field>
                    <Field label="Task Type" md={4}>{vr.task_type_display || vr.task_type || '—'}</Field>
                    <Field label="Assigned By" md={4}>{vr.created_by_name || '—'}</Field>
                    <Field label="Assigned To" md={4}>
                        {vr.assigned_employee_name || '—'}
                        {vr.assigned_department_name ? ` (${vr.assigned_department_name})` : ''}
                    </Field>
                    {vr.team_lead_name && <Field label="Team Lead" md={4}>{vr.team_lead_name}</Field>}
                    {vr.completed_percentage !== undefined && vr.completed_percentage !== null && (
                        <Field label="Completed Progress" md={4}>{`${vr.completed_percentage}%`}</Field>
                    )}
                </Row>

                {vr.remarks && (
                    <div className="mb-3">
                        <Label>Request Remarks</Label>
                        <p className="mb-0 bg-light p-3 rounded text-muted" style={{ fontSize: '13px' }}>{vr.remarks}</p>
                    </div>
                )}

                {vr.task_attachments && vr.task_attachments.length > 0 && (
                    <div className="mb-3">
                        <Label>Task Attachments</Label>
                        <div className="d-flex flex-wrap gap-2">
                            {vr.task_attachments.map((att) => (
                                <a key={att.id} href={att.file} target="_blank" rel="noopener noreferrer" className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1 py-1 px-2" style={{ fontSize: '12px' }}>
                                    <i className="fa fa-paperclip"></i> {att.filename || 'Attachment'}
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                <hr />

                <Form.Group className="mt-2">
                    <Label>Your Remarks</Label>
                    <Form.Control
                        as="textarea"
                        rows={3}
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Enter your remarks here..."
                        disabled={!isVotingActive || busy}
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck="false"
                        style={{ textTransform: 'none' }}
                    />
                </Form.Group>
            </Modal.Body>
            <Modal.Footer className="d-flex justify-content-between">
                <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
                {isVotingActive ? (
                    <div className="d-flex gap-2">
                        <Button size="sm" disabled={busy} variant={vr.my_vote === 'yes' ? 'success' : 'outline-success'} onClick={() => vote('yes')}>
                            {vr.my_vote === 'yes' ? 'Approved ✓' : 'Approve'}
                        </Button>
                        <Button size="sm" disabled={busy} variant={vr.my_vote === 'no' ? 'danger' : 'outline-danger'} onClick={() => vote('no')}>
                            {vr.my_vote === 'no' ? 'Rejected ✓' : 'Reject'}
                        </Button>
                    </div>
                ) : <span className="text-muted small">Voting closed</span>}
            </Modal.Footer>
        </>
    );
};

const STATUS_TO_DECISION = {
    Accepted: 'Approved',
    Rejected: 'Rejected',
    Hold: 'On Hold'
};

const DECISION_TO_STATUS = {
    Approved: 'Accepted',
    Rejected: 'Rejected',
    'On Hold': 'Hold'
};

const EquipmentPanel = ({ item, onClose, onSaved }) => {
    const [req, setReq] = useState(item.raw);
    const isEvaluator = item.role === 'evaluator';
    const mine = item.myFeedback;
    const respLocked = equipmentInactive(req);
    const reduxUser = useSelector((state) => state.auth?.auth?.user || state.auth?.user);
    const userName = reduxUser ? `${reduxUser.first_name || ''} ${reduxUser.last_name || ''}`.trim() || reduxUser.username : 'Receiver';
    const commentName = mine?.responder_name || userName;

    // Responder state (First Approval)
    const [values, setValues] = useState({
        positive: mine?.positive_feedback || '',
        negative: mine?.negative_feedback || '',
        decision: mine?.decision || '',
        notes: mine?.decision_notes || '',
    });
    const [file, setFile] = useState(null);

    // Evaluator state (Final Decision)
    const evalLocked = req.status === 'Accepted' || req.status === 'Rejected';
    const [evalDecision, setEvalDecision] = useState(STATUS_TO_DECISION[req.status] || '');
    const [evalRemarks, setEvalRemarks] = useState(req.decision_notes || '');

    // Collapsible voters state for final evaluator
    const [expandedVoters, setExpandedVoters] = useState({});

    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (req.status && STATUS_TO_DECISION[req.status]) {
            setEvalDecision(STATUS_TO_DECISION[req.status]);
        } else {
            setEvalDecision('');
        }
        if (req.decision_notes) {
            setEvalRemarks(req.decision_notes);
        }
    }, [req.status, req.decision_notes]);

    const submitResponder = async () => {
        if (!values.decision) {
            Swal.fire('Select a decision', 'Choose YES, NO or NEUTRAL before submitting.', 'warning');
            return;
        }
        setBusy(true);
        try {
            const statusMap = { YES: 'Accepted', NO: 'Rejected', NEUTRAL: 'Hold' };
            const fd = new FormData();
            fd.append('status', statusMap[values.decision]);
            fd.append('decision', values.decision);
            fd.append('positive_feedback', values.positive);
            fd.append('negative_feedback', values.negative);
            fd.append('decision_notes', values.notes);
            if (file) fd.append('supporting_document', file);
            await submitRepairRequestDecision(req.id, fd);
            await Swal.fire({ icon: 'success', title: 'Success', text: 'Decision and feedback submitted successfully', timer: 1800, showConfirmButton: false });
            onSaved();
        } catch (e) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to submit decision' });
        } finally {
            setBusy(false);
        }
    };

    const submitEvaluator = async () => {
        if (!evalDecision) {
            Swal.fire('Select a decision', 'Choose Approved, Rejected, or On Hold before submitting.', 'warning');
            return;
        }
        if (responderDecision === 'YES' && evalDecision === 'Rejected') {
            Swal.fire('Invalid decision', 'Cannot reject a request when receivers voted YES.', 'warning');
            return;
        }
        if (responderDecision === 'NO' && evalDecision === 'Approved') {
            Swal.fire('Invalid decision', 'Cannot approve a request when receivers voted NO.', 'warning');
            return;
        }
        setBusy(true);
        try {
            const targetStatus = DECISION_TO_STATUS[evalDecision] || evalDecision;
            await adminUpdateRepairRequestStatus(req.id, targetStatus, evalRemarks);
            await Swal.fire({ title: 'Success!', text: `Repair Request #${req.id} marked as ${evalDecision}`, icon: 'success', timer: 1800, showConfirmButton: false });
            onSaved();
        } catch (e) {
            Swal.fire({ icon: 'error', title: 'Error', text: e.response?.data?.detail || e.response?.data?.error || 'Failed to update request status' });
        } finally {
            setBusy(false);
        }
    };

    // All voters (feedbacks) for evaluator review
    const voters = useMemo(() => {
        let list = [];
        if (req.feedbacks && req.feedbacks.length > 0) {
            list = req.feedbacks.map((fb) => ({
                id: fb.id,
                name: fb.responder_name || 'Receiver',
                date: fb.created_at,
                decision: fb.decision,
                positive: fb.positive_feedback || '',
                negative: fb.negative_feedback || '',
                remarks: fb.decision_notes || '',
                document: fb.supporting_document || null,
            }));
        }
        return list;
    }, [req.feedbacks]);

    const voteStats = useMemo(() => {
        const stats = { total: voters.length, yes: 0, no: 0, neutral: 0 };
        voters.forEach((v) => {
            const dec = (v.decision || '').toUpperCase();
            if (dec === 'YES') stats.yes += 1;
            else if (dec === 'NO') stats.no += 1;
            else if (dec === 'NEUTRAL') stats.neutral += 1;
        });
        return stats;
    }, [voters]);

    // Calculate responder decision majority matching RepairRequestReviewList logic
    const responderDecision = useMemo(() => {
        let yes = voteStats.yes;
        let no = voteStats.no;
        let neutral = voteStats.neutral;
        if (yes === 0 && no === 0 && neutral === 0 && req.votes) {
            yes = req.votes.yes || 0;
            no = req.votes.no || 0;
            neutral = req.votes.neutral || 0;
        }
        if (yes === 0 && no === 0 && neutral === 0) return 'NONE';
        if (yes >= no && yes >= neutral) return 'YES';
        if (no > yes && no >= neutral) return 'NO';
        return 'NEUTRAL';
    }, [req.votes, voteStats]);

    useEffect(() => {
        if (!evalLocked) {
            if (responderDecision === 'YES' && evalDecision === 'Rejected') {
                setEvalDecision('');
            } else if (responderDecision === 'NO' && evalDecision === 'Approved') {
                setEvalDecision('');
            }
        }
    }, [responderDecision, evalLocked, evalDecision]);

    const toggleVoter = (id) => {
        setExpandedVoters((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const allExpanded = voters.length > 0 && voters.every((v) => expandedVoters[v.id]);

    const toggleAllVoters = () => {
        const nextState = !allExpanded;
        const updated = {};
        voters.forEach((v) => {
            updated[v.id] = nextState;
        });
        setExpandedVoters(updated);
    };

    return (
        <>
            <Modal.Body className="p-4">
                <div className="d-flex justify-content-between align-items-start mb-3">
                    <div>
                        <div className="text-muted small text-uppercase fw-semibold" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>Part / Machine</div>
                        <h4 className="fw-bold mb-0">{req.part_details || req.part || 'Repair Request'}</h4>
                    </div>
                    <div className="d-flex gap-2">
                        <span className={`badge ${req.priority === 'High' ? 'bg-danger-subtle text-danger' : req.priority === 'Medium' ? 'bg-warning-subtle text-warning' : 'bg-info-subtle text-info'} border`} style={{ fontSize: '11px', padding: '5px 9px' }}>
                            {req.priority || 'Medium'} Priority
                        </span>
                        <span className="badge bg-light text-dark border" style={{ fontSize: '11px', padding: '5px 9px' }}>
                            {STATUS_TO_DECISION[req.status] || req.status || 'Pending'}
                        </span>
                    </div>
                </div>

                <Row className="g-3 mb-3">
                    <Field label="Part / Machine" md={4}>{req.part_details || req.part || '—'}</Field>
                    <Field label="Entry Date (Start Date)" md={4}>{formatDateOnly(req.entry_date)}</Field>
                    <Field label="Due Date (End Date)" md={4}>{formatDateOnly(req.duedate)}</Field>
                    <Field label="Sender / Raised By" md={4}>{req.created_by_name || 'System'}</Field>
                    <Field label="Priority" md={4}>{req.priority || 'Medium'}</Field>
                    <Field label="Current Status" md={4}>{STATUS_TO_DECISION[req.status] || req.status || 'Pending'}</Field>
                </Row>

                {req.notes && (
                    <div className="mb-3">
                        <Label>Notes / Issue Description</Label>
                        <p className="mb-0 bg-light p-3 rounded" style={{ whiteSpace: 'pre-line', fontSize: '13px' }}>{req.notes}</p>
                    </div>
                )}

                {req.remarks && (
                    <div className="mb-3">
                        <Label>Remarks</Label>
                        <p className="mb-0 bg-light p-3 rounded text-muted" style={{ fontSize: '13px' }}>{req.remarks}</p>
                    </div>
                )}

                {req.images?.length > 0 && (
                    <div className="mb-3">
                        <Label>Document Images</Label>
                        <div className="d-flex gap-2 flex-wrap">
                            {req.images.map((img) => (
                                <a key={img.id} href={img.image} target="_blank" rel="noopener noreferrer" className="border rounded p-1" style={{ width: 68, height: 68, display: 'inline-block', overflow: 'hidden' }}>
                                    <img src={img.image} alt="repair" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }} />
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {req.decision_notes && req.status !== 'Pending' && !isEvaluator && (
                    <div className="mb-3 p-3 rounded bg-warning-subtle border border-warning" style={{ fontSize: '13px' }}>
                        <div className="fw-bold text-warning-emphasis mb-1">
                            <i className="fa fa-info-circle me-1"></i> Remark from Decision Maker
                        </div>
                        <div style={{ whiteSpace: 'pre-line' }}>{req.decision_notes}</div>
                    </div>
                )}

                <hr />

                {isEvaluator ? (
                    /* Evaluator Section: All Voters Breakdown + Administrative Final Decision */
                    <div>
                        <div className="mb-4">
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <div className="fw-semibold text-muted small text-uppercase" style={{ letterSpacing: '0.5px' }}>
                                    <i className="fa fa-users text-primary me-1"></i> Receiver Votes & Feedback ({voters.length})
                                </div>
                                {voters.length > 0 && (
                                    <div className="d-flex align-items-center gap-2">
                                        <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: '11px' }}>
                                            {voteStats.yes} Yes
                                        </span>
                                        <span className="badge bg-danger-subtle text-danger border border-danger-subtle" style={{ fontSize: '11px' }}>
                                            {voteStats.no} No
                                        </span>
                                        <span className="badge bg-warning-subtle text-warning border border-warning-subtle" style={{ fontSize: '11px' }}>
                                            {voteStats.neutral} Neutral
                                        </span>
                                        <Button
                                            variant="outline-secondary"
                                            size="sm"
                                            className="py-0 px-2 d-inline-flex align-items-center gap-1"
                                            style={{ fontSize: '11px', height: '24px' }}
                                            onClick={toggleAllVoters}
                                        >
                                            {allExpanded ? (
                                                <>
                                                    <ChevronUp size={12} /> Collapse All
                                                </>
                                            ) : (
                                                <>
                                                    <ChevronDown size={12} /> Expand All
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {voters.length === 0 ? (
                                <div className="text-center py-4 text-muted border rounded mb-3 bg-light" style={{ fontSize: '13px' }}>
                                    No receiver has submitted feedback for this request yet.
                                </div>
                            ) : (
                                <div className="d-flex flex-column gap-2 mb-3">
                                    {voters.map((v) => {
                                        const isOpen = !!expandedVoters[v.id];
                                        const dec = (v.decision || '').toUpperCase();
                                        const isYes = dec === 'YES';
                                        const isNo = dec === 'NO';
                                        const badgeBg = isYes ? 'rgba(34, 197, 94, 0.12)' : isNo ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)';
                                        const badgeColor = isYes ? '#16a34a' : isNo ? '#dc2626' : '#d97706';

                                        return (
                                            <div
                                                key={v.id}
                                                className="border rounded bg-white shadow-sm overflow-hidden"
                                                style={{ transition: 'all 0.2s ease' }}
                                            >
                                                <div
                                                    className="p-3 d-flex align-items-center justify-content-between"
                                                    style={{
                                                        cursor: 'pointer',
                                                        backgroundColor: isOpen ? '#f8fafc' : '#ffffff',
                                                        borderBottom: isOpen ? '1px solid #e2e8f0' : 'none'
                                                    }}
                                                    onClick={() => toggleVoter(v.id)}
                                                >
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div
                                                            className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold"
                                                            style={{
                                                                width: '32px',
                                                                height: '32px',
                                                                backgroundColor: '#6366f1',
                                                                fontSize: '12px'
                                                            }}
                                                        >
                                                            {(v.name || 'U')[0].toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
                                                                {v.name}
                                                            </div>
                                                            {v.date && (
                                                                <div className="text-muted" style={{ fontSize: '11px' }}>
                                                                    {formatDateOnly(v.date)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span
                                                            className="badge fw-semibold"
                                                            style={{
                                                                fontSize: '11px',
                                                                padding: '5px 10px',
                                                                backgroundColor: badgeBg,
                                                                color: badgeColor
                                                            }}
                                                        >
                                                            {v.decision || 'VOTED'}
                                                        </span>
                                                        <span className="text-muted">
                                                            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                        </span>
                                                    </div>
                                                </div>

                                                {isOpen && (
                                                    <div className="p-3 bg-white" style={{ fontSize: '13px' }}>
                                                        <Row className="g-2 mb-2">
                                                            <Col md={6}>
                                                                <div className="p-2 rounded bg-success-subtle border border-success-subtle">
                                                                    <div className="fw-semibold text-success small mb-1">
                                                                        <i className="fa fa-thumbs-up me-1"></i> Positive Feedback
                                                                    </div>
                                                                    <div className="text-dark small" style={{ whiteSpace: 'pre-wrap' }}>
                                                                        {v.positive || <span className="text-muted fst-italic">None</span>}
                                                                    </div>
                                                                </div>
                                                            </Col>
                                                            <Col md={6}>
                                                                <div className="p-2 rounded bg-danger-subtle border border-danger-subtle">
                                                                    <div className="fw-semibold text-danger small mb-1">
                                                                        <i className="fa fa-thumbs-down me-1"></i> Negative Feedback
                                                                    </div>
                                                                    <div className="text-dark small" style={{ whiteSpace: 'pre-wrap' }}>
                                                                        {v.negative || <span className="text-muted fst-italic">None</span>}
                                                                    </div>
                                                                </div>
                                                            </Col>
                                                        </Row>

                                                        {v.remarks && (
                                                            <div className="p-2 rounded bg-light border mb-2 small">
                                                                <strong className="text-muted d-block mb-1">Decision Notes:</strong>
                                                                <div style={{ whiteSpace: 'pre-wrap' }}>{v.remarks}</div>
                                                            </div>
                                                        )}

                                                        {v.document && (
                                                            <div className="mt-2 pt-2 border-top">
                                                                <a
                                                                    href={v.document}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1"
                                                                    style={{ fontSize: '12px' }}
                                                                >
                                                                    <i className="fa fa-paperclip"></i> View Supporting Document
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {evalLocked && (
                            <Alert variant="secondary" className="py-2 small mb-3">
                                Final decision already submitted: <strong>{STATUS_TO_DECISION[req.status] || req.status}</strong> {req.decision_notes ? `— ${req.decision_notes}` : ''}
                            </Alert>
                        )}

                        <div className="fw-semibold text-muted small text-uppercase mb-2" style={{ letterSpacing: '0.5px' }}>
                            <i className="fa fa-gavel text-primary me-1"></i> Administrative Final Decision
                        </div>

                        <Form.Group className="mb-3">
                            <Label>Administrative Decision</Label>
                            <Form.Select
                                id="equipment-eval-decision-select"
                                value={evalDecision}
                                disabled={evalLocked || busy}
                                onChange={(e) => setEvalDecision(e.target.value)}
                                className="mt-1"
                                style={{
                                    border: evalLocked ? '1px solid #cbd5e1' : '1.5px solid #10b981',
                                    borderRadius: '12px',
                                    padding: '10px 16px',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    color: '#1e293b',
                                    backgroundColor: evalLocked ? '#f8fafc' : '#ffffff',
                                    boxShadow: 'none',
                                    cursor: evalLocked ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {!evalDecision && (
                                    <option value="" disabled hidden>Select Decision</option>
                                )}
                                {(responderDecision !== 'NO' || (evalLocked && evalDecision === 'Approved')) && (
                                    <option value="Approved">Approved</option>
                                )}
                                {(responderDecision !== 'YES' || (evalLocked && evalDecision === 'Rejected')) && (
                                    <option value="Rejected">Rejected</option>
                                )}
                                <option value="On Hold">On Hold</option>
                            </Form.Select>
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Label>Administrative Remarks</Label>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                value={evalRemarks}
                                disabled={evalLocked || busy}
                                onChange={(e) => setEvalRemarks(e.target.value)}
                                placeholder="Enter administrative remarks or notes..."
                                style={{ textTransform: 'none' }}
                            />
                        </Form.Group>
                    </div>
                ) : (
                    /* Primary Responder Section: Submit Initial Vote & Feedback */
                    <div>
                        {respLocked && (
                            <Alert variant="secondary" className="py-2 small">
                                This request is closed for voting or final decision has been made.
                            </Alert>
                        )}

                        <div className="fw-semibold text-muted small text-uppercase mb-3" style={{ letterSpacing: '0.5px' }}>
                            <i className="fa fa-comment-dots text-success me-1"></i> Comment Action
                        </div>

                        <Form.Group className="mb-3">
                            <Label>Comment name</Label>
                            <Form.Control
                                type="text"
                                disabled
                                readOnly
                                value={commentName}
                                style={{ background: '#f8fafc', fontWeight: 500, color: '#334155' }}
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Label>Positive Feedback</Label>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                value={values.positive}
                                disabled={respLocked || busy}
                                onChange={(e) => setValues({ ...values, positive: e.target.value })}
                                placeholder="Enter positive feedback..."
                                style={{ textTransform: 'none' }}
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Label>Negative Feedback</Label>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                value={values.negative}
                                disabled={respLocked || busy}
                                onChange={(e) => setValues({ ...values, negative: e.target.value })}
                                placeholder="Enter negative feedback..."
                                style={{ textTransform: 'none' }}
                            />
                        </Form.Group>

                        <Row className="g-3 mb-3">
                            <Col md={6}>
                                <Label>Decision</Label>
                                <div className="d-flex gap-4 mt-2">
                                    {['YES', 'NO', 'NEUTRAL'].map((o) => (
                                        <Form.Check
                                            key={o}
                                            type="radio"
                                            id={`equipment-decision-${o}`}
                                            name="equipment-vote-decision"
                                            label={o}
                                            checked={values.decision === o}
                                            disabled={respLocked || busy}
                                            onChange={() => setValues({ ...values, decision: o })}
                                            style={{ fontWeight: 600, color: o === 'YES' ? '#198754' : o === 'NO' ? '#dc3545' : '#6c757d' }}
                                        />
                                    ))}
                                </div>
                            </Col>
                            <Col md={6}>
                                <Label>Supporting Document</Label>
                                <Form.Control
                                    type="file"
                                    disabled={respLocked || busy}
                                    onChange={(e) => setFile(e.target.files[0] || null)}
                                />
                                {req.supporting_document && (
                                    <div className="mt-1">
                                        <a href={req.supporting_document} target="_blank" rel="noopener noreferrer" className="small text-primary">
                                            <i className="fa fa-download me-1"></i> Current document
                                        </a>
                                    </div>
                                )}
                            </Col>
                        </Row>

                        <Form.Group>
                            <Label>Decision Notes</Label>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                value={values.notes}
                                disabled={respLocked || busy}
                                onChange={(e) => setValues({ ...values, notes: e.target.value })}
                                placeholder="Enter reason or notes for decision..."
                                style={{ textTransform: 'none' }}
                            />
                        </Form.Group>
                    </div>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
                {isEvaluator ? (
                    !evalLocked && (
                        <Button size="sm" variant="primary" disabled={busy} onClick={submitEvaluator}>
                            {busy ? 'Submitting…' : 'Submit Final Evaluation'}
                        </Button>
                    )
                ) : (
                    !respLocked && (
                        <Button size="sm" disabled={busy} onClick={submitResponder}>
                            {busy ? 'Submitting…' : 'Submit Decision'}
                        </Button>
                    )
                )}
            </Modal.Footer>
        </>
    );
};

const FeedbackPanel = ({ item, onClose, onSaved }) => {
    const [c, setC] = useState(item.raw);
    const isEvaluator = item.role === 'evaluator';
    const mine = item.myAction;
    
    // Responder state (First Approval)
    const respLocked = complaintBlocked(c);
    const [values, setValues] = useState({
        positive: mine?.positive_feedback || '',
        negative: mine?.negative_feedback || '',
        decision: mine ? ({ YES: 'Yes', NO: 'No', NEUTRAL: 'Neutral' }[mine.decision] || 'Neutral') : '',
        remarks: mine?.notes || '',
    });
    const [file, setFile] = useState(null);

    // Evaluator state (Final Decision)
    const evalLocked = c.status === 'Closed' || c.admin_decision === 'Approved' || c.admin_decision === 'Rejected';
    const [evalDecision, setEvalDecision] = useState(c.admin_decision && c.admin_decision !== 'Pending' ? c.admin_decision : '');
    const [evalRemarks, setEvalRemarks] = useState(c.admin_remarks || '');

    // Cutoff date extension for final evaluators
    const getCutoffYMD = (val) => (val ? String(val).split('T')[0] : '');
    const [cutoffDate, setCutoffDate] = useState(getCutoffYMD(c.cutoff_date));
    const [savingCutoff, setSavingCutoff] = useState(false);

    useEffect(() => {
        if (c.cutoff_date) {
            setCutoffDate(getCutoffYMD(c.cutoff_date));
        }
    }, [c.cutoff_date]);

    const handleCutoffDateUpdate = async (newDate) => {
        if (!newDate || newDate === getCutoffYMD(c.cutoff_date)) {
            return;
        }
        setCutoffDate(newDate);
        setSavingCutoff(true);
        try {
            await ComplaintService.updateComplaint(c.id, { cutoff_date: newDate }, { is_review: 'true' });
            setC((prev) => ({ ...prev, cutoff_date: newDate }));
            Swal.fire({
                title: 'Updated!',
                text: `Cutoff date for CMP-${c.id} updated successfully.`,
                icon: 'success',
                confirmButtonColor: '#0a500f',
                timer: 1500,
                showConfirmButton: false,
            });
        } catch (err) {
            Swal.fire('Error', err.response?.data?.detail || 'Failed to update cutoff date', 'error');
            setCutoffDate(getCutoffYMD(c.cutoff_date));
        } finally {
            setSavingCutoff(false);
        }
    };

    // Collapsible voters state for final evaluator
    const [expandedVoters, setExpandedVoters] = useState({});

    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (item.raw?.id && isEvaluator) {
            let active = true;
            ComplaintService.getComplaint(item.raw.id, { is_review: 'true' })
                .then((res) => {
                    if (active && res?.data) {
                        setC(res.data);
                    }
                })
                .catch((err) => console.error("Error refreshing complaint details", err));
            return () => { active = false; };
        }
    }, [item.raw?.id, isEvaluator]);

    useEffect(() => {
        if (c.admin_decision && c.admin_decision !== 'Pending') {
            setEvalDecision(c.admin_decision);
        } else {
            setEvalDecision('');
        }
        if (c.admin_remarks) {
            setEvalRemarks(c.admin_remarks);
        }
    }, [c.admin_decision, c.admin_remarks]);

    const submitResponder = async () => {
        if (!values.decision) {
            Swal.fire('Select a decision', 'Choose Yes, No or Neutral before submitting.', 'warning');
            return;
        }
        setBusy(true);
        try {
            const fd = new FormData();
            fd.append('positive_feedback', values.positive);
            fd.append('negative_feedback', values.negative);
            fd.append('decision_type', values.decision);
            fd.append('responder_remarks', values.remarks);
            if (file) fd.append('responder_attachment', file);
            await ComplaintService.submitDecision(c.id, fd);
            await Swal.fire({ title: 'Success!', text: 'Decision submitted successfully!', icon: 'success', timer: 1800, showConfirmButton: false });
            onSaved();
        } catch (e) {
            Swal.fire('Error', e.response?.data?.detail || 'Error submitting decision', 'error');
        } finally {
            setBusy(false);
        }
    };

    const submitEvaluator = async () => {
        if (!evalDecision) {
            Swal.fire('Select a decision', 'Choose Pending, Approved, Rejected, or On Hold before submitting.', 'warning');
            return;
        }
        setBusy(true);
        try {
            await ComplaintService.setAdminDecision(c.id, evalDecision, evalRemarks, { is_review: 'true' });
            await Swal.fire({ title: 'Success!', text: `Ticket CMP-${c.id} marked as ${evalDecision}`, icon: 'success', timer: 1800, showConfirmButton: false });
            onSaved();
        } catch (e) {
            Swal.fire('Error', e.response?.data?.detail || 'Error submitting final decision', 'error');
        } finally {
            setBusy(false);
        }
    };

    const raisedByName = c.user_details ? `${c.user_details.first_name || ''} ${c.user_details.last_name || ''}`.trim() || c.user_details.email : item.from;
    const assignedToName = c.assigned_to_details ? `${c.assigned_to_details.first_name || ''} ${c.assigned_to_details.last_name || ''}`.trim() || c.assigned_to_details.email : '—';

    // All voters for evaluator review
    const voters = useMemo(() => {
        let list = [];
        if (c.actions && c.actions.length > 0) {
            // Keep unique latest action per responder
            const latestActionMap = new Map();
            c.actions.forEach((action) => {
                const userId = action.created_by || action.created_by_details?.id || action.created_by_details?.email || action.comment_name || action.id;
                latestActionMap.set(userId, action);
            });
            list = Array.from(latestActionMap.values());
            list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        }

        // If no actions recorded in actions array, check complaint-level decision
        if (list.length === 0 && (c.decision_type || c.responder_remarks || c.positive_feedback || c.negative_feedback)) {
            list.push({
                id: 'complaint-default',
                created_by_details: c.assigned_to_details || null,
                comment_name: c.assigned_to_details
                    ? `${c.assigned_to_details.first_name || ''} ${c.assigned_to_details.last_name || ''}`.trim() || c.assigned_to_details.email
                    : (assignedToName !== '—' ? assignedToName : 'Primary Responder'),
                decision: c.decision_type ? c.decision_type.toUpperCase() : 'PENDING',
                positive_feedback: c.positive_feedback,
                negative_feedback: c.negative_feedback,
                notes: c.responder_remarks,
                supporting_document: c.responder_attachment,
                created_at: c.updated_at || c.created_at,
            });
        }
        return list;
    }, [c.actions, c.decision_type, c.responder_remarks, c.positive_feedback, c.negative_feedback, c.assigned_to_details, c.updated_at, c.created_at, assignedToName]);

    const yesCount = voters.filter((v) => (v.decision || '').toUpperCase() === 'YES').length;
    const noCount = voters.filter((v) => (v.decision || '').toUpperCase() === 'NO').length;
    const neutralCount = voters.filter((v) => {
        const d = (v.decision || '').toUpperCase();
        return d === 'NEUTRAL' || (d !== 'YES' && d !== 'NO');
    }).length;

    // Calculate responder decision majority for feedback review
    const responderDecision = useMemo(() => {
        if (yesCount === 0 && noCount === 0 && neutralCount === 0) return 'NONE';
        if (yesCount >= noCount && yesCount >= neutralCount) return 'YES';
        if (noCount > yesCount && noCount >= neutralCount) return 'NO';
        return 'NEUTRAL';
    }, [yesCount, noCount, neutralCount]);

    const toggleVoter = (idx) => {
        setExpandedVoters(prev => ({
            ...prev,
            [idx]: !prev[idx]
        }));
    };

    const toggleAllVoters = (expand) => {
        const next = {};
        voters.forEach((_, idx) => {
            next[idx] = expand;
        });
        setExpandedVoters(next);
    };

    const allExpanded = voters.length > 0 && voters.every((_, idx) => !!expandedVoters[idx]);

    return (
        <>
            <Modal.Body className="p-4">
                <div className="d-flex justify-content-between align-items-start mb-3">
                    <div>
                        <h4 className="fw-bold mb-1">{c.title || `Complaint CMP-${c.id}`}</h4>
                        <div className="text-muted small">Reference: CMP-{c.id}</div>
                    </div>
                    <div className="d-flex gap-2 align-items-center">
                        {isEvaluator ? (
                            <span className="badge border" style={{ fontSize: '11px', padding: '5px 9px', color: '#6f42c1', borderColor: '#d3c3eb', background: '#f3e8ff' }}>
                                <i className="fa fa-gavel me-1"></i> Final Evaluator
                            </span>
                        ) : (
                            <span className="badge border" style={{ fontSize: '11px', padding: '5px 9px', color: '#0dcaf0', borderColor: '#b6effb', background: '#e0f7fa' }}>
                                <i className="fa fa-user me-1"></i> Primary Responder
                            </span>
                        )}
                        {c.priority && (
                            <span className="badge bg-light text-dark border" style={{ fontSize: '11px', padding: '5px 9px' }}>
                                {c.priority} Priority
                            </span>
                        )}
                        <span className="badge bg-light text-primary border" style={{ fontSize: '11px', padding: '5px 9px' }}>
                            {c.status || 'Open'}
                        </span>
                    </div>
                </div>

                <Row className="g-3 mb-3">
                    <Field label="Date Filed (Start Date)" md={4}>{formatDateOnly(c.created_at)}</Field>
                    <Field label="Cutoff Date (End Date)" md={4}>
                        {isEvaluator && !evalLocked ? (
                            <div className="d-flex align-items-center gap-2 mt-1">
                                <Form.Control
                                    type="date"
                                    size="sm"
                                    value={cutoffDate || ''}
                                    min={new Date().toISOString().split('T')[0]}
                                    disabled={savingCutoff}
                                    onChange={(e) => handleCutoffDateUpdate(e.target.value)}
                                    title="Extend or update cutoff date"
                                    style={{
                                        fontSize: '13px',
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        border: '1.5px solid #cbd5e1',
                                        maxWidth: '165px',
                                        backgroundColor: savingCutoff ? '#f1f5f9' : '#ffffff',
                                        fontWeight: '600',
                                        color: '#1e293b'
                                    }}
                                />
                                {savingCutoff && <span className="spinner-border spinner-border-sm text-primary" />}
                            </div>
                        ) : (
                            formatDateOnly(c.cutoff_date)
                        )}
                    </Field>
                    <Field label="Category" md={4}>{c.category_name || '—'}</Field>
                    {c.pattern_name && <Field label="Pattern" md={4}>{c.pattern_name}</Field>}
                    <Field label="Raised By" md={4}>{raisedByName || '—'}</Field>
                    <Field label="Final Evaluator" md={4}>{c.evaluator_name || '—'}</Field>
                </Row>

                {c.description && (
                    <div className="mb-3">
                        <Label>Problem Description</Label>
                        <p className="mb-0 bg-light p-3 rounded" style={{ whiteSpace: 'pre-line', fontSize: '13px' }}>{c.description}</p>
                    </div>
                )}

                {c.attachment && (
                    <div className="mb-3">
                        <Label>Attached Evidence</Label>
                        <div>
                            <a href={c.attachment} target="_blank" rel="noopener noreferrer" className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1">
                                <i className="fa fa-paperclip"></i> View Attached Evidence
                            </a>
                        </div>
                    </div>
                )}

                <hr />

                {isEvaluator ? (
                    /* Final Evaluator Section: Review All Voters Details + Submit Administrative Decision */
                    <div>
                        {/* All Voters Voting Details */}
                        <div className="mb-4">
                            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                                <div>
                                    <span className="fw-bold text-dark text-uppercase small" style={{ letterSpacing: '0.5px' }}>
                                        <i className="fa fa-users text-primary me-1"></i> All Voters Voting Details ({voters.length})
                                    </span>
                                </div>
                                {voters.length > 0 && (
                                    <div className="d-flex gap-2 align-items-center flex-wrap">
                                        <span className="badge" style={{ backgroundColor: 'rgba(25, 135, 84, 0.12)', color: '#198754', border: '1px solid rgba(25, 135, 84, 0.25)', fontSize: '11px', fontWeight: 600 }}>
                                            <i className="fa fa-check me-1"></i> YES: {yesCount}
                                        </span>
                                        <span className="badge" style={{ backgroundColor: 'rgba(220, 53, 69, 0.12)', color: '#dc3545', border: '1px solid rgba(220, 53, 69, 0.25)', fontSize: '11px', fontWeight: 600 }}>
                                            <i className="fa fa-times me-1"></i> NO: {noCount}
                                        </span>
                                        <span className="badge" style={{ backgroundColor: 'rgba(13, 202, 240, 0.12)', color: '#0aa2c0', border: '1px solid rgba(13, 202, 240, 0.25)', fontSize: '11px', fontWeight: 600 }}>
                                            NEUTRAL: {neutralCount}
                                        </span>
                                        <button
                                            type="button"
                                            className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1 ms-1"
                                            style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px' }}
                                            onClick={() => toggleAllVoters(!allExpanded)}
                                            title={allExpanded ? "Collapse all voter cards" : "Expand all voter cards"}
                                        >
                                            {allExpanded ? (
                                                <><ChevronUp size={12} /> Collapse All</>
                                            ) : (
                                                <><ChevronDown size={12} /> Expand All</>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {voters.length === 0 ? (
                                <div className="p-3 rounded border bg-light text-center text-muted small">
                                    <i className="fa fa-info-circle me-1"></i> No voters have submitted decisions yet.
                                </div>
                            ) : (
                                <div className="d-flex flex-column gap-2">
                                    {voters.map((voter, idx) => {
                                        const voterName = voter.created_by_details
                                            ? `${voter.created_by_details.first_name || ''} ${voter.created_by_details.last_name || ''}`.trim() || voter.created_by_details.email
                                            : (voter.comment_name || `Voter #${idx + 1}`);
                                        const voterEmail = voter.created_by_details?.email;
                                        const dec = (voter.decision || 'PENDING').toUpperCase();
                                        const isYes = dec === 'YES';
                                        const isNo = dec === 'NO';
                                        const isOpen = !!expandedVoters[idx];

                                        return (
                                            <div
                                                key={voter.id || idx}
                                                className="rounded border"
                                                style={{
                                                    fontSize: '13px',
                                                    background: '#ffffff',
                                                    boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                                                    borderLeft: `4px solid ${isYes ? '#198754' : isNo ? '#dc3545' : '#0dcaf0'}`,
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                {/* Clickable Voter Header */}
                                                <div
                                                    className="d-flex justify-content-between align-items-center flex-wrap gap-2 p-3"
                                                    style={{ cursor: 'pointer', userSelect: 'none' }}
                                                    onClick={() => toggleVoter(idx)}
                                                    title={isOpen ? "Click to collapse details" : "Click to view voting details"}
                                                >
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span
                                                            className="my-votes-user-avatar"
                                                            style={{
                                                                width: '32px',
                                                                height: '32px',
                                                                fontSize: '12px',
                                                                backgroundColor: isYes ? '#d1e7dd' : isNo ? '#f8d7da' : '#cff4fc',
                                                                color: isYes ? '#0f5132' : isNo ? '#842029' : '#055160'
                                                            }}
                                                        >
                                                            {getInitials(voterName)}
                                                        </span>
                                                        <div>
                                                            <div className="d-flex align-items-center gap-2">
                                                                <span className="fw-bold text-dark">{voterName}</span>
                                                                {voterEmail && voterEmail !== voterName && (
                                                                    <span className="text-muted small">({voterEmail})</span>
                                                                )}
                                                            </div>
                                                            {voter.created_at && (
                                                                <div className="text-muted" style={{ fontSize: '11.5px' }}>
                                                                    <Clock size={11} className="me-1" />
                                                                    Voted on: {formatDateTime(voter.created_at)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span
                                                            className={`badge ${isYes ? 'bg-success' : isNo ? 'bg-danger' : 'bg-info text-dark'}`}
                                                            style={{ fontSize: '11px', padding: '5px 11px' }}
                                                        >
                                                            {isYes ? (
                                                                <><CheckCircle2 size={12} className="me-1" /> Voted: YES</>
                                                            ) : isNo ? (
                                                                <><XCircle size={12} className="me-1" /> Voted: NO</>
                                                            ) : (
                                                                `Voted: ${dec}`
                                                            )}
                                                        </span>
                                                        <span
                                                            className="text-muted d-inline-flex align-items-center justify-content-center"
                                                            style={{ width: '22px', height: '22px' }}
                                                        >
                                                            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Collapsible Details */}
                                                {isOpen && (
                                                    <div className="px-3 pb-3 pt-2 border-top bg-light-subtle">
                                                        {/* Positive & Negative Feedback */}
                                                        {(voter.positive_feedback || voter.negative_feedback) && (
                                                            <div className="row g-2 mb-2">
                                                                <div className="col-md-6">
                                                                    <div className="p-2 rounded h-100" style={{ backgroundColor: 'rgba(25, 135, 84, 0.08)', border: '1px solid rgba(25, 135, 84, 0.2)' }}>
                                                                        <div className="fw-bold text-success mb-1" style={{ fontSize: '11px', textTransform: 'uppercase' }}>
                                                                            <i className="fa fa-thumbs-up me-1"></i> Positive Analysis
                                                                        </div>
                                                                        <div className="text-dark" style={{ whiteSpace: 'pre-line', fontSize: '12.5px' }}>
                                                                            {voter.positive_feedback || <span className="text-muted fst-italic">None</span>}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="col-md-6">
                                                                    <div className="p-2 rounded h-100" style={{ backgroundColor: 'rgba(220, 53, 69, 0.08)', border: '1px solid rgba(220, 53, 69, 0.2)' }}>
                                                                        <div className="fw-bold text-danger mb-1" style={{ fontSize: '11px', textTransform: 'uppercase' }}>
                                                                            <i className="fa fa-thumbs-down me-1"></i> Critical Issues / Negative Analysis
                                                                        </div>
                                                                        <div className="text-dark" style={{ whiteSpace: 'pre-line', fontSize: '12.5px' }}>
                                                                            {voter.negative_feedback || <span className="text-muted fst-italic">None</span>}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Remarks */}
                                                        {voter.notes && (
                                                            <div className="mb-2">
                                                                <strong className="text-muted small d-block mb-1">Remarks / Notes:</strong>
                                                                <div className="bg-white p-2 rounded border text-dark" style={{ whiteSpace: 'pre-line', fontSize: '12.5px' }}>
                                                                    {voter.notes}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Attached Supporting Document */}
                                                        {voter.supporting_document && (
                                                            <div className="mt-2">
                                                                <a
                                                                    href={voter.supporting_document}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1"
                                                                    style={{ fontSize: '12px' }}
                                                                >
                                                                    <i className="fa fa-paperclip"></i> View Resolution Document
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {evalLocked && (
                            <Alert variant="secondary" className="py-2 small mb-3">
                                Final decision already submitted: <strong>{c.admin_decision}</strong> {c.admin_remarks ? `— ${c.admin_remarks}` : ''}
                            </Alert>
                        )}

                        <div className="fw-semibold text-muted small text-uppercase mb-2" style={{ letterSpacing: '0.5px' }}>
                            <i className="fa fa-gavel text-primary me-1"></i> Administrative Final Decision
                        </div>

                        <Form.Group className="mb-3">
                            <Label>Administrative Decision</Label>
                            <Form.Select
                                id="eval-decision-select"
                                value={evalDecision}
                                disabled={evalLocked || busy}
                                onChange={(e) => setEvalDecision(e.target.value)}
                                className="mt-1"
                                style={{
                                    border: evalLocked ? '1px solid #cbd5e1' : '1.5px solid #10b981',
                                    borderRadius: '12px',
                                    padding: '10px 16px',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    color: '#1e293b',
                                    backgroundColor: evalLocked ? '#f8fafc' : '#ffffff',
                                    boxShadow: 'none',
                                    cursor: evalLocked ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {!evalDecision && (
                                    <option value="" disabled hidden>Select Decision</option>
                                )}
                                <option value="Pending">Pending</option>
                                <option value="Approved">Approved</option>
                                <option value="Rejected">Rejected</option>
                                <option value="On Hold">On Hold</option>
                            </Form.Select>
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Label>Administrative Remarks</Label>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                value={evalRemarks}
                                disabled={evalLocked || busy}
                                onChange={(e) => setEvalRemarks(e.target.value)}
                                placeholder="Enter administrative remarks or notes..."
                                style={{ textTransform: 'none' }}
                            />
                        </Form.Group>
                    </div>
                ) : (
                    /* Primary Responder Section: Submit Initial Vote & Analysis */
                    <div>
                        {respLocked && (
                            <Alert variant="secondary" className="py-2 small">
                                This complaint is closed, finalised, or past its cutoff date.
                            </Alert>
                        )}

                        <Form.Group className="mb-3">
                            <Label>Positive Analysis</Label>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                value={values.positive}
                                disabled={respLocked || busy}
                                onChange={(e) => setValues({ ...values, positive: e.target.value })}
                                placeholder="Detail positive findings..."
                                style={{ textTransform: 'none' }}
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Label>Negative Analysis</Label>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                value={values.negative}
                                disabled={respLocked || busy}
                                onChange={(e) => setValues({ ...values, negative: e.target.value })}
                                placeholder="Detail negative findings..."
                                style={{ textTransform: 'none' }}
                            />
                        </Form.Group>

                        <Row className="g-3 mb-3">
                            <Col md={6}>
                                <Label>Decision</Label>
                                <div className="d-flex gap-4 mt-2">
                                    {['Yes', 'No', 'Neutral'].map((o) => (
                                        <Form.Check
                                            key={o}
                                            type="radio"
                                            id={`feedback-decision-${o}`}
                                            name="feedback-vote-decision"
                                            label={o}
                                            checked={values.decision === o}
                                            disabled={respLocked || busy}
                                            onChange={() => setValues({ ...values, decision: o })}
                                            style={{ fontWeight: 600, color: o === 'Yes' ? '#198754' : o === 'No' ? '#dc3545' : '#6c757d' }}
                                        />
                                    ))}
                                </div>
                            </Col>
                            <Col md={6}>
                                <Label>Report / Attachment</Label>
                                <Form.Control
                                    type="file"
                                    disabled={respLocked || busy}
                                    onChange={(e) => setFile(e.target.files[0] || null)}
                                />
                            </Col>
                        </Row>

                        <Form.Group>
                            <Label>Remarks</Label>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                value={values.remarks}
                                disabled={respLocked || busy}
                                onChange={(e) => setValues({ ...values, remarks: e.target.value })}
                                placeholder="Any additional remarks..."
                                style={{ textTransform: 'none' }}
                            />
                        </Form.Group>
                    </div>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
                {isEvaluator ? (
                    !evalLocked && (
                        <Button size="sm" variant="primary" disabled={busy} onClick={submitEvaluator}>
                            {busy ? 'Submitting…' : 'Submit Final Evaluation'}
                        </Button>
                    )
                ) : (
                    !respLocked && (
                        <Button size="sm" disabled={busy} onClick={submitResponder}>
                            {busy ? 'Submitting…' : 'Submit Decision'}
                        </Button>
                    )
                )}
            </Modal.Footer>
        </>
    );
};

const AppointmentPanel = ({ item, onClose, onSaved }) => {
    const a = item.raw;
    const [busy, setBusy] = useState(false);

    const act = async (kind) => {
        setBusy(true);
        try {
            if (kind === 'approve') await AppointmentService.approveAppointment(a.id);
            else await AppointmentService.rejectAppointment(a.id);
            await Swal.fire({ icon: 'success', title: kind === 'approve' ? 'Approved' : 'Rejected', timer: 1500, showConfirmButton: false });
            onSaved();
        } catch (e) {
            Swal.fire('Error', e.response?.data?.error || `Failed to ${kind} appointment.`, 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <Modal.Body className="p-4">
                <div className="d-flex justify-content-between align-items-start mb-3">
                    <div>
                        <h4 className="fw-bold mb-1">{a.visitor_name || a.vehicle_number || 'Visitor Appointment'}</h4>
                        {a.company && <div className="text-muted small">{a.company}</div>}
                    </div>
                    <div className="d-flex gap-2">
                        {a.visitor_category_name && (
                            <span className="badge bg-light text-primary border" style={{ fontSize: '11px', padding: '5px 9px' }}>
                                {a.visitor_category_name}
                            </span>
                        )}
                        <span className={`badge ${a.status === 'approved' ? 'bg-success-subtle text-success' : a.status === 'rejected' ? 'bg-danger-subtle text-danger' : 'bg-warning-subtle text-warning'} border text-capitalize`} style={{ fontSize: '11px', padding: '5px 9px' }}>
                            {a.status || 'Pending'}
                        </span>
                    </div>
                </div>

                <Row className="g-3 mb-3">
                    <Field label="Appointment Date (Start Date)" md={4}>{a.formatted_date || formatDateOnly(a.appointment_date)}</Field>
                    <Field label="Appointment Time" md={4}>{a.appointment_time ? String(a.appointment_time).slice(0, 5) : '—'}</Field>
                    {a.expected_exit_time && <Field label="Expected Exit Time" md={4}>{String(a.expected_exit_time).slice(0, 5)}</Field>}
                    <Field label="Visitor Mobile" md={4}>{a.visitor_phone || a.contact_number || '—'}</Field>
                    {a.vehicle_number && <Field label="Vehicle Number" md={4}>{a.vehicle_number}</Field>}
                    <Field label="Department" md={4}>{a.department_name || '—'}</Field>
                    {a.designation_name && <Field label="Designation" md={4}>{a.designation_name}</Field>}
                    {a.concerned_staff_name && <Field label="Concerned Staff" md={4}>{a.concerned_staff_name}</Field>}
                    {a.contact_person_name && <Field label="Contact Person" md={4}>{a.contact_person_name}</Field>}
                    {a.contact_number && <Field label="Contact Number" md={4}>{a.contact_number}</Field>}
                    {a.number_of_persons && <Field label="Number of Persons" md={4}>{a.number_of_persons}</Field>}
                    <Field label="Requested By" md={4}>{a.created_by_name || '—'}</Field>
                    {a.created_at && <Field label="Requested On" md={4}>{formatDateTime(a.created_at)}</Field>}
                </Row>

                {a.purpose_of_visit && (
                    <div className="mb-3">
                        <Label>Purpose of Visit</Label>
                        <p className="mb-0 bg-light p-3 rounded" style={{ whiteSpace: 'pre-line', fontSize: '13px' }}>{a.purpose_of_visit}</p>
                    </div>
                )}
            </Modal.Body>
            <Modal.Footer className="d-flex justify-content-between">
                <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
                {a.status === 'pending' ? (
                    <div className="d-flex gap-2">
                        <Button size="sm" variant="outline-success" disabled={busy} onClick={() => act('approve')}>Approve</Button>
                        <Button size="sm" variant="outline-danger" disabled={busy} onClick={() => act('reject')}>Reject</Button>
                    </div>
                ) : <Badge color={DECISION_COLORS[item.decision.tone]}>{item.decision.text}</Badge>}
            </Modal.Footer>
        </>
    );
};

const PANELS = { task: TaskPanel, equipment: EquipmentPanel, feedback: FeedbackPanel, appointment: AppointmentPanel };

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 15;

const MyVotesPage = () => {
    usePageTitle('My Approvals');

    const reduxUser = useSelector((state) => state.auth?.auth?.user);
    const me = useMemo(() => {
        if (reduxUser) return reduxUser;
        try { return JSON.parse(localStorage.getItem('userDetails'))?.user || null; } catch { return null; }
    }, [reduxUser]);

    const [items, setItems] = useState([]);
    const [failed, setFailed] = useState([]);
    const [loading, setLoading] = useState(true);
    const [moduleFilter, setModuleFilter] = useState('all');
    const [tab, setTab] = useState('pending');
    const [visible, setVisible] = useState(PAGE_SIZE);
    const [selected, setSelected] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        const myId = me?.id;
        const bad = [];
        const safe = (name, p) => p.catch(() => { bad.push(name); return null; });

        const [tasks, repairs, reviewRepairs, complaints, reviewComplaints, apPending, apApproved, apRejected] = await Promise.all([
            safe('Task', getMyPendingVotes()),
            safe('Equipment', getReceivedRepairRequests()),
            safe('EquipmentReview', getRepairRequests()),
            safe('Feedback', ComplaintService.getComplaints()),
            safe('FeedbackReview', ComplaintService.getComplaints({ is_review: 'true' })),
            safe('Appointment', AppointmentService.getMyPendingApprovals({ date: 'all' })),
            safe('Appointment', AppointmentService.getMyApprovedRequests({ date: 'all' })),
            safe('Appointment', AppointmentService.getMyRejectedRequests({ date: 'all' })),
        ]);

        const isAdmin = Boolean(me?.is_superuser);
        const all = [
            ...asList(tasks).map(fromTask),
            // Equipment - Responder: receivers voting on newly received repair requests
            ...asList(repairs).map((r) => fromEquipment(r, myId, 'responder')).filter((i) => i.done || !equipmentInactive(i.raw)),
            // Equipment - Evaluator: decision makers reviewing after receivers vote
            ...asList(reviewRepairs)
                .filter((r) => r.is_defined && (isAdmin || r.decision_maker_id === myId) && ((r.feedbacks && r.feedbacks.length > 0) || r.status !== 'Pending'))
                .map((r) => fromEquipment(r, myId, 'evaluator')),
            // Feedback - Responder: primary handlers voting on newly routed complaints
            ...asList(complaints?.data).filter((c) => c.can_respond && c.user !== myId)
                .map((c) => fromComplaint(c, myId, 'responder')).filter((i) => i.done || !complaintBlocked(i.raw)),
            // Feedback - Evaluator: predefined evaluators reviewing after complaint vote is done in a person
            ...asList(reviewComplaints?.data).filter((c) => c.is_evaluator && ((c.actions && c.actions.length > 0) || c.decision_type))
                .map((c) => fromComplaint(c, myId, 'evaluator')).filter((i) => i.done || !complaintBlocked(i.raw)),
            ...asList(apPending).map(fromAppointment),
            ...asList(apApproved).map(fromAppointment),
            ...asList(apRejected).map(fromAppointment),
        ];

        setItems(all);
        setFailed([...new Set(bad)]);
        setLoading(false);
    }, [me]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { setVisible(PAGE_SIZE); }, [moduleFilter, tab]);

    const inTab = useMemo(() => items.filter((i) => (tab === 'pending' ? !i.done : i.done)), [items, tab]);
    const counts = useMemo(() => {
        const c = { all: inTab.length, task: 0, equipment: 0, feedback: 0, appointment: 0 };
        inTab.forEach((i) => { if (c[i.module] !== undefined) c[i.module] += 1; });
        return c;
    }, [inTab]);
    const pendingTotal = useMemo(() => items.filter((i) => !i.done).length, [items]);
    const decidedTotal = useMemo(() => items.filter((i) => i.done).length, [items]);

    const rows = useMemo(() => {
        const list = inTab.filter((i) => moduleFilter === 'all' || i.module === moduleFilter);
        return [...list].sort((a, b) => {
            const aNotVoted = a.decision?.tone === 'pending' || a.decision?.text === 'Not voted yet';
            const bNotVoted = b.decision?.tone === 'pending' || b.decision?.text === 'Not voted yet';
            if (aNotVoted !== bNotVoted) {
                return aNotVoted ? -1 : 1;
            }
            const da = a.deadline ? a.deadline.getTime() : Infinity;
            const db = b.deadline ? b.deadline.getTime() : Infinity;
            return tab === 'pending' ? da - db : db - da;
        });
    }, [inTab, moduleFilter, tab]);

    const closeModal = () => setSelected(null);
    const afterSave = () => { setSelected(null); load(); };
    const Panel = selected ? PANELS[selected.module] : null;

    const getInitials = (str) => {
        if (!str || str === '—' || str === 'System') return '—';
        const parts = str.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    const deadlineCell = (i) => {
        if (!i.deadline) return <span className="text-muted">—</span>;
        const h = hoursLeft(i.deadline);
        const urgent = !i.done && i.module !== 'appointment' && h !== null && h >= 0 && h <= 24;
        return (
            <div>
                <div className={`d-flex align-items-center gap-1.5 ${urgent ? 'text-danger fw-bold' : 'text-dark fw-medium'}`} style={{ fontSize: '13px' }}>
                    <Clock size={13} className={urgent ? 'text-danger' : 'text-muted'} />
                    <span>{i.deadlineHasTime ? formatDateTime(i.deadline) : formatDateOnly(i.deadline)}</span>
                </div>
                {i.module === 'appointment' && (
                    <span className="badge bg-light text-muted border mt-1" style={{ fontSize: '10px' }}>
                        Scheduled Visit
                    </span>
                )}
            </div>
        );
    };

    const renderDecisionBadge = (i) => {
        if (i.decision.tone === 'approved') {
            return (
                <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2.5 py-1 fw-semibold d-inline-flex align-items-center gap-1">
                    <CheckCircle2 size={12} strokeWidth={2.2} />
                    <span>{i.decision.text}</span>
                </span>
            );
        }
        if (i.decision.tone === 'rejected') {
            return (
                <span className="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill px-2.5 py-1 fw-semibold d-inline-flex align-items-center gap-1">
                    <XCircle size={12} strokeWidth={2.2} />
                    <span>{i.decision.text}</span>
                </span>
            );
        }
        return (
            <span className="badge bg-warning-subtle text-warning border border-warning-subtle rounded-pill px-2.5 py-1 fw-semibold d-inline-flex align-items-center gap-1">
                <Clock size={12} strokeWidth={2.2} />
                <span>{i.decision.text}</span>
            </span>
        );
    };

    const chip = (key, label, color, Icon) => {
        const active = moduleFilter === key;
        const count = counts[key] || 0;
        return (
            <button
                key={key}
                type="button"
                className={`my-votes-tab-chip ${active ? 'active' : ''}`}
                onClick={() => setModuleFilter(key)}
                style={{
                    borderColor: active ? color : undefined,
                    background: active
                        ? `linear-gradient(135deg, ${tint(color, 0.16)} 0%, ${tint(color, 0.06)} 100%)`
                        : undefined,
                    color: active ? color : undefined,
                    boxShadow: active ? `0 4px 14px ${tint(color, 0.28)}` : undefined,
                }}
            >
                {Icon && <Icon size={15} style={{ color: active ? color : '#64748b' }} />}
                <span>{label}</span>
                <span
                    className="my-votes-tab-count"
                    style={{
                        background: active
                            ? color
                            : count > 0
                                ? tint(color, 0.16)
                                : '#e2e8f0',
                        color: active
                            ? '#ffffff'
                            : count > 0
                                ? color
                                : '#64748b',
                    }}
                >
                    {count}
                </span>
            </button>
        );
    };

    const cols = TAB_COLUMNS[moduleFilter] || TAB_COLUMNS.all;

    return (
        <>
            <Card className="my-votes-card p-4">
                <div className="my-votes-header d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
                    <div>
                        <h4 className="fw-bold mb-1">My Approvals</h4>
                        <div className="text-muted small">
                            {loading ? 'Loading your requests…' : pendingTotal === 0
                                ? 'Nothing is waiting for your decision.'
                                : `${pendingTotal} request${pendingTotal === 1 ? '' : 's'} waiting for your decision`}
                        </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        <button
                            type="button"
                            className="my-votes-refresh-btn"
                            onClick={load}
                            disabled={loading}
                        >
                            <RefreshCw size={14} className={loading ? 'fa-spin' : ''} />
                            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
                        </button>
                    </div>
                </div>

                {failed.length > 0 && (
                    <Alert variant="warning" className="py-2 small mb-4">
                        Could not load: {failed.join(', ')}. Those requests are not shown below. Try refreshing.
                    </Alert>
                )}

                <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
                    {/* Category Filter Tabs */}
                    <div className="my-votes-tabs-wrapper">
                        {chip('all', 'All', '#475569', Layers)}
                        {Object.entries(MODULES).map(([k, m]) => chip(k, m.label, m.color, m.icon))}
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-5">
                        <Spinner animation="border" role="status" />
                    </div>
                ) : rows.length === 0 ? (
                    <div className="my-votes-empty-container">
                        <div className="my-votes-empty-icon-box">
                            <Inbox size={30} />
                        </div>
                        <h5 className="fw-bold mb-1">
                            {tab === 'pending' ? 'No pending requests' : 'No decided requests'}
                        </h5>
                        <p className="text-muted mx-auto mb-0" style={{ maxWidth: '420px', fontSize: '13px' }}>
                            {tab === 'pending'
                                ? 'No requests are currently waiting for your decision in this category.'
                                : 'You have not submitted decisions on any requests in this category yet.'}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="table-responsive">
                            <Table hover className="align-middle mb-0">
                                <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #eef2f6' }}>
                                        <th style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '14px 16px' }}>
                                            {cols.type}
                                        </th>
                                        <th style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '14px 16px' }}>
                                            {cols.request}
                                        </th>
                                        <th style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '14px 16px' }}>
                                            {cols.from}
                                        </th>
                                        <th style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '14px 16px' }}>
                                            {cols.deadline}
                                        </th>
                                        <th style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '14px 16px' }}>
                                            {cols.status}
                                        </th>
                                        <th className="text-end" style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '14px 16px' }}>
                                            {cols.action}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.slice(0, visible).map((i) => {
                                        const mod = MODULES[i.module] || { label: i.module, color: '#64748b', icon: Layers };
                                        const ModIcon = mod.icon || Layers;
                                        const subtitle = i.raw?.purpose_of_visit || i.raw?.task_description || i.raw?.notes || (i.title?.includes(i.raw?.part_details) ? null : i.raw?.part_details);
                                        return (
                                            <tr key={i.key}>
                                                <td style={{ padding: '14px 16px' }}>
                                                    <span
                                                        className="badge rounded-pill d-inline-flex align-items-center gap-1.5"
                                                        style={{
                                                            background: tint(mod.color, 0.1),
                                                            color: mod.color,
                                                            border: `1px solid ${tint(mod.color, 0.25)}`,
                                                            fontWeight: 600,
                                                            fontSize: '11.5px',
                                                            padding: '5px 10px',
                                                        }}
                                                    >
                                                        <ModIcon size={12} strokeWidth={2.2} />
                                                        <span>{mod.label}</span>
                                                    </span>
                                                </td>
                                                <td style={{ padding: '14px 16px' }}>
                                                    <div className="fw-semibold text-dark" style={{ fontSize: '13.5px' }}>
                                                        {i.title}
                                                    </div>
                                                    {subtitle && (
                                                        <div className="text-muted text-truncate" style={{ fontSize: '12px', maxWidth: '340px' }}>
                                                            {subtitle}
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ padding: '14px 16px' }}>
                                                    <span className="fw-medium text-secondary" style={{ fontSize: '13px' }}>
                                                        {i.from}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '14px 16px' }}>{deadlineCell(i)}</td>
                                                <td style={{ padding: '14px 16px' }}>{renderDecisionBadge(i)}</td>
                                                <td className="text-end" style={{ padding: '14px 16px' }}>
                                                    <Button
                                                        variant="outline-primary"
                                                        size="sm"
                                                        onClick={() => setSelected(i)}
                                                        title={i.done ? 'View Details' : (i.decision.tone !== 'pending' ? 'Change / Review Vote' : 'Review & Decide')}
                                                    >
                                                        <Eye size={16} />
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </Table>
                        </div>
                        {rows.length > visible && (
                            <div className="text-center mt-3 pt-2">
                                <Button
                                    variant="outline-secondary"
                                    size="sm"
                                    className="rounded-pill px-4"
                                    onClick={() => setVisible((v) => v + PAGE_SIZE)}
                                >
                                    Show more ({rows.length - visible} remaining)
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </Card>

            <Modal show={!!selected} onHide={closeModal} centered size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>
                        {selected && <Badge color={MODULES[selected.module]?.color || '#64748b'}>{MODULES[selected.module]?.label || selected.module}</Badge>}
                        <span className="ms-2">Review request</span>
                    </Modal.Title>
                </Modal.Header>
                {selected && <Panel key={selected.key} item={selected} onClose={closeModal} onSaved={afterSave} />}
            </Modal>
        </>
    );
};

export default MyVotesPage;