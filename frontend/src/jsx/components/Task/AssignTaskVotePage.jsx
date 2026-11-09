import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Form, Card, Row, Col, Button, Tabs, Tab, Table, Modal, Spinner, ProgressBar } from 'react-bootstrap';
import { Eye, CheckCircle2, XCircle, Clock, RotateCcw } from 'lucide-react';
import Swal from 'sweetalert2';
import axiosInstance from '../../../services/AxiosInstance';
import { usePageTitle } from '../../../context/TitleContext';
import {
    getTaskCategories,
    getTaskSubCategories,
    getTasks,
    createTaskVoteRequest,
    getMyCreatedVoteRequests,
    rescheduleTaskVoteRequest,
} from '../../../services/TaskService';

const formatDate = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    return isNaN(date) ? d : date.toLocaleString();
};

// result_status -> pill styling, shared by the summary table and the modal
const STATUS_STYLES = {
    pending: { bg: 'rgba(13, 110, 253, 0.15)', color: '#0d6efd', label: 'Voting Open', Icon: Clock },
    approved: { bg: 'rgba(40, 167, 69, 0.15)', color: '#28a745', label: 'Approved', Icon: CheckCircle2 },
    rejected: { bg: 'rgba(220, 53, 69, 0.15)', color: '#dc3545', label: 'Rejected', Icon: XCircle },
    incomplete: { bg: 'rgba(255, 193, 7, 0.2)', color: '#d97706', label: 'Reschedule Required', Icon: Clock },
};

const ResultStatusBadge = ({ status }) => {
    const s = STATUS_STYLES[status] || STATUS_STYLES.pending;
    const { Icon } = s;
    return (
        <span
            style={{
                backgroundColor: s.bg,
                color: s.color,
                fontWeight: 600,
                fontSize: '12px',
                padding: '4px 10px',
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
            }}
        >
            <Icon size={13} /> {s.label}
        </span>
    );
};

const VoteBadge = ({ vote }) => {
    const map = {
        yes: { bg: 'rgba(40, 167, 69, 0.15)', color: '#28a745', label: 'Approved' },
        no: { bg: 'rgba(220, 53, 69, 0.15)', color: '#dc3545', label: 'Rejected' },
        pending: { bg: 'rgba(108, 117, 125, 0.15)', color: '#6c757d', label: 'Awaiting' },
    };
    const s = map[vote] || map.pending;
    return (
        <span
            style={{
                backgroundColor: s.bg,
                color: s.color,
                fontWeight: 600,
                fontSize: '12px',
                padding: '3px 9px',
                borderRadius: '4px',
                display: 'inline-block',
            }}
        >
            {s.label}
        </span>
    );
};

const getDepartments = () =>
    axiosInstance.get(`/api/hr/departments/`).then(r => r.data);

const getEmployees = (params) =>
    axiosInstance.get(`/api/hr/employees/`, { params }).then(r => r.data);

const getBODs = () =>
    axiosInstance.get(`/api/hr/bod/`).then(r => r.data);

const getHODs = () =>
    axiosInstance.get(`/api/hr/employees/`, { params: { is_hod: 'true' } }).then(r => r.data);

