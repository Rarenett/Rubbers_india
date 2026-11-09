import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Alert } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { getMeetingById, getMeetingAgendas, submitComment, exitMeeting, convertAudioToText } from '../../../services/MeetingManagementService';

const VirtualMeetingRoom = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [meeting, setMeeting] = useState(null);
    const [agendas, setAgendas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [commentData, setCommentData] = useState({});
    const [recordingAgendaId, setRecordingAgendaId] = useState(null);
    const [uploadingAgendaId, setUploadingAgendaId] = useState(null);
    const recognitionRef = useRef(null);
    const fileInputRefs = useRef({});

    const fetchController = useRef(null);

    useEffect(() => {
        if (fetchController.current) {
            fetchController.current.abort = true;
        }

        const controller = { abort: false };
        fetchController.current = controller;

        const fetchMeetingDetails = async () => {
            try {
                setLoading(true);
                const [meetingData, agendaData] = await Promise.all([
                    getMeetingById(id),
                    getMeetingAgendas(id)
                ]);

                if (controller.abort) return;

                setMeeting(meetingData);
                setAgendas(agendaData);

                const initialComments = {};
                agendaData.forEach(a => {
                    if (a.user_comment) {
                        initialComments[a.id] = {
                            vote: a.user_comment.vote,
                            remarks: a.user_comment.remarks,
                            submitted: true
                        };
                    } else {
                        initialComments[a.id] = { vote: 'neutral', remarks: '', submitted: false };
                    }
                });
                setCommentData(initialComments);
            } catch (error) {
                if (controller.abort) return;
                console.error("Error fetching meeting details:", error);
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load meeting room details.' });
                navigate('/meeting/assigned');
            } finally {
                if (!controller.abort) setLoading(false);
            }
        };

        fetchMeetingDetails();

        return () => { controller.abort = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const handleCommentChange = (agendaId, field, value) => {
        setCommentData(prev => ({
            ...prev,
            [agendaId]: { ...prev[agendaId], [field]: value }
        }));
    };

    const handleSubmitComment = async (agendaId) => {
        try {
            const data = {
                agenda: agendaId,
                participant: null,
                vote: commentData[agendaId].vote,
                remarks: commentData[agendaId].remarks
            };

            if (!data.remarks.trim()) {
                Swal.fire({ icon: 'warning', title: 'Missing Remarks', text: 'Please enter your remarks before submitting.' });
                return;
            }

            await submitComment(data);

            setCommentData(prev => ({
                ...prev,
                [agendaId]: { ...prev[agendaId], submitted: true }
            }));

            Swal.fire({
                icon: 'success',
                title: 'Submitted',
                text: 'Your comment has been recorded.',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (error) {
            console.error("Error submitting comment:", error);
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to submit comment.' });
        }
    };

    const handleExitMeeting = async () => {
        const result = await Swal.fire({
            title: 'Exit Meeting?',
            text: "Are you sure you want to leave the meeting? Your departure will be logged.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, Exit'
        });

        if (result.isConfirmed) {
            try {
                await exitMeeting(id);
                Swal.fire({
                    icon: 'success',
                    title: 'Exited',
                    text: 'You have left the meeting.',
                    timer: 1500,
                    showConfirmButton: false
                });
                navigate('/meeting/assigned');
            } catch (error) {
                console.error("Error exiting meeting:", error);
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to log exit.' });
            }
        }
    };

    // Speech-to-Text Implementation using Web Speech API
    const toggleRecording = (agendaId) => {
        // If we are already recording this agenda, stop it.
        if (recordingAgendaId === agendaId) {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            setRecordingAgendaId(null);
            return;
        }

        // If recording another agenda, stop it first.
        if (recordingAgendaId !== null && recognitionRef.current) {
            recognitionRef.current.stop();
        }

        // Check for browser support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            Swal.fire({
                icon: 'error',
                title: 'Not Supported',
                text: 'Your browser does not support Speech-to-Text. Please use Chrome, Edge, or Safari.'
            });
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        // Store current length to append only new text
        let currentRemarks = commentData[agendaId]?.remarks || '';

        recognition.onstart = () => {
            setRecordingAgendaId(agendaId);
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript + ' ';
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            // Append the recognized text to the existing remarks
            const newRemarks = currentRemarks + (currentRemarks && !currentRemarks.endsWith(' ') ? ' ' : '') + finalTranscript + interimTranscript;

            handleCommentChange(agendaId, 'remarks', newRemarks);

            // Update base text when final result is received so next ones concatenate properly
            if (finalTranscript) {
                currentRemarks = currentRemarks + (currentRemarks && !currentRemarks.endsWith(' ') ? ' ' : '') + finalTranscript;
            }
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            if (event.error !== 'no-speech') {
                Swal.fire({
                    icon: 'error',
                    title: 'Microphone Error',
                    text: `Failed to record: ${event.error}`
                });
                setRecordingAgendaId(null);
            }
        };

        recognition.onend = () => {
            // If it ended naturally (or unexpectedly), reset the state if it matches the current agenda
            setRecordingAgendaId((currentId) => {
                if (currentId === agendaId) return null;
                return currentId;
            });
        };

        recognitionRef.current = recognition;
        recognition.start();
    };

    // Audio File Upload to Text Implementation
    const handleFileUpload = async (agendaId, event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Reset the input so the same file could be selected again if needed
        event.target.value = null;

        try {
            setUploadingAgendaId(agendaId);
            const response = await convertAudioToText(file, agendaId);

            if (response && response.text) {
                const currentRemarks = commentData[agendaId]?.remarks || '';
                const newRemarks = currentRemarks + (currentRemarks && !currentRemarks.endsWith(' ') ? ' ' : '') + response.text;
                handleCommentChange(agendaId, 'remarks', newRemarks);

                Swal.fire({
                    icon: 'success',
                    title: 'Audio Processed',
                    text: 'Transcription added to remarks.',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        } catch (error) {
            console.error("Audio to text error:", error);
            Swal.fire({
                icon: 'error',
                title: 'Conversion Failed',
                text: error.response?.data?.error || 'Failed to convert audio to text. Make sure the file contains clear speech.'
            });
        } finally {
            setUploadingAgendaId(null);
        }
    };

    const isMeetingOver = () => {
        if (!meeting) return false;
        try {
            const now = new Date();
            const [year, month, day] = meeting.meeting_date.split('-').map(Number);
            const [hour, minute] = meeting.end_time.split(':').map(Number);
            const meetingEndDate = new Date(year, month - 1, day, hour, minute);
            return now > meetingEndDate;
        } catch (e) {
            console.error("Error calculating meeting end time:", e);
            return false;
        }
    };

    if (loading) {
        return (
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: '300px',
                    width: '100%'
                }}
            >
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    return (
        /* ── outermost wrapper: full width, scrollable, no height cap ── */
        <div style={{ width: '100%', overflowY: 'auto', overflowX: 'hidden' }}>

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

            {/* ── Meeting Header Banner ── */}
            <div
                style={{
                    background: 'linear-gradient(135deg, #4CAF50 0%, #2e7d32 100%)',
                    borderRadius: '12px',
                    padding: '24px 28px',
                    marginBottom: '28px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 4px 15px rgba(76,175,80,0.3)',
                    flexWrap: 'wrap',
                    gap: '12px'
                }}
            >
                <div>
                    <h2 style={{ color: '#fff', marginBottom: '6px', fontWeight: 700, fontSize: '1.6rem' }}>
                        {meeting?.meeting_title}
                    </h2>
                    <p style={{ color: 'rgba(255,255,255,0.85)', marginBottom: 0, fontSize: '0.9rem' }}>
                        <i className="fa fa-calendar-o" style={{ marginRight: '6px' }}></i>
                        {meeting?.meeting_date}
                        <span style={{ margin: '0 8px' }}>|</span>
                        <i className="fa fa-clock-o" style={{ marginRight: '6px' }}></i>
                        {meeting?.start_time} – {meeting?.end_time}
                    </p>
                </div>
                <button
                    onClick={handleExitMeeting}
                    style={{
                        background: '#fff',
                        color: '#e53935',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '10px 20px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        transition: 'opacity 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                    <i className="fa fa-sign-out"></i> Exit Meeting
                </button>
            </div>

            {/* ── Section Title ── */}
            <h4 style={{ fontWeight: 700, marginBottom: '20px', color: '#2d3748' }}>
                Meeting Agendas &amp; Discussions
            </h4>

            {/* ── Agenda Cards container — key fix: no overflow hidden, full height ── */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                    width: '100%',
                    paddingBottom: '40px' /* breathing room at bottom */
                }}
            >
                {agendas.length === 0 ? (
                    <Alert variant="info">No agenda items found for this meeting.</Alert>
                ) : (
                    agendas.map((agenda, index) => (
                        <div
                            key={agenda.id}
                            style={{
                                background: '#fff',
                                borderRadius: '12px',
                                boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                                borderLeft: '5px solid #4CAF50',
                                overflow: 'visible', /* never clip children */
                                width: '100%'
                            }}
                        >
                            {/* Card Header */}
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '16px 20px',
                                    borderBottom: '1px solid #f0f0f0',
                                    flexWrap: 'wrap',
                                    gap: '8px'
                                }}
                            >
                                <h5 style={{ margin: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span
                                        style={{
                                            background: '#4CAF50',
                                            color: '#fff',
                                            borderRadius: '6px',
                                            padding: '2px 10px',
                                            fontSize: '0.85rem',
                                            fontWeight: 700
                                        }}
                                    >
                                        {index + 1}
                                    </span>
                                    {agenda.points}
                                </h5>
                                {agenda.duration_minutes > 0 && (
                                    <span
                                        style={{
                                            background: '#f5f5f5',
                                            border: '1px solid #e0e0e0',
                                            borderRadius: '6px',
                                            padding: '3px 12px',
                                            fontSize: '0.82rem',
                                            color: '#555',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '5px'
                                        }}
                                    >
                                        <i className="fa fa-hourglass-start"></i>
                                        {agenda.duration_minutes} mins
                                    </span>
                                )}
                            </div>

                            {/* Card Body */}
                            <div style={{ padding: '20px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>

                                {/* Left — agenda details */}
                                <div style={{ flex: '1 1 55%', minWidth: '260px' }}>
                                    <p style={{ color: '#666', marginBottom: '14px', lineHeight: '1.6' }}>
                                        {agenda.details || "No further details provided."}
                                    </p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                        <small style={{ color: '#4CAF50', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <i className="fa fa-user"></i>
                                            Presenter: <strong>{agenda.presenter_name || "N/A"}</strong>
                                        </small>
                                        {agenda.file_upload_url && (
                                            <a
                                                href={agenda.file_upload_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    border: '1px solid #26c6da',
                                                    color: '#00838f',
                                                    borderRadius: '6px',
                                                    padding: '4px 12px',
                                                    fontSize: '0.78rem',
                                                    textDecoration: 'none',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '5px'
                                                }}
                                            >
                                                View Attachment
                                            </a>
                                        )}
                                    </div>
                                </div>

                                {/* Divider */}
                                <div style={{ width: '1px', background: '#eeeeee', flexShrink: 0 }} />

                                {/* Right — feedback / vote form */}
                                <div style={{ flex: '1 1 35%', minWidth: '260px' }}>
                                    {commentData[agenda.id]?.submitted ? (
                                        <div
                                            style={{
                                                background: '#f9f9f9',
                                                borderRadius: '10px',
                                                padding: '16px',
                                                border: '1px solid #e8e8e8'
                                            }}
                                        >
                                            <h6 style={{ color: '#4CAF50', fontWeight: 700, marginBottom: '10px' }}>
                                                Your Feedback
                                            </h6>
                                            <div style={{ marginBottom: '8px' }}>
                                                <span
                                                    style={{
                                                        background:
                                                            commentData[agenda.id].vote === 'approve' ? '#4CAF50' :
                                                                commentData[agenda.id].vote === 'reject' ? '#e53935' : '#9e9e9e',
                                                        color: '#fff',
                                                        borderRadius: '5px',
                                                        padding: '3px 12px',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 700,
                                                        letterSpacing: '0.5px'
                                                    }}
                                                >
                                                    {commentData[agenda.id].vote.toUpperCase()}
                                                </span>
                                            </div>
                                            <p style={{ fontSize: '0.88rem', marginBottom: '6px', color: '#333' }}>
                                                <strong>Remarks:</strong> {commentData[agenda.id].remarks}
                                            </p>
                                            <small style={{ color: '#aaa', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <i className="fa fa-check-circle" style={{ color: '#4CAF50' }}></i>
                                                Already voted
                                            </small>
                                        </div>
                                    ) : isMeetingOver() ? (
                                        <div
                                            style={{
                                                background: '#fff9fa',
                                                borderRadius: '10px',
                                                padding: '20px',
                                                border: '1px dashed #ef9a9a',
                                                textAlign: 'center'
                                            }}
                                        >
                                            <i className="fa fa-lock" style={{ fontSize: '1.5rem', color: '#e53935', marginBottom: '10px', display: 'block' }}></i>
                                            <h6 style={{ color: '#c62828', fontWeight: 700, marginBottom: '5px' }}>
                                                Voting Closed
                                            </h6>
                                            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: 0 }}>
                                                The scheduled meeting time has ended. Commenting and voting are no longer available.
                                            </p>
                                        </div>
                                    ) : (
                                        <div>
                                            {/* Vote radios */}
                                            <div style={{ marginBottom: '14px' }}>
                                                <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>
                                                    Your Vote
                                                </label>
                                                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                                    {[
                                                        { value: 'approve', label: 'Approve', color: '#4CAF50' },
                                                        { value: 'reject', label: 'Reject', color: '#e53935' },
                                                        { value: 'neutral', label: 'Neutral', color: '#9e9e9e' }
                                                    ].map(opt => (
                                                        <label
                                                            key={opt.value}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                cursor: 'pointer',
                                                                color: commentData[agenda.id]?.vote === opt.value ? opt.color : '#555',
                                                                fontWeight: commentData[agenda.id]?.vote === opt.value ? 600 : 400,
                                                                fontSize: '0.88rem'
                                                            }}
                                                        >
                                                            <input
                                                                type="radio"
                                                                name={`vote-${agenda.id}`}
                                                                value={opt.value}
                                                                checked={commentData[agenda.id]?.vote === opt.value}
                                                                onChange={() => handleCommentChange(agenda.id, 'vote', opt.value)}
                                                                style={{ accentColor: opt.color, width: '16px', height: '16px' }}
                                                            />
                                                            {opt.label}
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Remarks textarea with Speech-to-Text button */}
                                            <div style={{ marginBottom: '14px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                    <label style={{ fontWeight: 600, display: 'block', margin: 0, fontSize: '0.9rem' }}>
                                                        Remarks
                                                    </label>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button
                                                            onClick={() => toggleRecording(agenda.id)}
                                                            title={recordingAgendaId === agenda.id ? "Stop Recording" : "Start Speech-to-Text"}
                                                            style={{
                                                                background: 'transparent',
                                                                border: 'none',
                                                                color: recordingAgendaId === agenda.id ? '#e53935' : '#757575',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                fontSize: '0.9rem',
                                                                fontWeight: 600,
                                                                padding: '4px 8px',
                                                                borderRadius: '4px',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                if (recordingAgendaId !== agenda.id) {
                                                                    e.currentTarget.style.color = '#4CAF50';
                                                                    e.currentTarget.style.background = '#e8f5e9';
                                                                }
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                if (recordingAgendaId !== agenda.id) {
                                                                    e.currentTarget.style.color = '#757575';
                                                                    e.currentTarget.style.background = 'transparent';
                                                                }
                                                            }}
                                                        >
                                                            <i className={`fa ${recordingAgendaId === agenda.id ? 'fa-stop-circle' : 'fa-microphone'}`}
                                                                style={{
                                                                    fontSize: '1.2rem',
                                                                    animation: recordingAgendaId === agenda.id ? 'pulse 1.5s infinite' : 'none'
                                                                }}
                                                            ></i>
                                                            {recordingAgendaId === agenda.id ? 'Listening...' : 'Voice input'}
                                                        </button>

                                                        {/* Audio Upload Button */}
                                                        <div>
                                                            <input
                                                                type="file"
                                                                accept="audio/*"
                                                                style={{ display: 'none' }}
                                                                ref={(el) => fileInputRefs.current[agenda.id] = el}
                                                                onChange={(e) => handleFileUpload(agenda.id, e)}
                                                            />
                                                            <button
                                                                onClick={() => fileInputRefs.current[agenda.id].click()}
                                                                disabled={uploadingAgendaId === agenda.id}
                                                                title="Upload Audio File for Transcription"
                                                                style={{
                                                                    background: 'transparent',
                                                                    border: 'none',
                                                                    color: uploadingAgendaId === agenda.id ? '#1976d2' : '#757575',
                                                                    cursor: uploadingAgendaId === agenda.id ? 'not-allowed' : 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '6px',
                                                                    fontSize: '0.9rem',
                                                                    fontWeight: 600,
                                                                    padding: '4px 8px',
                                                                    borderRadius: '4px',
                                                                    transition: 'all 0.2s',
                                                                    opacity: uploadingAgendaId === agenda.id ? 0.7 : 1
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    if (uploadingAgendaId !== agenda.id) {
                                                                        e.currentTarget.style.color = '#1976d2';
                                                                        e.currentTarget.style.background = '#e3f2fd';
                                                                    }
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    if (uploadingAgendaId !== agenda.id) {
                                                                        e.currentTarget.style.color = '#757575';
                                                                        e.currentTarget.style.background = 'transparent';
                                                                    }
                                                                }}
                                                            >
                                                                <i className={`fa ${uploadingAgendaId === agenda.id ? 'fa-spinner fa-spin' : 'fa-upload'}`}
                                                                    style={{ fontSize: '1.2rem' }}
                                                                ></i>
                                                                {uploadingAgendaId === agenda.id ? 'Processing...' : 'Upload Audio'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Inline CSS for pulsing effect */}
                                                <style>
                                                    {`
 @keyframes pulse {
 0% { transform: scale(1); opacity: 1; }
 50% { transform: scale(1.15); opacity: 0.6; }
 100% { transform: scale(1); opacity: 1; }
 }
 `}
                                                </style>

                                                <textarea
                                                    rows={3}
                                                    placeholder="Share your thoughts..."
                                                    value={commentData[agenda.id]?.remarks || ''}
                                                    onChange={(e) => handleCommentChange(agenda.id, 'remarks', e.target.value)}
                                                    style={{
                                                        width: '100%',
                                                        border: '1px solid #ddd',
                                                        borderRadius: '8px',
                                                        padding: '10px 12px',
                                                        fontSize: '0.88rem',
                                                        resize: 'vertical',
                                                        outline: 'none',
                                                        fontFamily: 'inherit',
                                                        transition: 'border-color 0.2s',
                                                        boxSizing: 'border-box'
                                                    }}
                                                    onFocus={e => e.target.style.borderColor = '#4CAF50'}
                                                    onBlur={e => e.target.style.borderColor = '#ddd'}
                                                />
                                            </div>

                                            {/* Submit button */}
                                            <button
                                                onClick={() => handleSubmitComment(agenda.id)}
                                                style={{
                                                    background: '#4CAF50',
                                                    color: '#fff',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    padding: '9px 22px',
                                                    fontWeight: 600,
                                                    fontSize: '0.88rem',
                                                    cursor: 'pointer',
                                                    transition: 'background 0.2s'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = '#388e3c'}
                                                onMouseLeave={e => e.currentTarget.style.background = '#4CAF50'}
                                            >
                                                Submit Comment
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default VirtualMeetingRoom;