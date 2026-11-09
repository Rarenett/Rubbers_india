import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../../services/AxiosInstance';

const LeadDetail = ({ id: propId }) => {
    const { id: paramId } = useParams();
    const id = propId || paramId;
    const navigate = useNavigate();
    const [lead, setLead] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        const fetchLead = async () => {
            try {
                const res = await axiosInstance.get(`/api/crm/leads/${id}/`);
                if (res.status === 200) {
                    setLead(res.data);
                }
            } catch (error) {
                console.error("Error fetching lead details", error);
            } finally {
                setLoading(false);
            }
        };
        if (id) fetchLead();
    }, [id]);

    if (loading) return <div className="text-center py-5 opacity-50">Synchronizing entity data...</div>;
    if (!lead) return <div className="text-center py-5 text-danger">Lead record not found in the ecosystem.</div>;

    const leadName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim();

    return (
        <div className="crm-detail-view">
            <style>{`
                .crm-detail-header {
                    background: var(--crm-card-bg);
                    border-radius: var(--crm-card-radius);
                    padding: 1.5rem 2.5rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                    border: 1px solid var(--crm-border);
                    box-shadow: var(--crm-shadow);
                }

                .crm-entity-identity {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                }

                .crm-entity-avatar {
                    width: 60px;
                    height: 60px;
                    background: var(--crm-accent-soft);
                    color: var(--crm-accent);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5rem;
                    font-weight: 800;
                    border: 2px solid var(--crm-accent);
                }

                .crm-entity-title h2 {
                    margin: 0;
                    font-size: 1.5rem;
                    font-weight: 800;
                    color: var(--crm-text-primary);
                }

                .crm-entity-title p {
                    margin: 0;
                    color: var(--crm-text-secondary);
                    font-size: 0.9rem;
                    font-weight: 600;
                }

                .crm-detail-actions {
                    display: flex;
                    gap: 1rem;
                }

                .crm-detail-tabs-container {
                    background: var(--crm-card-bg);
                    border-radius: var(--crm-card-radius) var(--crm-card-radius) 0 0;
                    padding: 1rem 2.5rem 0;
                    border: 1px solid var(--crm-border);
                    border-bottom: none;
                }

                .crm-detail-tabs {
                    display: flex;
                    gap: 2rem;
                }

                .crm-detail-tab {
                    padding: 1rem 0;
                    color: var(--crm-text-secondary);
                    font-weight: 700;
                    font-size: 0.9rem;
                    cursor: pointer;
                    position: relative;
                    transition: all 0.3s;
                }

                .crm-detail-tab.active {
                    color: var(--crm-accent);
                }

                .crm-detail-tab.active::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    width: 100%;
                    height: 3px;
                    background: var(--crm-accent);
                    border-radius: 3px 3px 0 0;
                }

                .crm-detail-content {
                    background: var(--crm-card-bg);
                    border-radius: 0 0 var(--crm-card-radius) var(--crm-card-radius);
                    padding: 2.5rem;
                    border: 1px solid var(--crm-border);
                    box-shadow: var(--crm-shadow);
                    margin-bottom: 2.5rem;
                }

                .crm-detail-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 3rem;
                }

                .crm-detail-section-title {
                    font-size: 0.8rem;
                    text-transform: uppercase;
                    color: var(--crm-text-secondary);
                    letter-spacing: 1.5px;
                    font-weight: 800;
                    margin-bottom: 2rem;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    border-left: 4px solid var(--crm-accent);
                    padding-left: 1rem;
                }

                .crm-detail-item {
                    display: flex;
                    flex-direction: column;
                    gap: 0.4rem;
                    margin-bottom: 1.5rem;
                }

                .crm-detail-label {
                    font-size: 0.75rem;
                    color: var(--crm-text-secondary);
                    font-weight: 600;
                }

                .crm-detail-value {
                    font-size: 0.95rem;
                    color: var(--crm-text-primary);
                    font-weight: 700;
                }

                .crm-back-btn {
                    padding: 0.5rem 1rem;
                    color: var(--crm-text-secondary);
                    font-weight: 700;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    transition: all 0.3s;
                }

                .crm-back-btn:hover {
                    color: var(--crm-accent);
                }
            `}</style>

            <div className="crm-back-btn" onClick={() => navigate('/crm/leads')}>
                <i className="fa fa-arrow-left"></i> Back to Directory
            </div>

            <div className="crm-detail-header mt-3">
                <div className="crm-entity-identity">
                    <div className="crm-entity-avatar" style={{ overflow: 'hidden' }}>
                        {lead.image ? (
                            <img src={lead.image} alt={leadName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            lead.last_name ? lead.last_name[0] : 'L'
                        )}
                    </div>
                    <div className="crm-entity-title">
                        <h2>{leadName}</h2>
                        <p>{lead.company || 'Private Entity'}</p>
                    </div>
                </div>
                <div className="crm-detail-actions">
                    <button className="btn btn-outline-primary" style={{ borderRadius: '10px', fontWeight: '700' }}>Send Email</button>
                    <button className="btn btn-outline-success" style={{ borderRadius: '10px', fontWeight: '700' }}>Convert</button>
                    <button 
                        className="btn btn-primary" 
                        style={{ background: 'var(--crm-accent)', border: 'none', borderRadius: '10px', fontWeight: '700' }}
                        onClick={() => navigate(`/crm/leads/edit/${id}`)}
                    >
                        Edit
                    </button>
                </div>
            </div>

            <div className="crm-detail-tabs-container">
                <div className="crm-detail-tabs">
                    <div className={`crm-detail-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</div>
                    <div className={`crm-detail-tab ${activeTab === 'timeline' ? 'active' : ''}`} onClick={() => setActiveTab('timeline')}>Timeline</div>
                </div>
            </div>

            <div className="crm-detail-content">
                {activeTab === 'overview' && (
                    <div className="crm-detail-grid">
                        <div className="crm-detail-section">
                            <h4 className="crm-detail-section-title">Lead Information</h4>
                            <div className="row">
                                <div className="col-md-6">
                                    <div className="crm-detail-item">
                                        <span className="crm-detail-label">Lead Owner</span>
                                        <span className="crm-detail-value">{lead.lead_owner_name || 'Unassigned'}</span>
                                    </div>
                                    <div className="crm-detail-item">
                                        <span className="crm-detail-label">Email</span>
                                        <span className="crm-detail-value text-primary">{lead.email || '—'}</span>
                                    </div>
                                    <div className="crm-detail-item">
                                        <span className="crm-detail-label">Phone</span>
                                        <span className="crm-detail-value">{lead.phone || '—'}</span>
                                    </div>
                                    <div className="crm-detail-item">
                                        <span className="crm-detail-label">Contact Preferences</span>
                                        <div className="d-flex gap-2 mt-1">
                                            {lead.contact_preferences ? lead.contact_preferences.split(',').map(pref => (
                                                <span key={pref} className="badge badge-light text-primary fw-900" style={{ fontSize: '0.7rem', border: '1px solid var(--crm-border)' }}>
                                                    {pref}
                                                </span>
                                            )) : <span className="crm-detail-value">—</span>}
                                        </div>
                                    </div>
                                    <div className="crm-detail-item">
                                        <span className="crm-detail-label">Lead Source</span>
                                        <span className="crm-detail-value">{lead.lead_source || '—'}</span>
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="crm-detail-item">
                                        <span className="crm-detail-label">Company</span>
                                        <span className="crm-detail-value">{lead.company || '—'}</span>
                                    </div>
                                    <div className="crm-detail-item">
                                        <span className="crm-detail-label">Title</span>
                                        <span className="crm-detail-value">{lead.title || '—'}</span>
                                    </div>
                                    <div className="crm-detail-item">
                                        <span className="crm-detail-label">Lead Status</span>
                                        <span className="crm-detail-value">{lead.lead_status || '—'}</span>
                                    </div>
                                    <div className="crm-detail-item">
                                        <span className="crm-detail-label">Industry</span>
                                        <span className="crm-detail-value">{lead.industry || '—'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="crm-detail-section">
                            <h4 className="crm-detail-section-title">Address Information</h4>
                            <div className="row">
                                <div className="col-md-12">
                                    <div className="crm-detail-item">
                                        <span className="crm-detail-label">Street</span>
                                        <span className="crm-detail-value">{lead.street_address || '—'}</span>
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="crm-detail-item">
                                        <span className="crm-detail-label">City</span>
                                        <span className="crm-detail-value">{lead.city || '—'}</span>
                                    </div>
                                    <div className="crm-detail-item">
                                        <span className="crm-detail-label">Zip Code</span>
                                        <span className="crm-detail-value">{lead.zip_postal_code || '—'}</span>
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="crm-detail-item">
                                        <span className="crm-detail-label">State</span>
                                        <span className="crm-detail-value">{lead.state_province || '—'}</span>
                                    </div>
                                    <div className="crm-detail-item">
                                        <span className="crm-detail-label">Country</span>
                                        <span className="crm-detail-value">{lead.country || '—'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="crm-detail-section col-12 mt-4">
                            <h4 className="crm-detail-section-title">Ecosystem Context</h4>
                            <div className="crm-detail-item">
                                <span className="crm-detail-label">Description</span>
                                <div className="crm-detail-value" style={{ fontWeight: '500', lineHeight: '1.6', opacity: 0.8 }}>
                                    {lead.description || 'No contextual data provided for this entity.'}
                                </div>
                            </div>
                            {lead.attachment && (
                                <div className="crm-detail-item mt-3">
                                    <span className="crm-detail-label">Attachment</span>
                                    <div className="crm-detail-value mt-1">
                                        <a
                                            href={lead.attachment}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-sm btn-outline-primary"
                                            style={{ borderRadius: '8px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                                        >
                                            <i className="fa fa-paperclip"></i>
                                            {typeof lead.attachment === 'string' ? lead.attachment.split('/').pop() : 'Download Attachment'}
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {activeTab === 'timeline' && (
                    <div className="crm-timeline-container">
                        <LeadTimeline leadId={id} />
                    </div>
                )}
            </div>
        </div>
    );
};

const LeadTimeline = ({ leadId }) => {
    const [timelineItems, setTimelineItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTimelineData = async () => {
            try {
                // Get assignments for this lead
                const resAsign = await axiosInstance.get(`/api/crm/assignments/?lead=${leadId}`);
                if (resAsign.data.length > 0) {
                    const allItems = [];
                    for (const asgn of resAsign.data) {
                        // Fetch logs
                        const resLog = await axiosInstance.get(`/api/crm/interaction-logs/?assignment=${asgn.id}`);
                        const logs = resLog.data;

                        // Fetch calls
                        const resCall = await axiosInstance.get(`/api/crm/call-sessions/?assignment=${asgn.id}`);
                        const calls = resCall.data;

                        // Consolidate calls and related logs
                        calls.forEach(call => {
                            // Filter out strict-mode phantom dialing records
                            if (call.status === 'Dialing' && call.duration === 0) return;

                            // Find a log created within 5 minutes after the call
                            const callTime = new Date(call.start_time).getTime();
                            const relatedLogIndex = logs.findIndex(l => {
                                const logTime = new Date(l.created_at).getTime();
                                const diff = logTime - callTime;
                                return diff >= 0 && diff <= 5 * 60 * 1000;
                            });

                            let mergedRemarks = null;
                            if (relatedLogIndex !== -1) {
                                mergedRemarks = logs[relatedLogIndex].remarks;
                                logs[relatedLogIndex].merged = true; // Mark as consumed
                            }

                            allItems.push({
                                ...call,
                                type: 'call',
                                timestamp: call.start_time,
                                remarks: mergedRemarks
                            });
                        });

                        // Add remaining standalone logs
                        logs.forEach(log => {
                            if (!log.merged) {
                                allItems.push({ ...log, type: 'log', timestamp: log.created_at });
                            }
                        });
                    }
                    setTimelineItems(allItems.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
                }
            } catch (error) {
                console.error("Error fetching timeline", error);
            } finally {
                setLoading(false);
            }
        };
        fetchTimelineData();
    }, [leadId]);

    if (loading) return <div className="text-center py-5 fw-900 opacity-25">Reconstructing interaction history...</div>;
    if (timelineItems.length === 0) return (
        <div className="text-center py-5 opacity-50 italic">
            <i className="fa fa-terminal fa-3x mb-3"></i>
            <p>No communication footprint found for this entity.</p>
        </div>
    );

    return (
        <div className="modern-timeline px-4">
            {timelineItems.map((item, idx) => (
                <div key={`${item.type}-${item.id}`} style={{
                    position: 'relative', paddingLeft: '3rem', paddingBottom: '3rem',
                    borderLeft: idx === timelineItems.length - 1 ? 'none' : '2px dashed var(--crm-border)',
                    marginLeft: '15px'
                }}>
                    <div style={{
                        position: 'absolute', left: '-11px', top: '0',
                        width: '20px', height: '20px', borderRadius: '50%',
                        background: 'white', border: `4px solid ${item.type === 'call' ? '#10b981' : 'var(--crm-accent)'}`,
                        boxShadow: `0 0 15px ${item.type === 'call' ? 'rgba(16, 185, 129, 0.2)' : 'var(--crm-accent-soft)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px'
                    }}>
                        <i className={`fa ${item.type === 'call' ? 'fa-phone' : 'fa-comment'}`} 
                           style={{ color: item.type === 'call' ? '#10b981' : 'var(--crm-accent)' }}></i>
                    </div>
                    <div className="p-4" style={{ background: 'var(--crm-bg)', border: '1px solid var(--crm-border)', borderRadius: '20px' }}>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <div>
                                <span className={`badge ${item.type === 'call' ? 'badge-success' : 'badge-primary'} px-3 py-2 fw-900 me-2`} style={{ fontSize: '0.65rem' }}>
                                    {item.type === 'call' ? 'VOICE CALL' : item.status.toUpperCase()}
                                </span>
                                {item.type === 'call' && (
                                    <span className="badge badge-light text-dark fw-800" style={{ fontSize: '0.65rem' }}>
                                        {Math.floor(item.duration / 60)}m {item.duration % 60}s
                                    </span>
                                )}
                            </div>
                            <small className="text-secondary fw-800">{new Date(item.timestamp).toLocaleString()}</small>
                        </div>
                        
                        {item.type === 'call' ? (
                            <div className="d-flex align-items-start gap-3">
                                <div className="p-3 rounded-circle bg-white border d-flex align-items-center justify-content-center" style={{ width: '45px', height: '45px' }}>
                                    <i className="fa fa-play text-primary ms-1"></i>
                                </div>
                                <div className="flex-grow-1">
                                    <p className="m-0 fw-800 text-dark" style={{ fontSize: '0.95rem' }}>Call to {item.phone_number || 'Lead'}</p>
                                    <small className="text-muted fw-600 d-block mb-1" style={{ fontSize: '0.75rem' }}>Status: {item.status}</small>
                                    
                                    {item.remarks && (
                                        <div className="p-2 mt-2 bg-white rounded border border-light" style={{ fontSize: '0.85rem' }}>
                                            <i className="fa fa-quote-left text-primary opacity-25 me-2"></i>
                                            <span className="fw-700 text-secondary">{item.remarks}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="d-flex align-items-start gap-3">
                                <div className="p-3 rounded-circle bg-white border border-light d-flex align-items-center justify-content-center" style={{ width: '45px', height: '45px' }}>
                                    <i className="fa fa-commenting-o text-primary"></i>
                                </div>
                                <p className="m-0 fw-700 text-dark pt-2" style={{ fontSize: '0.95rem' }}>"{item.remarks}"</p>
                            </div>
                        )}

                        <div className="mt-3 pt-3 border-top d-flex justify-content-between align-items-center">
                            <small className="text-secondary fw-700">AGENT: {item.type === 'call' ? item.caller_detail?.full_name : item.user_detail?.full_name || 'System'}</small>
                            {item.next_call_date && (
                                <small className="fw-800" style={{ color: 'var(--crm-accent)' }}>
                                    <i className="fa fa-calendar-check-o me-1"></i>
                                    FOLLOW-UP: {new Date(item.next_call_date).toLocaleDateString()}
                                </small>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default LeadDetail;
