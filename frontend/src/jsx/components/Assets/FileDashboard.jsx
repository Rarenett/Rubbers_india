import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './FileDashboard.css';
import AssetService from '../../../services/AssetService.js';
import TrendChart from './TrendChart.jsx';
import RoomChart from './RoomChart.jsx';

const FileDashboard = () => {
    const navigate = useNavigate();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [stats, setStats] = useState({
        total_assets: 0,
        available: 0,
        allocated: 0,
        overdue: 0,
        this_month_new: 0,
        total_keys: 0,
        available_keys: 0,
        allocated_keys: 0,
        total_it_assets: 0,
        available_it_assets: 0,
        allocated_it_assets: 0
    });
    const [currentUser] = useState(() => {
        const user = localStorage.getItem('userDetails');
        return user ? JSON.parse(user) : null;
    });
    const [recentAllocations, setRecentAllocations] = useState([]);
    const [allAllocations, setAllAllocations] = useState([]);
    const [trendData, setTrendData] = useState([]);
    const [roomData, setRoomData] = useState([]);
    const [users, setUsers] = useState([]);
    const [availableFiles, setAvailableFiles] = useState([]);

    // Allocation action modals
    const [showAllocateModal, setShowAllocateModal] = useState(false);
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [showReallocateModal, setShowReallocateModal] = useState(false);
    const [selectedAllocation, setSelectedAllocation] = useState(null);
    const [allocateFormData, setAllocateFormData] = useState({ file: '', assigned_to: '', due_date: '', remarks: '' });
    const [returnFormData, setReturnFormData] = useState({ return_remarks: '' });
    const [reallocateFormData, setReallocateFormData] = useState({ due_date: '', assigned_to: '', remarks: '' });

    const now = new Date();
    const localMinDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const [statsRes, allocationsRes, trendRes, roomRes] = await Promise.all([
                AssetService.getDashboardStats(),
                AssetService.getRecentAllocations(),
                AssetService.getAllocationTrend(),
                AssetService.getRoomDistribution(),
            ]);
            setStats(statsRes.data);
            setRecentAllocations(allocationsRes.data);
            setTrendData(trendRes.data);
            setRoomData(roomRes.data);
        } catch (error) {
            console.error("Error fetching dashboard data", error);
        }

        // Fetch all allocations for the allocations table
        try {
            const allAllocRes = await AssetService.getAllocations();
            const data = Array.isArray(allAllocRes.data) ? allAllocRes.data : (allAllocRes.data?.results || []);
            setAllAllocations(data);
        } catch (error) {
            console.error("Error fetching all allocations", error);
        }

        // Fetch available files for allocate modal
        try {
            const filesRes = await AssetService.getFiles();
            const files = Array.isArray(filesRes.data) ? filesRes.data : (filesRes.data?.results || []);
            setAvailableFiles(files.filter(f => f.status === 'Available'));
        } catch (error) {
            console.error("Error fetching files", error);
        }

        // Fetch users for reallocate dropdown
        try {
            const { getUsers } = await import('../../../services/HRManagementService');
            const usersRes = await getUsers();
            setUsers(Array.isArray(usersRes) ? usersRes : (usersRes?.results || []));
        } catch (error) {
            console.error("Error fetching users", error);
        }
    };

    // --- Allocate Handler ---
    const handleAllocateSubmit = async (e) => {
        e.preventDefault();
        try {
            await AssetService.allocateFile({
                file: allocateFormData.file,
                assigned_to: allocateFormData.assigned_to,
                due_date: allocateFormData.due_date,
                remarks: allocateFormData.remarks || '',
            });
            setShowAllocateModal(false);
            setAllocateFormData({ file: '', assigned_to: '', due_date: '', remarks: '' });
            fetchDashboardData();
        } catch (error) {
            alert(error.response?.data?.error || 'Allocation failed. Please try again.');
        }
    };

    // --- Return Handler ---
    const handleOpenReturn = (allocation) => {
        setSelectedAllocation(allocation);
        setReturnFormData({ return_remarks: '', return_to: 'admin' });
        setShowReturnModal(true);
    };

    const handleReturnSubmit = async (e) => {
        e.preventDefault();
        try {
            await AssetService.returnFile(selectedAllocation.id, returnFormData);
            setShowReturnModal(false);
            fetchDashboardData();
        } catch (error) {
            alert(error.response?.data?.error || 'Return failed. Please try again.');
        }
    };

    // --- Reallocate Handler ---
    const handleOpenReallocate = (allocation) => {
        setSelectedAllocation(allocation);
        setReallocateFormData({ due_date: localMinDateTime, assigned_to: '', remarks: '' });
        setShowReallocateModal(true);
    };

    const handleReallocateSubmit = async (e) => {
        e.preventDefault();
        try {
            await AssetService.reallocateFile(selectedAllocation.id, {
                assigned_to: reallocateFormData.assigned_to,
                due_date: reallocateFormData.due_date,
                remarks: reallocateFormData.remarks || '',
            });
            setShowReallocateModal(false);
            fetchDashboardData();
        } catch (error) {
            alert(error.response?.data?.error || 'Reallocation failed. Please try again.');
        }
    };

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'Allocated': return 'status-allocated';
            case 'In Use': return 'status-in-use';
            case 'Returned': return 'status-returned';
            case 'Overdue': return 'status-overdue';
            default: return '';
        }
    };

    const categories = [
        {
            title: 'Storage Room',
            desc: 'Manage rooms and physical storage areas.',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>,
            path: '/asset-management/Room',
            adminOnly: true
        },
        {
            title: 'Asset Type',
            desc: 'Define categories and classification codes.',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>,
            path: '/asset-management/type',
            adminOnly: true
        },
        {
            title: 'Shelf & Rack',
            desc: 'Manage specific units and storage slots.',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line></svg>,
            path: '/asset-management/Shelf',
            adminOnly: true
        },
        {
            title: 'File Management',
            desc: 'Register and track physical files and records.',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
            path: '/asset-management/File'
        },
        {
            title: 'Key Management',
            desc: 'Strategic management of physical keys.',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="5.5"></circle><path d="m21 2-9.6 9.6"></path><path d="m15.5 7.5 3 3L22 7l-3-3"></path></svg>,
            path: '/asset-management/Key'
        },
        {
            title: 'File Allocation',
            desc: 'Track file transfers between users.',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><polyline points="17 11 19 13 23 9"></polyline></svg>,
            path: '/asset-management/Allocation'
        },
        {
            title: 'Key Allocation',
            desc: 'Manage key transfers and responsibilities.',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="5.5"></circle><path d="m21 2-9.6 9.6"></path><path d="m15.5 7.5 3 3"></path><path d="M16 11l2 2 2-2"></path></svg>,
            path: '/asset-management/Key Allocation'
        },
        {
            title: 'Asset Allocation',
            desc: 'Manage and track IT/Infrastructure asset transfers.',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>,
            path: '/asset-management/Asset'
        },
    ];

    return (
        <div className="fd-dashboard-container">
            {/* Hero Section */}
            <div className="fd-hero-card">
                <div className="fd-hero-content">
                    <h1>The <span>AssetCore</span> Hub</h1>
                    <p>
                        Strategic infrastructure management for your physical assets and keys.
                        Powered by real-time monitoring and advanced allocation tracking.
                    </p>
                </div>
                <div className="fd-system-status">
                    <span className="fd-time">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase()}</span>
                    <div className="fd-status-pill">
                        <div className="fd-status-dot"></div>
                        SYSTEM ACTIVE
                    </div>
                </div>
            </div>

            {/* Stats Row */}
            <div className="fd-stats-bar">
                <div className="fd-stat-mini-card">
                    <div className="fd-stat-icon-box">📄</div>
                    <div className="fd-stat-info">
                        <label>Total Files</label>
                        <h2>{stats.total_assets}</h2>
                    </div>
                </div>
                <div className="fd-stat-mini-card">
                    <div className="fd-stat-icon-box">🔑</div>
                    <div className="fd-stat-info">
                        <label>Total Keys</label>
                        <h2>{stats.total_keys}</h2>
                    </div>
                </div>
                <div className="fd-stat-mini-card">
                    <div className="fd-stat-icon-box">💻</div>
                    <div className="fd-stat-info">
                        <label>Total Assets</label>
                        <h2>{stats.total_it_assets}</h2>
                    </div>
                </div>
                <div className="fd-stat-mini-card">
                    <div className="fd-stat-icon-box">◎</div>
                    <div className="fd-stat-info">
                        <label>Available</label>
                        <h2>{stats.available + stats.available_keys + stats.available_it_assets}</h2>
                    </div>
                </div>
                <div className="fd-stat-mini-card">
                    <div className="fd-stat-icon-box" style={{ color: '#ef4444' }}>⚠</div>
                    <div className="fd-stat-info">
                        <label>Overdue</label>
                        <h2 style={{ color: '#dc2626' }}>{stats.overdue}</h2>
                    </div>
                </div>
            </div>

            {/* Quick Actions / Categories */}
            <h2 className="fd-quick-actions-title">Quick Actions</h2>
            <div className="fd-action-grid">
                {categories.map((cat, idx) => (
                    (cat.adminOnly && !currentUser?.user?.is_superuser) ? null : (
                        <div key={idx} className="fd-action-card" onClick={() => navigate(cat.path)}>
                            <div className="fd-action-header">
                                <div className="fd-action-icon">{cat.icon}</div>
                                <div className="fd-action-dot"></div>
                            </div>
                            <div className="fd-action-content">
                                <h3>{cat.title}</h3>
                                <p>{cat.desc}</p>
                            </div>
                            <div className="fd-action-footer">
                                Access Module <span className="ms-1">›</span>
                            </div>
                        </div>
                    )
                ))}
            </div>

            {/* Charts Section */}
            <div className="row g-4 mb-5">
                <div className="col-lg-8">
                    <div className="fd-section-container h-100">
                        <div className="fd-section-header">
                            <h3>Allocation Trend</h3>
                        </div>
                        <div style={{ height: '300px' }}>
                            {trendData.length > 0 && <TrendChart data={trendData} />}
                        </div>
                    </div>
                </div>
                {currentUser?.user?.is_superuser && (
                    <div className="col-lg-4">
                        <div className="fd-section-container h-100">
                            <div className="fd-section-header">
                                <h3>Storage Distribution</h3>
                            </div>
                            <div style={{ height: '300px' }}>
                                {roomData.length > 0 && <RoomChart data={roomData} />}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Recent Activity Section */}
            <div className="fd-section-container mb-5">
                <div className="fd-section-header d-flex justify-content-between align-items-center">
                    <h3>Recent Asset Activity</h3>
                    <button className="btn btn-sm btn-outline-primary" onClick={() => navigate('/asset-management/Allocation')}>View All Allocations</button>
                </div>
                <div className="table-responsive">
                    <table className="table fd-activity-table">
                        <thead>
                            <tr>
                                <th>Category</th>
                                <th>Asset Name</th>
                                <th>Assigned To</th>
                                <th>Status</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentAllocations.length > 0 ? (
                                recentAllocations.map((item, idx) => (
                                    <tr key={idx}>
                                        <td>
                                            <span className={`fd-category-pill ${item.asset_type_category?.toLowerCase().replace(' ', '-')}`}>
                                                {item.asset_type_category}
                                            </span>
                                        </td>
                                        <td>
                                            <strong>
                                                {item.asset_type_category === 'Key' ? item.key_details?.key_name :
                                                    item.asset_type_category === 'File' ? item.file_details?.file_name :
                                                        item.allocated_to_user_name ? (item.items?.[0]?.asset_details?.name || 'Bulk Allocation') : '—'}
                                            </strong>
                                        </td>
                                        <td>{item.allocated_to_user_name || (item.assigned_to_details ? `${item.assigned_to_details.first_name} ${item.assigned_to_details.last_name}` : '—')}</td>
                                        <td>
                                            <span className={`status-badge ${getStatusBadgeClass(item.status)}`}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td>{item.allocated_at ? new Date(item.allocated_at).toLocaleDateString() : '—'}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="text-center py-4">No recent activity found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Allocate Asset Modal */}
            {showAllocateModal && (
                <div className="fd-modal-overlay">
                    <div className="fd-modal-content">
                        <h2>Allocate File</h2>
                        <p className="text-muted mb-3">Select an available file and assign it to a user.</p>
                        <form onSubmit={handleAllocateSubmit}>
                            <div className="form-group mb-3">
                                <label>File</label>
                                <select
                                    className="form-control"
                                    required
                                    value={allocateFormData.file || ''}
                                    onChange={(e) => setAllocateFormData({ ...allocateFormData, file: e.target.value })}
                                >
                                    <option value="">Select Available File...</option>
                                    {availableFiles.map(f => (
                                        <option key={f.id} value={f.id}>
                                            {f.file_name} {f.reference_code ? `(${f.reference_code})` : ''}
                                        </option>
                                    ))}
                                </select>
                                {availableFiles.length === 0 && (
                                    <small className="text-warning mt-1 d-block">No available files at the moment.</small>
                                )}
                            </div>
                            <div className="form-group mb-3">
                                <label>Assign To</label>
                                <select
                                    className="form-control"
                                    required
                                    value={allocateFormData.assigned_to || ''}
                                    onChange={(e) => setAllocateFormData({ ...allocateFormData, assigned_to: e.target.value })}
                                >
                                    <option value="">Select User...</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.first_name} {u.last_name} ({u.email})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group mb-3">
                                <label>Due Date &amp; Time</label>
                                <input
                                    type="datetime-local"
                                    className="form-control"
                                    required
                                    min={localMinDateTime}
                                    value={allocateFormData.due_date || ''}
                                    onChange={(e) => setAllocateFormData({ ...allocateFormData, due_date: e.target.value })}
                                />
                            </div>
                            <div className="form-group mb-3">
                                <label>Remarks (optional)</label>
                                <textarea
                                    className="form-control"
                                    rows="2"
                                    value={allocateFormData.remarks || ''}
                                    onChange={(e) => setAllocateFormData({ ...allocateFormData, remarks: e.target.value })}
                                    placeholder="Any notes about this allocation..."
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" onClick={() => setShowAllocateModal(false)} className="btn btn-secondary">Cancel</button>
                                <button type="submit" className="btn btn-success" disabled={availableFiles.length === 0}>Allocate</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Return Modal */}
            {showReturnModal && selectedAllocation && (
                <div className="fd-modal-overlay">
                    <div className="fd-modal-content">
                        <h2>Return Asset</h2>
                        <p className="text-muted mb-3">
                            Returning: <strong>{selectedAllocation.asset_type_category === 'Key' ? selectedAllocation.key_details?.key_name : selectedAllocation.file_details?.file_name}</strong>
                            {' '}from <strong>{selectedAllocation.assigned_to_details?.email}</strong>
                        </p>
                        <form onSubmit={handleReturnSubmit}>
                            {selectedAllocation.previous_holder_details && (
                                <div className="form-group mb-3">
                                    <label>Return To</label>
                                    <select className="form-control"
                                        value={returnFormData.return_to || 'admin'}
                                        onChange={(e) => setReturnFormData({ ...returnFormData, return_to: e.target.value })}>
                                        <option value="admin">Admin (Available Stock)</option>
                                        <option value="previous_holder">{selectedAllocation.previous_holder_details.name} (Previous Holder)</option>
                                    </select>
                                    <small className="text-muted">This file was reallocated to you. You may return it to the previous holder.</small>
                                </div>
                            )}
                            <div className="form-group mb-3">
                                <label>Return Remarks (optional)</label>
                                <textarea
                                    className="form-control"
                                    rows="3"
                                    value={returnFormData.return_remarks || ''}
                                    onChange={(e) => setReturnFormData({ ...returnFormData, return_remarks: e.target.value })}
                                    placeholder="e.g. Returned in good condition"
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" onClick={() => setShowReturnModal(false)} className="btn btn-secondary">Cancel</button>
                                <button type="submit" className="btn btn-warning">Confirm Return</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reallocate Modal */}
            {showReallocateModal && selectedAllocation && (
                <div className="fd-modal-overlay">
                    <div className="fd-modal-content">
                        <h2>Reallocate Asset</h2>
                        <p className="text-muted mb-3">
                            Reallocating: <strong>{selectedAllocation.asset_type_category === 'Key' ? selectedAllocation.key_details?.key_name : selectedAllocation.file_details?.file_name}</strong>
                        </p>
                        <form onSubmit={handleReallocateSubmit}>
                            <div className="form-group mb-3">
                                <label>Assign To (New User)</label>
                                <select
                                    className="form-control"
                                    required
                                    value={reallocateFormData.assigned_to || ''}
                                    onChange={(e) => setReallocateFormData({ ...reallocateFormData, assigned_to: e.target.value })}
                                >
                                    <option value="">Select New User...</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.first_name} {u.last_name} ({u.email})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group mb-3">
                                <label>New Due Date &amp; Time</label>
                                <input
                                    type="datetime-local"
                                    className="form-control"
                                    required
                                    min={localMinDateTime}
                                    value={reallocateFormData.due_date || ''}
                                    onChange={(e) => setReallocateFormData({ ...reallocateFormData, due_date: e.target.value })}
                                />
                            </div>
                            <div className="form-group mb-3">
                                <label>Remarks (optional)</label>
                                <textarea
                                    className="form-control"
                                    rows="2"
                                    value={reallocateFormData.remarks || ''}
                                    onChange={(e) => setReallocateFormData({ ...reallocateFormData, remarks: e.target.value })}
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" onClick={() => setShowReallocateModal(false)} className="btn btn-secondary">Cancel</button>
                                <button type="submit" className="btn btn-info text-white">Reallocate</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FileDashboard;