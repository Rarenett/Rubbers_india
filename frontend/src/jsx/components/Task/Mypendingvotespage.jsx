import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Modal, Spinner, Row, Col, Form } from 'react-bootstrap';
import { Eye } from 'lucide-react';
import Swal from 'sweetalert2';
import axiosInstance from '../../../services/AxiosInstance';
import { getMyPendingVotes, castVote, rescheduleTaskVoteRequest } from '../../../services/TaskService';

const formatDate = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    return isNaN(date) ? d : date.toLocaleString();
};

const renderStatusBadge = (isOpen) => (
    <span
        style={{
            backgroundColor: isOpen ? 'rgba(40, 167, 69, 0.15)' : 'rgba(108, 117, 125, 0.15)',
            color: isOpen ? '#28a745' : '#6c757d',
            fontWeight: 600,
            fontSize: '12px',
            padding: '4px 10px',
            borderRadius: '4px',
            display: 'inline-block'
        }}
    >
        {isOpen ? 'Open' : 'Closed'}
    </span>
);

const renderApprovalBadge = (approvalType) => (
    <span
        style={{
            backgroundColor: 'rgba(13, 110, 253, 0.15)',
            color: '#0d6efd',
            fontWeight: 600,
            fontSize: '12px',
            padding: '4px 10px',
            borderRadius: '4px',
            display: 'inline-block',
            textTransform: 'uppercase'
        }}
    >
        {approvalType || '—'}
    </span>
);

const renderVoteBadge = (vote) => {
    const isVoted = vote === 'yes' || vote === 'no';
    const bg = isVoted ? 'rgba(40, 167, 69, 0.15)' : 'rgba(255, 193, 7, 0.15)';
    const color = isVoted ? '#28a745' : '#b58105';
    const label = isVoted ? 'Voted' : 'Not voted yet';
    return (
        <span
            style={{
                backgroundColor: bg,
                color: color,
                fontWeight: 600,
                fontSize: '12px',
                padding: '4px 10px',
                borderRadius: '4px',
                display: 'inline-block'
            }}
        >
            {label}
        </span>
    );
};

