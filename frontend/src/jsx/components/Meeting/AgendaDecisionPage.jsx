import React, { useState, useEffect, useRef, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Alert, Form, Modal, Button } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    getMeetingById,
    getAgendasWithComments,
    reviewComment,
    reviewAllComments,
    submitAgendaDecision,
    getMeetingParticipants,
    createAgendaTask,
    deleteAgendaTask
} from '../../../services/MeetingManagementService';
import { ThemeContext } from "../../../context/ThemeContext";

const AgendaDecisionPage = () => {
    const { id } = useParams();
    const { background } = useContext(ThemeContext);
    const isDark = background.value === "dark";

    const [meeting, setMeeting] = useState(null);
    const [agendas, setAgendas] = useState([]);
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [decisions, setDecisions] = useState({}); // { agendaId: text }
    const [saving, setSaving] = useState({}); // { agendaId: bool }
    const [editMode, setEditMode] = useState({}); // { agendaId: bool }
    const [currentAgendaIndex, setCurrentAgendaIndex] = useState(0);

    // Task Modal State
    const [showModal, setShowModal] = useState(false);
    const [currentAgendaId, setCurrentAgendaId] = useState(null);
    const [taskData, setTaskData] = useState({ title: '', description: '', assigned_to: '', due_date: '' });

    const fetchController = useRef(null);

    useEffect(() => {
        if (fetchController.current) fetchController.current.abort = true;
        const controller = { abort: false };
        fetchController.current = controller;

        const fetchData = async () => {
            try {
                setLoading(true);
                const [meetingData, agendaData, participantsData] = await Promise.all([
                    getMeetingById(id),
                    getAgendasWithComments(id),
                    getMeetingParticipants(id)
                ]);
                if (controller.abort) return;
                setMeeting(meetingData);
                setAgendas(agendaData);
                setParticipants(participantsData);

                // Pre-fill existing decisions and set editMode if decision exists
                const initDecisions = {};
                const initEditMode = {};
                agendaData.forEach(a => {
                    initDecisions[a.id] = a.host_decision || '';
                    initEditMode[a.id] = !a.host_decision; // If decision exists, not in edit mode by default
                });
                setDecisions(initDecisions);
                setEditMode(initEditMode);
            } catch (error) {
                if (controller.abort) return;
                console.error('Error loading agenda decisions:', error);
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load meeting details.' });
            } finally {
                if (!controller.abort) setLoading(false);
            }
        };
        fetchData();
        return () => { controller.abort = true; };
    }, [id]);

    /* ── handlers ── */

    const handleReview = async (commentId, agendaId) => {
        try {
            await reviewComment(commentId);
            const updated = await getAgendasWithComments(id);
            setAgendas(updated);
            Swal.fire({ icon: 'success', title: 'Reviewed', text: 'Comment marked as reviewed.', timer: 1500, showConfirmButton: false });
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to mark comment as reviewed.' });
        }
    };

    const handleReviewAll = async (agendaId) => {
        try {
            const result = await reviewAllComments(agendaId);
            if (result.agenda) {
                setAgendas(prev => prev.map(a => a.id === agendaId ? result.agenda : a));
            } else {
                const updated = await getAgendasWithComments(id);
                setAgendas(updated);
            }
            Swal.fire({ icon: 'success', title: 'All Reviewed', text: `${result.reviewed_count} comment(s) marked as reviewed.`, timer: 1500, showConfirmButton: false });
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to review all comments.' });
        }
    };

    const handleDecisionChange = (agendaId, value) => {
        setDecisions(prev => ({ ...prev, [agendaId]: value }));
    };

    const handlePrevAgenda = () => {
        if (currentAgendaIndex > 0) {
            setCurrentAgendaIndex(prev => prev - 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleNextAgenda = () => {
        if (currentAgendaIndex < agendas.length - 1) {
            setCurrentAgendaIndex(prev => prev + 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleSubmitDecision = async (agendaId) => {
        const text = decisions[agendaId]?.trim();
        if (!text) {
            Swal.fire({ icon: 'warning', title: 'Empty Decision', text: 'Please enter a decision before submitting.' });
            return;
        }
        try {
            setSaving(prev => ({ ...prev, [agendaId]: true }));
            const updatedAgenda = await submitAgendaDecision(agendaId, text);
            setAgendas(prev => prev.map(a => a.id === agendaId ? { ...a, ...updatedAgenda } : a));
            setEditMode(prev => ({ ...prev, [agendaId]: false }));
            Swal.fire({ icon: 'success', title: 'Decision Saved', timer: 1500, showConfirmButton: false });
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to save decision.' });
        } finally {
            setSaving(prev => ({ ...prev, [agendaId]: false }));
        }
    };

    // Task Modal Handlers
    const openTaskModal = (agendaId) => {
        setCurrentAgendaId(agendaId);
        setTaskData({ title: '', description: '', assigned_to: '', due_date: '' });
        setShowModal(true);
    };

    const handleAddTask = async () => {
        if (!taskData.title || !taskData.assigned_to) {
            Swal.fire({ icon: 'warning', title: 'Missing Info', text: 'Title and Assignee are required.' });
            return;
        }
        try {
            const payload = {
                agenda: currentAgendaId,
                title: taskData.title,
                description: taskData.description,
                assigned_to: taskData.assigned_to,
                due_date: taskData.due_date || null
            };
            await createAgendaTask(payload);

            // Refresh agendas
            const updated = await getAgendasWithComments(id);
            setAgendas(updated);

            setShowModal(false);
            Swal.fire({ icon: 'success', title: 'Task Assigned', timer: 1500, showConfirmButton: false });
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to create task.' });
        }
    };

    const handleDeleteTask = async (taskId) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#fe5131',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                await deleteAgendaTask(taskId);
                const updated = await getAgendasWithComments(id);
                setAgendas(updated);
                Swal.fire('Deleted!', 'Task has been deleted.', 'success');
            } catch (error) {
                Swal.fire('Error', 'Failed to delete task.', 'error');
            }
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return '#4CAF50';
            case 'in_progress': return '#2196F3';
            case 'pending': return '#ff9800';
            default: return '#9e9e9e';
        }
    };

    /* ── theme tokens ── */
    const T = {
        bg: isDark ? '#24292D' : '#f4f7fa',
        card: isDark ? '#2F363E' : '#fff',
        header: isDark ? '#2F363E' : '#fff',
        text: isDark ? '#e2e8f0' : '#1e293b',
        textBold: isDark ? '#fff' : '#1e293b',
        textMuted: isDark ? '#94a3b8' : '#64748b',
        border: isDark ? '#333a4d' : '#e1e8f0',
        borderLight: isDark ? '#333a4d' : '#f1f5f9',
        inputBg: isDark ? '#1a1f23' : '#fff',
        rowHover: isDark ? '#2d3339' : '#f9fafb',
        navBar: isDark ? '#2F363E' : '#fff',
        sectionBg: isDark ? '#1a1f23' : '#f1f5f9',
        taskBar: isDark ? '#2F363E' : '#f8fafc',
    };

    /* ── styles ── */
    const S = {
        page: {
            width: '100%', padding: '0 10px', backgroundColor: T.bg, minHeight: '100vh', transition: 'all 0.3s ease'
        },
        header: {
            background: T.header, borderRadius: '12px', padding: '20px 24px',
            marginBottom: '24px', display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', border: `1px solid ${T.border}`,
            boxShadow: isDark ? '0 4px 6px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.02)',
            transition: 'all 0.3s ease'
        },
        card: {
            background: T.card, borderRadius: '12px',
            boxShadow: isDark ? '0 10px 15px -3px rgba(0, 0, 0, 0.3)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            border: `1px solid ${T.border}`, width: '100%', overflow: 'hidden',
            transition: 'all 0.3s ease'
        },
        cardHeader: {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '18px 24px', background: isDark ? '#0f172a' : '#f8fafc', borderBottom: `1px solid ${T.border}`
        },
        badge: (bg) => ({
            background: bg, color: '#fff', borderRadius: '4px',
            padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.5px'
        }),
        commentRow: (isReviewed) => ({
            display: 'flex', gap: '14px', padding: '16px 20px',
            background: isReviewed ? T.rowHover : T.card,
            borderBottom: `1px solid ${T.borderLight}`, alignItems: 'flex-start'
        }),
        votePill: (vote) => ({
            background: vote === 'approve' ? (isDark ? '#064e3b' : '#dcfce7') : vote === 'reject' ? (isDark ? '#7f1d1d' : '#fee2e2') : (isDark ? '#334155' : '#f1f5f9'),
            color: vote === 'approve' ? (isDark ? '#6ee7b7' : '#166534') : vote === 'reject' ? (isDark ? '#fca5a5' : '#991b1b') : T.text,
            borderRadius: '6px', padding: '4px 10px', fontSize: '0.75rem',
            fontWeight: 700, border: `1px solid ${vote === 'approve' ? '#10b981' : vote === 'reject' ? '#ef4444' : T.border}`
        }),
        summaryContainer: {
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '12px', marginBottom: '24px', padding: '16px', background: isDark ? '#0f172a' : '#f8fafc',
            borderRadius: '10px', border: `1px solid ${T.border}`
        },
        summaryItem: (color) => ({
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '10px', background: T.card, borderRadius: '8px',
            border: `1px solid ${T.border}`, borderTop: `3px solid ${color}`
        }),
        textArea: {
            width: '100%', border: `1px solid ${T.border}`, borderRadius: '8px',
            padding: '14px', fontSize: '0.95rem', resize: 'vertical',
            outline: 'none', transition: 'border-color 0.2s', backgroundColor: T.inputBg, color: T.text
        },
        submitBtn: (disabled) => ({
            background: disabled ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none',
            borderRadius: '8px', padding: '12px 28px', fontWeight: 600, fontSize: '0.95rem',
            cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
            boxShadow: disabled ? 'none' : '0 4px 6px -1px rgba(37, 99, 235, 0.2)'
        }),
        taskSection: {
            marginTop: '24px', padding: '20px', background: T.card,
            borderRadius: '10px', border: `1px solid ${T.border}`
        },
        taskItem: {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px',
            background: T.taskBar, borderRadius: '8px', marginBottom: '8px', border: `1px solid ${T.border}`
        },
        navBar: {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: T.navBar, padding: '16px 24px', borderRadius: '12px',
            marginBottom: '20px', border: `1px solid ${T.border}`, boxShadow: isDark ? '0 4px 10px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.05)'
        },
        navBtn: (disabled) => ({
            background: disabled ? (isDark ? '#1e293b' : '#f8fafc') : T.card,
            color: disabled ? T.border : T.text,
            border: `1px solid ${T.border}`, borderRadius: '8px', padding: '10px 20px',
            fontWeight: 600, fontSize: '0.9rem', cursor: disabled ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s',
            boxShadow: disabled ? 'none' : '0 1px 2px rgba(0,0,0,0.05)'
        })
    };

    /* ── render ── */

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', width: '100%' }}>
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    return (
        <div style={S.page}>
            {/* Breadcrumb */}
            <div className="page-titles">
                <button 
                    onClick={() => window.history.back()} 
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div>

            {/* Header / Meeting Info */}
            <div style={S.header}>
                <div>
                    <h3 style={{ color: T.textBold, marginBottom: '4px', fontWeight: 800, fontSize: '1.4rem' }}>
                        {meeting?.meeting_title}
                    </h3>
                    <div style={{ color: T.textMuted, fontSize: '0.9rem', display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <span><i className="fa fa-calendar-o me-2"></i>{meeting?.meeting_date}</span>
                        <span style={{ opacity: 0.3 }}>|</span>
                        <span><i className="fa fa-clock-o me-2"></i>{meeting?.start_time} – {meeting?.end_time}</span>
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ background: isDark ? '#0f172a' : '#f1f5f9', borderRadius: '8px', padding: '6px 14px', color: T.textMuted, fontWeight: 700, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', border: `1px solid ${T.border}` }}>
                        <i className="fa fa-university me-2 text-primary"></i> ERP Decision Portal
                    </div>
                </div>
            </div>

            {/* Section Label */}
            <div className="d-flex align-items-center mb-4">
                <div style={{ width: '4px', height: '24px', background: '#2563eb', borderRadius: '2px', marginRight: '12px' }}></div>
                <h4 style={{ fontWeight: 800, margin: 0, color: T.textBold, fontSize: '1.1rem', letterSpacing: '-0.2px' }}>
                    AGENDA REVIEW &amp; RESOLUTION
                </h4>
            </div>

            {/* Agenda Navigation & Card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>
                {agendas.length === 0 ? (
                    <div style={S.card}><div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No agenda items found for this meeting.</div></div>
                ) : (
                    <>
                        {/* Navigation Bar */}
                        <div style={S.navBar}>
                            <button
                                onClick={handlePrevAgenda}
                                disabled={currentAgendaIndex === 0}
                                style={S.navBtn(currentAgendaIndex === 0)}
                            >
                                <i className="fa fa-arrow-left"></i> Previous
                            </button>

                            <div style={{ fontWeight: 800, color: T.textMuted, fontSize: '1rem' }}>
                                Agenda {currentAgendaIndex + 1} of {agendas.length}
                            </div>

                            <button
                                onClick={handleNextAgenda}
                                disabled={currentAgendaIndex === agendas.length - 1}
                                style={S.navBtn(currentAgendaIndex === agendas.length - 1)}
                            >
                                Next <i className="fa fa-arrow-right"></i>
                            </button>
                        </div>

                        {/* Current Agenda Card */}
                        {(() => {
                            const agenda = agendas[currentAgendaIndex];
                            const index = currentAgendaIndex;
                            return (
                                <div key={agenda.id} style={S.card}>
                                    {/* Header */}
                                    <div style={S.cardHeader}>
                                        <h5 style={{ margin: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ background: '#1e88e5', color: '#fff', borderRadius: '6px', padding: '2px 10px', fontSize: '0.85rem', fontWeight: 700 }}>
                                                {index + 1}
                                            </span>
                                            {agenda.points}
                                        </h5>
                                        {agenda.presenter_name && (
                                            <small style={{ color: '#1e88e5', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <i className="fa fa-user"></i> {agenda.presenter_name}
                                            </small>
                                        )}
                                    </div>

                                    {/* Body */}
                                    <div style={{ padding: '20px' }}>
                                        {agenda.details && (
                                            <p style={{ color: '#666', marginBottom: '16px', lineHeight: '1.6' }}>{agenda.details}</p>
                                        )}

                                        {agenda.file_upload_url && (
                                            <div className="mb-4">
                                                <a href={agenda.file_upload_url} target="_blank" rel="noopener noreferrer"
                                                    className="btn btn-outline-info btn-sm px-3" style={{ borderRadius: '8px' }}>
                                                    <i className="fa fa-paperclip me-2"></i> View Attached Document
                                                </a>
                                            </div>
                                        )}

                                        {/* Vote Summary Structured Grid */}
                                        {agenda.vote_summary && (
                                            <div style={S.summaryContainer}>
                                                <div style={S.summaryItem('#10b981')}>
                                                    <span style={{ fontSize: '0.7rem', color: T.textMuted, fontWeight: 700 }}>APPROVE</span>
                                                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: isDark ? '#6ee7b7' : '#065f46' }}>{agenda.vote_summary.approve}</span>
                                                </div>
                                                <div style={S.summaryItem('#ef4444')}>
                                                    <span style={{ fontSize: '0.7rem', color: T.textMuted, fontWeight: 700 }}>REJECT</span>
                                                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: isDark ? '#fca5a5' : '#991b1b' }}>{agenda.vote_summary.reject}</span>
                                                </div>
                                                <div style={S.summaryItem('#94a3b8')}>
                                                    <span style={{ fontSize: '0.7rem', color: T.textMuted, fontWeight: 700 }}>NEUTRAL</span>
                                                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: T.text }}>{agenda.vote_summary.neutral}</span>
                                                </div>
                                                <div style={S.summaryItem('#2563eb')}>
                                                    <span style={{ fontSize: '0.7rem', color: T.textMuted, fontWeight: 700 }}>TOTAL VOTES</span>
                                                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: isDark ? '#60a5fa' : '#1e3a8a' }}>{agenda.vote_summary.total}</span>
                                                </div>
                                                <div style={S.summaryItem('#f59e0b')}>
                                                    <span style={{ fontSize: '0.7rem', color: T.textMuted, fontWeight: 700 }}>PENDING</span>
                                                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: isDark ? '#fbbf24' : '#92400e' }}>{agenda.vote_summary.pending}</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Comments Table Structured */}
                                        <div style={{ border: `1px solid ${T.border}`, borderRadius: '12px', overflow: 'hidden', marginBottom: '30px', background: T.card }}>
                                            {/* Header row */}
                                            <div style={{ display: 'flex', background: isDark ? '#0f172a' : '#f1f5f9', padding: '14px 20px', fontWeight: 700, fontSize: '0.75rem', color: T.textMuted, borderBottom: `1px solid ${T.border}`, gap: '15px', alignItems: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                <div style={{ flex: '1 1 15%' }}>Participant</div>
                                                <div style={{ flex: '0 0 80px', textAlign: 'center' }}>Vote</div>
                                                <div style={{ flex: '1 1 50%' }}>Remarks &amp; Voice Input</div>
                                                <div style={{ flex: '0 0 100px', textAlign: 'center' }}>Status</div>
                                                <div style={{ flex: '0 0 100px', textAlign: 'center' }}>
                                                    {agenda.vote_summary && agenda.vote_summary.pending > 0 ? (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleReviewAll(agenda.id); }}
                                                            className="btn btn-warning btn-xs text-white"
                                                            style={{ fontSize: '0.7rem', fontWeight: 800, borderRadius: '4px', padding: '2px 8px' }}
                                                        >
                                                            REVIEW ALL
                                                        </button>
                                                    ) : 'ACTION'}
                                                </div>
                                            </div>
                                            {/* Table Content */}
                                            {(() => {
                                                const comments = agenda.comments || [];
                                                const transcriptions = agenda.audio_transcriptions || [];
                                                const participantMap = {};

                                                // Group by participant
                                                comments.forEach(c => {
                                                    participantMap[c.participant] = { ...c, audio: [] };
                                                });

                                                transcriptions.forEach(t => {
                                                    if (participantMap[t.user]) {
                                                        participantMap[t.user].audio.push(t);
                                                    } else {
                                                        participantMap[t.user] = {
                                                            id: `audio-${t.id}`,
                                                            participant: t.user,
                                                            participant_name: t.user_name,
                                                            vote: 'neutral',
                                                            remarks: '',
                                                            review_status: 'pending',
                                                            created_at: t.created_at,
                                                            audio: [t]
                                                        };
                                                    }
                                                });

                                                const integratedList = Object.values(participantMap).sort((a, b) =>
                                                    new Date(b.created_at) - new Date(a.created_at)
                                                );

                                                if (integratedList.length === 0) {
                                                    return (
                                                        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem', fontStyle: 'italic' }}>
                                                            No participant input recorded yet.
                                                        </div>
                                                    );
                                                }

                                                return integratedList.map(item => (
                                                    <div key={item.id} style={S.commentRow(item.review_status === 'reviewed')}>
                                                        <div style={{ flex: '1 1 15%', fontWeight: 700, fontSize: '0.9rem', color: T.textBold }}>
                                                            {item.participant_name || 'Unknown'}
                                                            <div style={{ fontSize: '0.75rem', color: T.textMuted, fontWeight: 500, marginTop: '2px' }}>
                                                                {item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                            </div>
                                                        </div>
                                                        <div style={{ flex: '0 0 80px', textAlign: 'center' }}>
                                                            <span style={S.votePill(item.vote)}>
                                                                {item.vote?.toUpperCase()}
                                                            </span>
                                                        </div>
                                                        <div style={{ flex: '1 1 50%', fontSize: '0.92rem', color: T.text, lineHeight: '1.5' }}>
                                                            {item.remarks && <div className="mb-2" style={{ fontWeight: 600 }}>{item.remarks}</div>}
                                                            {item.audio && item.audio.map(clip => (
                                                                <div key={clip.id} style={{ marginTop: '10px', background: isDark ? '#0f172a' : '#f8fafc', padding: '12px', borderRadius: '10px', border: `1px solid ${T.border}` }}>
                                                                    <audio controls src={clip.audio_file_url} style={{ width: '100%', height: '32px', marginBottom: '8px' }} />
                                                                    <div style={{ fontSize: '0.85rem', color: T.textMuted, display: 'flex', alignItems: 'flex-start', gap: '8px', paddingLeft: '4px' }}>
                                                                        <i className="fa fa-microphone" style={{ color: '#2563eb', marginTop: '3px', fontSize: '0.8rem' }}></i>
                                                                        <span style={{ fontStyle: 'italic' }}>"{clip.transcribed_text}"</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {!item.remarks && (!item.audio || item.audio.length === 0) && <span style={{ color: isDark ? '#475569' : '#cbd5e1' }}>No remarks</span>}
                                                        </div>
                                                        <div style={{ flex: '0 0 100px', textAlign: 'center' }}>
                                                            <span style={S.badge(item.review_status === 'reviewed' ? '#059669' : '#d97706')}>
                                                                {item.review_status === 'reviewed' ? 'Reviewed' : 'Pending'}
                                                            </span>
                                                        </div>
                                                        <div style={{ flex: '0 0 100px', textAlign: 'center' }}>
                                                            {item.review_status !== 'reviewed' ? (
                                                                <button
                                                                    className="btn btn-outline-primary btn-xs"
                                                                    onClick={() => handleReview(item.id, agenda.id)}
                                                                    style={{ borderRadius: '6px', fontWeight: 700, padding: '4px 10px' }}
                                                                >
                                                                    <i className="fa fa-check me-1"></i> Review
                                                                </button>
                                                            ) : (
                                                                <i className="fa fa-check-circle" style={{ color: '#059669', fontSize: '1.2rem' }}></i>
                                                            )}
                                                        </div>
                                                    </div>
                                                ));
                                            })()}
                                        </div>

                                        {/* Resolution / Decision Panel */}
                                        <div style={{ background: isDark ? '#0f172a' : '#f1f5f9', borderRadius: '16px', padding: '28px', border: `1px solid ${T.border}` }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={{ width: '40px', height: '40px', background: '#2563eb', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                                                        <i className="fa fa-gavel" style={{ fontSize: '1.2rem' }}></i>
                                                    </div>
                                                    <div>
                                                        <h6 style={{ margin: 0, fontWeight: 800, color: T.textBold, fontSize: '1.05rem' }}>Formal Resolution</h6>
                                                        <p style={{ margin: 0, fontSize: '0.75rem', color: T.textMuted, fontWeight: 600 }}>SUBMIT THE FINAL HOST DECISION</p>
                                                    </div>
                                                </div>
                                                {!editMode[agenda.id] && agenda.host_decision && (
                                                    <button
                                                        className="btn btn-white btn-sm shadow-sm"
                                                        onClick={() => setEditMode(prev => ({ ...prev, [agenda.id]: true }))}
                                                        style={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontWeight: 700, fontSize: '0.85rem' }}
                                                    >
                                                        <i className="fa fa-pencil me-2 text-primary"></i> Modify Decision
                                                    </button>
                                                )}
                                            </div>

                                            {editMode[agenda.id] ? (
                                                <div style={{ background: T.card, padding: '20px', borderRadius: '12px', border: `1px solid ${T.border}` }}>
                                                    <textarea
                                                        rows={5}
                                                        placeholder="As the host, please document the final decision or resolution reached for this agenda item..."
                                                        value={decisions[agenda.id] || ''}
                                                        onChange={e => handleDecisionChange(agenda.id, e.target.value)}
                                                        style={S.textArea}
                                                    />
                                                    <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
                                                        <button
                                                            onClick={() => handleSubmitDecision(agenda.id)}
                                                            disabled={saving[agenda.id]}
                                                            style={S.submitBtn(saving[agenda.id])}
                                                        >
                                                            {saving[agenda.id] ? (
                                                                <><i className="fa fa-spinner fa-spin me-2"></i>SUBMITTING...</>
                                                            ) : (
                                                                <><i className="fa fa-check-circle me-2"></i>SUBMIT RESOLUTION</>
                                                            )}
                                                        </button>
                                                        {agenda.host_decision && (
                                                            <button
                                                                className="btn btn-light"
                                                                style={{ borderRadius: '8px', padding: '10px 24px', fontWeight: 700, fontSize: '0.9rem' }}
                                                                onClick={() => {
                                                                    setDecisions(prev => ({ ...prev, [agenda.id]: agenda.host_decision }));
                                                                    setEditMode(prev => ({ ...prev, [agenda.id]: false }));
                                                                }}
                                                            >
                                                                DISCARD CHANGES
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{ padding: '24px', background: T.card, borderRadius: '14px', border: `1px solid ${T.border}`, boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.2)' : '0 2px 10px rgba(0,0,0,0.03)' }}>
                                                    <div style={{ position: 'relative', marginBottom: '15px' }}>
                                                        <i className="fa fa-quote-left" style={{ position: 'absolute', top: '-5px', left: '-10px', color: isDark ? '#2d3748' : '#e2e8f0', fontSize: '1.5rem' }}></i>
                                                        <p style={{ margin: 0, color: T.textBold, fontSize: '1.1rem', lineHeight: '1.7', fontWeight: 600, paddingLeft: '15px' }}>
                                                            {agenda.host_decision}
                                                        </p>
                                                    </div>
                                                    <hr style={{ borderTop: `1px dashed ${T.border}`, margin: '15px 0' }} />
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div style={{ display: 'flex', gap: '20px' }}>
                                                            <span style={{ fontSize: '0.8rem', color: T.textMuted, display: 'flex', alignItems: 'center' }}>
                                                                <i className="fa fa-user-circle me-2 text-primary"></i> <b style={{ color: T.text }}>{agenda.decision_added_by_name}</b>
                                                            </span>
                                                            <span style={{ fontSize: '0.8rem', color: T.textMuted, display: 'flex', alignItems: 'center' }}>
                                                                <i className="fa fa-clock-o me-2 text-primary"></i> {new Date(agenda.decision_added_at).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        <span className="badge bg-success-light text-success" style={{ fontWeight: 800, fontSize: '0.7rem' }}>PUBLISHED</span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Action Items / Tasks */}
                                            {agenda.host_decision && (
                                                <div style={S.taskSection}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                                        <h6 style={{ margin: 0, fontWeight: 800, fontSize: '1rem', color: T.textBold, display: 'flex', alignItems: 'center' }}>
                                                            <i className="fa fa-list-check me-2 text-primary"></i> Assigned Action Items
                                                        </h6>
                                                        <button
                                                            className="btn btn-primary btn-sm"
                                                            onClick={() => openTaskModal(agenda.id)}
                                                            style={{ borderRadius: '8px', padding: '6px 16px', fontWeight: 700, fontSize: '0.82rem' }}
                                                        >
                                                            <i className="fa fa-plus me-1"></i> ADD TASK
                                                        </button>
                                                    </div>

                                                    {/* Tasks List Content */}
                                                    {agenda.tasks && agenda.tasks.length > 0 ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                            {agenda.tasks.map(task => (
                                                                <div key={task.id} style={S.taskItem}>
                                                                    <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start', flex: 1 }}>
                                                                        <div style={{
                                                                            width: '32px', height: '32px', background: '#e0e7ff',
                                                                            borderRadius: '8px', display: 'flex', alignItems: 'center',
                                                                            justifyContent: 'center', color: '#4338ca', fontSize: '0.85rem'
                                                                        }}>
                                                                            <i className="fa fa-check"></i>
                                                                        </div>
                                                                        <div>
                                                                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: T.textBold }}>{task.title}</div>
                                                                            <div style={{ fontSize: '0.8rem', color: T.textMuted, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                                                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                                    <i className="fa fa-user-circle text-primary"></i> {task.assigned_to_name}
                                                                                </span>
                                                                                <span style={S.badge(getStatusColor(task.status))}>
                                                                                    {task.status?.replace('_', ' ').toLowerCase()}
                                                                                </span>
                                                                                {task.due_date && (
                                                                                    <span style={{ borderLeft: '1px solid #e1e8f0', paddingLeft: '10px' }}>
                                                                                        <i className="fa fa-calendar me-1"></i> {task.due_date}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <button
                                                                        className="btn btn-light btn-xs text-danger"
                                                                        onClick={() => handleDeleteTask(task.id)}
                                                                        style={{ borderRadius: '6px', border: '1px solid #fee2e2' }}
                                                                    >
                                                                        <i className="fa fa-trash-alt"></i>
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div style={{ padding: '30px', textAlign: 'center', background: isDark ? '#0f172a' : '#f8fafc', borderRadius: '12px', border: `1px dashed ${T.border}` }}>
                                                            <i className="fa fa-tasks mb-3" style={{ fontSize: '1.5rem', color: T.border }}></i>
                                                            <p style={{ fontSize: '0.85rem', color: T.textMuted, margin: 0, fontWeight: 500 }}>
                                                                No specific action items assigned yet.
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Bottom Navigation */}
                        <div style={{ ...S.navBar, marginTop: '10px', background: 'transparent', border: 'none', boxShadow: 'none', padding: '0 5px' }}>
                            <button
                                onClick={handlePrevAgenda}
                                disabled={currentAgendaIndex === 0}
                                style={S.navBtn(currentAgendaIndex === 0)}
                            >
                                <i className="fa fa-chevron-left me-2"></i> PREVIOUS
                            </button>

                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: T.textMuted, background: T.card, padding: '8px 16px', borderRadius: '20px', border: `1px solid ${T.border}` }}>
                                AGENDA <span style={{ color: '#2563eb' }}>{currentAgendaIndex + 1}</span> OF {agendas.length}
                            </div>

                            <button
                                onClick={handleNextAgenda}
                                disabled={currentAgendaIndex === agendas.length - 1}
                                style={S.navBtn(currentAgendaIndex === agendas.length - 1)}
                            >
                                NEXT <i className="fa fa-chevron-right ms-2"></i>
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Task Assignment Modal */}
            <Modal show={showModal} onHide={() => setShowModal(false)} centered size="md">
                <Modal.Header closeButton style={{ background: isDark ? '#16213e' : '#f8fafc', borderBottom: `1px solid ${T.border}`, padding: '20px 24px' }}>
                    <Modal.Title style={{ fontSize: '1.1rem', fontWeight: 800, color: T.textBold, display: 'flex', alignItems: 'center' }}>
                        <div style={{ width: '32px', height: '32px', background: '#2563eb', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', marginRight: '12px' }}>
                            <i className="fa fa-tasks" style={{ fontSize: '0.9rem' }}></i>
                        </div>
                        Assign Action Item
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body style={{ padding: '24px', background: T.card }}>
                    <Form>
                        <Form.Group className="mb-4">
                            <Form.Label style={{ fontWeight: 700, fontSize: '0.85rem', color: T.textMuted, marginBottom: '8px' }}>TASK TITLE *</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="E.g., Prepare financial projections"
                                value={taskData.title}
                                onChange={e => setTaskData({ ...taskData, title: e.target.value })}
                                style={{ borderRadius: '8px', padding: '12px', border: `1px solid ${T.border}`, fontSize: '0.95rem', backgroundColor: T.inputBg, color: T.text }}
                            />
                        </Form.Group>

                        <div className="row">
                            <div className="col-md-7">
                                <Form.Group className="mb-4">
                                    <Form.Label style={{ fontWeight: 700, fontSize: '0.85rem', color: T.textMuted, marginBottom: '8px' }}>ASSIGNEE *</Form.Label>
                                    <Form.Select
                                        value={taskData.assigned_to}
                                        onChange={e => setTaskData({ ...taskData, assigned_to: e.target.value })}
                                        style={{ borderRadius: '8px', padding: '12px', border: `1px solid ${T.border}`, fontSize: '0.95rem', backgroundColor: T.inputBg, color: T.text }}
                                    >
                                        <option value="">Select a participant...</option>
                                        {participants.map(p => (
                                            <option key={p.id} value={p.participant}>
                                                {p.participant_name}
                                            </option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                            </div>
                            <div className="col-md-5">
                                <Form.Group className="mb-4">
                                    <Form.Label style={{ fontWeight: 700, fontSize: '0.85rem', color: T.textMuted, marginBottom: '8px' }}>DUE DATE</Form.Label>
                                    <Form.Control
                                        type="date"
                                        value={taskData.due_date}
                                        onChange={e => setTaskData({ ...taskData, due_date: e.target.value })}
                                        style={{ borderRadius: '8px', padding: '12px', border: `1px solid ${T.border}`, fontSize: '0.95rem', backgroundColor: T.inputBg, color: T.text }}
                                    />
                                </Form.Group>
                            </div>
                        </div>

                        <Form.Group className="mb-0">
                            <Form.Label style={{ fontWeight: 700, fontSize: '0.85rem', color: T.textMuted, marginBottom: '8px' }}>DESCRIPTION</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                placeholder="Clarify the task objectives..."
                                value={taskData.description}
                                onChange={e => setTaskData({ ...taskData, description: e.target.value })}
                                style={{ borderRadius: '8px', padding: '12px', border: `1px solid ${T.border}`, fontSize: '0.95rem', backgroundColor: T.inputBg, color: T.text }}
                            />
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer style={{ borderTop: `1px solid ${T.border}`, padding: '20px 24px', background: isDark ? '#16213e' : '#f8fafc' }}>
                    <button
                        className="btn btn-link link-secondary"
                        onClick={() => setShowModal(false)}
                        style={{ fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none', color: T.textMuted }}
                    >
                        CANCEL
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleAddTask}
                        style={{ borderRadius: '8px', padding: '10px 24px', fontWeight: 700, background: '#2563eb', border: 'none', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' }}
                    >
                        ASSIGN TASK
                    </button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default AgendaDecisionPage;
