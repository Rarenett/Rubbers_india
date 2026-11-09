import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, Row, Col, Button, Form, Modal, Table, Badge } from 'react-bootstrap';
import axiosInstance from '../../../services/AxiosInstance';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import PageTitle from '../../layouts/PageTitle';

// ─── Format Helpers ─────────────────────────────────────────────────────────
const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDateTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

const formatSeconds = (s) => {
    if (!s && s !== 0) return '00:00';
    const num = parseInt(s, 10) || 0;
    const m = Math.floor(num / 60);
    const sec = num % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const getOfferTiers = (offer) => {
    const rows = offer.criteria_rows || [];
    const type = offer.criteria_type || 'Amount Based';

    if (rows.length === 0) {
        if (offer.min_purchase_amount || offer.discount_percent || offer.discount_amount) {
            const disc = offer.discount_percent ? `${parseFloat(offer.discount_percent)}%` : `₹${parseFloat(offer.discount_amount || 0)}`;
            const minAmt = parseFloat(offer.min_purchase_amount || 0).toLocaleString();
            return [{
                text: `Min. purchase ₹${minAmt} → ${disc} Off`,
                node: <span>Min. purchase <strong>₹{minAmt}</strong> → <strong>{disc} Off</strong></span>
            }];
        }
        return [];
    }

    if (type === 'Amount Based') {
        return rows.map(r => {
            const disc = r.discount_type === 'Percentage' ? `${r.discount_value}%` : `₹${r.discount_value}`;
            const targetProduct = r.product_name ? ` on ${r.product_name}` : ' (All Products)';
            const minAmt = parseFloat(r.min_purchase_amount || 0).toLocaleString();
            return {
                text: `Min. purchase ₹${minAmt} → ${disc} Off${targetProduct}`,
                node: <span>Min. purchase <strong>₹{minAmt}</strong> → <strong>{disc} Off</strong>{targetProduct}</span>
            };
        });
    }

    if (type === 'Product Based') {
        return rows.map((r, i) => {
            const disc = r.discount_percentage ? `${r.discount_percentage}%` : (r.discount_value ? `₹${r.discount_value}` : 'Special discount');
            const pName = r.product_name || `Product #${r.product || i + 1}`;
            const qty = r.quantity || 1;
            return {
                text: `Buy ${qty}+ of ${pName} → ${disc} Off`,
                node: <span>Buy <strong>{qty}+</strong> of <strong>{pName}</strong> → <strong>{disc} Off</strong></span>
            };
        });
    }

    if (type === 'Service Based') {
        return rows.map((r, i) => {
            const disc = r.discount_percentage ? `${r.discount_percentage}%` : (r.discount_value ? `₹${r.discount_value}` : 'Special discount');
            const sName = r.service_name || `Service #${r.service || i + 1}`;
            return {
                text: `Service: ${sName} → ${disc} Off`,
                node: <span>Service: <strong>{sName}</strong> → <strong>{disc} Off</strong></span>
            };
        });
    }

    return [];
};

const renderOfferBenefitLines = (offer, onSelectTier) => {
    const tiers = getOfferTiers(offer);
    if (tiers.length === 0) return null;

    return (
        <div className="d-flex flex-column gap-1.5" style={{ fontSize: '12.5px' }}>
            {tiers.map((t, i) => (
                <button
                    key={i}
                    type="button"
                    className="btn w-100 text-start p-2 px-3 rounded d-flex align-items-center gap-2 mb-1"
                    style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        fontSize: '12.5px',
                        color: '#1e293b',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f1f5f9';
                        e.currentTarget.style.borderColor = '#94a3b8';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                        e.currentTarget.style.borderColor = '#cbd5e1';
                    }}
                    onClick={() => onSelectTier && onSelectTier(t.text)}
                    title="Click this offer to add to remarks"
                >
                    <i className="fa fa-tag text-muted" style={{ fontSize: '11px' }}></i>
                    <span className="flex-grow-1">{t.node}</span>
                </button>
            ))}
        </div>
    );
};

const OUTCOME_META = {
    'Contacted': { label: 'Contacted', badgeClass: 'badge-info light', color: '#0284c7', bg: '#f5fafe', icon: 'fa-phone' },
    'Interested': { label: 'Interested', badgeClass: 'badge-success light', color: '#68CF29', bg: '#ecfae4', icon: 'fa-star' },
    'Call Back Later': { label: 'Call Back Later', badgeClass: 'badge-warning light', color: '#FFAC30', bg: '#fff2dd', icon: 'fa-clock' },
    'Converted': { label: 'Converted to Opportunity', badgeClass: 'badge-success light', color: '#68CF29', bg: '#ecfae4', icon: 'fa-trophy' },
    'Converted to Opportunity': { label: 'Converted to Opportunity', badgeClass: 'badge-success light', color: '#68CF29', bg: '#ecfae4', icon: 'fa-trophy' },
    'Busy': { label: 'Busy', badgeClass: 'badge-warning light', color: '#FFAC30', bg: '#fff2dd', icon: 'fa-hourglass-half' },
    'Not Answered': { label: 'Not Answered', badgeClass: 'badge-dark light', color: '#6e6e6e', bg: '#eeeeee', icon: 'fa-phone' },
    'Not Interested': { label: 'Not Interested', badgeClass: 'badge-danger light', color: '#FF4C41', bg: '#ffefee', icon: 'fa-thumbs-down' },
    'Wrong Number': { label: 'Wrong Number', badgeClass: 'badge-danger light', color: '#FF4C41', bg: '#ffefee', icon: 'fa-times-circle' },
};

const getOutcomeBadgeClass = (outcome) => {
    return OUTCOME_META[outcome]?.badgeClass || 'badge-secondary light';
};

const PRIORITY_META = {
    'Critical': { label: 'Critical', color: '#FF4C41', bg: '#ffefee', badgeClass: 'badge-danger light' },
    'High':     { label: 'High',     color: '#FFAC30', bg: '#fff2dd', badgeClass: 'badge-warning light' },
    'Medium':   { label: 'Medium',   color: '#51A6F5', bg: '#f5fafe', badgeClass: 'badge-info light' },
    'Low':      { label: 'Low',      color: '#68CF29', bg: '#ecfae4', badgeClass: 'badge-success light' },
};

const getPriorityBadgeClass = (priority) => {
    return PRIORITY_META[priority]?.badgeClass || 'badge-info light';
};

// ─── Call Timer Component ───────────────────────────────────────────────────
const CallTimer = ({ onEnd }) => {
    const [seconds, setSeconds] = useState(0);
    const intervalRef = useRef(null);

    useEffect(() => {
        intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
        return () => clearInterval(intervalRef.current);
    }, []);

    const format = (s) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    };

    return (
        <div className="text-center py-2">
            <div style={{
                fontSize: '2.4rem', fontWeight: 900, letterSpacing: '2px',
                color: '#2ece8a', fontVariantNumeric: 'tabular-nums', lineHeight: 1
            }}>
                {format(seconds)}
            </div>
            <div style={{ color: '#94a3b8', fontSize: '12px', margin: '6px 0 16px' }}>
                <span className="spinner-grow spinner-grow-sm text-success me-1" style={{ width: '8px', height: '8px' }}></span>
                Call in progress...
            </div>
            <button
                id="end-call-btn"
                onClick={() => onEnd(seconds)}
                className="btn btn-danger w-100 py-2 font-w600"
                style={{ borderRadius: '50px', boxShadow: '0 4px 15px rgba(239,68,68,0.4)' }}
            >
                <i className="fa fa-phone me-2"></i> End &amp; Log Call
            </button>
        </div>
    );
};