const MyPendingVotesPage = () => {
    const [voteRequests, setVoteRequests] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [votingId, setVotingId] = useState(null);
    const [selectedVote, setSelectedVote] = useState(null);
    const [remarks, setRemarks] = useState('');

    const loadVotes = useCallback(() => {
        setLoading(true);
        Promise.all([
            getMyPendingVotes().catch(() => []),
            axiosInstance.get('/api/hr/departments/').then(r => r.data).catch(() => []),
        ])
            .then(([data, deptData]) => {
                const list = data.results || data || [];
                const sorted = [...list].sort((a, b) => {
                    const aVoted = a.my_vote === 'yes' || a.my_vote === 'no';
                    const bVoted = b.my_vote === 'yes' || b.my_vote === 'no';
                    if (aVoted !== bVoted) {
                        return aVoted ? 1 : -1;
                    }
                    const da = a.cutoff_date ? new Date(a.cutoff_date).getTime() : Infinity;
                    const db = b.cutoff_date ? new Date(b.cutoff_date).getTime() : Infinity;
                    return da - db;
                });
                setVoteRequests(sorted);
                setDepartments(deptData.results || deptData || []);
            })
            .catch(() => {
                Swal.fire('Error', 'Failed to load your pending votes.', 'error');
                setVoteRequests([]);
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        loadVotes();
    }, [loadVotes]);

    const getDeptName = (vote) => {
        if (!vote) return '';
        if (vote.assigned_department_name) return vote.assigned_department_name;
        if (vote.assigned_department) {
            if (typeof vote.assigned_department === 'object') {
                return vote.assigned_department.name || vote.assigned_department.department_name || '';
            }
            const found = departments.find(d => String(d.id) === String(vote.assigned_department));
            if (found) return found.name || found.department_name;
        }
        return '';
    };

    const handleVote = async (voteRequestId, vote) => {
        setVotingId(voteRequestId);
        try {
            const updated = await castVote(voteRequestId, vote, remarks);
            Swal.fire('Success', `Your task has been ${vote === 'yes' ? 'Approved' : 'Rejected'}.`, 'success');
            loadVotes();
            // Keep the modal open with the refreshed vote AND the remark
            // that was just saved, so the voter can see it's actually
            // been recorded instead of the box going blank.
            const savedRemarks = updated?.remarks ?? remarks;
            setRemarks(savedRemarks);
            setSelectedVote(prev => (prev && String(prev.id) === String(voteRequestId)
                ? { ...prev, my_vote: updated?.vote ?? vote, my_remarks: savedRemarks }
                : prev));
        } catch (err) {
            Swal.fire(
                'Error',
                err.response?.data?.detail || 'Failed to cast your vote.',
                'error'
            );
        } finally {
            setVotingId(null);
        }
    };

    const hasVotedAndPending = (vr) => {
        if (!vr) return false;
        // Only show reschedule button after the cutoff due date and time
        const cutoffPassed = vr.cutoff_date ? new Date() > new Date(vr.cutoff_date) : false;
        if (!cutoffPassed) return false;

        const yesNo = (vr.yes_count ?? 0) + (vr.no_count ?? 0);
        const pending = vr.pending_count ?? 0;
        if (yesNo > 0 && pending > 0) return true;
        if (vr.voters && vr.voters.length > 0) {
            const hasVoted = vr.voters.some(v => v.vote === 'yes' || v.vote === 'no');
            const hasPending = vr.voters.some(v => v.vote === 'pending');
            return hasVoted && hasPending;
        }
        return false;
    };

    const handleReschedule = async (voteRequestId, currentCutoff) => {
        let initialDate = '';
        if (currentCutoff) {
            try {
                const dt = new Date(currentCutoff);
                if (!isNaN(dt)) {
                    initialDate = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                }
            } catch {}
        }
        const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

        const { value: newCutoff } = await Swal.fire({
            title: 'Reschedule Voting Request',
            html: `
                <div style="text-align: left; font-size: 14px; margin-bottom: 8px; color: #495057;">
                    Select a new cutoff date &amp; time to reschedule voting for the same persons:
                </div>
                <input type="datetime-local" id="swal-cutoff-date" class="swal2-input" style="width: 100%; margin: 0; box-sizing: border-box;" min="${nowLocal}" value="${initialDate}">
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Reschedule',
            cancelButtonText: 'Cancel',
            preConfirm: () => {
                const input = document.getElementById('swal-cutoff-date')?.value;
                if (!input) {
                    Swal.showValidationMessage('Please select a valid new cutoff date & time.');
                }
                return input;
            }
        });

        if (newCutoff) {
            try {
                const updated = await rescheduleTaskVoteRequest(voteRequestId, newCutoff);
                Swal.fire('Rescheduled!', 'Voting request has been rescheduled to the same persons.', 'success');
                loadVotes();
                if (selectedVote && String(selectedVote.id) === String(voteRequestId)) {
                    setSelectedVote(updated);
                }
            } catch (err) {
                Swal.fire('Error', err.response?.data?.detail || 'Failed to reschedule voting request.', 'error');
            }
        }
    };

    if (loading) {
        return (
            <Card className="p-4">
                <div className="text-center py-5">
                    <Spinner animation="border" role="status" />
                    <p className="mt-2 text-muted">Loading...</p>
                </div>
            </Card>
        );
    }

    return (
        <>
            <Card className="p-4">
                <h4 className="mb-4">My Pending Votes</h4>

                {voteRequests.length === 0 ? (
                    <p className="text-muted mb-0">You have no pending votes right now.</p>
                ) : (
                    <div className="table-responsive">
                        <Table hover className="align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>Task Name</th>
                                    <th>Assigned By</th>
                                    <th>Approval Type</th>
                                    <th>Status</th>
                                    <th>Your Vote</th>
                                    <th>Cutoff Date</th>
                                    <th className="text-end">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {voteRequests.map((vr) => (
                                    <tr key={vr.id}>
                                        <td className="fw-semibold">{vr.task_name || '—'}</td>
                                        <td>{vr.created_by_name || '—'}</td>
                                        <td>{renderApprovalBadge(vr.approval_type)}</td>
                                        <td>{renderStatusBadge(vr.is_open)}</td>
                                        <td>{renderVoteBadge(vr.my_vote)}</td>
                                        <td>{formatDate(vr.cutoff_date)}</td>
                                        <td className="text-end">
                                            <Button
                                                variant="outline-primary"
                                                size="sm"
                                                onClick={() => { setSelectedVote(vr); setRemarks(vr.my_remarks || ''); }}
                                                title="View Details"
                                            >
                                                <Eye size={16} />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </div>
                )}
            </Card>

            {/* Details & Action Modal */}
            <Modal show={!!selectedVote} onHide={() => { setSelectedVote(null); setRemarks(''); }} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Task Vote Request Details</Modal.Title>
                </Modal.Header>
                {selectedVote && (
                    <>
                        <Modal.Body className="p-4">
                            <div className="mb-3">
                                <h4 className="fw-bold mb-2">{selectedVote.task_name}</h4>
                                <div className="d-flex gap-2 align-items-center mb-3">
                                    {renderStatusBadge(selectedVote.is_open)}
                                    {renderApprovalBadge(selectedVote.approval_type)}
                                    {renderVoteBadge(selectedVote.my_vote)}
                                </div>
                            </div>

                            {selectedVote.task_description && (
                                <div className="mb-3">
                                    <label className="text-muted small font-weight-bold text-uppercase mb-1">Description</label>
                                    <p className="mb-0 bg-light p-3 rounded">{selectedVote.task_description}</p>
                                </div>
                            )}

                            <Row className="g-3">
                                <Col md={6}>
                                    <label className="text-muted small font-weight-bold text-uppercase mb-1">Assigned By</label>
                                    <div className="fw-semibold">{selectedVote.created_by_name || '—'}</div>
                                </Col>
                                <Col md={6}>
                                    <label className="text-muted small font-weight-bold text-uppercase mb-1">Assigned To</label>
                                    <div className="fw-semibold">
                                        {selectedVote.assigned_employee_name || '—'}
                                        {getDeptName(selectedVote) ? ` (${getDeptName(selectedVote)})` : ''}
                                    </div>
                                </Col>
                                <Col md={6}>
                                    <label className="text-muted small font-weight-bold text-uppercase mb-1">Cutoff Date</label>
                                    <div className="fw-semibold">{formatDate(selectedVote.cutoff_date)}</div>
                                </Col>
                            </Row>

                            <Form.Group className="mt-3">
                                <Form.Label className="text-muted small font-weight-bold text-uppercase mb-1">
                                    Remarks {selectedVote.is_open && <span className="text-danger"></span>}
                                </Form.Label>
                                <Form.Control
                                    as="textarea"
                                    rows={3}
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    autoCapitalize="off"
                                    autoCorrect="off"
                                    spellCheck="false"
                                    style={{ textTransform: 'none' }}
                                    disabled={!(selectedVote.is_open && selectedVote.result_status !== 'approved' && selectedVote.result_status !== 'rejected') || votingId === selectedVote.id}
                                />
                            </Form.Group>
                        </Modal.Body>
                        <Modal.Footer className="d-flex justify-content-between">
                            <Button variant="secondary" size="sm" onClick={() => { setSelectedVote(null); setRemarks(''); }}>
                                Close
                            </Button>
                            {(selectedVote.is_open && selectedVote.result_status !== 'approved' && selectedVote.result_status !== 'rejected') ? (
                                <div className="d-flex gap-2">
                                    <Button
                                        variant={selectedVote.my_vote === 'yes' ? 'success' : 'outline-success'}
                                        size="sm"
                                        disabled={votingId === selectedVote.id}
                                        onClick={() => handleVote(selectedVote.id, 'yes')}
                                    >
                                        {votingId === selectedVote.id ? 'Submitting...' : selectedVote.my_vote === 'yes' ? 'Approved ✓' : 'Approve'}
                                    </Button>
                                    {hasVotedAndPending(selectedVote) && (
                                        <Button
                                            variant="warning"
                                            size="sm"
                                            onClick={() => handleReschedule(selectedVote.id, selectedVote.cutoff_date)}
                                        >
                                            Reschedule
                                        </Button>
                                    )}
                                    <Button
                                        variant={selectedVote.my_vote === 'no' ? 'danger' : 'outline-danger'}
                                        size="sm"
                                        disabled={votingId === selectedVote.id}
                                        onClick={() => handleVote(selectedVote.id, 'no')}
                                    >
                                        {votingId === selectedVote.id ? 'Submitting...' : selectedVote.my_vote === 'no' ? 'Rejected ✓' : 'Reject'}
                                    </Button>
                                </div>
                            ) : (
                                <span className="text-muted small">Voting closed</span>
                            )}
                        </Modal.Footer>
                    </>
                )}
            </Modal>
        </>
    );
};

export default MyPendingVotesPage;