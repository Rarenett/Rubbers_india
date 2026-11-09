import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ThemeContext } from "../../../context/ThemeContext";
import ComplaintService from '../../../services/ComplaintService';

/// Extracted Components
import ComplaintDashboardView from './ComplaintDashboardView';
import ComplaintList from './ComplaintList';
import ComplaintForm from './ComplaintForm';
// Removed CategorySetup as it's now separate pages

import './Complaints.css';

const ComplaintManagement = () => {
    const { background } = useContext(ThemeContext);
    const { tab = 'dashboard' } = useParams();
    const navigate = useNavigate();
    
    const [activeTab, setActiveTab] = useState(tab);
    const [stats, setStats] = useState({ total: 0, pending: 0, in_progress: 0, resolved: 0, closed: 0 });
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
        setActiveTab(tab);
        fetchStats();
        if (tab === 'list' || tab === 'dashboard') {
            fetchComplaints();
        }
    }, [tab]);

    const fetchStats = async () => {
        try {
            const res = await ComplaintService.getStatistics();
            setStats(res.data);
        } catch (err) {
            console.error("Error fetching stats", err);
        }
    };

    const fetchComplaints = async () => {
        setLoading(true);
        try {
            const res = await ComplaintService.getComplaints();
            setComplaints(res.data.results || res.data);
        } catch (err) {
            console.error("Error fetching complaints", err);
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (newTab) => {
        setActiveTab(newTab);
        navigate(`/complaints/manage/${newTab}`);
    };

    return (
        <div className="cm-dashboard-container">
            {/* Hero Card / Header - Shared across all tabs except categories */}
            {activeTab !== 'categories' && (
                <>
                    <div className="cm-hero-card">
                        <div className="cm-hero-content">
                            <h1>The <span>ComplaintCore</span> Hub</h1>
                            <p>Strategic resolution management for your enterprise issues. Powered by real-time monitoring and advanced priority tracking.</p>
                        </div>
                        <div className="cm-system-status d-none d-md-flex">
                            <span className="cm-status-pill">
                                <span className="cm-status-dot"></span>
                                Resolution Active
                            </span>
                        </div>
                    </div>

            {/* Quick Stats Grid */}
            <div className="cm-stats-bar">
                <div className="cm-stat-mini-card">
                    <div className="cm-stat-icon-box">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    </div>
                    <div className="cm-stat-info">
                        <label>Total Complaints</label>
                        <h2>{stats.total}</h2>
                    </div>
                </div>
                <div className="cm-stat-mini-card">
                    <div className="cm-stat-icon-box" style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.08)' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12" y2="16"></line></svg>
                    </div>
                    <div className="cm-stat-info">
                        <label style={{color: '#f59e0b'}}>Pending</label>
                        <h2>{stats.pending}</h2>
                    </div>
                </div>
                <div className="cm-stat-mini-card">
                    <div className="cm-stat-icon-box" style={{ color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.08)' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    </div>
                    <div className="cm-stat-info">
                        <label style={{color: '#8b5cf6'}}>In Progress</label>
                        <h2>{stats.in_progress}</h2>
                    </div>
                </div>
                <div className="cm-stat-mini-card">
                    <div className="cm-stat-icon-box" style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.08)' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    </div>
                    <div className="cm-stat-info">
                        <label style={{color: '#10b981'}}>Resolved</label>
                        <h2>{stats.resolved}</h2>
                    </div>
                </div>
            </div>

            <div className="cm-quick-actions-title">
                Quick Actions
            </div>

            <div className="cm-action-grid">
                <div className="cm-action-card" onClick={() => navigate('/complaints/categories')}>
                    <div className="cm-action-header">
                        <div className="cm-action-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        </div>
                        <div className="cm-action-dot"></div>
                    </div>
                    <div className="cm-action-content">
                        <h3>Setup Matrix</h3>
                        <p>Configure routing structures and categories.</p>
                    </div>
                    <div className="cm-action-footer">
                        Access Module ›
                    </div>
                </div>

                <div className="cm-action-card" onClick={() => navigate('/complaints/patterns')}>
                    <div className="cm-action-header">
                        <div className="cm-action-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 13.41 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                        </div>
                        <div className="cm-action-dot" style={{ background: '#8b5cf6' }}></div>
                    </div>
                    <div className="cm-action-content">
                        <h3>Comment Patterns</h3>
                        <p>Manage resolution protocols and duty assignment.</p>
                    </div>
                    <div className="cm-action-footer">
                        Access Module ›
                    </div>
                </div>

                <div className={`cm-action-card ${activeTab === 'dashboard' ? 'active-tab' : ''}`} onClick={() => handleTabChange('dashboard')}>
                    <div className="cm-action-header">
                        <div className="cm-action-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                        </div>
                        <div className="cm-action-dot"></div>
                    </div>
                    <div className="cm-action-content">
                        <h3>Overview</h3>
                        <p>View top-level statistics and recent complaints.</p>
                    </div>
                    <div className="cm-action-footer">
                        Access Module ›
                    </div>
                </div>

                <div className="cm-action-card" onClick={() => navigate('/complaints/list')}>
                    <div className="cm-action-header">
                        <div className="cm-action-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                        </div>
                        <div className="cm-action-dot"></div>
                    </div>
                    <div className="cm-action-content">
                        <h3>Complaints List</h3>
                        <p>Browse, filter, and track all submitted tickets.</p>
                    </div>
                    <div className="cm-action-footer">
                        Access Module ›
                    </div>
                </div>

                <div className="cm-action-card" onClick={() => navigate('/complaints/raise')}>
                    <div className="cm-action-header">
                        <div className="cm-action-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        </div>
                        <div className="cm-action-dot"></div>
                    </div>
                    <div className="cm-action-content">
                        <h3>Raise Complaint</h3>
                        <p>Submit a new ticket or tracking request.</p>
                    </div>
                    <div className="cm-action-footer">
                        Access Module ›
                    </div>
                </div>
            </div>
                </>
            )}

            {/* Dynamic Content Views */}
            {activeTab === 'dashboard' && <ComplaintDashboardView stats={stats} />}
            {activeTab === 'list' && <ComplaintList complaints={complaints} loading={loading} />}
            {activeTab === 'new' && <ComplaintForm onSuccess={() => handleTabChange('list')} />}
            
        </div>
    );
};

export default ComplaintManagement;