// ─── Main Component ─────────────────────────────────────────────────────────
const CallerMyLeads = () => {
    const navigate = useNavigate();
    const [individualLeads, setIndividualLeads] = useState([]);
    const [teamLeads, setTeamLeads]             = useState([]);
    const [assignmentTab, setAssignmentTab]     = useState('individual'); // 'individual' or 'team'
    const [loading, setLoading]                 = useState(true);
    const [search, setSearch]                   = useState('');
    const [filterOutcome, setFilterOutcome]     = useState('');
    const [filterPriority, setFilterPriority]   = useState('');

    // Call session
    const [activeCall, setActiveCall] = useState(null);
    const activeCallRef = useRef(null);
    const [callSeconds, setCallSeconds] = useState(0);
    const [isCallInProgress, setIsCallInProgress] = useState(false);
    const [isCallSession, setIsCallSession] = useState(false);

    // History modal
    const [historyTarget, setHistoryTarget] = useState(null);
    const [modalHistoryViewMode, setModalHistoryViewMode] = useState('detailed'); // 'detailed' | 'summary'

    // Log modal
    const [showLogModal, setShowLogModal] = useState(false);
    const [logTarget, setLogTarget] = useState(null);
    const [callHistoryViewMode, setCallHistoryViewMode] = useState('detailed'); // 'detailed' | 'summary'
    const [logForm, setLogForm] = useState({
        call_outcome: 'Contacted',
        duration_seconds: '',
        notes: '',
        follow_up_date: '',
    });
    const [logSaving, setLogSaving] = useState(false);

    // Reassign modal state
    const [showReassignModal, setShowReassignModal] = useState(false);
    const [reassignTarget, setReassignTarget] = useState(null);
    const [reassignReason, setReassignReason] = useState('');
    const [selectedNewCallerId, setSelectedNewCallerId] = useState('');
    const [reassignSubmitting, setReassignSubmitting] = useState(false);
    const [viewReassignTarget, setViewReassignTarget] = useState(null);
    const [telecallingUsers, setTelecallingUsers] = useState([]);

    // Offers state for active call session
    const [offers, setOffers] = useState([]);
    const [activeOffersLoading, setActiveOffersLoading] = useState(false);
    const [activeLeftTab, setActiveLeftTab] = useState('history'); // 'history' | 'offers'
    const [selectedOfferCategory, setSelectedOfferCategory] = useState('ALL'); // 'ALL' | 'Amount Based' | 'Product Based' | 'Service Based'
    const [offerSearch, setOfferSearch] = useState('');

    // Active call live timer effect
    useEffect(() => {
        let timer;
        if (isCallInProgress) {
            timer = setInterval(() => {
                setCallSeconds(prev => {
                    const next = prev + 1;
                    setLogForm(f => ({ ...f, duration_seconds: String(next) }));
                    return next;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [isCallInProgress]);

    useEffect(() => {
        fetchAllLeads();
        fetchActiveOffers();

        // Background poll every 5 seconds to keep active call states synchronized across team members
        const syncInterval = setInterval(() => {
            fetchLeadsSilently();
        }, 5000);
        return () => clearInterval(syncInterval);
    }, []);

    const fetchActiveOffers = async () => {
        setActiveOffersLoading(true);
        try {
            let res;
            try {
                res = await axiosInstance.get('/api/crm_new/offers/active_offers/');
            } catch {
                res = await axiosInstance.get('/api/crm/offers/active_offers/');
            }
            const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            setOffers(data);
        } catch (err) {
            console.error('Error fetching active offers for caller:', err);
        } finally {
            setActiveOffersLoading(false);
        }
    };

    // Filtered offers list based on Category (renamed from scenario) and search
    const filteredOffers = useMemo(() => {
        return offers.filter(o => {
            // Category filter
            if (selectedOfferCategory !== 'ALL') {
                if (o.criteria_type !== selectedOfferCategory) return false;
            }

            // Search filter
            if (offerSearch.trim()) {
                const q = offerSearch.toLowerCase().trim();
                const matchTitle = (o.title || '').toLowerCase().includes(q);
                const matchCode = (o.code || '').toLowerCase().includes(q);
                const matchPitch = (o.caller_pitch || o.description || '').toLowerCase().includes(q);
                const matchCat = (o.criteria_type || '').toLowerCase().includes(q);
                if (!matchTitle && !matchCode && !matchPitch && !matchCat) return false;
            }

            return true;
        });
    }, [offers, selectedOfferCategory, offerSearch]);

    const handleCopyOfferCode = (code) => {
        if (!code) return;
        navigator.clipboard?.writeText(code);
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: `Copied ${code}`,
            showConfirmButton: false,
            timer: 1500,
        });
    };

    const handleInsertOfferIntoNotes = async (offer, specificTier = null) => {
        let chosenTierText = specificTier;

        if (!chosenTierText) {
            const tiers = getOfferTiers(offer);
            if (tiers.length === 1) {
                chosenTierText = tiers[0].text;
            } else if (tiers.length > 1) {
                // If the offer contains multiple options, prompt caller to select which one the customer agreed to
                const inputOptions = {};
                tiers.forEach((t, idx) => {
                    inputOptions[idx] = t.text;
                });

                const result = await Swal.fire({
                    title: 'Select Chosen Offer',
                    text: `Which offer option did the customer choose for "${offer.title}"?`,
                    input: 'radio',
                    inputOptions: inputOptions,
                    inputValue: '0',
                    showCancelButton: true,
                    confirmButtonText: 'Add to Remarks',
                    confirmButtonColor: '#2563eb',
                    cancelButtonText: 'Cancel',
                });

                if (!result.isConfirmed || result.value === undefined) {
                    return;
                }
                const selectedIdx = parseInt(result.value, 10);
                chosenTierText = tiers[selectedIdx]?.text || tiers[0]?.text;
            }
        }

        const noteLine = chosenTierText
            ? `\n[Offer: ${offer.title} - ${chosenTierText}]`
            : `\n[Offer: ${offer.title}]`;

        setLogForm(f => ({
            ...f,
            notes: f.notes ? `${f.notes.trim()}${noteLine}` : noteLine.trim(),
        }));

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Offer added to call remarks',
            showConfirmButton: false,
            timer: 1500,
        });
    };

    const fetchLeadsSilently = async () => {
        try {
            const [myRes, teamRes, usersRes] = await Promise.allSettled([
                axiosInstance.get('/api/crm_new/telecalling-assignments/my-leads/'),
                axiosInstance.get('/api/crm_new/telecalling-assignments/team-leads/'),
                axiosInstance.get('/api/crm_new/telecalling-assignments/telecalling-users/'),
            ]);
            if (myRes.status === 'fulfilled' && myRes.value.status === 200 && Array.isArray(myRes.value.data)) {
                setIndividualLeads(myRes.value.data);
            }
            if (teamRes.status === 'fulfilled' && teamRes.value.status === 200 && Array.isArray(teamRes.value.data)) {
                setTeamLeads(teamRes.value.data);
            }
            if (usersRes.status === 'fulfilled' && usersRes.value.status === 200 && Array.isArray(usersRes.value.data)) {
                setTelecallingUsers(usersRes.value.data);
            }
        } catch (err) {
            // Silently ignore background polling errors
        }
    };

    const updateItemCallStatus = (assignmentId, isInCall, byMe) => {
        const updater = list => list.map(item => {
            if (item.assignment_id === assignmentId) {
                return {
                    ...item,
                    is_in_call: isInCall,
                    active_call_by_me: byMe
                };
            }
            return item;
        });
        setIndividualLeads(updater);
        setTeamLeads(updater);
    };

    const fetchAllLeads = async () => {
        setLoading(true);
        try {
            const [myRes, teamRes, usersRes] = await Promise.allSettled([
                axiosInstance.get('/api/crm_new/telecalling-assignments/my-leads/'),
                axiosInstance.get('/api/crm_new/telecalling-assignments/team-leads/'),
                axiosInstance.get('/api/crm_new/telecalling-assignments/telecalling-users/'),
            ]);
            if (myRes.status === 'fulfilled' && myRes.value.status === 200) {
                setIndividualLeads(Array.isArray(myRes.value.data) ? myRes.value.data : []);
            }
            if (teamRes.status === 'fulfilled' && teamRes.value.status === 200) {
                setTeamLeads(Array.isArray(teamRes.value.data) ? teamRes.value.data : []);
            }
            if (usersRes.status === 'fulfilled' && usersRes.value.status === 200) {
                setTelecallingUsers(Array.isArray(usersRes.value.data) ? usersRes.value.data : []);
            }
        } catch (err) {
            console.error('Error fetching assigned leads', err);
        } finally {
            setLoading(false);
        }
    };

    // ── Filtering & Tabs ───────────────────────────────────────────────────
    const currentUser = (() => {
        try {
            const u = JSON.parse(localStorage.getItem('userDetails') || '{}');
            return u?.user || u || {};
        } catch {
            return {};
        }
    })();

    const currentUserId = currentUser?.id || currentUser?.user_id || currentUser?.pk || null;

    const isAdmin = Boolean(
        currentUser?.is_superuser ||
        (currentUser?.role?.name && ['admin', 'administrator', 'super admin'].includes(currentUser.role.name.toLowerCase())) ||
        (typeof currentUser?.role === 'string' && ['admin', 'administrator', 'super admin'].includes(currentUser.role.toLowerCase())) ||
        (currentUser?.username && currentUser.username.toLowerCase().startsWith('admin'))
    );

    const isTeamLeader = isAdmin || teamLeads.some(item => 
        Boolean(item.is_team_leader) || (currentUserId && item.team_leader_id === currentUserId)
    );

    const isAssigner = isAdmin || individualLeads.some(item => 
        Boolean(item.is_assigner) || (currentUserId && item.assigned_by_id === currentUserId)
    );

    const canViewReassignedTab = isTeamLeader || isAssigner || isAdmin;

    useEffect(() => {
        if (!canViewReassignedTab && assignmentTab === 'reassigned') {
            setAssignmentTab('individual');
        }
    }, [canViewReassignedTab, assignmentTab]);

    const reassignedTeamLeads = (isTeamLeader || isAdmin)
        ? teamLeads.filter(
            item => (item.is_team_leader || isAdmin || (currentUserId && item.team_leader_id === currentUserId)) &&
                    item.reassignment_status === 'REQUESTED'
          )
        : [];

    const reassignedIndividualLeads = (isAssigner || isAdmin)
        ? individualLeads.filter(
            item => (item.is_assigner || isAdmin || (currentUserId && item.assigned_by_id === currentUserId)) &&
                    item.reassignment_status === 'REQUESTED'
          )
        : [];

    const reassignedLeads = [...reassignedTeamLeads, ...reassignedIndividualLeads];

    const reassignedCount = reassignedLeads.length;

    const regularTeamLeads = teamLeads.filter(item => {
        // If pending request to team leader, only show in Reassigned Calls
        if (item.reassignment_status === 'REQUESTED') {
            return false;
        }
        return true;
    });

    const regularIndividualLeads = individualLeads.filter(item => {
        // If pending request and user is the assigner/admin (and not the caller who requested it), only show in Reassigned Calls
        if (item.reassignment_status === 'REQUESTED' && (item.is_assigner || isAdmin) && item.reassignment_requested_by_id !== currentUserId) {
            return false;
        }
        return true;
    });

    const convertedOpportunities = useMemo(() => {
        const combined = [...individualLeads, ...teamLeads];
        const seen = new Set();
        const list = [];
        for (const item of combined) {
            const id = item.assignment_id || item.lead?.id;
            if (!id || seen.has(id)) continue;
            seen.add(id);

            const isConverted = (
                item.last_outcome === 'Converted' ||
                item.last_outcome === 'Converted to Opportunity' ||
                item.lead?.lead_status === 'Converted' ||
                item.lead?.lead_status === 'Converted to Opportunity' ||
                (item.call_logs && item.call_logs.some(l => l.call_outcome === 'Converted' || l.call_outcome === 'Converted to Opportunity'))
            );

            if (isConverted) {
                if (isAdmin) {
                    list.push(item);
                } else {
                    const convLog = item.call_logs?.find(l => l.call_outcome === 'Converted' || l.call_outcome === 'Converted to Opportunity');
                    const convertedCallerId = item.converted_by_id || convLog?.caller_id || convLog?.caller;
                    if (convertedCallerId && currentUserId) {
                        if (String(convertedCallerId) === String(currentUserId)) {
                            list.push(item);
                        }
                    } else {
                        const convertedByName = (item.converted_by_name || convLog?.caller_name || '').trim().toLowerCase();
                        const currentFullName = `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim().toLowerCase();
                        const currentName = (currentUser?.name || currentFullName || currentUser?.username || '').trim().toLowerCase();
                        if (convertedByName && currentName && (convertedByName === currentName || convertedByName.includes(currentName) || currentName.includes(convertedByName))) {
                            list.push(item);
                        }
                    }
                }
            }
        }
        return list;
    }, [individualLeads, teamLeads, isAdmin, currentUserId, currentUser]);

    const activeLeads = assignmentTab === 'individual'
        ? regularIndividualLeads
        : (assignmentTab === 'reassigned' && canViewReassignedTab)
            ? reassignedLeads
            : regularTeamLeads;

    const filtered = activeLeads.filter(item => {
        const lead = item.lead || {};
        const q = search.toLowerCase().trim();
        const matchSearch = !q ||
            (lead.company || '').toLowerCase().includes(q) ||
            (lead.first_name || '').toLowerCase().includes(q) ||
            (lead.last_name || '').toLowerCase().includes(q) ||
            (lead.phone || '').includes(q) ||
            (lead.mobile || '').includes(q) ||
            (lead.city || '').toLowerCase().includes(q) ||
            (item.team_name || '').toLowerCase().includes(q) ||
            (item.assigned_employee_name || '').toLowerCase().includes(q) ||
            (item.last_caller_name || (item.call_logs && item.call_logs.length > 0 ? item.call_logs[0]?.caller_name : '') || '').toLowerCase().includes(q) ||
            (item.reassignment_requested_by_name || '').toLowerCase().includes(q) ||
            (item.reassignment_reason || '').toLowerCase().includes(q);

        const matchOutcome = !filterOutcome || (
            filterOutcome === 'Pending' 
                ? item.total_calls === 0 
                : filterOutcome === 'REASSIGNED'
                    ? item.reassignment_status === 'REQUESTED'
                    : (item.last_outcome === filterOutcome || (filterOutcome === 'Converted' && item.last_outcome === 'Converted to Opportunity') || (filterOutcome === 'Converted to Opportunity' && item.last_outcome === 'Converted'))
        );
        const matchPriority = !filterPriority || lead.priority === filterPriority;
        return matchSearch && matchOutcome && matchPriority;
    });

    // ── Call Flow ───────────────────────────────────────────────────────────
    const handleInitiateCall = async (item) => {
        const lead = item.lead || {};
        const phone = lead.phone || lead.mobile;
        if (!phone) {
            Swal.fire({
                icon: 'warning',
                title: 'No Phone Number',
                text: 'This lead does not have a phone number specified.',
                confirmButtonColor: '#2ece8a'
            });
            return;
        }

        if (item.is_contacted && !item.contacted_by_me) {
            Swal.fire({
                icon: 'info',
                title: 'Already Contacted',
                text: `This lead has already been contacted by ${item.contacted_caller_name || 'another team member'}.`,
                confirmButtonColor: '#2ece8a'
            });
            return;
        }

        // Notify backend of call initiation to lock the lead for other team members
        try {
            await axiosInstance.post(`/api/crm_new/telecalling-assignments/${item.assignment_id}/start-call/`);
        } catch (err) {
            const errorMsg = err.response?.data?.error || 'This lead is currently being called by another team member.';
            Swal.fire({
                icon: 'warning',
                title: 'Call in Progress',
                text: errorMsg,
                confirmButtonColor: '#2ece8a'
            });
            fetchLeadsSilently();
            return;
        }

        const callData = { assignmentId: item.assignment_id, lead, phone, item };
        setActiveCall(callData);
        activeCallRef.current = callData;
        setIsCallInProgress(true);
        setIsCallSession(true);
        setCallSeconds(0);

        // Optimistically update local state so current user's screen shows in call immediately
        updateItemCallStatus(item.assignment_id, true, true);

        // Open Log & Previous History modal simultaneously at the time of calling
        setLogTarget(item);
        setLogForm({
            call_outcome: 'Contacted',
            duration_seconds: '0',
            notes: '',
            follow_up_date: '',
        });
        fetchActiveOffers();
        setSelectedOfferCategory('ALL');
        setOfferSearch('');
        setShowLogModal(true);
    };

    const handleEndCall = () => {
        setIsCallInProgress(false);
        setActiveCall(null);
        activeCallRef.current = null;
        setShowLogModal(true);
    };

    const handleCallEnd = (duration) => {
        setIsCallInProgress(false);
        const callData = activeCallRef.current;
        setActiveCall(null);
        activeCallRef.current = null;
        if (callData) {
            openLogModal(callData.item, duration);
        }
    };

    // ── Log Modal ───────────────────────────────────────────────────────────
    const openLogModal = (item, prefillDuration = null) => {
        setLogTarget(item);
        fetchActiveOffers();
        setSelectedOfferCategory('ALL');
        setOfferSearch('');
        if (!activeCall || activeCall.assignmentId !== item.assignment_id) {
            setIsCallInProgress(false);
            setIsCallSession(false);
            setCallSeconds(prefillDuration !== null ? prefillDuration : 0);
            setLogForm({
                call_outcome: 'Contacted',
                duration_seconds: prefillDuration !== null ? String(prefillDuration) : '',
                notes: '',
                follow_up_date: '',
            });
        }
        setShowLogModal(true);
    };

    const handleCloseLogModal = () => {
        if (isCallInProgress) {
            // Minimize popup during active call; widget stays alive
            setShowLogModal(false);
            return;
        }
        if (isCallSession) {
            // Once call has ended, closing without saving mandatory data is prohibited
            Swal.fire({
                icon: 'warning',
                title: 'Mandatory Call Details Required',
                text: 'The call has ended. You must fill in the mandatory fields (Outcome, Duration, Notes, Follow-up Date) and save the call log.',
                confirmButtonColor: '#2ece8a'
            });
            return;
        }
        setShowLogModal(false);
    };

    const handleSaveLog = async (e) => {
        e.preventDefault();
        if (!logTarget) return;

        if (
            !logForm.call_outcome ||
            logForm.duration_seconds === '' ||
            logForm.duration_seconds === null ||
            logForm.duration_seconds === undefined ||
            !logForm.notes?.trim()
        ) {
            Swal.fire({
                icon: 'warning',
                title: 'Mandatory Fields Required',
                text: 'Please fill in all mandatory fields: Call Outcome, Duration, and Discussion Notes.',
                confirmButtonColor: '#2ece8a'
            });
            return;
        }

        setLogSaving(true);
        setIsCallInProgress(false);
        setIsCallSession(false);
        setActiveCall(null);
        activeCallRef.current = null;
        try {
            const payload = {
                assignment: logTarget.assignment_id,
                call_outcome: logForm.call_outcome,
                duration_seconds: parseInt(logForm.duration_seconds, 10),
                notes: logForm.notes.trim(),
                follow_up_date: logForm.follow_up_date || null,
            };
            await axiosInstance.post('/api/crm_new/call-logs/', payload);
            setShowLogModal(false);
            Swal.fire({
                icon: 'success',
                title: 'Call Recorded',
                text: 'Your call log has been successfully saved.',
                timer: 1800,
                showConfirmButton: false
            });
            fetchAllLeads();
        } catch (err) {
            console.error(err);
            Swal.fire({
                icon: 'error',
                title: 'Save Failed',
                text: 'Failed to record call details. Please try again.',
                confirmButtonColor: '#d33'
            });
        } finally {
            setLogSaving(false);
        }
    };

    // ── Reassignment Handlers ────────────────────────────────────────────────
    const handleOpenReassignModal = (item) => {
        setReassignTarget(item);
        setReassignReason('');
        setSelectedNewCallerId('');
        setShowReassignModal(true);
    };

    const handleCloseReassignModal = () => {
        setShowReassignModal(false);
        setReassignTarget(null);
        setReassignReason('');
        setSelectedNewCallerId('');
    };

    const handleSubmitReassignRequest = async () => {
        if (!reassignReason.trim()) {
            Swal.fire({
                icon: 'warning',
                title: 'Reason Required',
                text: reassignTarget?.team_name
                    ? 'Please enter a reason for reassigning to team leader.'
                    : 'Please enter a reason for reassigning to original assigner.',
                confirmButtonColor: '#2ece8a'
            });
            return;
        }

        setReassignSubmitting(true);
        try {
            await axiosInstance.post(`/api/crm_new/telecalling-assignments/${reassignTarget.assignment_id}/request-reassignment/`, {
                reason: reassignReason.trim()
            });
            Swal.fire({
                icon: 'success',
                title: 'Reassignment Requested',
                text: reassignTarget?.team_name
                    ? 'Call has been successfully requested for reassignment to your team leader.'
                    : 'Call has been successfully requested for reassignment to your assigner.',
                confirmButtonColor: '#2ece8a'
            });
            handleCloseReassignModal();
            fetchLeadsSilently();
            fetchAllLeads();
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Reassign Failed',
                text: err.response?.data?.error || 'Failed to request reassignment. Please try again.',
                confirmButtonColor: '#d33'
            });
        } finally {
            setReassignSubmitting(false);
        }
    };

    const handleSubmitTeamLeadReassign = async () => {
        const targetCallerId = selectedNewCallerId;
        if (!targetCallerId) {
            Swal.fire({
                icon: 'warning',
                title: 'Select Member',
                text: reassignTarget?.team_members?.length > 0
                    ? 'Please select a team member to reassign this call to.'
                    : 'Please select a telecalling member to reassign this call to.',
                confirmButtonColor: '#2ece8a'
            });
            return;
        }

        setReassignSubmitting(true);
        try {
            const res = await axiosInstance.post(`/api/crm_new/telecalling-assignments/${reassignTarget.assignment_id}/reassign/`, {
                new_caller_id: targetCallerId,
                notes: reassignReason.trim()
            });
            Swal.fire({
                icon: 'success',
                title: 'Lead Reassigned',
                text: res.data?.message || 'Lead has been successfully reassigned.',
                confirmButtonColor: '#2ece8a'
            });
            handleCloseReassignModal();
            fetchAllLeads();
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Reassign Failed',
                text: err.response?.data?.error || 'Failed to reassign lead. Please try again.',
                confirmButtonColor: '#d33'
            });
        } finally {
            setReassignSubmitting(false);
        }
    };

    // ── Helpers ─────────────────────────────────────────────────────────────
    const getLeadName = (lead) => {
        if (!lead) return 'Unknown Lead';
        const name = `${lead.first_name || ''} ${lead.last_name || ''}`.trim();
        return name || lead.company || `Lead #${lead.id}`;
    };

    const getInitials = (lead) => {
        const leadName = getLeadName(lead);
        const parts = leadName.split(' ').filter(Boolean);
        if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
        return leadName.slice(0, 2).toUpperCase();
    };

    const getReassignmentDetails = (item) => {
        let name = item?.reassignment_requested_by_name || '';
        let reason = item?.reassignment_reason || '';

        if (reason && reason.startsWith('Reassigned by ')) {
            const parts = reason.split(':');
            if (!name && parts.length > 0) {
                name = parts[0].replace('Reassigned by ', '').trim();
            }
            if (parts.length > 1) {
                reason = parts.slice(1).join(':').trim();
            } else {
                reason = '';
            }
        }

        return {
            callerName: name || 'Team Member',
            reason: reason
        };
    };

    // ── Consolidated History Summary Renderer (Paragraph-like consolidation) ──
    const renderConsolidatedSummary = (callLogs = []) => {
        if (!callLogs || callLogs.length === 0) {
            return (
                <div className="text-center py-4 text-muted" style={{ background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                    <i className="fa fa-info-circle fa-2x mb-2 text-secondary opacity-50"></i>
                    <div className="font-w600" style={{ fontSize: '13px' }}>No Call History to Summarize</div>
                    <div style={{ fontSize: '12px' }}>A consolidated summary will appear once calls are logged.</div>
                </div>
            );
        }

        const totalCalls = callLogs.length;
        const totalDurationSec = callLogs.reduce((acc, curr) => acc + (parseInt(curr.duration_seconds, 10) || 0), 0);
        const durationMins = Math.floor(totalDurationSec / 60);
        const durationSecs = totalDurationSec % 60;
        const durationText = durationMins > 0 ? `${durationMins}m ${durationSecs}s` : `${durationSecs}s`;

        const outcomeCounts = {};
        callLogs.forEach(log => {
            const out = log.call_outcome || 'Contacted';
            outcomeCounts[out] = (outcomeCounts[out] || 0) + 1;
        });
        const outcomeBreakdown = Object.entries(outcomeCounts)
            .map(([k, v]) => `${v} ${k.toLowerCase()}`)
            .join(', ');

        const callerNames = [...new Set(callLogs.map(l => l.caller_name).filter(Boolean))];
        const callersDisplay = callerNames.length > 0 ? callerNames.join(', ') : 'telecalling team';

        const latestCall = callLogs[0];
        const followUps = callLogs.map(l => l.follow_up_date).filter(Boolean);
        const latestFollowUp = followUps.length > 0 ? followUps[0] : null;

        // Collect discussion remarks chronologically for fluent reading
        const chronologicalNotes = [...callLogs]
            .reverse()
            .filter(l => l.notes && l.notes.trim())
            .map(l => {
                let note = l.notes.trim();
                if (!/[.!?]$/.test(note)) note += '.';
                return note;
            });

        const paragraph1 = `This lead has a total of ${totalCalls} recorded ${totalCalls === 1 ? 'call interaction' : 'call interactions'} (${outcomeBreakdown}) handled by ${callersDisplay}, with an aggregate conversation duration of ${durationText}.`;

        const paragraph2 = chronologicalNotes.length > 0
            ? `Summary of discussions: ${chronologicalNotes.join(' ')}`
            : `No detailed discussion remarks were recorded during these previous calls.`;

        const paragraph3 = latestFollowUp
            ? `The most recent call was placed on ${formatDate(latestCall.called_at)} by ${latestCall.caller_name || 'the caller'} (status: ${latestCall.call_outcome}), and the next follow-up is scheduled for ${formatDate(latestFollowUp)}.`
            : `The most recent call was placed on ${formatDate(latestCall.called_at)} by ${latestCall.caller_name || 'the caller'} with outcome "${latestCall.call_outcome}".`;

        const fullCopyText = `${paragraph1}\n\n${paragraph2}\n\n${paragraph3}`;

        return (
            <div className="p-3 bg-white border rounded shadow-none" style={{ borderColor: '#e2e8f0', backgroundColor: '#ffffff' }}>
                <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom flex-wrap gap-2">
                    <span className="font-w700 text-dark" style={{ fontSize: '13.5px' }}>
                        <i className="fa fa-align-left text-primary me-2"></i>
                        Consolidated History Summary
                    </span>
                    <button
                        type="button"
                        className="btn btn-xs btn-outline-secondary"
                        onClick={() => {
                            navigator.clipboard.writeText(fullCopyText);
                            Swal.fire({
                                icon: 'success',
                                title: 'Copied!',
                                text: 'Consolidated summary paragraph copied.',
                                timer: 1200,
                                showConfirmButton: false
                            });
                        }}
                        style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px' }}
                        title="Copy consolidated summary text"
                    >
                        <i className="fa fa-copy me-1"></i> Copy Summary
                    </button>
                </div>

                <div className="p-3 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', fontSize: '13px', lineHeight: '1.75' }}>
                    <p className="mb-2">
                        {paragraph1}
                    </p>
                    <p className="mb-2">
                        {paragraph2}
                    </p>
                    <p className="mb-0 text-muted" style={{ fontSize: '12.5px' }}>
                        <i className="fa fa-info-circle text-info me-1"></i> {paragraph3}
                    </p>
                </div>
            </div>
        );
    };

    // ── Stats Calculation ───────────────────────────────────────────────────
    const stats = {
        total: activeLeads.length,
        called: activeLeads.filter(i => i.total_calls > 0).length,
        pending: activeLeads.filter(i => i.total_calls === 0).length,
        converted: convertedOpportunities.length,
    };

    return (
        <div className="container-fluid" style={{ minHeight: '100vh', padding: '1.25rem 1.5rem' }}>
            <PageTitle activeMenu="My Assigned Leads" motherMenu="CRM" />

            {/* Custom Modern Styles */}
            <style>{`
                .lead-tabs-search-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: nowrap;
                }
                .lead-search-bar {
                    width: 190px;
                    position: relative;
                }
                @media (max-width: 991px) {
                    .lead-tabs-search-row {
                        flex-wrap: nowrap !important;
                    }
                    .lead-tabs-search-row .view-switcher-container {
                        flex-shrink: 0;
                    }
                    .lead-tabs-search-row .view-switcher-container button {
                        padding: 5px 12px !important;
                        font-size: 0.75rem !important;
                    }
                    .lead-tabs-search-row .lead-search-bar {
                        min-width: 140px;
                        width: auto !important;
                        flex: 1 1 auto;
                    }
                }
                @media (max-width: 767px) {
                    .lead-tabs-search-row {
                        width: 100% !important;
                        flex-wrap: nowrap !important;
                        overflow-x: auto;
                        padding-bottom: 2px;
                    }
                    .lead-tabs-search-row .view-switcher-container {
                        flex-shrink: 0;
                    }
                    .lead-tabs-search-row .view-switcher-container button {
                        padding: 5px 10px !important;
                        font-size: 0.72rem !important;
                        white-space: nowrap;
                    }
                    .lead-tabs-search-row .lead-search-bar {
                        min-width: 120px;
                        width: 100% !important;
                        flex: 1 1 auto;
                    }
                }
                .cml-table th {
                    font-size: 11.5px !important;
                    font-weight: 700 !important;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: #64748b;
                    border-bottom: 2px solid #e2e8f0 !important;
                    padding: 12px 14px !important;
                }
                .cml-table td {
                    padding: 12px 14px !important;
                    vertical-align: middle;
                    font-size: 13px;
                }
                .cml-table tbody tr:hover {
                    background-color: #f8fafc;
                }
                .cml-card {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .cml-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 24px rgba(0,0,0,0.06);
                }
                .cml-floating-call {
                    position: fixed;
                    bottom: 2rem;
                    right: 2rem;
                    width: 320px;
                    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                    color: #fff;
                    border-radius: 18px;
                    padding: 1.5rem;
                    z-index: 9999;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.35);
                    animation: cmlBounceIn 0.3s ease;
                }
                @keyframes cmlBounceIn {
                    from { transform: scale(0.9); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                @media (min-width: 992px) {
                    .cml-history-col {
                        border-right: 1px solid #e2e8f0;
                        padding-right: 1.5rem !important;
                    }
                    .cml-log-col {
                        padding-left: 1.5rem !important;
                    }
                }
            `}</style>

            {/* ── 1. Standard KPI Stat Widgets ── */}
            <Row className="g-3 mb-4">
                <Col xl={3} sm={6}>
                    <div className="card mb-0 shadow-sm" style={{ borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                        <div className="card-body p-3 d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted text-uppercase font-w600" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                                    Total Assigned
                                </div>
                                <h3 className="font-w700 mb-0 mt-1" style={{ fontSize: '24px', color: '#1e293b' }}>
                                    {stats.total}
                                </h3>
                            </div>
                            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                                <i className="fa fa-address-book"></i>
                            </div>
                        </div>
                    </div>
                </Col>

                <Col xl={3} sm={6}>
                    <div className="card mb-0 shadow-sm" style={{ borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                        <div className="card-body p-3 d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted text-uppercase font-w600" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                                    Pending Calls
                                </div>
                                <h3 className="font-w700 mb-0 mt-1" style={{ fontSize: '24px', color: '#f59e0b' }}>
                                    {stats.pending}
                                </h3>
                            </div>
                            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#fffbeb', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                                <i className="fa fa-clock"></i>
                            </div>
                        </div>
                    </div>
                </Col>

                <Col xl={3} sm={6}>
                    <div className="card mb-0 shadow-sm" style={{ borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                        <div className="card-body p-3 d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted text-uppercase font-w600" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                                    Called Leads
                                </div>
                                <h3 className="font-w700 mb-0 mt-1" style={{ fontSize: '24px', color: '#0ea5e9' }}>
                                    {stats.called}
                                </h3>
                            </div>
                            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#f0f9ff', color: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                                <i className="fa fa-phone"></i>
                            </div>
                        </div>
                    </div>
                </Col>

                <Col xl={3} sm={6}>
                    <div 
                        className="card mb-0 shadow-sm" 
                        onClick={() => navigate('/crm_new/converted-opportunities')}
                        style={{ 
                            borderRadius: '10px', 
                            border: '1px solid #e2e8f0',
                            backgroundColor: '#fff',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                        title="Click to view Converted Opportunities page"
                    >
                        <div className="card-body p-3 d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted text-uppercase font-w600" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                                    Converted to Opportunity
                                </div>
                                <h3 className="font-w700 mb-0 mt-1" style={{ fontSize: '24px', color: '#10b981' }}>
                                    {stats.converted}
                                </h3>
                            </div>
                            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                                <i className="fa fa-trophy"></i>
                            </div>
                        </div>
                    </div>
                </Col>
            </Row>

            {/* ── 2. Unified Enterprise Main Card ── */}
            <Card className="shadow-sm mb-4" style={{ borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2 py-3 px-4">
                    <div className="d-flex align-items-center gap-2">
                        <Card.Title className="mb-0" style={{ fontSize: '16px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {assignmentTab === 'individual' 
                                ? 'Individual Assigned Leads' 
                                : (assignmentTab === 'reassigned' && canViewReassignedTab)
                                    ? 'Reassigned Calls'
                                    : 'Team Assigned Leads'}
                        </Card.Title>
                        {(assignmentTab !== 'reassigned' || !canViewReassignedTab) && (
                            <Badge bg="primary" style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px' }}>
                                {filtered.length} {filtered.length === 1 ? 'Lead' : 'Leads'}
                            </Badge>
                        )}
                    </div>

                    <div className="d-flex flex-wrap align-items-center gap-2">
                        {/* 1. Three Tabs & Search Bar in the SAME ROW */}
                        <div className="lead-tabs-search-row">
                            {/* Tab Switcher: Capsule Segmented Control (Individual Assigned vs Team Assigned vs Reassigned Calls) */}
                            <div
                                className="d-flex align-items-center gap-1 view-switcher-container"
                                style={{
                                    background: '#f0f1f3',
                                    borderRadius: 999,
                                    padding: 4
                                }}
                            >
                                <button
                                    type="button"
                                    className="btn btn-sm d-flex align-items-center"
                                    onClick={() => setAssignmentTab('individual')}
                                    style={{
                                        borderRadius: 999,
                                        fontSize: '0.8rem',
                                        fontWeight: 700,
                                        padding: '6px 14px',
                                        border: 'none',
                                        transition: 'all 0.2s',
                                        background: assignmentTab === 'individual' ? '#fff' : 'transparent',
                                        color: assignmentTab === 'individual' ? '#00b8d9' : '#8a8f98',
                                        boxShadow: assignmentTab === 'individual' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    <i className="fa fa-user me-1.5"></i> Individual Assigned
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm d-flex align-items-center"
                                    onClick={() => setAssignmentTab('team')}
                                    style={{
                                        borderRadius: 999,
                                        fontSize: '0.8rem',
                                        fontWeight: 700,
                                        padding: '6px 14px',
                                        border: 'none',
                                        transition: 'all 0.2s',
                                        background: assignmentTab === 'team' ? '#fff' : 'transparent',
                                        color: assignmentTab === 'team' ? '#00b8d9' : '#8a8f98',
                                        boxShadow: assignmentTab === 'team' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    <i className="fa fa-users me-1.5"></i> Team Assigned
                                </button>
                                {canViewReassignedTab && (
                                    <button
                                        type="button"
                                        className="btn btn-sm d-flex align-items-center"
                                        onClick={() => setAssignmentTab('reassigned')}
                                        style={{
                                            borderRadius: 999,
                                            fontSize: '0.8rem',
                                            fontWeight: 700,
                                            padding: '6px 14px',
                                            border: 'none',
                                            transition: 'all 0.2s',
                                            background: assignmentTab === 'reassigned' ? '#fff' : 'transparent',
                                            color: assignmentTab === 'reassigned' ? '#00b8d9' : '#8a8f98',
                                            boxShadow: assignmentTab === 'reassigned' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        <i className="fa fa-exchange me-1.5"></i> Reassigned Calls
                                    </button>
                                )}
                            </div>

                            {/* Standard Search Bar with SVG Icon */}
                            <div className="lead-search-bar" style={{ position: 'relative' }}>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="#64748b"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                                >
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                                <Form.Control
                                    type="text"
                                    placeholder="Search leads..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    style={{ height: '36px', borderRadius: '6px', paddingLeft: '34px', fontSize: '13px' }}
                                />
                            </div>
                        </div>

                        {/* 2. Call Outcome Filter */}
                        <Form.Select
                            value={filterOutcome}
                            onChange={e => setFilterOutcome(e.target.value)}
                            style={{ width: '150px', height: '36px', borderRadius: '6px', fontSize: '13px' }}
                        >
                            <option value="">All Call Outcomes</option>
                            <option value="Pending">Pending (0 calls)</option>
                            {isTeamLeader && (
                                <option value="REASSIGNED">Reassigned Calls ({reassignedCount})</option>
                            )}
                            {Object.keys(OUTCOME_META).filter(outcome => outcome !== 'Converted').map(outcome => (
                                <option key={outcome} value={outcome}>{OUTCOME_META[outcome]?.label || outcome}</option>
                            ))}
                        </Form.Select>

                        {/* Clear Filters */}
                        {(search || filterOutcome) && (
                            <button
                                type="button"
                                className="btn btn-sm btn-light text-danger"
                                onClick={() => { setSearch(''); setFilterOutcome(''); setFilterPriority(''); }}
                                style={{ height: '36px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, padding: '0 10px' }}
                                title="Clear Filters"
                            >
                                <i className="fa fa-times me-1"></i> Clear
                            </button>
                        )}

                        {/* Reload Button */}
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={fetchAllLeads}
                            disabled={loading}
                            style={{ height: '36px', width: '36px', borderRadius: '6px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Refresh Leads"
                        >
                            <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
                        </button>
                    </div>
                </Card.Header>

                <Card.Body className="p-0">
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status"></div>
                            <p className="mt-2 text-muted" style={{ fontSize: '13px' }}>Loading assigned leads...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-5 my-4">
                            <div style={{
                                width: '64px', height: '64px', borderRadius: '50%',
                                background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '24px', marginBottom: '14px'
                            }}>
                                <i className="fa fa-headphones"></i>
                            </div>
                            <h5 className="font-w700 text-dark mb-1">
                                {assignmentTab === 'individual' 
                                    ? 'No Individual Assigned Leads' 
                                    : assignmentTab === 'reassigned'
                                        ? 'No Reassigned Calls'
                                        : 'No Team Assigned Leads'}
                            </h5>
                            <p className="text-muted mb-3" style={{ fontSize: '13px', maxWidth: '440px', margin: '0 auto' }}>
                                {search || filterOutcome || filterPriority
                                    ? 'No assigned leads matched your filter criteria. Try clearing filters.'
                                    : assignmentTab === 'individual'
                                        ? 'You currently do not have any individual leads assigned for calling. Leads assigned to you by your manager will automatically appear here.'
                                        : assignmentTab === 'reassigned'
                                            ? 'No calls have been requested for reassignment. When callers request reassignment, they will appear here.'
                                            : 'You currently do not have any team leads assigned for calling. Leads assigned to your telecalling team by your manager will automatically appear here.'}
                            </p>
                            {(search || filterOutcome || filterPriority) ? (
                                <button
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => { setSearch(''); setFilterOutcome(''); setFilterPriority(''); }}
                                    style={{ borderRadius: '6px' }}
                                >
                                    Clear Filters
                                </button>
                            ) : (
                                <button
                                    className="btn btn-sm btn-primary"
                                    onClick={fetchAllLeads}
                                    style={{ borderRadius: '6px' }}
                                >
                                    <i className="fas fa-sync-alt me-1"></i> Check Again
                                </button>
                            )}
                        </div>
                    ) : (
                        /* ── Standard ERP Table View ── */
                        <div className="table-responsive">
                            <table className="table table-hover cml-table mb-0 align-middle">
                                <thead style={{ backgroundColor: '#f8fafc' }}>
                                    <tr>
                                        <th style={{ width: '50px' }}>SL.NO</th>
                                        <th>COMPANY / LEAD</th>
                                        <th>CONTACT DETAILS</th>
                                        <th>LOCATION</th>
                                        <th>PRIORITY</th>
                                        {assignmentTab !== 'individual' && (
                                            <th>
                                                {assignmentTab === 'reassigned' 
                                                    ? 'ASSIGNED TEAM / CALLER' 
                                                    : 'ASSIGNED TEAM'}
                                            </th>
                                        )}
                                        <th>CALL STATUS</th>
                                        <th>LAST CALLED PERSON</th>
                                        <th className="text-center">HISTORY</th>
                                        <th className="text-end" style={{ minWidth: '240px' }}>ACTIONS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((item, index) => {
                                        const lead = item.lead || {};
                                        const leadName = getLeadName(lead);
                                        const phone = lead.phone || lead.mobile;
                                        const outcomeInfo = item.last_outcome ? OUTCOME_META[item.last_outcome] : null;
                                        const priorityInfo = PRIORITY_META[lead.priority] || PRIORITY_META['Medium'];
                                        const reassignDetails = getReassignmentDetails(item);
                                        const isAssignedToMe = Boolean(item.assigned_caller_id && item.assigned_caller_id === currentUserId);
                                        const isReassignedToOther = Boolean(item.assigned_caller_id && item.assigned_caller_id !== currentUserId);
                                        const isLeaderOrAssigner = Boolean(
                                            item.is_team_leader || 
                                            item.is_assigner || 
                                            isAdmin || 
                                            (currentUserId && item.team_leader_id === currentUserId) || 
                                            (currentUserId && item.assigned_by_id === currentUserId)
                                        );

                                        return (
                                            <tr key={item.assignment_id}>
                                                <td className="text-muted font-w600">{index + 1}</td>

                                                {/* Company & Name */}
                                                <td>
                                                    <div>
                                                        <div className="font-w700 text-dark" style={{ fontSize: '13.5px' }}>
                                                            {leadName}
                                                        </div>
                                                        <div className="text-muted" style={{ fontSize: '11.5px' }}>
                                                            {lead.company ? (
                                                                <span><i className="fa fa-building-o me-1"></i>{lead.company}</span>
                                                            ) : (
                                                                <span>—</span>
                                                            )}
                                                            {(lead.category_name || item.lead_source) && (
                                                                <span className="badge bg-light text-secondary ms-1" style={{ fontSize: '10px' }}>
                                                                    {lead.category_name || item.lead_source}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Contact Details */}
                                                <td>
                                                    <div>
                                                        {phone ? (
                                                            <a href={`tel:${phone}`} className="text-primary font-w600 text-decoration-none d-inline-flex align-items-center gap-1" style={{ fontSize: '13px' }}>
                                                                <i className="fa fa-phone text-success"></i> {phone}
                                                            </a>
                                                        ) : (
                                                            <span className="text-muted">—</span>
                                                        )}
                                                        {lead.email && (
                                                            <div className="text-muted" style={{ fontSize: '11.5px' }}>
                                                                <i className="fa fa-envelope-o me-1"></i>{lead.email}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Location */}
                                                <td>
                                                    <span className="text-dark" style={{ fontSize: '12.5px' }}>
                                                        {[lead.city, lead.state_province].filter(Boolean).join(', ') || '—'}
                                                    </span>
                                                </td>

                                                {/* Priority */}
                                                <td>
                                                    <span
                                                        className={`badge ${getPriorityBadgeClass(lead.priority)}`}
                                                        style={{
                                                            borderRadius: '8px',
                                                            fontSize: '12px',
                                                            fontWeight: 700,
                                                            padding: '5px 14px',
                                                            minHeight: '28px',
                                                            lineHeight: 1.2,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                    >
                                                        {lead.priority || 'Medium'}
                                                    </span>
                                                </td>

                                                {/* Assigned Team / Caller */}
                                                {assignmentTab !== 'individual' && (
                                                    <td>
                                                        {item.team_name || item.team_id ? (
                                                            <span className="badge bg-light text-primary font-w600" style={{ fontSize: '11px', padding: '5px 9px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                                                                <i className="fa fa-users me-1"></i>
                                                                {item.team_name || 'Team'}
                                                            </span>
                                                        ) : (
                                                            <div className="d-inline-flex align-items-center gap-1 flex-wrap">
                                                                <span className="badge bg-light text-dark font-w600" style={{ fontSize: '11px', padding: '5px 9px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                                                                    <i className="fa fa-user text-info me-1"></i>
                                                                    {item.assigned_employee_name || item.reassignment_requested_by_name || 'Caller'}
                                                                </span>
                                                                <span className="badge bg-light text-secondary font-w600" style={{ fontSize: '10px', padding: '3px 6px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                                                    Individual
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>
                                                )}

                                                {/* Call Status */}
                                                <td>
                                                    {item.is_in_call ? (
                                                        <span
                                                            className="badge badge-danger light"
                                                            style={{
                                                                borderRadius: '8px',
                                                                fontSize: '12px',
                                                                fontWeight: 700,
                                                                padding: '5px 14px',
                                                                minHeight: '28px',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                gap: '6px',
                                                                lineHeight: 1.2
                                                            }}
                                                            title={item.active_call_by_me ? 'You are calling this lead' : `In call by ${item.active_caller_name || 'another team member'}`}
                                                        >
                                                            <span
                                                                className="spinner-grow spinner-grow-sm text-danger"
                                                                style={{ width: '6px', height: '6px', animationDuration: '0.8s' }}
                                                                role="status"
                                                            ></span>
                                                            In Call {item.active_caller_name ? `(${item.active_caller_name})` : ''}
                                                        </span>
                                                    ) : item.last_outcome ? (
                                                        <span
                                                            className={`badge ${getOutcomeBadgeClass(item.last_outcome)}`}
                                                            style={{
                                                                borderRadius: '8px',
                                                                fontSize: '12px',
                                                                fontWeight: 700,
                                                                padding: '5px 14px',
                                                                minHeight: '28px',
                                                                lineHeight: 1.2,
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}
                                                        >
                                                            {OUTCOME_META[item.last_outcome]?.label || item.last_outcome}
                                                        </span>
                                                    ) : (
                                                        <span
                                                            className="badge badge-secondary light"
                                                            style={{
                                                                borderRadius: '8px',
                                                                fontSize: '12px',
                                                                fontWeight: 700,
                                                                padding: '5px 14px',
                                                                minHeight: '28px',
                                                                lineHeight: 1.2,
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}
                                                        >
                                                            Pending
                                                        </span>
                                                    )}

                                                    {/* Reassignment Status Badges */}
                                                    {assignmentTab === 'reassigned' && (
                                                        <>
                                                            {item.reassignment_status === 'REQUESTED' && (
                                                                <div className="mt-1">
                                                                    <span
                                                                        className="badge"
                                                                        style={{
                                                                            background: '#ede9fe',
                                                                            color: '#6d28d9',
                                                                            border: '1px solid #ddd6fe',
                                                                            borderRadius: '8px',
                                                                            fontSize: '10px',
                                                                            padding: '3px 8px',
                                                                            cursor: isTeamLeader ? 'pointer' : 'default'
                                                                        }}
                                                                        onClick={() => isTeamLeader ? setViewReassignTarget(item) : null}
                                                                        title={isTeamLeader ? `Reassigned by ${reassignDetails.callerName} — Click to view details` : 'Reassignment requested to team leader'}
                                                                    >
                                                                        <i className="fa fa-exchange me-1"></i>
                                                                        {isTeamLeader ? `Reassigned by: ${reassignDetails.callerName}` : 'Reassign Req'}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {item.reassignment_status === 'REASSIGNED' && (
                                                                <div className="mt-1">
                                                                    <span
                                                                        className="badge"
                                                                        style={{
                                                                            background: '#ede9fe',
                                                                            color: '#6d28d9',
                                                                            border: '1px solid #ddd6fe',
                                                                            borderRadius: '8px',
                                                                            fontSize: '10px',
                                                                            padding: '3px 8px',
                                                                            cursor: isTeamLeader ? 'pointer' : 'default'
                                                                        }}
                                                                        onClick={() => isTeamLeader ? setViewReassignTarget(item) : null}
                                                                        title={isTeamLeader ? `Reassigned by ${reassignDetails.callerName} — Click to view details` : 'Reassigned to team leader'}
                                                                    >
                                                                        <i className="fa fa-exchange me-1"></i>
                                                                        {isTeamLeader ? `Reassigned by: ${reassignDetails.callerName}` : 'Reassigned'}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </td>

                                                {/* Last Called Person */}
                                                <td>
                                                    {(() => {
                                                        const lastCaller = item.last_caller_name || (item.call_logs && item.call_logs.length > 0 ? item.call_logs[0]?.caller_name : null) || (item.is_in_call ? item.active_caller_name : null);
                                                        return lastCaller ? (
                                                            <span
                                                                className="badge bg-light text-dark font-w600"
                                                                style={{ fontSize: '11px', padding: '5px 9px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                                                                title={`Last called by ${lastCaller}`}
                                                            >
                                                                <i className="fa fa-user-circle text-primary me-1"></i>
                                                                {lastCaller}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted" style={{ fontSize: '12px' }}>—</span>
                                                        );
                                                    })()}
                                                </td>

                                                {/* History Count */}
                                                <td className="text-center">
                                                    <button
                                                        type="button"
                                                        className="btn btn-xs btn-outline-secondary"
                                                        onClick={() => setHistoryTarget(item)}
                                                        style={{ borderRadius: '4px', fontSize: '12px', padding: '4px 8px', border: '1px solid #cbd5e1' }}
                                                        title={`View Call History (${item.total_calls} calls)`}
                                                    >
                                                        <i className="fa fa-history text-primary"></i>
                                                    </button>
                                                </td>

                                                {/* Actions */}
                                                <td className="text-end">
                                                    <div className="d-flex align-items-center justify-content-end gap-1.5 flex-wrap">
                                                        {item.is_in_call && !item.active_call_by_me ? (
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-secondary"
                                                                disabled
                                                                style={{
                                                                    height: '32px',
                                                                    width: '34px',
                                                                    borderRadius: '6px',
                                                                    fontSize: '13px',
                                                                    padding: '0',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    opacity: 0.65,
                                                                    cursor: 'not-allowed',
                                                                    backgroundColor: '#94a3b8',
                                                                    borderColor: '#94a3b8',
                                                                    color: '#ffffff'
                                                                }}
                                                                title={`Calling disabled — currently on call with ${item.active_caller_name || 'another team member'}`}
                                                            >
                                                                <i className="fa fa-phone-slash"></i>
                                                            </button>
                                                        ) : (isReassignedToOther || (item.is_contacted && !item.contacted_by_me)) ? (
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-secondary"
                                                                disabled
                                                                style={{
                                                                    height: '32px',
                                                                    width: '34px',
                                                                    borderRadius: '6px',
                                                                    fontSize: '13px',
                                                                    padding: '0',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    opacity: 0.65,
                                                                    cursor: 'not-allowed',
                                                                    backgroundColor: '#94a3b8',
                                                                    borderColor: '#94a3b8',
                                                                    color: '#ffffff'
                                                                }}
                                                                title={
                                                                    isReassignedToOther
                                                                        ? `Calling disabled — lead reassigned to ${item.assigned_caller_name || 'another team member'}`
                                                                        : `Calling disabled — lead already contacted by ${item.contacted_caller_name || 'another team member'}`
                                                                }
                                                            >
                                                                <i className="fa fa-phone-slash"></i>
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-success"
                                                                onClick={() => handleInitiateCall(item)}
                                                                style={{
                                                                    height: '32px',
                                                                    width: '34px',
                                                                    borderRadius: '6px',
                                                                    fontSize: '13px',
                                                                    padding: '0',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    color: '#ffffff'
                                                                }}
                                                                title="Direct Call"
                                                            >
                                                                <i className="fa fa-phone"></i>
                                                            </button>
                                                        )}
                                                        {canViewReassignedTab && assignmentTab === 'reassigned' && (
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm"
                                                                onClick={() => setViewReassignTarget(item)}
                                                                style={{
                                                                    height: '32px',
                                                                    borderRadius: '6px',
                                                                    fontSize: '12px',
                                                                    fontWeight: 600,
                                                                    padding: '0 10px',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    border: '1px solid #0284c7',
                                                                    color: '#0284c7',
                                                                    backgroundColor: '#f0f9ff'
                                                                }}
                                                                title="View Reassignment Information"
                                                            >
                                                                <i className="fa fa-eye"></i> View
                                                            </button>
                                                        )}
                                                        {item.reassignment_status === 'REQUESTED' && !isLeaderOrAssigner ? (
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm"
                                                                disabled
                                                                style={{
                                                                    height: '32px',
                                                                    borderRadius: '6px',
                                                                    fontSize: '12px',
                                                                    fontWeight: 600,
                                                                    padding: '0 10px',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    opacity: 0.85,
                                                                    cursor: 'not-allowed',
                                                                    border: '1px solid #ddd6fe',
                                                                    color: '#6d28d9',
                                                                    backgroundColor: '#ede9fe'
                                                                }}
                                                                title={`Reassignment requested: "${item.reassignment_reason}"`}
                                                            >
                                                                <i className="fa fa-clock-o"></i> Reassigned
                                                            </button>
                                                        ) : isReassignedToOther && !isLeaderOrAssigner ? (
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm"
                                                                disabled
                                                                style={{
                                                                    height: '32px',
                                                                    borderRadius: '6px',
                                                                    fontSize: '12px',
                                                                    fontWeight: 600,
                                                                    padding: '0 10px',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    opacity: 0.65,
                                                                    cursor: 'not-allowed',
                                                                    border: '1px solid #e2e8f0',
                                                                    color: '#94a3b8',
                                                                    backgroundColor: '#f1f5f9'
                                                                }}
                                                                title={`Lead reassigned to ${item.assigned_caller_name || 'another member'}`}
                                                            >
                                                                <i className="fa fa-exchange"></i> Reassign
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm"
                                                                onClick={() => handleOpenReassignModal(item)}
                                                                style={{
                                                                    height: '32px',
                                                                    borderRadius: '6px',
                                                                    fontSize: '12px',
                                                                    fontWeight: 600,
                                                                    padding: '0 10px',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    border: '1px solid #6d28d9',
                                                                    backgroundColor: '#7c3aed',
                                                                    color: '#ffffff',
                                                                    boxShadow: '0 1px 2px rgba(124, 58, 237, 0.25)'
                                                                }}
                                                                title={
                                                                    isLeaderOrAssigner
                                                                        ? (item.reassignment_status === 'REQUESTED' ? `Reassignment requested by ${item.reassignment_requested_by_name || 'caller'}: "${item.reassignment_reason}" — Click to reassign` : 'Reassign lead to member')
                                                                        : (item.team_name ? 'Request call reassignment to team leader' : 'Request call reassignment to assigner')
                                                                }
                                                            >
                                                                <i className="fa fa-exchange"></i> {isLeaderOrAssigner && item.reassignment_status === 'REQUESTED' ? 'Reassign (Req)' : 'Reassign'}
                                                            </button>
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
                </Card.Body>
            </Card>

            {/* ── 3. Active Call Floating Widget (shown only during active ongoing call) ── */}
            {activeCall && isCallInProgress && (
                <div className="cml-floating-call" id="active-call-banner" style={{ zIndex: 1060 }}>
                    <div
                        className="d-flex align-items-center gap-3 mb-2"
                        onClick={() => setShowLogModal(true)}
                        style={{ cursor: 'pointer' }}
                        title="Click to open Call Log & History"
                    >
                        <div style={{
                            width: '42px', height: '42px', borderRadius: '50%',
                            background: 'rgba(46, 206, 138, 0.2)', color: '#2ece8a',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.2rem'
                        }}>
                            <i className="fa fa-phone"></i>
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                            <div className="font-w700 text-truncate text-white" style={{ fontSize: '14px' }}>
                                {getLeadName(activeCall.lead)}
                            </div>
                            <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                                {activeCall.phone}
                            </div>
                        </div>
                    </div>

                    <div className="text-center py-2">
                        <div style={{
                            fontSize: '2.4rem', fontWeight: 900, letterSpacing: '2px',
                            color: '#2ece8a', fontVariantNumeric: 'tabular-nums', lineHeight: 1
                        }}>
                            {formatSeconds(callSeconds)}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '12px', margin: '6px 0 14px' }}>
                            <span className="spinner-grow spinner-grow-sm text-success me-1" style={{ width: '8px', height: '8px' }}></span>
                            Call in progress...
                        </div>
                        <div className="d-flex flex-column gap-2">
                            <button
                                id="end-call-btn"
                                type="button"
                                onClick={handleEndCall}
                                className="btn btn-danger w-100 py-2 font-w600"
                                style={{ borderRadius: '50px', boxShadow: '0 4px 15px rgba(239,68,68,0.4)' }}
                            >
                                <i className="fa fa-phone me-2"></i> End Call
                            </button>

                            {!showLogModal && (
                                <button
                                    type="button"
                                    onClick={() => setShowLogModal(true)}
                                    className="btn btn-sm btn-success w-100 py-2 font-w600"
                                    style={{ borderRadius: '25px', fontSize: '12px' }}
                                >
                                    <i className="fa fa-expand me-1"></i> Open Call Log &amp; History
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── 4. Call History Modal ── */}
            <Modal
                show={!!historyTarget}
                onHide={() => setHistoryTarget(null)}
                centered
                size="lg"
            >
                <Modal.Header closeButton style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <div className="d-flex align-items-center justify-content-between w-100 me-3 flex-wrap gap-2">
                        <Modal.Title style={{ fontSize: '16px', fontWeight: 700 }}>
                            <i className="fa fa-history text-primary me-2"></i>
                            Call History — {getLeadName(historyTarget?.lead || {})}
                        </Modal.Title>
                        {historyTarget?.call_logs && historyTarget.call_logs.length > 0 && (
                            <div className="btn-group" role="group" style={{ height: '28px' }}>
                                <button
                                    type="button"
                                    className={`btn btn-xs ${modalHistoryViewMode === 'detailed' ? 'btn-primary' : 'btn-outline-secondary'}`}
                                    onClick={() => setModalHistoryViewMode('detailed')}
                                    style={{ fontSize: '11px', padding: '2px 9px', borderRadius: '4px 0 0 4px', fontWeight: 600 }}
                                    title="View full chronological call logs"
                                >
                                    <i className="fa fa-list me-1"></i> Full History
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-xs ${modalHistoryViewMode === 'summary' ? 'btn-primary' : 'btn-outline-secondary'}`}
                                    onClick={() => setModalHistoryViewMode('summary')}
                                    style={{ fontSize: '11px', padding: '2px 9px', borderRadius: '0 4px 4px 0', fontWeight: 600 }}
                                    title="View consolidated summary & key points"
                                >
                                    <i className="fa fa-bolt me-1"></i> Summary
                                </button>
                            </div>
                        )}
                    </div>
                </Modal.Header>
                <Modal.Body className="p-4" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                    {historyTarget?.lead?.company && (
                        <div className="p-2 px-3 mb-3 bg-light rounded d-flex justify-content-between align-items-center" style={{ fontSize: '12.5px' }}>
                            <div>
                                <strong>Company:</strong> {historyTarget.lead.company} · <strong>Contact:</strong> {historyTarget.lead.phone || historyTarget.lead.mobile || '—'}
                            </div>
                            <span className="badge bg-secondary">Total: {historyTarget.call_logs?.length || 0} calls</span>
                        </div>
                    )}

                    {!historyTarget?.call_logs || historyTarget.call_logs.length === 0 ? (
                        <div className="text-center py-4 text-muted" style={{ fontSize: '13px' }}>
                            <i className="fa fa-info-circle fa-2x mb-2 text-secondary"></i>
                            <div>No previous call logs recorded for this lead.</div>
                        </div>
                    ) : modalHistoryViewMode === 'summary' ? (
                        renderConsolidatedSummary(historyTarget.call_logs)
                    ) : (
                        <div className="d-flex flex-column gap-2">
                            {historyTarget.call_logs.map((log) => {
                                const logMeta = OUTCOME_META[log.call_outcome];
                                return (
                                    <div key={log.id} className="p-3 border rounded" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
                                        <div className="d-flex align-items-center justify-content-between mb-2">
                                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                                <span
                                                    className={`badge ${getOutcomeBadgeClass(log.call_outcome)}`}
                                                    style={{
                                                        borderRadius: '8px',
                                                        fontSize: '11.5px',
                                                        fontWeight: 600,
                                                        padding: '4px 10px'
                                                    }}
                                                >
                                                    {OUTCOME_META[log.call_outcome]?.label || log.call_outcome}
                                                </span>
                                                {log.duration_display && (
                                                    <span className="badge bg-light text-muted" style={{ fontSize: '11px' }}>
                                                        <i className="fa fa-clock me-1"></i> {log.duration_display}
                                                    </span>
                                                )}
                                                {log.caller_name && (
                                                    <span className="badge bg-light text-dark" style={{ fontSize: '11px', border: '1px solid #e2e8f0', fontWeight: 500 }}>
                                                        <i className="fa fa-user-circle-o me-1 text-primary"></i> Caller: <strong className="ms-1">{log.caller_name}</strong>
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-muted" style={{ fontSize: '11.5px' }}>
                                                {formatDateTime(log.called_at)}
                                            </div>
                                        </div>
                                        {log.notes && (
                                            <p className="mb-2 text-dark" style={{ fontSize: '13px', whiteSpace: 'pre-line' }}>
                                                {log.notes}
                                            </p>
                                        )}
                                        {log.follow_up_date && (
                                            <div className="text-warning font-w600" style={{ fontSize: '12px' }}>
                                                <i className="fa fa-calendar-check-o me-1"></i> Next Follow-up: {formatDate(log.follow_up_date)}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer style={{ borderTop: '1px solid #e2e8f0' }}>
                    <Button variant="light" size="sm" onClick={() => setHistoryTarget(null)} style={{ borderRadius: '6px' }}>
                        Close
                    </Button>
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                            const target = historyTarget;
                            setHistoryTarget(null);
                            openLogModal(target);
                        }}
                        style={{ borderRadius: '6px' }}
                    >
                        <i className="fa fa-edit me-1"></i> Log New Call
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* ── 5. Unified Call & Log Modal (History shown only when calling) ── */}
            <Modal
                show={showLogModal && !!logTarget}
                onHide={handleCloseLogModal}
                backdrop="static"
                keyboard={false}
                centered
                size={isCallSession ? "xl" : "lg"}
            >
                <Modal.Header closeButton={!isCallSession || isCallInProgress} style={{ borderBottom: '1px solid #e2e8f0', background: '#fafbfc' }}>
                    <div className="d-flex align-items-center justify-content-between w-100 pe-3">
                        <Modal.Title style={{ fontSize: '16px', fontWeight: 700 }}>
                            <i className={`fa ${isCallSession ? 'fa-phone' : 'fa-edit'} text-primary me-2`}></i>
                            {isCallSession ? (isCallInProgress ? 'Calling' : 'Call & Log') : 'Log Call Feedback'} — {getLeadName(logTarget?.lead || {})}
                        </Modal.Title>
                        <div className="d-flex align-items-center gap-2">
                            {isCallInProgress && (
                                <>
                                    <span className="badge bg-success d-inline-flex align-items-center gap-1" style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '20px' }}>
                                        <span className="spinner-grow spinner-grow-sm" style={{ width: '6px', height: '6px' }}></span>
                                        Call in progress
                                    </span>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-light border text-muted"
                                        onClick={handleCloseLogModal}
                                        title="Minimize"
                                        style={{ borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: 600 }}
                                    >
                                        Minimize
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </Modal.Header>

                <Modal.Body className="p-4">
                    <Row className="g-4">
                        {/* ── Left Column: Previous Call History & Categorized Offers ── */}
                        {isCallSession && (
                            <Col lg={6} md={12} className="cml-history-col">
                                <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom flex-wrap gap-2">
                                    <div className="btn-group" role="group">
                                        <button
                                            type="button"
                                            className={`btn btn-sm d-inline-flex align-items-center justify-content-center gap-2 ${
                                                activeLeftTab === 'history' ? 'btn-primary text-white' : 'btn-outline-primary'
                                            }`}
                                            onClick={() => setActiveLeftTab('history')}
                                            style={{
                                                fontWeight: 600,
                                                fontSize: '12.5px',
                                                height: '32px',
                                                padding: '0 12px',
                                                lineHeight: 1,
                                                borderRadius: '6px 0 0 6px'
                                            }}
                                        >
                                            <i className="fa fa-history" style={{ fontSize: '13px', lineHeight: 1 }}></i>
                                            <span style={{ lineHeight: 1 }}>Call History</span>
                                            <span
                                                className="badge rounded-pill"
                                                style={{
                                                    fontSize: '10.5px',
                                                    fontWeight: 700,
                                                    padding: '2px 7px',
                                                    lineHeight: 1,
                                                    backgroundColor: activeLeftTab === 'history' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(16, 185, 129, 0.15)',
                                                    color: activeLeftTab === 'history' ? '#ffffff' : 'inherit'
                                                }}
                                            >
                                                {logTarget?.call_logs?.length || 0}
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            className={`btn btn-sm d-inline-flex align-items-center justify-content-center gap-2 ${
                                                activeLeftTab === 'offers' ? 'btn-primary text-white' : 'btn-outline-primary'
                                            }`}
                                            onClick={() => setActiveLeftTab('offers')}
                                            style={{
                                                fontWeight: 600,
                                                fontSize: '12.5px',
                                                height: '32px',
                                                padding: '0 12px',
                                                lineHeight: 1,
                                                borderRadius: '0 6px 6px 0'
                                            }}
                                        >
                                            <i className="fa fa-gift" style={{ fontSize: '13px', lineHeight: 1 }}></i>
                                            <span style={{ lineHeight: 1 }}>Offers</span>
                                            <span
                                                className="badge rounded-pill"
                                                style={{
                                                    fontSize: '10.5px',
                                                    fontWeight: 700,
                                                    padding: '2px 7px',
                                                    lineHeight: 1,
                                                    backgroundColor: activeLeftTab === 'offers' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(16, 185, 129, 0.15)',
                                                    color: activeLeftTab === 'offers' ? '#ffffff' : 'inherit'
                                                }}
                                            >
                                                {offers.length}
                                            </span>
                                        </button>
                                    </div>
                                    {activeLeftTab === 'history' && logTarget?.call_logs && logTarget.call_logs.length > 0 && (
                                        <div className="btn-group" role="group">
                                            <button
                                                type="button"
                                                className={`btn btn-xs d-inline-flex align-items-center justify-content-center gap-1 ${
                                                    callHistoryViewMode === 'detailed' ? 'btn-primary text-white' : 'btn-outline-primary'
                                                }`}
                                                onClick={() => setCallHistoryViewMode('detailed')}
                                                style={{
                                                    fontSize: '11px',
                                                    height: '28px',
                                                    padding: '0 10px',
                                                    borderRadius: '5px 0 0 5px',
                                                    fontWeight: 600,
                                                    lineHeight: 1
                                                }}
                                                title="View full chronological call logs"
                                            >
                                                <i className="fa fa-list" style={{ fontSize: '11px', lineHeight: 1 }}></i>
                                                <span style={{ lineHeight: 1 }}>Full</span>
                                            </button>
                                            <button
                                                type="button"
                                                className={`btn btn-xs d-inline-flex align-items-center justify-content-center gap-1 ${
                                                    callHistoryViewMode === 'summary' ? 'btn-primary text-white' : 'btn-outline-primary'
                                                }`}
                                                onClick={() => setCallHistoryViewMode('summary')}
                                                style={{
                                                    fontSize: '11px',
                                                    height: '28px',
                                                    padding: '0 10px',
                                                    borderRadius: '0 5px 5px 0',
                                                    fontWeight: 600,
                                                    lineHeight: 1
                                                }}
                                                title="View consolidated summary & key points"
                                            >
                                                <i className="fa fa-bolt" style={{ fontSize: '11px', lineHeight: 1 }}></i>
                                                <span style={{ lineHeight: 1 }}>Summary</span>
                                            </button>
                                        </div>
                                    )}
                                    {activeLeftTab === 'offers' && (
                                        <button
                                            type="button"
                                            className="btn btn-xs btn-link text-decoration-none p-0 text-muted"
                                            onClick={fetchActiveOffers}
                                            title="Refresh offers"
                                        >
                                            <i className={`fa fa-refresh me-1 ${activeOffersLoading ? 'fa-spin' : ''}`}></i> Refresh
                                        </button>
                                    )}
                                </div>

                                {activeLeftTab === 'history' ? (
                                    <div className="pe-1" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                                        {!logTarget?.call_logs || logTarget.call_logs.length === 0 ? (
                                            <div className="text-center py-5 text-muted" style={{ background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                                                <i className="fa fa-info-circle fa-2x mb-2 text-secondary opacity-50"></i>
                                                <div className="font-w600" style={{ fontSize: '13px' }}>No Previous Call Logs</div>
                                                <div style={{ fontSize: '12px' }}>This will be the first recorded call for this lead.</div>
                                            </div>
                                        ) : callHistoryViewMode === 'summary' ? (
                                            renderConsolidatedSummary(logTarget.call_logs)
                                        ) : (
                                            <div className="d-flex flex-column gap-2">
                                                {logTarget.call_logs.map((log) => {
                                                    const logMeta = OUTCOME_META[log.call_outcome];
                                                    return (
                                                        <div key={log.id} className="p-3 border rounded shadow-none" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
                                                            <div className="d-flex align-items-center justify-content-between mb-2">
                                                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                                                    <span
                                                                        className={`badge ${getOutcomeBadgeClass(log.call_outcome)}`}
                                                                        style={{
                                                                            borderRadius: '8px',
                                                                            fontSize: '11.5px',
                                                                            fontWeight: 600,
                                                                            padding: '4px 10px'
                                                                        }}
                                                                    >
                                                                        {OUTCOME_META[log.call_outcome]?.label || log.call_outcome}
                                                                    </span>
                                                                    {log.duration_display && (
                                                                        <span className="badge bg-light text-muted" style={{ fontSize: '11px' }}>
                                                                            <i className="fa fa-clock me-1"></i> {log.duration_display}
                                                                        </span>
                                                                    )}
                                                                    {log.caller_name && (
                                                                        <span className="badge bg-light text-dark" style={{ fontSize: '11px', border: '1px solid #e2e8f0', fontWeight: 500 }}>
                                                                            <i className="fa fa-user-circle-o me-1 text-primary"></i> Caller: <strong className="ms-1">{log.caller_name}</strong>
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-muted" style={{ fontSize: '11px' }}>
                                                                    {formatDateTime(log.called_at)}
                                                                </div>
                                                            </div>
                                                            {log.notes && (
                                                                <div className="p-2 mb-2 rounded" style={{ background: '#f8fafc', borderLeft: '3px solid #3b82f6', fontSize: '12.5px', color: '#1e293b', whiteSpace: 'pre-line' }}>
                                                                    {log.notes}
                                                                </div>
                                                            )}
                                                            {log.follow_up_date && (
                                                                <div className="text-warning font-w600" style={{ fontSize: '11.5px' }}>
                                                                    <i className="fa fa-calendar-check-o me-1"></i> Next Follow-up: {formatDate(log.follow_up_date)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* Active Offers / Schemes View */
                                    <div>
                                        {/* Filter Controls: Category Pills */}
                                        <div className="mb-3 d-flex align-items-center gap-1 flex-wrap pb-2 border-bottom" style={{ fontSize: '12px' }}>
                                            <span className="text-muted fw-semibold me-1">Category:</span>
                                            {[
                                                { key: 'ALL', label: `All (${offers.length})` },
                                                { key: 'Amount Based', label: 'Amount Based' },
                                                { key: 'Product Based', label: 'Product Based' },
                                                { key: 'Service Based', label: 'Service Based' },
                                            ].map(cat => {
                                                const isSelected = selectedOfferCategory === cat.key;
                                                return (
                                                    <button
                                                        key={cat.key}
                                                        type="button"
                                                        className="btn btn-xs"
                                                        onClick={() => setSelectedOfferCategory(cat.key)}
                                                        style={{
                                                            padding: '3px 10px',
                                                            borderRadius: '14px',
                                                            fontSize: '11.5px',
                                                            fontWeight: isSelected ? 600 : 400,
                                                            backgroundColor: isSelected ? '#334155' : '#ffffff',
                                                            borderColor: isSelected ? '#334155' : '#cbd5e1',
                                                            color: isSelected ? '#ffffff' : '#475569',
                                                            transition: 'all 0.15s ease'
                                                        }}
                                                    >
                                                        {cat.label}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Offers Cards Scrollable Container */}
                                        <div className="pe-1" style={{ maxHeight: '430px', overflowY: 'auto' }}>
                                            {activeOffersLoading ? (
                                                <div className="text-center py-5 text-muted">
                                                    <span className="spinner-border spinner-border-sm me-2"></span>
                                                    Loading active offers...
                                                </div>
                                            ) : filteredOffers.length === 0 ? (
                                                <div className="text-center py-5 text-muted" style={{ background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                                                    <i className="fa fa-gift fa-2x mb-2 text-secondary opacity-50"></i>
                                                    <div className="font-w600" style={{ fontSize: '13px' }}>No Offers Found</div>
                                                    <div style={{ fontSize: '12px' }}>No active offers match the selected category or search.</div>
                                                    {selectedOfferCategory !== 'ALL' && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-xs btn-outline-secondary mt-2"
                                                            onClick={() => { setSelectedOfferCategory('ALL'); setOfferSearch(''); }}
                                                        >
                                                            Show All Offers
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="d-flex flex-column gap-3">
                                                    {filteredOffers.map((offer) => {
                                                        const pitchText = offer.caller_pitch || offer.description || '';
                                                        return (
                                                            <div
                                                                key={offer.id}
                                                                className="p-3 rounded"
                                                                style={{
                                                                    backgroundColor: '#ffffff',
                                                                    border: '1px solid #e2e8f0',
                                                                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                                                                }}
                                                            >
                                                                {/* Card Header: Title & Category on left, Date Badge on right */}
                                                                <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-2">
                                                                    <div className="d-flex align-items-center gap-2 flex-wrap">
                                                                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                                                                            {offer.title}
                                                                        </span>
                                                                        <span
                                                                            style={{
                                                                                fontSize: '11px',
                                                                                fontWeight: 500,
                                                                                backgroundColor: '#f1f5f9',
                                                                                color: '#475569',
                                                                                border: '1px solid #e2e8f0',
                                                                                borderRadius: '4px',
                                                                                padding: '2px 7px'
                                                                            }}
                                                                        >
                                                                            {offer.criteria_type || 'Amount Based'}
                                                                        </span>
                                                                    </div>
                                                                    <div
                                                                        style={{
                                                                            fontSize: '11.5px',
                                                                            fontWeight: 600,
                                                                            color: '#1e293b',
                                                                            backgroundColor: '#f8fafc',
                                                                            border: '1px solid #cbd5e1',
                                                                            borderRadius: '4px',
                                                                            padding: '3px 8px',
                                                                            whiteSpace: 'nowrap'
                                                                        }}
                                                                    >
                                                                        <i className="fa fa-calendar-check-o text-muted me-1"></i>
                                                                        {offer.start_date || offer.end_date
                                                                            ? `Valid: ${offer.start_date ? formatDate(offer.start_date) : 'Now'} to ${offer.end_date ? formatDate(offer.end_date) : 'Ongoing'}`
                                                                            : 'Always Active'}
                                                                    </div>
                                                                </div>

                                                                {/* Offer Benefit / Criteria Lines */}
                                                                <div className="mb-2">
                                                                    {renderOfferBenefitLines(offer, (tierText) => handleInsertOfferIntoNotes(offer, tierText))}
                                                                </div>

                                                                {/* Sales Pitch Callout */}
                                                                {pitchText && (
                                                                    <div
                                                                        className="p-2 px-3 my-2 rounded"
                                                                        style={{
                                                                            background: '#f8fafc',
                                                                            borderLeft: '3px solid #64748b',
                                                                            fontSize: '12.5px'
                                                                        }}
                                                                    >
                                                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                                                            <span className="fw-semibold" style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                                                                <i className="fa fa-bullhorn me-1"></i> Pitch to Prospect:
                                                                            </span>
                                                                            <button
                                                                                type="button"
                                                                                className="btn btn-xs btn-outline-secondary"
                                                                                onClick={() => handleInsertOfferIntoNotes(offer)}
                                                                                title="Append chosen offer to your call remarks"
                                                                                style={{ fontSize: '11px', padding: '1px 8px', borderRadius: '4px', fontWeight: 500 }}
                                                                            >
                                                                                <i className="fa fa-plus me-1"></i> Add to Notes
                                                                            </button>
                                                                        </div>
                                                                        <div style={{ color: '#334155', fontStyle: 'italic', lineHeight: '1.45' }}>
                                                                            "{pitchText}"
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Terms & Conditions Footer */}
                                                                {offer.terms_and_conditions && (
                                                                    <div className="d-flex justify-content-end text-muted pt-1" style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                                        <span title={offer.terms_and_conditions} style={{ cursor: 'pointer' }}>
                                                                            <i className="fa fa-info-circle me-1"></i> Terms apply
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </Col>
                        )}

                        {/* ── Right Column: Call Feedback Form (full-width when log button is clicked) ── */}
                        <Col lg={isCallSession ? 6 : 12} md={12} className="cml-log-col">
                            {/* Contact Details Header */}
                            {logTarget?.lead && (
                                <div className="p-2 px-3 mb-3 bg-light rounded d-flex align-items-center justify-content-between flex-wrap gap-2" style={{ fontSize: '12.5px', border: '1px solid #e2e8f0' }}>
                                    <div>
                                        <span className="text-muted">Contact:</span> <strong>{logTarget?.lead?.phone || logTarget?.lead?.mobile || '—'}</strong>
                                        {logTarget?.lead?.company && <span className="text-muted"> · {logTarget.lead.company}</span>}
                                    </div>
                                    <div className="d-flex align-items-center gap-2">
                                        <button
                                            type="button"
                                            className={`btn btn-xs d-inline-flex align-items-center justify-content-center gap-1.5 ${activeLeftTab === 'offers' ? 'btn-primary text-white' : 'btn-outline-primary'} font-w600`}
                                            onClick={() => setActiveLeftTab('offers')}
                                            title="View applicable offers"
                                            style={{ borderRadius: '6px', height: '26px', padding: '0 9px', fontSize: '11px', lineHeight: 1 }}
                                        >
                                            <i className="fa fa-gift" style={{ fontSize: '11.5px', lineHeight: 1 }}></i>
                                            <span style={{ lineHeight: 1 }}>Offers</span>
                                            <span
                                                className="badge rounded-pill"
                                                style={{
                                                    fontSize: '10px',
                                                    fontWeight: 700,
                                                    padding: '1px 5px',
                                                    lineHeight: 1,
                                                    backgroundColor: activeLeftTab === 'offers' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(16, 185, 129, 0.15)',
                                                    color: activeLeftTab === 'offers' ? '#ffffff' : 'inherit'
                                                }}
                                            >
                                                {offers.length}
                                            </span>
                                        </button>
                                        {isCallInProgress && (
                                            <span className="badge bg-success-light text-success font-w600" style={{ fontSize: '11px' }}>
                                                <span className="spinner-grow spinner-grow-sm me-1" style={{ width: '6px', height: '6px' }}></span>
                                                Active Call
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Call Feedback Form */}
                            <Form onSubmit={handleSaveLog}>
                                <div className="mb-3">
                                    <Form.Label className="font-w600" style={{ fontSize: '13px' }}>
                                        Call Outcome <span className="text-danger">*</span>
                                    </Form.Label>
                                    <Form.Select
                                        value={logForm.call_outcome}
                                        onChange={e => setLogForm(f => ({ ...f, call_outcome: e.target.value }))}
                                        required
                                        style={{ height: '38px', borderRadius: '6px', fontSize: '13px' }}
                                    >
                                        {Object.keys(OUTCOME_META).filter(outcome => outcome !== 'Converted').map(outcome => (
                                            <option key={outcome} value={outcome}>
                                                {OUTCOME_META[outcome]?.label || outcome}
                                            </option>
                                        ))}
                                    </Form.Select>
                                </div>

                                <div className="mb-3">
                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                        <Form.Label className="font-w600 mb-0" style={{ fontSize: '13px' }}>
                                            Call Duration (seconds) <span className="text-danger">*</span>
                                        </Form.Label>
                                        {isCallInProgress && (
                                            <span className="text-success font-w600" style={{ fontSize: '11.5px' }}>
                                                <i className="fa fa-clock me-1"></i> Live syncing ({callSeconds}s)
                                            </span>
                                        )}
                                    </div>
                                    <Form.Control
                                        type="number"
                                        placeholder="e.g. 120 (2 minutes)"
                                        min={0}
                                        required
                                        value={logForm.duration_seconds}
                                        onChange={e => setLogForm(f => ({ ...f, duration_seconds: e.target.value }))}
                                        style={{ height: '38px', borderRadius: '6px', fontSize: '13px' }}
                                    />
                                </div>

                                <div className="mb-3">
                                    <Form.Label className="font-w600" style={{ fontSize: '13px' }}>
                                        Discussion Notes / Remarks <span className="text-danger">*</span>
                                    </Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        rows={4}
                                        placeholder="Type notes here while on call with the prospect..."
                                        required
                                        value={logForm.notes}
                                        onChange={e => setLogForm(f => ({ ...f, notes: e.target.value }))}
                                        style={{ borderRadius: '6px', fontSize: '13px' }}
                                    />
                                </div>

                                <div className="mb-3">
                                    <Form.Label className="font-w600" style={{ fontSize: '13px' }}>
                                        Scheduled Next Follow-up Date
                                    </Form.Label>
                                    <Form.Control
                                        type="date"
                                        value={logForm.follow_up_date}
                                        onChange={e => setLogForm(f => ({ ...f, follow_up_date: e.target.value }))}
                                        style={{ height: '38px', borderRadius: '6px', fontSize: '13px' }}
                                    />
                                </div>

                                <div className="d-flex align-items-center justify-content-end pt-2 border-top">
                                    <Button type="submit" variant="primary" size="sm" disabled={logSaving} style={{ borderRadius: '6px', fontWeight: 600 }}>
                                        {logSaving ? 'Saving...' : 'Save Call Log'}
                                    </Button>
                                </div>
                            </Form>
                        </Col>
                    </Row>
                </Modal.Body>
            </Modal>

            {/* ── 5. Reassign Modal (Caller request & Team Leader/Assigner execution) ── */}
            <Modal show={showReassignModal} onHide={handleCloseReassignModal} centered backdrop="static">
                {(() => {
                    if (!reassignTarget) return null;
                    const isManagerTarget = Boolean(
                        reassignTarget.is_team_leader ||
                        reassignTarget.is_assigner ||
                        isAdmin ||
                        (currentUserId && reassignTarget.team_leader_id === currentUserId) ||
                        (currentUserId && reassignTarget.assigned_by_id === currentUserId)
                    );
                    const isTeamAssignment = Boolean((reassignTarget.team_name || reassignTarget.team_id) && assignmentTab !== 'individual');
                    const hasTeamMembers = isTeamAssignment && reassignTarget.team_members && reassignTarget.team_members.length > 0;
                    const membersList = hasTeamMembers ? reassignTarget.team_members : telecallingUsers;

                    // Grouped teams with their members for team leader leading one or multiple teams (ONLY for team assignment case)
                    const teamsWithMembers = (() => {
                        if (!isTeamAssignment) {
                            return [];
                        }
                        if (Array.isArray(reassignTarget.teams_with_members) && reassignTarget.teams_with_members.length > 0) {
                            return reassignTarget.teams_with_members;
                        }
                        const teamMap = new Map();
                        if (reassignTarget.team_id && reassignTarget.team_members) {
                            teamMap.set(reassignTarget.team_id, {
                                team_id: reassignTarget.team_id,
                                team_name: reassignTarget.team_name || 'Current Team',
                                members: reassignTarget.team_members
                            });
                        }
                        teamLeads.forEach(tl => {
                            const isMyTeam = isAdmin || (currentUserId && tl.team_leader_id === currentUserId) || tl.is_team_leader;
                            if (isMyTeam && tl.team_id && tl.team_members && tl.team_members.length > 0 && !teamMap.has(tl.team_id)) {
                                teamMap.set(tl.team_id, {
                                    team_id: tl.team_id,
                                    team_name: tl.team_name || `Team #${tl.team_id}`,
                                    members: tl.team_members
                                });
                            }
                        });
                        return Array.from(teamMap.values());
                    })();

                    const hasGroupedTeams = isTeamAssignment && teamsWithMembers && teamsWithMembers.length > 0;

                    return (
                        <>
                            <Modal.Header closeButton style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                                <Modal.Title style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                                    <i className="fa fa-exchange me-2" style={{ color: '#7c3aed' }}></i>
                                    {isManagerTarget 
                                        ? (isTeamAssignment ? 'Reassign Lead to Team Member' : 'Reassign Lead to Telecalling Member') 
                                        : (isTeamAssignment ? 'Reassign Call to Team Leader' : 'Reassign Call to Assigner')}
                                </Modal.Title>
                            </Modal.Header>
                            <Modal.Body style={{ padding: '20px' }}>
                                {/* Lead Summary Info */}
                                <div className="p-3 mb-3" style={{ background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                        <span className="font-w700 text-dark" style={{ fontSize: '14px' }}>
                                            {getLeadName(reassignTarget.lead)}
                                        </span>
                                        {reassignTarget.team_name ? (
                                             <span className="badge bg-light text-primary font-w600" style={{ border: '1px solid #bfdbfe', fontSize: '11px' }}>
                                                 <i className="fa fa-users me-1"></i>{reassignTarget.team_name}
                                             </span>
                                        ) : (
                                            <span className="badge bg-light text-secondary font-w600" style={{ border: '1px solid #e2e8f0', fontSize: '11px' }}>
                                                <i className="fa fa-user me-1"></i>Individual Assignment
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-muted" style={{ fontSize: '12px' }}>
                                        {reassignTarget.lead?.company && <span><i className="fa fa-building-o me-1"></i>{reassignTarget.lead.company} &bull; </span>}
                                        <span><i className="fa fa-phone me-1"></i>{reassignTarget.lead?.phone || reassignTarget.lead?.mobile || 'No Phone'}</span>
                                    </div>
                                </div>

                                {/* If there is an existing reassignment request from a caller */}
                                {reassignTarget.reassignment_status === 'REQUESTED' && (
                                    <div className="alert p-3 mb-3" style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '13px' }}>
                                        <div className="font-w700 mb-1" style={{ color: '#b45309' }}>
                                            <i className="fa fa-info-circle me-1"></i>
                                            Reassignment Request from {reassignTarget.reassignment_requested_by_name || 'Caller'}:
                                        </div>
                                        <div className="text-dark ps-2 my-1" style={{ borderLeft: '3px solid #f59e0b', fontSize: '13px', fontStyle: 'italic' }}>
                                            "{reassignTarget.reassignment_reason}"
                                        </div>
                                        {reassignTarget.reassignment_requested_at && (
                                            <div className="text-muted mt-2" style={{ fontSize: '11px' }}>
                                                <i className="fa fa-clock-o me-1"></i>
                                                Requested on {new Date(reassignTarget.reassignment_requested_at).toLocaleString()}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Assign to Member dropdown for Manager/Assigner/Team Leader vs Readonly for Requesting Caller */}
                                {isManagerTarget ? (
                                    <Form.Group className="mb-3">
                                        <Form.Label className="font-w600 text-dark" style={{ fontSize: '13px' }}>
                                            {hasGroupedTeams || hasTeamMembers ? 'Assign to Team Member' : 'Assign to Telecalling Member'} <span className="text-danger">*</span>
                                        </Form.Label>
                                        <Form.Select
                                            value={selectedNewCallerId}
                                            onChange={(e) => setSelectedNewCallerId(e.target.value)}
                                            style={{
                                                backgroundColor: '#ffffff',
                                                color: '#1e293b',
                                                fontSize: '13px',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1'
                                            }}
                                        >
                                            <option value="">{hasGroupedTeams || hasTeamMembers ? 'Select a team member to assign...' : 'Select a telecalling employee to assign...'}</option>
                                            {hasGroupedTeams ? (
                                                teamsWithMembers.map(group => (
                                                    <optgroup key={group.team_id || group.team_name} label={`Team: ${group.team_name}`}>
                                                        {group.members.map(member => (
                                                            <option key={`${group.team_id || 'team'}_${member.id}`} value={member.id}>
                                                                {member.name} {member.is_leader ? '(Team Leader)' : ''}
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                ))
                                            ) : (
                                                membersList.map(member => (
                                                    <option key={member.id} value={member.id}>
                                                        {member.name} {member.is_leader ? '(Team Leader)' : ''}
                                                    </option>
                                                ))
                                            )}
                                        </Form.Select>
                                    </Form.Group>
                                ) : (
                                    <Form.Group className="mb-3">
                                        <Form.Label className="font-w600 text-dark" style={{ fontSize: '13px' }}>
                                            {reassignTarget.team_name ? 'Team Leader' : 'Original Assigner / Manager'}
                                        </Form.Label>
                                        <Form.Control
                                            type="text"
                                            value={reassignTarget.team_leader_name || reassignTarget.assigned_by_name || 'Original Assigner'}
                                            readOnly
                                            disabled
                                            style={{
                                                backgroundColor: '#f8fafc',
                                                color: '#1e293b',
                                                fontWeight: 600,
                                                fontSize: '13px',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1'
                                            }}
                                        />
                                    </Form.Group>
                                )}

                                {/* Reason / Notes typing portion */}
                                {isManagerTarget ? (
                                    <Form.Group className="mb-2">
                                        <Form.Label className="font-w600 text-dark" style={{ fontSize: '13px' }}>
                                            Handoff Notes / Instructions (Optional)
                                        </Form.Label>
                                        <Form.Control
                                            as="textarea"
                                            rows={3}
                                            placeholder="Add any special instructions or handoff notes for the new caller..."
                                            value={reassignReason}
                                            onChange={(e) => setReassignReason(e.target.value)}
                                            style={{ borderRadius: '6px', fontSize: '13px' }}
                                        />
                                    </Form.Group>
                                ) : (
                                    <Form.Group className="mb-2">
                                        <Form.Label className="font-w600 text-dark" style={{ fontSize: '13px' }}>
                                            Reason for Reassignment <span className="text-danger">*</span>
                                        </Form.Label>
                                        <Form.Control
                                            as="textarea"
                                            rows={4}
                                            placeholder={reassignTarget.team_name ? "Please describe why this call should be reassigned to the team leader..." : "Please describe why this call should be reassigned to another caller..."}
                                            value={reassignReason}
                                            onChange={(e) => setReassignReason(e.target.value)}
                                            style={{ borderRadius: '6px', fontSize: '13px' }}
                                            autoFocus
                                        />
                                        <Form.Text className="text-muted" style={{ fontSize: '11.5px' }}>
                                            {reassignTarget.team_name ? "Your team leader will see this reassignment request." : "The original assigner will see this reassignment request."}
                                        </Form.Text>
                                    </Form.Group>
                                )}
                            </Modal.Body>
                            <Modal.Footer style={{ borderTop: '1px solid #e2e8f0' }}>
                                <Button variant="secondary" onClick={handleCloseReassignModal} disabled={reassignSubmitting} style={{ borderRadius: '6px', fontSize: '12px' }}>
                                    Cancel
                                </Button>
                                {isManagerTarget ? (
                                    <Button
                                        onClick={handleSubmitTeamLeadReassign}
                                        disabled={reassignSubmitting}
                                        className="font-w600"
                                        style={{ borderRadius: '6px', fontSize: '12px', backgroundColor: '#7c3aed', borderColor: '#6d28d9', color: '#ffffff' }}
                                    >
                                        {reassignSubmitting ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                                                Reassigning...
                                            </>
                                        ) : (
                                            <>
                                                <i className="fa fa-check me-1"></i> Confirm Reassign
                                            </>
                                        )}
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={handleSubmitReassignRequest}
                                        disabled={reassignSubmitting}
                                        style={{ borderRadius: '6px', fontSize: '12px', fontWeight: 600, backgroundColor: '#7c3aed', borderColor: '#6d28d9', color: '#ffffff' }}
                                    >
                                        {reassignSubmitting ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                                                Requesting...
                                            </>
                                        ) : (
                                            <>
                                                <i className="fa fa-paper-plane me-1"></i> {reassignTarget.team_name ? 'Reassign to Team Leader' : 'Request Reassignment'}
                                            </>
                                        )}
                                    </Button>
                                )}
                            </Modal.Footer>
                        </>
                    );
                })()}
            </Modal>

            {/* ── View Reassignment Information Modal (Team Leader / Assigner) ── */}
            <Modal show={!!viewReassignTarget} onHide={() => setViewReassignTarget(null)} centered size="md">
                {(() => {
                    if (!viewReassignTarget) return null;
                    const lead = viewReassignTarget.lead || {};
                    const leadName = getLeadName(lead);
                    const details = getReassignmentDetails(viewReassignTarget);

                    return (
                        <>
                            <Modal.Header closeButton style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                                <Modal.Title style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                                    <i className="fa fa-info-circle text-primary me-2"></i>
                                    Reassignment Information
                                </Modal.Title>
                            </Modal.Header>
                            <Modal.Body className="p-4">
                                {/* Lead Quick Header */}
                                <div className="p-3 mb-3 rounded" style={{ backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0' }}>
                                    <div className="d-flex align-items-center justify-content-between">
                                        <div>
                                            <h6 className="mb-1 font-w700 text-dark" style={{ fontSize: '14px' }}>{leadName}</h6>
                                            {lead.company && (
                                                <div className="text-muted" style={{ fontSize: '12px' }}>
                                                    <i className="fa fa-building-o me-1"></i>{lead.company}
                                                </div>
                                            )}
                                        </div>
                                        {lead.priority && (
                                            <span
                                                className={`badge ${getPriorityBadgeClass(lead.priority)}`}
                                                style={{ borderRadius: '8px', fontSize: '11.5px', fontWeight: 700, padding: '4px 10px' }}
                                            >
                                                {lead.priority} Priority
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Reassignment Metadata Details */}
                                <div className="card shadow-none mb-3" style={{ border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                    <div className="table-responsive">
                                        <table className="table table-sm mb-0" style={{ fontSize: '12.5px' }}>
                                            <tbody>
                                                <tr>
                                                    <td className="text-muted font-w600" style={{ width: '40%', padding: '10px 12px' }}>Requested By:</td>
                                                    <td className="font-w700 text-dark" style={{ padding: '10px 12px' }}>
                                                        <i className="fa fa-user-circle text-primary me-1"></i>
                                                        {details.callerName}
                                                    </td>
                                                </tr>
                                                {viewReassignTarget.team_name ? (
                                                    <tr>
                                                        <td className="text-muted font-w600" style={{ padding: '10px 12px' }}>Assigned Team:</td>
                                                        <td className="text-dark" style={{ padding: '10px 12px' }}>
                                                            <i className="fa fa-users text-info me-1"></i>
                                                            {viewReassignTarget.team_name}
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    viewReassignTarget.assigned_by_name && (
                                                        <tr>
                                                            <td className="text-muted font-w600" style={{ padding: '10px 12px' }}>Original Assigner:</td>
                                                            <td className="text-dark" style={{ padding: '10px 12px' }}>
                                                                <i className="fa fa-user text-info me-1"></i>
                                                                {viewReassignTarget.assigned_by_name}
                                                            </td>
                                                        </tr>
                                                    )
                                                )}
                                                {viewReassignTarget.assigned_caller_name && (
                                                    <tr>
                                                        <td className="text-muted font-w600" style={{ padding: '10px 12px' }}>Assigned Caller:</td>
                                                        <td className="text-dark font-w600" style={{ padding: '10px 12px' }}>
                                                            <i className="fa fa-user me-1 text-success"></i>
                                                            {viewReassignTarget.assigned_caller_name}
                                                        </td>
                                                    </tr>
                                                )}
                                                {viewReassignTarget.reassignment_requested_at && (
                                                    <tr>
                                                        <td className="text-muted font-w600" style={{ padding: '10px 12px' }}>Requested At:</td>
                                                        <td className="text-dark" style={{ padding: '10px 12px' }}>
                                                            <i className="fa fa-clock-o text-secondary me-1"></i>
                                                            {new Date(viewReassignTarget.reassignment_requested_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                                        </td>
                                                    </tr>
                                                )}
                                                <tr>
                                                    <td className="text-muted font-w600" style={{ padding: '10px 12px' }}>Status:</td>
                                                    <td style={{ padding: '10px 12px' }}>
                                                        <span className="badge" style={{ backgroundColor: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe' }}>
                                                            {viewReassignTarget.reassignment_status === 'REQUESTED' ? 'Reassignment Requested' : 'Reassigned'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Reason Section */}
                                <div>
                                    <label className="form-label font-w600 text-dark mb-1" style={{ fontSize: '12px' }}>
                                        <i className="fa fa-commenting-o me-1 text-primary"></i> Reason for Reassignment
                                    </label>
                                    <div
                                        className="p-3 rounded"
                                        style={{
                                            backgroundColor: '#f8fafc',
                                            border: '1px solid #e2e8f0',
                                            color: details.reason ? '#1e293b' : '#94a3b8',
                                            fontSize: '13px',
                                            minHeight: '60px',
                                            whiteSpace: 'pre-wrap'
                                        }}
                                    >
                                        {details.reason || 'No specific reason provided.'}
                                    </div>
                                </div>
                            </Modal.Body>
                            <Modal.Footer style={{ borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                                <Button
                                    variant="secondary"
                                    onClick={() => setViewReassignTarget(null)}
                                    style={{ borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}
                                >
                                    Close
                                </Button>
                                <Button
                                    onClick={() => {
                                        const target = viewReassignTarget;
                                        setViewReassignTarget(null);
                                        handleOpenReassignModal(target);
                                    }}
                                    style={{
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        backgroundColor: '#7c3aed',
                                        borderColor: '#6d28d9',
                                        color: '#ffffff'
                                    }}
                                >
                                    <i className="fa fa-exchange me-1"></i> Reassign Lead
                                </Button>
                            </Modal.Footer>
                        </>
                    );
                })()}
            </Modal>
        </div>
    );
};

export default CallerMyLeads;