const AssignTaskVotePage = () => {
    // dropdown source data
    const [categories, setCategories] = useState([]);
    const [allSubcategories, setAllSubcategories] = useState([]);
    const [allTasks, setAllTasks] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [bods, setBods] = useState([]);
    const [hods, setHods] = useState([]);
    
    usePageTitle("Screening");
    // task selection
    const [category, setCategory] = useState('');
    const [subcategory, setSubcategory] = useState('');
    const [task, setTask] = useState('');

    // "assign to" employee
    const [assignDept, setAssignDept] = useState('');
    const [assignEmployees, setAssignEmployees] = useState([]);
    const [assignedEmployee, setAssignedEmployee] = useState('');

    // approval mode
    const [approvalType, setApprovalType] = useState(''); // 'bod' | 'hod' | 'single' | 'multiple'
    const [selectedBod, setSelectedBod] = useState('');
    const [selectedHod, setSelectedHod] = useState('');

    // single mode
    const [singleDept, setSingleDept] = useState('');
    const [singleDeptEmployees, setSingleDeptEmployees] = useState([]);
    const [singleEmployee, setSingleEmployee] = useState('');

    // multiple mode
    const [multiDepts, setMultiDepts] = useState([]);
    const [multiDeptEmployees, setMultiDeptEmployees] = useState({});
    const [multiEmployees, setMultiEmployees] = useState([]);

    const [cutoffDate, setCutoffDate] = useState('');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);

    // ---- "My Sent Requests" tab (voting status/remarks of everyone I sent a task to) ----
    const [activeTab, setActiveTab] = useState('create');
    const [sentRequests, setSentRequests] = useState([]);
    const [loadingSent, setLoadingSent] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);

    const [rescheduleTarget, setRescheduleTarget] = useState(null);
    const [newCutoffDate, setNewCutoffDate] = useState('');
    const [rescheduleRemarks, setRescheduleRemarks] = useState('');
    const [rescheduling, setRescheduling] = useState(false);

    const loadSentRequests = useCallback(() => {
        setLoadingSent(true);
        getMyCreatedVoteRequests()
            .then(data => setSentRequests(data.results || data || []))
            .catch(() => setSentRequests([]))
            .finally(() => setLoadingSent(false));
    }, []);

    useEffect(() => {
        if (activeTab === 'sent') {
            loadSentRequests();
        }
    }, [activeTab, loadSentRequests]);

    // Also load once on mount (independent of which tab is active) so the
    // "New Request" task dropdown can immediately exclude already-approved
    // tasks without requiring a visit to the Screening Status tab first.
    useEffect(() => {
        loadSentRequests();
    }, [loadSentRequests]);

    const hasVotedAndPending = (vr) => {
        if (!vr) return false;
        // Show reschedule button after cutoff date & time if any voter status is pending (awaiting)
        const cutoffPassed = vr.cutoff_date ? new Date() > new Date(vr.cutoff_date) : false;
        if (!cutoffPassed) return false;

        const pending = vr.pending_count ?? 0;
        if (pending > 0) return true;
        if (vr.voters && vr.voters.length > 0) {
            return vr.voters.some(v => v.vote === 'pending');
        }
        return false;
    };

    const openRescheduleModal = (vr) => {
        let initial = '';
        if (vr && vr.cutoff_date) {
            try {
                const dt = new Date(vr.cutoff_date);
                if (!isNaN(dt)) {
                    initial = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                }
            } catch {}
        }
        setNewCutoffDate(initial);
        setRescheduleRemarks(vr?.remarks || '');
        setRescheduleTarget(vr);
    };

    const handleConfirmReschedule = async (e) => {
        e.preventDefault();
        if (!newCutoffDate || !rescheduleTarget) return;

        setRescheduling(true);
        try {
            const updated = await rescheduleTaskVoteRequest(rescheduleTarget.id, newCutoffDate, rescheduleRemarks);
            Swal.fire({
                icon: 'success',
                title: 'Rescheduled!',
                text: 'Voting request has been successfully rescheduled for the same persons.',
                timer: 2000,
                showConfirmButton: false,
            });
            loadSentRequests();
            if (selectedRequest && String(selectedRequest.id) === String(rescheduleTarget.id)) {
                setSelectedRequest(updated);
            }
            setRescheduleTarget(null);
        } catch (err) {
            Swal.fire('Error', err.response?.data?.detail || 'Failed to reschedule voting request.', 'error');
        } finally {
            setRescheduling(false);
        }
    };

    // ---- initial loads (fetch everything once) ----
    useEffect(() => {
        setLoading(true);
        Promise.all([
            getTaskCategories().catch(() => []),
            getTaskSubCategories().catch(() => []),
            getTasks().catch(() => []),
            getDepartments().catch(() => []),
            getBODs().catch(() => []),
            getHODs().catch(() => []),
        ])
            .then(([catData, subcatData, taskData, deptData, bodData, hodData]) => {
                setCategories(catData.results || catData || []);
                setAllSubcategories(subcatData.results || subcatData || []);
                setAllTasks(taskData.results || taskData || []);
                setDepartments(deptData.results || deptData || []);
                setBods(bodData.results || bodData || []);
                setHods(hodData.results || hodData || []);
            })
            .catch(() => {
                Swal.fire('Error', 'Failed to load initial data', 'error');
            })
            .finally(() => setLoading(false));
    }, []);

    // ---- derived: task ids that already have an approved vote request ----
    const approvedTaskIds = useMemo(() => {
        return new Set(
            sentRequests
                .filter(vr => vr.result_status === 'approved')
                .map(vr => String(vr.task))
        );
    }, [sentRequests]);

    // ---- derived: tasks available for screening/approval ----
    const tasks = useMemo(() => {
        return allTasks.filter(t => !approvedTaskIds.has(String(t.id)));
    }, [allTasks, approvedTaskIds]);

    // ---- auto-populate category & subcategory upon task selection ----
    const handleTaskChange = (selectedTaskId) => {
        setTask(selectedTaskId);
        if (!selectedTaskId) {
            setCategory('');
            setSubcategory('');
            return;
        }

        const selectedTask = allTasks.find(t => String(t.id) === String(selectedTaskId));
        if (selectedTask) {
            const subcatId = typeof selectedTask.subcategory === 'object' && selectedTask.subcategory !== null
                ? String(selectedTask.subcategory.id)
                : (selectedTask.subcategory != null ? String(selectedTask.subcategory) : '');

            let resolvedSubcatId = subcatId;
            let subcatObj = allSubcategories.find(sc => String(sc.id) === subcatId);
            if (!subcatObj && selectedTask.subcategory_name) {
                subcatObj = allSubcategories.find(sc => sc.subcategory_name === selectedTask.subcategory_name);
                if (subcatObj) {
                    resolvedSubcatId = String(subcatObj.id);
                }
            }
            setSubcategory(resolvedSubcatId);

            let catId = '';
            if (subcatObj) {
                catId = typeof subcatObj.category === 'object' && subcatObj.category !== null
                    ? String(subcatObj.category.id)
                    : (subcatObj.category != null ? String(subcatObj.category) : '');
            }
            if (!catId && selectedTask.category != null) {
                catId = typeof selectedTask.category === 'object' && selectedTask.category !== null
                    ? String(selectedTask.category.id)
                    : String(selectedTask.category);
            }
            if (!catId && selectedTask.category_name) {
                const catObj = categories.find(c => c.category_name === selectedTask.category_name);
                if (catObj) {
                    catId = String(catObj.id);
                }
            }
            setCategory(catId);
        } else {
            setCategory('');
            setSubcategory('');
        }
    };

    // ---- assign department -> assign employees ----
    useEffect(() => {
        setAssignedEmployee('');
        if (!assignDept) {
            setAssignEmployees([]);
            return;
        }
        getEmployees({ department: assignDept })
            .then(d => setAssignEmployees(d.results || d || []))
            .catch(() => setAssignEmployees([]));
    }, [assignDept]);

    // ---- approval type change -> reset all approver selections ----
    useEffect(() => {
        setSelectedBod('');
        setSelectedHod('');
        setSingleDept('');
        setSingleDeptEmployees([]);
        setSingleEmployee('');
        setMultiDepts([]);
        setMultiDeptEmployees({});
        setMultiEmployees([]);
    }, [approvalType]);

    // ---- single mode: department -> employees ----
    useEffect(() => {
        setSingleEmployee('');
        if (!singleDept) {
            setSingleDeptEmployees([]);
            return;
        }
        getEmployees({ department: singleDept })
            .then(d => setSingleDeptEmployees(d.results || d || []))
            .catch(() => setSingleDeptEmployees([]));
    }, [singleDept]);

    // ---- multiple mode: toggle a department checkbox ----
    const toggleMultiDept = async (deptId) => {
        setMultiDepts(prev =>
            prev.includes(deptId) ? prev.filter(id => id !== deptId) : [...prev, deptId]
        );
        if (!multiDeptEmployees[deptId]) {
            try {
                const data = await getEmployees({ department: deptId });
                setMultiDeptEmployees(prev => ({ ...prev, [deptId]: data.results || data || [] }));
            } catch {
                setMultiDeptEmployees(prev => ({ ...prev, [deptId]: [] }));
            }
        }
    };

    const toggleMultiEmployee = (empId) => {
        setMultiEmployees(prev =>
            prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
        );
    };

    // ---- employee hierarchy & filtering logic ----
    const selectedAssignee = useMemo(() => {
        if (!assignedEmployee) return null;
        return assignEmployees.find(emp => String(emp.id) === String(assignedEmployee)) || null;
    }, [assignEmployees, assignedEmployee]);

    const assigneeLevel = selectedAssignee?.level ?? selectedAssignee?.designation_level ?? null;

    const isHigherEmployee = useCallback((candidateEmp, assignee) => {
        if (!candidateEmp || !assignee) return false;
        // Cannot approve self
        if (String(candidateEmp.id) === String(assignee.id)) return false;
        if (candidateEmp.user && assignee.user && String(candidateEmp.user) === String(assignee.user)) return false;

        const aLevel = assignee.level ?? assignee.designation_level;
        const cLevel = candidateEmp.level ?? candidateEmp.designation_level;

        // If assignee has no level set, any candidate with a defined rank/level is higher
        if (aLevel == null) {
            return cLevel != null;
        }

        // Candidate must have a defined level
        if (cLevel == null) return false;

        // Numerical rank: Level 1 is highest rank.
        // Higher rank = strictly lower number. Peers (equal level) and juniors (higher level) are excluded.
        return Number(cLevel) < Number(aLevel);
    }, []);

    const eligibleSingleApprovers = useMemo(() => {
        if (!selectedAssignee) return [];
        return singleDeptEmployees.filter(emp => isHigherEmployee(emp, selectedAssignee));
    }, [singleDeptEmployees, selectedAssignee, isHigherEmployee]);

    const eligibleMultiApprovers = useMemo(() => {
        if (!selectedAssignee) return {};
        const map = {};
        for (const deptId in multiDeptEmployees) {
            map[deptId] = (multiDeptEmployees[deptId] || []).filter(emp => isHigherEmployee(emp, selectedAssignee));
        }
        return map;
    }, [multiDeptEmployees, selectedAssignee, isHigherEmployee]);

    const eligibleBods = useMemo(() => {
        if (!selectedAssignee) return bods;
        return bods.filter(b => {
            if (b.user && selectedAssignee.user && String(b.user) === String(selectedAssignee.user)) return false;
            if (b.employee_profile_id && String(b.employee_profile_id) === String(selectedAssignee.id)) return false;
            return true;
        });
    }, [bods, selectedAssignee]);

    const eligibleHods = useMemo(() => {
        if (!selectedAssignee) return hods;
        return hods.filter(h => {
            if (String(h.id) === String(selectedAssignee.id)) return false;
            if (h.user && selectedAssignee.user && String(h.user) === String(selectedAssignee.user)) return false;
            const aLevel = selectedAssignee.level ?? selectedAssignee.designation_level;
            const hLevel = h.level ?? h.designation_level;
            if (aLevel != null && hLevel != null && Number(hLevel) >= Number(aLevel)) {
                return false;
            }
            return true;
        });
    }, [hods, selectedAssignee]);

    // Clean up selectedHod if no longer eligible
    useEffect(() => {
        if (selectedHod) {
            if (!selectedAssignee) {
                setSelectedHod('');
            } else if (!eligibleHods.some(h => String(h.id) === String(selectedHod))) {
                setSelectedHod('');
            }
        }
    }, [selectedAssignee, eligibleHods, selectedHod]);

    // Clean up singleEmployee if no longer eligible
    useEffect(() => {
        if (singleEmployee) {
            if (!selectedAssignee) {
                setSingleEmployee('');
            } else {
                const found = singleDeptEmployees.find(e => String(e.id) === String(singleEmployee));
                if (!found || !isHigherEmployee(found, selectedAssignee)) {
                    setSingleEmployee('');
                }
            }
        }
    }, [selectedAssignee, singleDeptEmployees, singleEmployee, isHigherEmployee]);

    // Clean up multiEmployees if no longer eligible
    useEffect(() => {
        if (multiEmployees.length > 0) {
            if (!selectedAssignee) {
                setMultiEmployees([]);
            } else {
                setMultiEmployees(prev => prev.filter(empId => {
                    for (const deptId in multiDeptEmployees) {
                        const found = (multiDeptEmployees[deptId] || []).find(e => String(e.id) === String(empId));
                        if (found && isHigherEmployee(found, selectedAssignee)) {
                            return true;
                        }
                    }
                    return false;
                }));
            }
        }
    }, [selectedAssignee, multiDeptEmployees, isHigherEmployee]);

    // ---- submit ----
    const resetForm = () => {
        setCategory(''); setSubcategory(''); setTask('');
        setAssignDept(''); setAssignedEmployee('');
        setApprovalType(''); setSelectedBod(''); setSelectedHod('');
        setSingleDept(''); setSingleDeptEmployees([]); setSingleEmployee('');
        setMultiDepts([]); setMultiDeptEmployees({}); setMultiEmployees([]);
        setCutoffDate('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!task || !assignDept || !assignedEmployee || !approvalType || !cutoffDate) {
            Swal.fire('Missing info', 'Please fill task, assignee and approval details.', 'warning');
            return;
        }

        const payload = {
            task,
            assigned_department: assignDept,
            assigned_employee: assignedEmployee,
            approval_type: approvalType,
            cutoff_date: cutoffDate,
        };

        if (approvalType === 'bod') {
            if (!selectedBod) {
                Swal.fire('Missing info', 'Select a BOD approver.', 'warning');
                return;
            }
            payload.bod_ids = [selectedBod];
        } else if (approvalType === 'hod') {
            if (!selectedHod) {
                Swal.fire('Missing info', 'Select an HOD approver.', 'warning');
                return;
            }
            payload.employee_ids = [selectedHod];
        } else if (approvalType === 'single') {
            if (!singleEmployee) {
                Swal.fire('Missing info', 'Select an approver.', 'warning');
                return;
            }
            payload.employee_ids = [singleEmployee];
        } else if (approvalType === 'multiple') {
            if (multiEmployees.length === 0) {
                Swal.fire('Missing info', 'Select at least one approver.', 'warning');
                return;
            }
            payload.employee_ids = multiEmployees;
        }

        setSaving(true);
        try {
            await createTaskVoteRequest(payload);
            Swal.fire('Success', 'Task sent for approval.', 'success');
            resetForm();
            loadSentRequests();
        } catch (err) {
            Swal.fire(
                'Error',
                err.response?.data?.detail || 'Failed to send task for approval',
                'error'
            );
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Card className="p-4">
                <div className="text-center py-5">
                    <span className="spinner-border" role="status" aria-hidden="true"></span>
                    <p className="mt-2 text-muted">Loading...</p>
                </div>
            </Card>
        );
    }

    return (
        <>
        <Card className="p-4">
            <h4 className="mb-4">Assign Task &amp; Send for Approval</h4>

            <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-4">
            <Tab eventKey="create" title="New Request">
            <Form onSubmit={handleSubmit} className="pt-3">

                {/* Task / Category / Sub-Category */}
                <Row className="mb-3">
                    <Col md={4}>
                        <Form.Label>Task</Form.Label>
                        <Form.Select
                            value={task}
                            onChange={e => handleTaskChange(e.target.value)}
                        >
                            <option value="">Select task...</option>
                            {tasks.map(t => (
                                <option key={t.id} value={t.id}>{t.task_name}</option>
                            ))}
                        </Form.Select>
                    </Col>
                    <Col md={4}>
                        <Form.Label>Category</Form.Label>
                        <Form.Select
                            value={category}
                            disabled
                        >
                            <option value="">Select category...</option>
                            {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.category_name}</option>
                            ))}
                        </Form.Select>
                    </Col>
                    <Col md={4}>
                        <Form.Label>Sub-Category</Form.Label>
                        <Form.Select
                            value={subcategory}
                            disabled
                        >
                            <option value="">Select sub-category...</option>
                            {allSubcategories.map(s => (
                                <option key={s.id} value={s.id}>{s.subcategory_name}</option>
                            ))}
                        </Form.Select>
                    </Col>
                </Row>

                {/* Assign to department / employee */}
                <Row className="mb-3">
                    <Col md={4}>
                        <Form.Label>Department</Form.Label>
                        <Form.Select value={assignDept} onChange={e => setAssignDept(e.target.value)}>
                            <option value="">Select department...</option>
                            {departments.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </Form.Select>
                    </Col>
                    <Col md={8}>
                        <Form.Label>Assign Task To</Form.Label>
                        <div className="d-flex flex-wrap gap-3">
                            {assignEmployees.map(emp => (
                                <Form.Check
                                    key={emp.id}
                                    type="radio"
                                    name="assignedEmployee"
                                    id={`assignee-${emp.id}`}
                                    label={emp.name || emp.full_name || `Employee #${emp.id}`}
                                    checked={String(assignedEmployee) === String(emp.id)}
                                    onChange={() => setAssignedEmployee(emp.id)}
                                />
                            ))}
                            {assignDept && assignEmployees.length === 0 && (
                                <span className="text-muted">No employees in this department</span>
                            )}
                        </div>
                    </Col>
                </Row>

                <hr />

                {/* Approval type */}
                <Form.Label className="d-block fw-bold">Send For Approval To</Form.Label>
                <div className="d-flex gap-4 mb-3">
                    <Form.Check
                        type="radio" name="approvalType" id="approval-bod" label="BOD"
                        checked={approvalType === 'bod'} onChange={() => setApprovalType('bod')}
                    />
                    <Form.Check
                        type="radio" name="approvalType" id="approval-hod" label="HOD"
                        checked={approvalType === 'hod'} onChange={() => setApprovalType('hod')}
                    />
                    <Form.Check
                        type="radio" name="approvalType" id="approval-single" label="Single"
                        checked={approvalType === 'single'} onChange={() => setApprovalType('single')}
                    />
                    <Form.Check
                        type="radio" name="approvalType" id="approval-multiple" label="Multiple"
                        checked={approvalType === 'multiple'} onChange={() => setApprovalType('multiple')}
                    />
                </div>

                {/* BOD block */}
                {approvalType === 'bod' && (
                    <div className="mb-3">
                        <Form.Label>Select BOD</Form.Label>
                        <div className="d-flex flex-column gap-2">
                            {eligibleBods.map(b => (
                                <Form.Check
                                    key={b.id}
                                    type="radio"
                                    name="bodApprover"
                                    id={`bod-${b.id}`}
                                    label={b.name}
                                    checked={String(selectedBod) === String(b.id)}
                                    onChange={() => setSelectedBod(b.id)}
                                />
                            ))}
                            {eligibleBods.length === 0 && <span className="text-muted">No BOD members found</span>}
                        </div>
                    </div>
                )}

                {/* HOD block */}
                {approvalType === 'hod' && (
                    <div className="mb-3">
                        <Form.Label>Select HOD</Form.Label>
                        <div className="d-flex flex-column gap-2">
                            {eligibleHods.map(h => (
                                <Form.Check
                                    key={h.id}
                                    type="radio"
                                    name="hodApprover"
                                    id={`hod-${h.id}`}
                                    label={`${h.full_name || h.name || 'HOD'}${h.department_name ? ` (${h.department_name})` : ''}`}
                                    checked={String(selectedHod) === String(h.id)}
                                    onChange={() => setSelectedHod(h.id)}
                                />
                            ))}
                            {eligibleHods.length === 0 && (
                                <span className="text-muted">
                                    {selectedAssignee ? 'No higher HOD members available for this employee' : 'No HOD members found'}
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* SINGLE block */}
                {approvalType === 'single' && (
                    <Row className="mb-3">
                        <Col md={4}>
                            <Form.Label>Department</Form.Label>
                            <div className="d-flex flex-column gap-2">
                                {departments.map(d => (
                                    <Form.Check
                                        key={d.id}
                                        type="radio"
                                        name="singleDept"
                                        id={`single-dept-${d.id}`}
                                        label={d.name}
                                        checked={String(singleDept) === String(d.id)}
                                        onChange={() => setSingleDept(d.id)}
                                    />
                                ))}
                            </div>
                        </Col>
                        <Col md={8}>
                            <Form.Label>Approver</Form.Label>
                            {!assignedEmployee ? (
                                <div className="alert alert-warning py-2 mb-0" style={{ fontSize: '13px' }}>
                                    <i className="fa fa-info-circle me-1"></i>
                                    Please select an employee in <strong>"Assign Task To"</strong> first to view eligible higher-level approvers.
                                </div>
                            ) : (
                                <div className="d-flex flex-wrap gap-3">
                                    {eligibleSingleApprovers.map(emp => (
                                        <Form.Check
                                            key={emp.id}
                                            type="radio"
                                            name="singleEmployee"
                                            id={`single-emp-${emp.id}`}
                                            label={emp.name || emp.full_name || `Employee #${emp.id}`}
                                            checked={String(singleEmployee) === String(emp.id)}
                                            onChange={() => setSingleEmployee(emp.id)}
                                        />
                                    ))}
                                    {singleDept && eligibleSingleApprovers.length === 0 && (
                                        <span className="text-muted">
                                            {assigneeLevel === 1
                                                ? 'Selected employee is at the highest designation level (Level 1). No employees are higher; please use BOD approval mode.'
                                                : 'No higher-level employees found in this department (peers and juniors excluded).'}
                                        </span>
                                    )}
                                </div>
                            )}
                        </Col>
                    </Row>
                )}

                {/* MULTIPLE block */}
                {approvalType === 'multiple' && (
                    <Row className="mb-3">
                        <Col md={4}>
                            <Form.Label>Departments</Form.Label>
                            <div className="d-flex flex-column gap-2">
                                {departments.map(d => (
                                    <Form.Check
                                        key={d.id}
                                        type="checkbox"
                                        id={`multi-dept-${d.id}`}
                                        label={d.name}
                                        checked={multiDepts.includes(d.id)}
                                        onChange={() => toggleMultiDept(d.id)}
                                    />
                                ))}
                            </div>
                        </Col>
                        <Col md={8}>
                            <Form.Label>Approvers</Form.Label>
                            {!assignedEmployee ? (
                                <div className="alert alert-warning py-2 mb-0" style={{ fontSize: '13px' }}>
                                    <i className="fa fa-info-circle me-1"></i>
                                    Please select an employee in <strong>"Assign Task To"</strong> first to view eligible higher-level approvers.
                                </div>
                            ) : (
                                <>
                                    {multiDepts.length === 0 && (
                                        <div className="text-muted">Check a department to see its eligible higher-level employees</div>
                                    )}
                                    {multiDepts.map(deptId => {
                                        const dept = departments.find(d => String(d.id) === String(deptId));
                                        const emps = eligibleMultiApprovers[deptId] || [];
                                        return (
                                            <div key={deptId} className="mb-2">
                                                <strong>{dept?.name}</strong>
                                                <div className="d-flex flex-wrap gap-3">
                                                    {emps.map(emp => (
                                                        <Form.Check
                                                            key={emp.id}
                                                            type="checkbox"
                                                            id={`multi-emp-${emp.id}`}
                                                            label={emp.name || emp.full_name || `Employee #${emp.id}`}
                                                            checked={multiEmployees.includes(emp.id)}
                                                            onChange={() => toggleMultiEmployee(emp.id)}
                                                        />
                                                    ))}
                                                    {emps.length === 0 && (
                                                        <span className="text-muted">
                                                            {assigneeLevel === 1
                                                                ? 'No higher-level employees (assignee is Level 1).'
                                                                : 'No higher-level employees found (peers and juniors excluded).'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </Col>
                    </Row>
                )}

                <hr />

                {/* Cutoff date */}
                <Row className="mb-4">
                    <Col md={4}>
                        <Form.Label>
                            Cutoff Date &amp; Time (Last Date to Vote) <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                            type="datetime-local"
                            value={cutoffDate}
                            min={new Date().toISOString().slice(0, 16)}
                            onChange={e => setCutoffDate(e.target.value)}
                            required
                        />
                    </Col>
                </Row>

                <Button type="submit" disabled={saving}>
                    {saving ? 'Sending...' : 'Send Task for Approval'}
                </Button>
            </Form>
            </Tab>

            <Tab eventKey="sent" title="Screening Status">
                <div className="pt-3">
                    {loadingSent ? (
                        <div className="text-center py-5">
                            <Spinner animation="border" role="status" />
                            <p className="mt-2 text-muted">Loading...</p>
                        </div>
                    ) : sentRequests.length === 0 ? (
                        <p className="text-muted mb-0">You haven't sent any tasks for approval yet.</p>
                    ) : (
                        <div className="table-responsive">
                            <Table hover className="align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>Task Name</th>
                                        <th>Assigned To</th>
                                        <th>Approval Type</th>
                                        <th>Progress</th>
                                        <th>Votes (Yes / No)</th>
                                        <th>Result</th>
                                        <th>Cutoff Date</th>
                                        <th className="text-end">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sentRequests.map((vr) => (
                                        <tr key={vr.id}>
                                            <td className="fw-semibold">{vr.task_name || '—'}</td>
                                            <td>
                                                {vr.assigned_employee_name || '—'}
                                                {vr.assigned_department_name ? ` (${vr.assigned_department_name})` : ''}
                                            </td>
                                            <td className="text-uppercase">{vr.approval_type || '—'}</td>
                                            <td>
                                                {vr.result_status === 'approved' ? (
                                                    <div style={{ minWidth: '100px' }}>
                                                        <div className="d-flex justify-content-between mb-1" style={{ fontSize: '11px', fontWeight: 600 }}>
                                                            <span>{Number(vr.completed_percentage || 0).toFixed(0)}%</span>
                                                        </div>
                                                        <ProgressBar
                                                            now={Number(vr.completed_percentage || 0)}
                                                            variant={Number(vr.completed_percentage || 0) >= 100 ? 'success' : 'primary'}
                                                            style={{ height: '6px' }}
                                                        />
                                                    </div>
                                                ) : (
                                                    <span className="text-muted small">—</span>
                                                )}
                                            </td>
                                            <td>
                                                <span className="text-success fw-semibold">{vr.yes_count ?? 0}</span>
                                                {' / '}
                                                <span className="text-danger fw-semibold">{vr.no_count ?? 0}</span>
                                            </td>
                                            <td><ResultStatusBadge status={vr.result_status} /></td>
                                            <td>{formatDate(vr.cutoff_date)}</td>
                                            <td className="text-end">
                                                <div className="d-flex justify-content-end gap-2 align-items-center">
                                                    <Button
                                                        variant="outline-primary"
                                                        size="sm"
                                                        onClick={() => setSelectedRequest(vr)}
                                                        title="View voting breakdown"
                                                    >
                                                        <Eye size={16} />
                                                    </Button>
                                                    {hasVotedAndPending(vr) && (
                                                        <Button
                                                            variant="outline-warning"
                                                            size="sm"
                                                            onClick={() => openRescheduleModal(vr)}
                                                            title="Reschedule voting request to same persons"
                                                        >
                                                            <RotateCcw size={16} />
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </div>
            </Tab>
            </Tabs>
        </Card>

        {/* Per-voter breakdown modal, shown on the Assigned-By side */}
        <Modal show={!!selectedRequest} onHide={() => setSelectedRequest(null)} centered size="lg">
            <Modal.Header closeButton>
                <Modal.Title>Voting Status</Modal.Title>
            </Modal.Header>
            {selectedRequest && (
                <Modal.Body className="p-4">
                    <div className="mb-3">
                        <h5 className="fw-bold mb-2">{selectedRequest.task_name}</h5>
                        <div className="d-flex gap-2 align-items-center mb-2">
                            <ResultStatusBadge status={selectedRequest.result_status} />
                            <span className="text-muted small text-uppercase">{selectedRequest.approval_type}</span>
                            {hasVotedAndPending(selectedRequest) && (
                                <Button
                                    variant="warning"
                                    size="sm"
                                    style={{ fontSize: '12px', padding: '2px 8px' }}
                                    onClick={() => openRescheduleModal(selectedRequest)}
                                >
                                    Reschedule Voting
                                </Button>
                            )}
                        </div>
                        <div className="text-muted small">
                            Assigned To <strong>{selectedRequest.assigned_employee_name || '—'}</strong>
                            {' · '}Cutoff <strong>{formatDate(selectedRequest.cutoff_date)}</strong>
                            {selectedRequest.remarks && (
                                <span className="d-block mt-1 text-dark">
                                    <strong>Reschedule Note:</strong> {selectedRequest.remarks}
                                </span>
                            )}
                        </div>
                    </div>

                    {selectedRequest.result_status === 'approved' && (
                        <div className="p-3 mb-3 rounded" style={{ backgroundColor: '#f8f9fa', border: '1px solid #e2e8f0' }}>
                            <div className="d-flex justify-content-between align-items-center mb-1">
                                <span className="fw-bold small text-uppercase" style={{ color: '#475569', letterSpacing: '0.5px' }}>
                                    Overall Task Progress
                                </span>
                                <span className="fw-bold" style={{ color: '#2563eb', fontSize: '14px' }}>
                                    {Number(selectedRequest.completed_percentage || 0).toFixed(1)}%
                                </span>
                            </div>
                            <ProgressBar
                                now={Number(selectedRequest.completed_percentage || 0)}
                                variant={Number(selectedRequest.completed_percentage || 0) >= 100 ? 'success' : 'primary'}
                                style={{ height: '8px', borderRadius: '4px' }}
                            />
                            <div className="text-muted mt-1" style={{ fontSize: '11px' }}>
                                True auto-calculated progress aggregated from all subtasks and delegation assignments.
                            </div>
                        </div>
                    )}

                    <div className="table-responsive">
                        <Table size="sm" className="align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>Voter</th>
                                    <th>Status</th>
                                    <th>Remarks</th>
                                    <th>Voted At</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(selectedRequest.voters || []).map(v => (
                                    <tr key={v.id}>
                                        <td className="fw-semibold">{v.voter_name || '—'}</td>
                                        <td><VoteBadge vote={v.vote} /></td>
                                        <td className="text-muted">{v.remarks || '—'}</td>
                                        <td>{v.voted_at ? new Date(v.voted_at).toLocaleString() : '—'}</td>
                                    </tr>
                                ))}
                                {(selectedRequest.voters || []).length === 0 && (
                                    <tr><td colSpan={4} className="text-muted text-center py-3">No voters found.</td></tr>
                                )}
                            </tbody>
                        </Table>
                    </div>
                </Modal.Body>
            )}
            <Modal.Footer className="d-flex justify-content-between align-items-center">
                <div>
                    {hasVotedAndPending(selectedRequest) && (
                        <Button
                            variant="warning"
                            size="sm"
                            onClick={() => openRescheduleModal(selectedRequest)}
                        >
                            Reschedule Voting
                        </Button>
                    )}
                </div>
                <Button variant="secondary" size="sm" onClick={() => setSelectedRequest(null)}>Close</Button>
            </Modal.Footer>
        </Modal>

        {/* Dedicated Reschedule Modal */}
        <Modal
            show={!!rescheduleTarget}
            onHide={() => !rescheduling && setRescheduleTarget(null)}
            centered
        >
            <Modal.Header closeButton className="border-0 pb-0">
                <div className="d-flex align-items-center gap-3">
                    <div
                        style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            backgroundColor: 'rgba(245, 158, 11, 0.15)',
                            color: '#d97706',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}
                    >
                        <RotateCcw size={22} />
                    </div>
                    <div>
                        <Modal.Title className="fw-bold h5 mb-0" style={{ color: '#1e293b' }}>Reschedule Voting Request</Modal.Title>
                        <small className="text-muted">Set a new cutoff deadline to notify approvers</small>
                    </div>
                </div>
            </Modal.Header>
            <Form onSubmit={handleConfirmReschedule}>
                <Modal.Body className="pt-3 pb-3">
                    {rescheduleTarget && (
                        <div className="mb-3 p-3 rounded" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                            <div className="fw-semibold text-dark">{rescheduleTarget.task_name}</div>
                            <small className="text-muted d-block mt-1">
                                Assigned To: <strong>{rescheduleTarget.assigned_employee_name || '—'}</strong>
                            </small>
                        </div>
                    )}
                    <Form.Group>
                        <Form.Label className="fw-semibold small text-uppercase text-secondary mb-1">
                            New Cutoff Date &amp; Time <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                            type="datetime-local"
                            value={newCutoffDate}
                            min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                            onChange={(e) => setNewCutoffDate(e.target.value)}
                            required
                            style={{
                                borderRadius: '8px',
                                padding: '10px 14px',
                                borderColor: '#cbd5e1',
                                fontSize: '14px'
                            }}
                        />
                        <Form.Text className="text-muted small mt-2 d-block">
                            Voting will be reopened for the same approvers until this new cutoff time.
                        </Form.Text>
                    </Form.Group>

                    <Form.Group className="mt-3">
                        <Form.Label className="fw-semibold small text-uppercase text-secondary mb-1">
                            Remarks / Reschedule Note
                        </Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={3}
                            value={rescheduleRemarks}
                            onChange={(e) => setRescheduleRemarks(e.target.value)}
                            autoCapitalize="off"
                            autoCorrect="off"
                            spellCheck="false"
                            style={{
                                borderRadius: '8px',
                                padding: '10px 14px',
                                borderColor: '#cbd5e1',
                                fontSize: '14px',
                                textTransform: 'none'
                            }}
                        />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer className="border-0 pt-0 pb-4 pe-4">
                    <Button
                        variant="light"
                        onClick={() => setRescheduleTarget(null)}
                        disabled={rescheduling}
                        style={{ borderRadius: '6px', fontWeight: 500, padding: '8px 18px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={rescheduling || !newCutoffDate}
                        style={{
                            borderRadius: '6px',
                            fontWeight: 600,
                            color: '#ffffff',
                            backgroundColor: '#f59e0b',
                            borderColor: '#f59e0b',
                            padding: '8px 20px'
                        }}
                    >
                        {rescheduling ? 'Rescheduling...' : 'Confirm Reschedule'}
                    </Button>
                </Modal.Footer>
            </Form>
        </Modal>
        </>
    );
};

export default AssignTaskVotePage; 