import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Modal, Form, Spinner, Tabs, Tab } from 'react-bootstrap';
import { Building2, User } from 'lucide-react';
import Swal from 'sweetalert2';
import {
    getDepartments,
    getDepartmentEmployees,
    getMyDepartmentEmployees,
    getCurrentEmployee,
    getTeamForTask,
    getTeamForSubtask,
    createTeam,
    updateTeam
} from '../../../services/TaskService';

/**
 * Modal for assembling and creating a Team for a given task.
 *
 * `task` — the record the "Create Team" button was clicked on (a
 *   TaskVoteRequest as returned by /my-assigned-tasks/). Needs `.task`
 *   (the underlying Task id) and `.task_name`.
 *
 * Mode "all"  — browse every department; check a department to reveal its
 *   employees (checkboxes) inline underneath, and pick across departments.
 * Mode "mine" — skips department browsing and shows only the employees in
 *   the current user's own department.
 *
 * The mode selector below is a Tabs/Tab pair (not radio buttons) so the two
 * pickers are visually distinct panels the user switches between.
 *
 * If a team already exists for this task, opening the modal pre-checks its
 * current members (and, in "All Departments" mode, auto-expands whichever
 * departments they belong to) so you can see who's already on the team and
 * adjust the roster. Saving in that case updates the existing team instead
 * of creating a second one for the same task.
 */
