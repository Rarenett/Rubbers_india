import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Button, Form, Spinner, ProgressBar, Table, Badge } from 'react-bootstrap';
import { Trash2, Plus, ArrowLeft, SplitSquareHorizontal, Users, Check, CheckCheck } from 'lucide-react';
import Swal from 'sweetalert2';
import {
    getSubtasksForTask,
    getTeamForTask,
    getTeamForSubtask,
    getTaskAssignments,
    saveTaskAssignments,
    approveMemberAssignments,
    bulkApproveAssignments,
} from '../../../services/TaskService';

// One row's shape while editing: { key, subtaskId, employeeId, percentage }
// `key` is a stable React key (not the same as any backend id) since rows
// can be added/removed freely before saving.
let rowKeySeed = 0;
const blankRow = () => ({ key: `row-${++rowKeySeed}`, subtaskId: '', employeeId: '', percentage: 0 });

// Helper to get initials from an employee name
const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const AssignTaskPage = () => {
    const { taskId } = useParams();
    const [searchParams] = useSearchParams();
    const parentSubtaskId = searchParams.get('parent_subtask');
    const navigate = useNavigate();

    // Active Tab: 'assign' (Split Across Subtasks) or 'team' (Team Members & Assigned Tasks)
    const [activeTab, setActiveTab] = useState('assign');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [approvingMemberId, setApprovingMemberId] = useState(null);
    const [bulkApproving, setBulkApproving] = useState(false);
    const [selectedMemberIds, setSelectedMemberIds] = useState(new Set());

    const [subtasks, setSubtasks] = useState([]);       // all subtasks under this task/subtask
    const [teamMembers, setTeamMembers] = useState([]); // this task's/subtask's team's members
    const [teamInfo, setTeamInfo] = useState(null);     // team metadata (team lead, etc.)
    const [savedAssignments, setSavedAssignments] = useState([]); // persisted assignments
    const [rows, setRows] = useState([blankRow()]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            // If parentSubtaskId exists, we are splitting a subtask across its own child subtasks (Level 3+)
            // In this case, taskId in the URL is actually the parent subtask ID, but we explicitly use parentSubtaskId.
            const pTaskId = parentSubtaskId ? null : taskId;
            const pSubtaskId = parentSubtaskId || null;

            const [subtaskData, teamData, assignmentData] = await Promise.all([
                getSubtasksForTask(pTaskId, pSubtaskId),
                parentSubtaskId ? getTeamForSubtask(pSubtaskId) : getTeamForTask(pTaskId),
                getTaskAssignments(pTaskId, pSubtaskId).catch(() => []), // no saved assignments yet is fine
            ]);

            const subtaskList = subtaskData.results || subtaskData || [];
            setSubtasks(subtaskList);

            const teams = teamData.results || teamData || [];
            const currentTeam = teams[0] || null;
            setTeamInfo(currentTeam);
            const members = currentTeam?.members || [];
            setTeamMembers(members);

            const existing = assignmentData.results || assignmentData || [];
            setSavedAssignments(existing);

            if (existing.length > 0) {
                setRows(existing.map((a) => ({
                    key: `row-${++rowKeySeed}`,
                    subtaskId: a.subtask,
                    employeeId: a.employee,
                    percentage: Number(a.percentage),
                })));
            } else {
                setRows([blankRow()]);
            }
        } catch (err) {
            console.error('Failed to load Assign Task data', err);
            Swal.fire('Error', 'Failed to load subtasks/team for this task.', 'error');
        } finally {
            setLoading(false);
        }
    }, [taskId, parentSubtaskId]);

    useEffect(() => { load(); }, [load]);

    const totalPercentage = useMemo(
        () => rows.reduce((sum, r) => sum + (Number(r.percentage) || 0), 0),
        [rows]
    );

    // A subtask/employee already chosen in another row shouldn't be
    // offered again — each dropdown's options exclude every OTHER row's
    // current selection (but still includes its own, so re-opening a
    // dropdown shows its current value).
    const subtaskOptionsFor = (rowKey) => {
        const usedElsewhere = new Set(
            rows
                .filter(r => r.key !== rowKey && r.subtaskId)
                .map(r => String(typeof r.subtaskId === 'object' ? r.subtaskId?.id : r.subtaskId))
        );
        return subtasks.filter(s => s.task_type === 'group' || !usedElsewhere.has(String(s.id)));
    };

    const employeeOptionsFor = (rowKey) => {
        const currentRow = rows.find(r => r.key === rowKey);
        const currentSubtaskId = currentRow?.subtaskId ? String(typeof currentRow.subtaskId === 'object' ? currentRow.subtaskId.id : currentRow.subtaskId) : null;
        
        const usedEmployeesForSubtask = new Set(
            rows
                .filter(r => r.key !== rowKey && currentSubtaskId && String(typeof r.subtaskId === 'object' ? r.subtaskId?.id : r.subtaskId) === currentSubtaskId && r.employeeId)
                .map(r => String(typeof r.employeeId === 'object' ? r.employeeId?.id : r.employeeId))
        );
        return teamMembers.filter(m => {
            const empId = typeof m.employee === 'object' ? m.employee?.id : m.employee;
            return !usedEmployeesForSubtask.has(String(empId));
        });
    };

    const updateRow = (key, patch) => {
        setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
    };

    const addRow = () => {
        const hasGroup = subtasks.some(s => s.task_type === 'group');
        if (!hasGroup && rows.length >= subtasks.length) return;
        setRows(prev => [...prev, blankRow()]);
    };

    const removeRow = (key) => {
        setRows(prev => (prev.length > 1 ? prev.filter(r => r.key !== key) : prev));
    };

    const canSave = rows.length > 0
        && rows.every(r => r.subtaskId && r.employeeId)
        && totalPercentage === 100
        && !saving;

    const handleSave = async () => {
        setSaving(true);
        try {
            const pTaskId = parentSubtaskId ? null : taskId;
            const pSubtaskId = parentSubtaskId || null;

            const payload = rows.map(r => ({
                subtask: r.subtaskId,
                employee: r.employeeId,
                percentage: Number(r.percentage),
            }));
            await saveTaskAssignments(pTaskId, pSubtaskId, payload);
            Swal.fire('Saved', 'Task split saved successfully.', 'success');
            await load();
            setActiveTab('team');
        } catch (err) {
            console.error('Failed to save task assignments', err);
            const apiError = err.response?.data?.assignments?.[0]
                || err.response?.data?.detail
                || 'Failed to save the task split.';
            Swal.fire('Error', apiError, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleEditMember = (member) => {
        const assigns = getAssignmentsForMember(member);
        const isApproved = assigns.length > 0 && assigns.every((a) => a.is_approved);
        if (isApproved) {
            Swal.fire('Locked', 'This member\'s subtask assignment has already been approved and cannot be edited.', 'info');
            return;
        }
        if (savedAssignments && savedAssignments.length > 0) {
            setRows(savedAssignments.map((a) => ({
                key: `row-${++rowKeySeed}`,
                subtaskId: a.subtask,
                employeeId: a.employee,
                percentage: Number(a.percentage),
            })));
        }
        setActiveTab('assign');
    };

    const handleApproveMember = async (member) => {
        const empId = typeof member.employee === 'object' ? member.employee?.id : member.employee;
        const memberKey = member.id || empId;
        setApprovingMemberId(memberKey);
        try {
            const pTaskId = parentSubtaskId ? null : taskId;
            const pSubtaskId = parentSubtaskId || null;
            await approveMemberAssignments(pTaskId, pSubtaskId, empId);
            Swal.fire({
                title: 'Approved!',
                text: `Assignments for ${member.employee_name || 'member'} have been approved.`,
                icon: 'success',
                timer: 2000,
                showConfirmButton: false,
            });
            await load();
        } catch (err) {
            console.error('Failed to approve assignments', err);
            const apiError = err.response?.data?.error
                || err.response?.data?.detail
                || 'Failed to approve assignments.';
            Swal.fire('Error', apiError, 'error');
        } finally {
            setApprovingMemberId(null);
        }
    };

    // Helper: find assignments for a specific team member
    const getAssignmentsForMember = useCallback((member) => {
        const targetEmpId = typeof member.employee === 'object' ? member.employee?.id : member.employee;
        return savedAssignments.filter((a) => {
            const empId = typeof a.employee === 'object' ? a.employee?.id : a.employee;
            return String(empId) === String(targetEmpId);
        });
    }, [savedAssignments]);

    // Unapproved vs all approved
    const unapprovedAssignments = useMemo(
        () => savedAssignments.filter((a) => !a.is_approved),
        [savedAssignments]
    );
    const unapprovedCount = unapprovedAssignments.length;
    const allApproved = savedAssignments.length > 0 && unapprovedCount === 0;

    // Team members who have at least one unapproved assignment
    const draftMembers = useMemo(() => {
        return teamMembers.filter((m) => {
            const assigns = getAssignmentsForMember(m);
            return assigns.length > 0 && assigns.some((a) => !a.is_approved);
        });
    }, [teamMembers, getAssignmentsForMember]);

    const handleToggleSelectAll = () => {
        if (selectedMemberIds.size === draftMembers.length) {
            setSelectedMemberIds(new Set());
        } else {
            const next = new Set();
            draftMembers.forEach((m) => {
                const empId = typeof m.employee === 'object' ? m.employee?.id : m.employee;
                if (empId) next.add(empId);
            });
            setSelectedMemberIds(next);
        }
    };

    const handleToggleSelectMember = (empId) => {
        setSelectedMemberIds((prev) => {
            const next = new Set(prev);
            if (next.has(empId)) {
                next.delete(empId);
            } else {
                next.add(empId);
            }
            return next;
        });
    };

    const handleBulkApprove = async () => {
        const pTaskId = parentSubtaskId ? null : taskId;
        const pSubtaskId = parentSubtaskId || null;

        const empIdsToApprove = selectedMemberIds.size > 0 ? Array.from(selectedMemberIds) : null;

        const confirmResult = await Swal.fire({
            title: empIdsToApprove
                ? `Approve ${empIdsToApprove.length} Selected Member(s)?`
                : `Approve All ${unapprovedCount} Subtask Assignment(s)?`,
            text: empIdsToApprove
                ? `This will approve subtasks for the selected team member(s) and make them active.`
                : `This will approve all draft subtasks under this task at once.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, Approve',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#16a34a',
        });

        if (!confirmResult.isConfirmed) return;

        setBulkApproving(true);
        try {
            const res = await bulkApproveAssignments(pTaskId, pSubtaskId, empIdsToApprove);
            Swal.fire({
                title: 'Approved!',
                text: res.message || 'Subtasks approved successfully.',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false,
            });
            setSelectedMemberIds(new Set());
            await load();
        } catch (err) {
            console.error('Failed to bulk approve', err);
            const apiError = err.response?.data?.error
                || err.response?.data?.detail
                || 'Failed to approve assignments.';
            Swal.fire('Error', apiError, 'error');
        } finally {
            setBulkApproving(false);
        }
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center py-5">
                <Spinner animation="border" />
            </div>
        );
    }

    const noSubtasks = subtasks.length === 0;
    const noTeam = teamMembers.length === 0;

    return (
        <div className="p-3 p-md-4">
            <Button variant="link" className="ps-0 mb-2 d-flex align-items-center gap-1 text-decoration-none" onClick={() => navigate(-1)}>
                <ArrowLeft size={16} /> Back
            </Button>

            <Card className="shadow-sm border-0" style={{ borderRadius: '16px' }}>
                <Card.Body className="p-4">
                    {/* Header with Title and Tab Switcher (positioned right next to the title) */}
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 border-bottom pb-3">
                        <div className="d-flex align-items-center gap-3 flex-wrap">
                            <h5 className="mb-0 fw-bold" style={{ color: '#1e293b' }}>
                                Assign Task — Split Across Subtasks
                            </h5>

                            {/* Tab Switcher */}
                            <div
                                className="d-flex align-items-center gap-1"
                                style={{
                                    background: '#f0f1f3',
                                    borderRadius: 999,
                                    padding: 4,
                                }}
                            >
                                <button
                                    type="button"
                                    className="btn btn-sm d-flex align-items-center"
                                    onClick={() => setActiveTab('assign')}
                                    style={{
                                        borderRadius: 999,
                                        fontSize: '0.8rem',
                                        fontWeight: 700,
                                        padding: '6px 18px',
                                        border: 'none',
                                        transition: 'all 0.2s',
                                        background: activeTab === 'assign' ? '#fff' : 'transparent',
                                        color: activeTab === 'assign' ? '#00b8d9' : '#8a8f98',
                                        boxShadow: activeTab === 'assign' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                                    }}
                                >
                                    <SplitSquareHorizontal size={15} className="me-2" />
                                    Split Across Subtasks
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm d-flex align-items-center"
                                    onClick={() => setActiveTab('team')}
                                    style={{
                                        borderRadius: 999,
                                        fontSize: '0.8rem',
                                        fontWeight: 700,
                                        padding: '6px 18px',
                                        border: 'none',
                                        transition: 'all 0.2s',
                                        background: activeTab === 'team' ? '#fff' : 'transparent',
                                        color: activeTab === 'team' ? '#00b8d9' : '#8a8f98',
                                        boxShadow: activeTab === 'team' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                                    }}
                                >
                                    <Users size={15} className="me-2" />
                                    Team Members & Assigned Tasks ({teamMembers.length})
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── TAB 1: Split Across Subtasks ─────────────────────────── */}
                    {activeTab === 'assign' && (
                        <>
                            {noSubtasks && (
                                <p className="text-muted small">
                                    This task has no subtasks yet. Add subtasks from the task's "Subtask" button first, then come back here to split and assign them.
                                </p>
                            )}
                            {!noSubtasks && noTeam && (
                                <p className="text-muted small">
                                    This task has no team yet. Create a team from the task's "Create Team" button first, then come back here to assign members.
                                </p>
                            )}

                            {!noSubtasks && !noTeam && (
                                <>
                                    <div className="table-responsive">
                                        <table className="table align-middle">
                                            <thead>
                                                <tr>
                                                    <th style={{ minWidth: 200 }}>Subtask</th>
                                                    <th style={{ minWidth: 200 }}>Team Member</th>
                                                    <th style={{ minWidth: 160 }}>Percentage</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rows.map((row) => (
                                                    <tr key={row.key}>
                                                        <td>
                                                            <Form.Select
                                                                value={row.subtaskId}
                                                                onChange={(e) => updateRow(row.key, { subtaskId: e.target.value })}
                                                            >
                                                                <option value="">Select subtask…</option>
                                                                {subtaskOptionsFor(row.key).map((s) => (
                                                                    <option key={s.id} value={s.id}>{s.subtask_name}</option>
                                                                ))}
                                                            </Form.Select>
                                                        </td>
                                                        <td>
                                                            <Form.Select
                                                                value={row.employeeId}
                                                                onChange={(e) => updateRow(row.key, { employeeId: e.target.value })}
                                                            >
                                                                <option value="">Select member…</option>
                                                                {employeeOptionsFor(row.key).map((m) => (
                                                                    <option key={m.employee} value={m.employee}>{m.employee_name}</option>
                                                                ))}
                                                            </Form.Select>
                                                        </td>
                                                        <td>
                                                            <div className="d-flex align-items-center gap-2">
                                                                <Form.Control
                                                                    type="number"
                                                                    min={0}
                                                                    max={100}
                                                                    placeholder="0"
                                                                    value={row.percentage === '' ? '' : row.percentage}
                                                                    onChange={(e) => {
                                                                        const raw = e.target.value;
                                                                        if (raw === '') {
                                                                            updateRow(row.key, { percentage: '' });
                                                                            return;
                                                                        }
                                                                        let val = Number(raw);
                                                                        if (val > 100) val = 100;
                                                                        if (val < 0) val = 0;
                                                                        updateRow(row.key, { percentage: val });
                                                                    }}
                                                                    style={{ maxWidth: 90 }}
                                                                />
                                                                <span className="fw-semibold text-muted">%</span>
                                                                <Button
                                                                    variant="link"
                                                                    className="text-danger p-0 ms-2"
                                                                    disabled={rows.length === 1}
                                                                    onClick={() => removeRow(row.key)}
                                                                    title="Remove row"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <Button
                                        variant="outline-secondary"
                                        size="sm"
                                        className="d-flex align-items-center gap-1 mb-4"
                                        onClick={addRow}
                                        disabled={rows.length >= subtasks.length}
                                    >
                                        <Plus size={14} /> Add Row
                                    </Button>

                                    <div className="mb-3">
                                        <div className="d-flex justify-content-between small mb-1">
                                            <span className="fw-semibold">Total split</span>
                                            <span className={totalPercentage === 100 ? 'text-success fw-semibold' : 'text-danger fw-semibold'}>
                                                {totalPercentage}% {totalPercentage === 100 ? '✓' : '(must equal 100%)'}
                                            </span>
                                        </div>
                                        <ProgressBar
                                            now={Math.min(totalPercentage, 100)}
                                            variant={totalPercentage === 100 ? 'success' : totalPercentage > 100 ? 'danger' : 'warning'}
                                        />
                                    </div>

                                    <Button variant="primary" onClick={handleSave} disabled={!canSave}>
                                        {saving ? 'Saving…' : 'Save Assignment'}
                                    </Button>
                                </>
                            )}
                        </>
                    )}

                    {/* ── TAB 2: Team Members & Assigned Tasks ──────────────────── */}
                    {activeTab === 'team' && (
                        <div>
                            {noTeam ? (
                                <div className="text-center py-5 border rounded-3 bg-light">
                                    <div
                                        className="mx-auto mb-3 d-flex align-items-center justify-content-center"
                                        style={{
                                            width: '56px',
                                            height: '56px',
                                            borderRadius: '50%',
                                            background: '#e8fbf3',
                                            color: '#10b981',
                                        }}
                                    >
                                        <Users size={28} />
                                    </div>
                                    <h6 className="fw-bold mb-1" style={{ color: '#1e293b' }}>No Team Members Found</h6>
                                    <p className="text-muted small mb-0">
                                        This task has no team yet. Create a team from the task's "Create Team" button first, then assign members.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* Summary Stats Header */}
                                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 p-3 bg-light rounded-3 border">
                                        <div className="d-flex align-items-center gap-3 flex-wrap">
                                            <div>
                                                <span className="text-muted small d-block" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                    Team Lead
                                                </span>
                                                <strong className="text-dark" style={{ fontSize: '13.5px' }}>
                                                    {teamInfo?.team_lead_name || '—'}
                                                </strong>
                                            </div>
                                            <div className="vr d-none d-sm-block my-1" />
                                            <div>
                                                <span className="text-muted small d-block" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                    Team Size
                                                </span>
                                                <strong className="text-dark" style={{ fontSize: '13.5px' }}>
                                                    {teamMembers.length} {teamMembers.length === 1 ? 'member' : 'members'}
                                                </strong>
                                            </div>
                                        </div>

                                        <div className="d-flex align-items-center gap-2 flex-wrap">
                                            <span
                                                className="badge px-3 py-2 fw-semibold"
                                                style={{ background: '#ecfdf5', color: '#16a34a', borderRadius: '8px', fontSize: '12px' }}
                                            >
                                                Assigned Subtasks: <span className="fw-bold">{savedAssignments.length}</span>
                                            </span>
                                            <span
                                                className="badge px-3 py-2 fw-semibold"
                                                style={{ background: '#eff6ff', color: '#2563eb', borderRadius: '8px', fontSize: '12px' }}
                                            >
                                                Total Split: <span className="fw-bold">{savedAssignments.reduce((acc, a) => acc + (Number(a.percentage) || 0), 0)}%</span>
                                            </span>

                                            {savedAssignments.length > 0 && (
                                                allApproved ? (
                                                    <span
                                                        className="badge px-3 py-2 fw-semibold d-inline-flex align-items-center gap-1 border"
                                                        style={{ background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0', borderRadius: '8px', fontSize: '12px' }}
                                                    >
                                                        <Check size={14} /> All Subtasks Approved
                                                    </span>
                                                ) : (
                                                    <Button
                                                        variant="success"
                                                        size="sm"
                                                        className="d-inline-flex align-items-center gap-1.5 fw-semibold px-3 py-2 shadow-sm text-white"
                                                        style={{ borderRadius: '8px', fontSize: '12px' }}
                                                        disabled={bulkApproving || unapprovedCount === 0}
                                                        onClick={handleBulkApprove}
                                                    >
                                                        {bulkApproving ? (
                                                            <>
                                                                <Spinner size="sm" animation="border" className="me-1" />
                                                                Approving...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <CheckCheck size={15} />
                                                                {selectedMemberIds.size > 0
                                                                    ? `Approve Selected (${selectedMemberIds.size})`
                                                                    : `Approve All (${unapprovedCount})`}
                                                            </>
                                                        )}
                                                    </Button>
                                                )
                                            )}
                                        </div>
                                    </div>

                                    {/* Members & Assigned Tasks Table */}
                                    <div className="table-responsive border rounded-3 overflow-hidden">
                                        <Table hover className="align-middle mb-0" style={{ fontSize: '13px' }}>
                                            <thead style={{ background: '#f8fafc', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                <tr>
                                                    {draftMembers.length > 0 && (
                                                        <th className="py-2.5 px-3 text-center" style={{ width: '40px' }}>
                                                            <Form.Check
                                                                type="checkbox"
                                                                checked={draftMembers.length > 0 && selectedMemberIds.size === draftMembers.length}
                                                                onChange={handleToggleSelectAll}
                                                                title="Select all draft members"
                                                                aria-label="Select all draft members"
                                                            />
                                                        </th>
                                                    )}
                                                    <th className="py-2.5 px-3">Team Member</th>
                                                    <th className="py-2.5 px-3">Department / Role</th>
                                                    <th className="py-2.5 px-3">Assigned Subtask</th>
                                                    <th className="py-2.5 px-3" style={{ minWidth: '110px' }}>Allocation</th>
                                                    <th className="py-2.5 px-3" style={{ minWidth: '140px' }}>Progress</th>
                                                    <th className="py-2.5 px-3 text-center">Status</th>
                                                    <th className="py-2.5 px-3 text-center" style={{ minWidth: '160px' }}>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {teamMembers.map((member) => {
                                                    const assignments = getAssignmentsForMember(member);
                                                    const hasAssigned = assignments.length > 0;
                                                    const isApproved = hasAssigned && assignments.every((a) => a.is_approved);
                                                    const empId = typeof member.employee === 'object' ? member.employee?.id : member.employee;
                                                    const memberKey = member.id || empId;
                                                    const isApproving = approvingMemberId === memberKey;

                                                    return (
                                                        <tr key={member.id || member.employee}>
                                                            {draftMembers.length > 0 && (
                                                                <td className="py-3 px-3 text-center">
                                                                    {hasAssigned && !isApproved ? (
                                                                        <Form.Check
                                                                            type="checkbox"
                                                                            checked={selectedMemberIds.has(empId)}
                                                                            onChange={() => handleToggleSelectMember(empId)}
                                                                            aria-label={`Select ${member.employee_name}`}
                                                                        />
                                                                    ) : (
                                                                        <span className="text-muted" style={{ fontSize: '11px' }}>—</span>
                                                                    )}
                                                                </td>
                                                            )}
                                                            {/* Team Member Name & Initials */}
                                                            <td className="py-3 px-3">
                                                                <div className="d-flex align-items-center gap-2.5">
                                                                    <div
                                                                        style={{
                                                                            width: '36px',
                                                                            height: '36px',
                                                                            borderRadius: '50%',
                                                                            background: '#dcfce7',
                                                                            color: '#15803d',
                                                                            fontWeight: 700,
                                                                            fontSize: '12px',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            flexShrink: 0,
                                                                        }}
                                                                    >
                                                                        {getInitials(member.employee_name)}
                                                                    </div>
                                                                    <div>
                                                                        <div className="fw-semibold text-dark" style={{ fontSize: '13.5px' }}>
                                                                            {member.employee_name}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            {/* Department / Role */}
                                                            <td className="py-3 px-3 text-muted">
                                                                <div>{member.designation_name || '—'}</div>
                                                                <div className="small text-muted opacity-75">{member.department_name || ''}</div>
                                                            </td>

                                                            {/* Assigned Subtasks */}
                                                            <td className="py-3 px-3">
                                                                {!hasAssigned ? (
                                                                    <span className="badge bg-light text-muted border fw-normal" style={{ fontSize: '11px' }}>
                                                                        No subtask assigned
                                                                    </span>
                                                                ) : (
                                                                    assignments.map((a) => {
                                                                        const subtaskObj = subtasks.find((s) => String(s.id) === String(a.subtask));
                                                                        const taskType = subtaskObj?.task_type_display || subtaskObj?.task_type || 'SUBTASK';
                                                                        return (
                                                                            <div key={a.id} className="d-flex align-items-center gap-2 mb-1">
                                                                                <span
                                                                                    style={{
                                                                                        width: '7px',
                                                                                        height: '7px',
                                                                                        borderRadius: '50%',
                                                                                        backgroundColor: '#22c55e',
                                                                                        flexShrink: 0,
                                                                                    }}
                                                                                />
                                                                                <span className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
                                                                                    {a.subtask_name || subtaskObj?.subtask_name || 'Subtask'}
                                                                                </span>
                                                                                <span
                                                                                    style={{
                                                                                        background: '#ecfdf5',
                                                                                        color: '#16a34a',
                                                                                        borderRadius: '4px',
                                                                                        fontSize: '10px',
                                                                                        fontWeight: 700,
                                                                                        padding: '1px 6px',
                                                                                        textTransform: 'uppercase',
                                                                                    }}
                                                                                >
                                                                                    {taskType}
                                                                                </span>
                                                                            </div>
                                                                        );
                                                                    })
                                                                )}
                                                            </td>

                                                            {/* Allocation Percentage */}
                                                            <td className="py-3 px-3">
                                                                {!hasAssigned ? (
                                                                    <span className="text-muted">—</span>
                                                                ) : (
                                                                    assignments.map((a) => (
                                                                        <div key={a.id} className="mb-1">
                                                                            <span className="badge bg-success bg-opacity-10 text-success fw-bold" style={{ fontSize: '11.5px' }}>
                                                                                {a.percentage}%
                                                                            </span>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </td>

                                                            {/* Progress */}
                                                            <td className="py-3 px-3">
                                                                {!hasAssigned ? (
                                                                    <span className="text-muted">—</span>
                                                                ) : (
                                                                    assignments.map((a) => {
                                                                        const comp = Number(a.completed_percentage) || 0;
                                                                        return (
                                                                            <div key={a.id} className="mb-1">
                                                                                <div className="d-flex justify-content-between align-items-center mb-0.5">
                                                                                    <span className="small text-muted" style={{ fontSize: '11px' }}>
                                                                                        {comp}%
                                                                                    </span>
                                                                                </div>
                                                                                <ProgressBar
                                                                                    now={comp}
                                                                                    variant={comp >= 100 ? 'success' : comp > 0 ? 'info' : 'secondary'}
                                                                                    style={{ height: '5px', borderRadius: '4px' }}
                                                                                />
                                                                            </div>
                                                                        );
                                                                    })
                                                                )}
                                                            </td>

                                                            {/* Status */}
                                                            <td className="py-3 px-3 text-center">
                                                                {!hasAssigned ? (
                                                                    <span className="badge bg-light text-secondary border fw-normal" style={{ fontSize: '11px' }}>
                                                                        Unassigned
                                                                    </span>
                                                                ) : (
                                                                    assignments.map((a) => {
                                                                        if (!a.is_approved) {
                                                                            return (
                                                                                <span key={a.id} className="badge bg-secondary mb-1 d-inline-block" style={{ fontSize: '11px' }}>
                                                                                    Draft
                                                                                </span>
                                                                            );
                                                                        }
                                                                        const comp = Number(a.completed_percentage) || 0;
                                                                        if (comp >= 100) {
                                                                            return (
                                                                                <span key={a.id} className="badge bg-success mb-1 d-inline-block" style={{ fontSize: '11px' }}>
                                                                                    Completed
                                                                                </span>
                                                                            );
                                                                        }
                                                                        if (comp > 0) {
                                                                            return (
                                                                                <span key={a.id} className="badge bg-info mb-1 d-inline-block text-white" style={{ fontSize: '11px' }}>
                                                                                    In Progress
                                                                                </span>
                                                                            );
                                                                        }
                                                                        return (
                                                                            <span key={a.id} className="badge bg-warning bg-opacity-25 text-warning-emphasis mb-1 d-inline-block" style={{ fontSize: '11px' }}>
                                                                                Pending
                                                                            </span>
                                                                        );
                                                                    })
                                                                )}
                                                            </td>

                                                            {/* Action */}
                                                            <td className="py-3 px-3 text-center">
                                                                {!hasAssigned ? (
                                                                    <span className="text-muted small">—</span>
                                                                ) : (
                                                                    <div className="d-flex align-items-center justify-content-center gap-2">
                                                                        <Button
                                                                            variant="outline-primary"
                                                                            size="sm"
                                                                            className="d-inline-flex align-items-center gap-1"
                                                                            style={{
                                                                                fontSize: '12px',
                                                                                padding: '4px 10px',
                                                                                borderRadius: '6px',
                                                                                cursor: isApproved ? 'not-allowed' : 'pointer',
                                                                                opacity: isApproved ? 0.6 : 1,
                                                                            }}
                                                                            disabled={isApproved || isApproving || bulkApproving}
                                                                            title={isApproved ? "Approved subtask cannot be edited" : "Edit assignment"}
                                                                            onClick={() => handleEditMember(member)}
                                                                        >
                                                                            Edit
                                                                        </Button>
                                                                        <Button
                                                                            variant={isApproved ? 'outline-success' : 'success'}
                                                                            size="sm"
                                                                            className="d-inline-flex align-items-center gap-1"
                                                                            style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px' }}
                                                                            disabled={isApproved || isApproving || bulkApproving}
                                                                            onClick={() => handleApproveMember(member)}
                                                                        >
                                                                            {isApproving ? (
                                                                                <>
                                                                                    <Spinner size="sm" animation="border" className="me-1" />
                                                                                    Approving...
                                                                                </>
                                                                            ) : isApproved ? (
                                                                                'Approved'
                                                                            ) : (
                                                                                'Approve'
                                                                            )}
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </Table>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </Card.Body>
            </Card>
        </div>
    );
};

export default AssignTaskPage;