const CreateTeamForm = ({
    show,
    onHide,
    task,
    subtaskId,
    subtaskName,
    leadEmployeeId,
    leadDepartmentId,
    onCreated
}) => {
    const [mode, setMode] = useState('all'); // 'all' | 'mine'

    const [departments, setDepartments] = useState([]);
    const [departmentsLoaded, setDepartmentsLoaded] = useState(false);
    const [loadingDepartments, setLoadingDepartments] = useState(false);
    const [checkedDepartmentIds, setCheckedDepartmentIds] = useState(() => new Set());
    const [departmentEmployees, setDepartmentEmployees] = useState({}); // { [deptId]: employee[] }
    const [loadingDeptEmployeeId, setLoadingDeptEmployeeId] = useState(null);

    const [myEmployees, setMyEmployees] = useState([]);
    const [myEmployeesLoaded, setMyEmployeesLoaded] = useState(false);
    const [loadingMyEmployees, setLoadingMyEmployees] = useState(false);

    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState(() => new Set());
    const [saving, setSaving] = useState(false);

    // Set once we've looked up whether this task already has a team. When
    // present, Save updates that team instead of creating a new one.
    const [existingTeamId, setExistingTeamId] = useState(null);
    const [loadingExistingTeam, setLoadingExistingTeam] = useState(false);

    const resetState = useCallback(() => {
        setMode('all');
        setDepartments([]);
        setDepartmentsLoaded(false);
        setCheckedDepartmentIds(new Set());
        setDepartmentEmployees({});
        setMyEmployees([]);
        setMyEmployeesLoaded(false);
        setSelectedEmployeeIds(new Set());
        setExistingTeamId(null);
    }, []);

    const effectiveLeadId = leadEmployeeId || task?.assigned_employee || task?.employee;
    const effectiveDeptId = leadDepartmentId || task?.assigned_department || task?.department;

    // Synchronously pre-check the team lead and expand their department the instant the modal opens
    useEffect(() => {
        if (!show) {
            resetState();
            return;
        }

        const initialLeadId = effectiveLeadId;
        const initialDeptId = effectiveDeptId;

        if (initialLeadId) {
            setSelectedEmployeeIds(new Set([initialLeadId]));
        } else {
            getCurrentEmployee()
                .then(emp => {
                    if (emp?.id) {
                        setSelectedEmployeeIds(prev => (prev.size === 0 ? new Set([emp.id]) : prev));
                        if (emp.department_id) {
                            setCheckedDepartmentIds(prev => (prev.size === 0 ? new Set([emp.department_id]) : prev));
                            getDepartmentEmployees(emp.department_id)
                                .then(data => {
                                    const emps = data.results || data || [];
                                    setDepartmentEmployees(prev => ({ ...prev, [emp.department_id]: emps }));
                                })
                                .catch(() => {});
                        }
                    }
                })
                .catch(() => {});
        }

        if (initialDeptId) {
            setCheckedDepartmentIds(new Set([initialDeptId]));
            getDepartmentEmployees(initialDeptId)
                .then(data => {
                    const emps = data.results || data || [];
                    setDepartmentEmployees(prev => ({ ...prev, [initialDeptId]: emps }));
                })
                .catch(() => {});
        }
    }, [show, effectiveLeadId, effectiveDeptId, resetState]);

    // Load data for whichever mode is active whenever the modal opens or the
    // mode changes. Each data set is fetched once per "open session" — once
    // loaded, switching tabs back and forth reuses what's already in state
    // instead of re-hitting the API every time.
    useEffect(() => {
        if (!show) return;

        if (mode === 'all') {
            if (departmentsLoaded) return;
            setLoadingDepartments(true);
            getDepartments()
                .then(data => {
                    setDepartments(data.results || data || []);
                    setDepartmentsLoaded(true);
                })
                .catch(() => Swal.fire('Error', 'Failed to load departments.', 'error'))
                .finally(() => setLoadingDepartments(false));
        } else {
            if (myEmployeesLoaded) return;
            setLoadingMyEmployees(true);
            getMyDepartmentEmployees()
                .then(data => {
                    const list = data.results || data || [];
                    setMyEmployees(list);
                    setMyEmployeesLoaded(true);

                    // If creating a new team and nothing was selected yet, pre-check current user
                    if (!existingTeamId) {
                        setSelectedEmployeeIds(prev => {
                            if (prev.size === 0) {
                                const me = list.find(e => e.is_current_user);
                                if (me) return new Set([me.id]);
                            }
                            return prev;
                        });
                    }
                })
                .catch(() => Swal.fire('Error', 'Failed to load your department\'s employees.', 'error'))
                .finally(() => setLoadingMyEmployees(false));
        }
    }, [show, mode, departmentsLoaded, myEmployeesLoaded, existingTeamId]);

    // Look up whether this task/subtask already has a team, once, each time
    // the modal opens. If found, pre-check its members so you can see (and
    // adjust) who's already on the team instead of starting from a blank
    // slate every time.
    // When `subtaskId` is provided (modal opened from a subtask card), we
    // look up the team for THAT subtask — not the parent task's team —
    // so you never see the parent's members pre-checked by mistake.
    useEffect(() => {
        // Need at least one of: subtaskId (subtask context) or task.task (parent task context)
        if (!show) return;
        if (!subtaskId && !task?.task) return;

        setLoadingExistingTeam(true);
        const teamFetch = subtaskId
            ? getTeamForSubtask(subtaskId)
            : getTeamForTask(task.task);

        teamFetch
            .then(async (data) => {
                const teams = data.results || data || [];
                const existing = teams[0];
                if (!existing) {
                    // No existing team yet — ensure the team lead is selected
                    const leadId = effectiveLeadId || (await getCurrentEmployee().catch(() => null))?.id;
                    if (leadId) {
                        setSelectedEmployeeIds(prev => (prev.size === 0 ? new Set([leadId]) : prev));
                    }
                    return;
                }

                setExistingTeamId(existing.id);

                const members = existing.members || [];
                setSelectedEmployeeIds(new Set(members.map(m => m.employee)));

                // In "All Departments" mode, pre-open every department that
                // one of these members belongs to, and pre-fetch its
                // employee list, so the pre-checked people are visible
                // right away instead of only after a manual click.
                const memberDeptIds = Array.from(new Set(
                    members
                        .map(m => m.employee_department)
                        .filter(id => id !== null && id !== undefined)
                ));
                if (memberDeptIds.length === 0) return;

                setCheckedDepartmentIds(prev => new Set([...prev, ...memberDeptIds]));

                const fetches = memberDeptIds.map(deptId =>
                    getDepartmentEmployees(deptId)
                        .then(d => ({ deptId, employees: d.results || d || [] }))
                        .catch(() => ({ deptId, employees: [] }))
                );
                const results = await Promise.all(fetches);
                setDepartmentEmployees(prev => {
                    const next = { ...prev };
                    results.forEach(({ deptId, employees }) => {
                        if (!next[deptId]) next[deptId] = employees;
                    });
                    return next;
                });
            })
            .catch(async (err) => {
                // A genuine 404/empty result here just means no team exists
                // yet — fall back to the normal blank "create" flow.
                if (err?.response?.status !== 404) {
                    console.error('Failed to look up existing team', subtaskId ?? task?.task, err);
                }
                const leadId = effectiveLeadId || (await getCurrentEmployee().catch(() => null))?.id;
                if (leadId) {
                    setSelectedEmployeeIds(prev => (prev.size === 0 ? new Set([leadId]) : prev));
                }
            })
            .finally(() => setLoadingExistingTeam(false));
    }, [show, task, subtaskId, effectiveLeadId]);

    const handleClose = () => {
        resetState();
        onHide();
    };

    const handleModeChange = (nextMode) => {
        if (nextMode === mode) return;
        setMode(nextMode);
        // Selections are kept across tabs on purpose: the same employee can
        // be checked whether you're looking at them via "All Departments" or
        // "My Department", and clearing here used to wipe out selections
        // that came from a previously-saved team the moment you switched tabs.
    };

    const handleDepartmentToggle = async (dept) => {
        const isNowChecked = !checkedDepartmentIds.has(dept.id);

        setCheckedDepartmentIds(prev => {
            const next = new Set(prev);
            if (isNowChecked) next.add(dept.id); else next.delete(dept.id);
            return next;
        });

        // Unchecking a department also drops its employees from the selection.
        if (!isNowChecked) {
            const idsInDept = new Set((departmentEmployees[dept.id] || []).map(e => e.id));
            setSelectedEmployeeIds(prev => {
                const next = new Set(prev);
                idsInDept.forEach(id => next.delete(id));
                return next;
            });
            return;
        }

        if (departmentEmployees[dept.id]) return; // already fetched

        setLoadingDeptEmployeeId(dept.id);
        try {
            const data = await getDepartmentEmployees(dept.id);
            setDepartmentEmployees(prev => ({ ...prev, [dept.id]: data.results || data || [] }));
        } catch (err) {
            Swal.fire('Error', `Failed to load employees for ${dept.name || 'this department'}.`, 'error');
        } finally {
            setLoadingDeptEmployeeId(null);
        }
    };

    const handleEmployeeToggle = (empId) => {
        setSelectedEmployeeIds(prev => {
            const next = new Set(prev);
            if (next.has(empId)) next.delete(empId); else next.add(empId);
            return next;
        });
    };

    const handleSave = async () => {
        if (selectedEmployeeIds.size === 0) {
            Swal.fire('Select employees', 'Pick at least one employee for the team.', 'warning');
            return;
        }
        setSaving(true);
        try {
            // When opened from a subtask card, bind the team to the subtask;
            // otherwise bind it to the parent task as usual.
            const payload = subtaskId
                ? { subtask: subtaskId, employee_ids: Array.from(selectedEmployeeIds) }
                : { task: task?.task, employee_ids: Array.from(selectedEmployeeIds) };
            if (existingTeamId) {
                await updateTeam(existingTeamId, payload);
                Swal.fire('Updated', 'Team updated successfully', 'success');
            } else {
                await createTeam(payload);
                Swal.fire('Created', 'Team created successfully', 'success');
            }
            onCreated && onCreated();
            handleClose();
        } catch (err) {
            console.error('Error saving team', err.response?.data || err.message);
            const apiError = err.response?.data?.employee_ids?.[0]
                || err.response?.data?.detail
                || 'Failed to save team. Please try again.';
            Swal.fire('Error', apiError, 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal show={show} onHide={handleClose} dialogClassName="item-custom-modal team-modal-lg" backdrop="static" keyboard={false} centered>
            <div className="modal-header-custom">
                <div className="d-flex align-items-center gap-3">
                    <div className="modal-icon-circle">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" fill="white" />
                        </svg>
                    </div>
                    <div>
                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                            {existingTeamId ? 'Edit Team' : 'Create Team'}
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            {subtaskName
                                ? `For subtask "${subtaskName}"`
                                : task?.task_name
                                    ? `For "${task.task_name}"`
                                    : 'Pick employees to form a team'}
                        </p>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={handleClose}>
                    &times;
                </button>
            </div>

            <div className="modal-body-custom">
                <style>{`
                    .team-modal-lg {
                        max-width: 800px !important;
                        width: 90vw !important;
                    }
                    .team-modal-lg .modal-body-custom {
                        min-height: 520px;
                    }
                    .team-mode-tabs.nav-tabs {
                        display: inline-flex;
                        border-bottom: none;
                        flex-wrap: nowrap;
                        background-color: #eef1f4;
                        border-radius: 999px;
                        padding: 4px;
                        border: 1px solid #e2e8f0;
                        width: auto;
                    }
                    .team-mode-tabs.nav-tabs .nav-link {
                        border: none;
                        border-radius: 999px;
                        color: #64748b;
                        font-weight: 500;
                        padding: 8px 20px;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        background-color: transparent;
                        white-space: nowrap;
                    }
                    .team-mode-tabs.nav-tabs .nav-link:hover {
                        color: #334155;
                    }
                    .team-mode-tabs.nav-tabs .nav-link.active {
                        background-color: #fff;
                        color: #0d6efd;
                        font-weight: 600;
                        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
                    }
                `}</style>
                <div className="mb-2">
                    <Tabs
                        activeKey={mode}
                        onSelect={(key) => handleModeChange(key)}
                        className="mb-3 team-mode-tabs"
                    >
                        <Tab
                            eventKey="all"
                            title={
                                <>
                                    <Building2 size={15} /> All Departments
                                </>
                            }
                        >
                            <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', marginTop: '14px' }}>
                                {loadingDepartments ? (
                                    <div className="text-center py-3"><Spinner animation="border" size="sm" /></div>
                                ) : departments.length === 0 ? (
                                    <p className="text-muted small mb-0">No departments found.</p>
                                ) : (
                                    departments.map(dept => (
                                        <div key={dept.id} className="mb-2">
                                            <Form.Check
                                                type="checkbox"
                                                id={`dept-${dept.id}`}
                                                label={dept.name}
                                                checked={checkedDepartmentIds.has(dept.id)}
                                                onChange={() => handleDepartmentToggle(dept)}
                                            />

                                            {checkedDepartmentIds.has(dept.id) && (
                                                <div className="ms-4 mt-1">
                                                    {loadingDeptEmployeeId === dept.id ? (
                                                        <div className="py-1"><Spinner animation="border" size="sm" /></div>
                                                    ) : (departmentEmployees[dept.id] || []).length === 0 ? (
                                                        <p className="text-muted small mb-1">No employees in this department.</p>
                                                    ) : (
                                                        (departmentEmployees[dept.id] || []).map(emp => (
                                                            <Form.Check
                                                                key={emp.id}
                                                                type="checkbox"
                                                                id={`emp-${dept.id}-${emp.id}`}
                                                                label={emp.name}
                                                                className="small mb-1"
                                                                checked={selectedEmployeeIds.has(emp.id)}
                                                                onChange={() => handleEmployeeToggle(emp.id)}
                                                            />
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </Tab>

                        <Tab
                            eventKey="mine"
                            title={
                                <>
                                    <User size={15} /> My Department
                                </>
                            }
                        >
                            <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', marginTop: '14px' }}>
                                {loadingMyEmployees ? (
                                    <div className="text-center py-3"><Spinner animation="border" size="sm" /></div>
                                ) : myEmployees.length === 0 ? (
                                    <p className="text-muted small mb-0">No employees found in your department.</p>
                                ) : (
                                    myEmployees.map(emp => (
                                        <Form.Check
                                            key={emp.id}
                                            type="checkbox"
                                            id={`my-emp-${emp.id}`}
                                            label={emp.name}
                                            className="mb-1"
                                            checked={selectedEmployeeIds.has(emp.id)}
                                            onChange={() => handleEmployeeToggle(emp.id)}
                                        />
                                    ))
                                )}
                            </div>
                        </Tab>
                    </Tabs>

                    <small className="text-muted d-block mt-2">
                        {loadingExistingTeam
                            ? 'Checking for an existing team…'
                            : `${selectedEmployeeIds.size} employee${selectedEmployeeIds.size === 1 ? '' : 's'} selected`}
                    </small>
                </div>
            </div>

            <div className="modal-footer-custom" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-close-custom" onClick={handleClose}>
                    Cancel
                </button>
                <button type="button" className="btn-save-custom" disabled={saving} onClick={handleSave}>
                    {saving ? (
                        <>
                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                            {existingTeamId ? 'Updating...' : 'Saving...'}
                        </>
                    ) : (existingTeamId ? 'Update' : 'Save')}
                </button>
            </div>
        </Modal>
    );
};

export default CreateTeamForm;