import React, { useState, useEffect, useContext, useRef } from 'react';
import Swal from 'sweetalert2';
import { ThemeContext } from '../../../context/ThemeContext';
import axiosInstance from '../../../services/AxiosInstance';

const API_BASE = '/api/settings/backup';

const DatabaseBackup = () => {
    const { background } = useContext(ThemeContext);
    const isDark = background?.value === 'dark';
    const folderInputRef = useRef(null);

    const [dbInfo, setDbInfo] = useState(null);
    const [loadingInfo, setLoadingInfo] = useState(true);
    const [downloadingFormat, setDownloadingFormat] = useState(null);

    const [schedule, setSchedule] = useState({
        is_enabled: false,
        frequency: 'daily',
        backup_time: '02:00',
        export_format: 'sql',
        retention_days: 30,
        backup_path: 'backups'
    });
    const [savingSchedule, setSavingSchedule] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);

    const handleBrowseFolder = async () => {
        if ('showDirectoryPicker' in window) {
            try {
                const dirHandle = await window.showDirectoryPicker();
                if (dirHandle && dirHandle.name) {
                    setSchedule(prev => ({ ...prev, backup_path: dirHandle.name }));
                }
            } catch (err) {
                // User closed directory picker window
            }
        } else if (folderInputRef.current) {
            folderInputRef.current.click();
        }
    };

    const handleFolderSelect = (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            const firstFile = files[0];
            const relativePath = firstFile.webkitRelativePath ? firstFile.webkitRelativePath.split('/')[0] : firstFile.name;
            setSchedule(prev => ({ ...prev, backup_path: relativePath }));
        }
    };

    useEffect(() => {
        fetchDbInfo();
        fetchSchedule();
    }, []);

    const fetchSchedule = async () => {
        try {
            const res = await axiosInstance.get(`${API_BASE}/schedule/`);
            if (res.data) {
                setSchedule({
                    is_enabled: res.data.is_enabled ?? false,
                    frequency: res.data.frequency || 'daily',
                    backup_time: res.data.backup_time || '02:00',
                    export_format: res.data.export_format || 'sql',
                    retention_days: res.data.retention_days || 30,
                    backup_path: res.data.backup_path || 'backups'
                });
            }
        } catch (err) {
            console.error('Failed to fetch backup schedule:', err);
        }
    };

    const handleSaveSchedule = async () => {
        setSavingSchedule(true);
        try {
            await axiosInstance.post(`${API_BASE}/schedule/`, schedule);
            setShowScheduleModal(false);
            Swal.fire({
                icon: 'success',
                title: 'Schedule Saved!',
                text: 'Automated backup settings updated successfully.',
                timer: 3000,
                showConfirmButton: false
            });
        } catch (err) {
            console.error('Failed to save schedule:', err);
            Swal.fire({
                icon: 'error',
                title: 'Save Failed',
                text: err.response?.data?.detail || 'Could not save backup schedule.'
            });
        } finally {
            setSavingSchedule(false);
        }
    };

    const fetchDbInfo = async () => {
        setLoadingInfo(true);
        try {
            const res = await axiosInstance.get(`${API_BASE}/info/`);
            setDbInfo(res.data);
        } catch (err) {
            console.error('Failed to fetch DB info:', err);
            setDbInfo(null);
        } finally {
            setLoadingInfo(false);
        }
    };

    const handleDownload = async (format) => {
        setDownloadingFormat(format);

        Swal.fire({
            title: `Preparing ${format.toUpperCase()} Backup...`,
            html: 'Generating database dump. Please wait.',
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => { Swal.showLoading(); }
        });

        try {
            const response = await axiosInstance.get(
                `${API_BASE}/download/?export_format=${format}&_t=${Date.now()}`,
                { responseType: 'blob' }
            );

            const disposition = response.headers['content-disposition'] || '';
            const filenameMatch = disposition.match(/filename="?([^";\r\n]+)"?/i);
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const filename = filenameMatch
                ? filenameMatch[1].trim()
                : `${dbInfo?.database_name || 'database'}_backup_${dateStr}.${format}`;

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

            Swal.fire({
                icon: 'success',
                title: 'Download Complete!',
                html: `Your <strong>${format.toUpperCase()}</strong> backup file is saved.<br/><small className="text-muted mt-2 d-block">${filename}</small>`,
                timer: 4000,
                showConfirmButton: false
            });
        } catch (err) {
            console.error('Download error:', err);
            Swal.fire({
                icon: 'error',
                title: 'Download Failed',
                text: `Could not download ${format.toUpperCase()} backup: ${err.message}`
            });
        } finally {
            setDownloadingFormat(null);
        }
    };

    return (
        <div className="container-fluid p-4">
            {/* Simple Header */}
            <div className="card mb-4 border-0 shadow-sm" style={{ borderRadius: '12px', background: isDark ? '#1e293b' : '#ffffff' }}>
                <div className="card-body p-4">
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                        <div>
                            <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                                <h3 className="fw-bold mb-0">Database Backup & Export</h3>
                                <span className="badge bg-primary text-white px-3 py-2 rounded-3 fs-6 fw-bold ms-2">
                                    <i className="fas fa-database me-1"></i> {loadingInfo ? 'Loading...' : (dbInfo?.database_name || 'Database')}
                                </span>
                            </div>
                            <p className="text-muted mb-0">Download .sql or .json backup files of your database.</p>
                        </div>
                        <div className="d-flex gap-2">
                            <button
                                onClick={fetchDbInfo}
                                className="btn btn-outline-secondary btn-sm rounded-3 px-3"
                                disabled={loadingInfo}
                            >
                                <i className={`fas fa-sync-alt me-1 ${loadingInfo ? 'fa-spin' : ''}`}></i> Refresh
                            </button>
                            <button
                                onClick={() => setShowScheduleModal(true)}
                                className="btn btn-outline-primary btn-sm rounded-3 px-3"
                            >
                                <i className="fas fa-clock me-1"></i> Backup Schedule
                            </button>
                        </div>
                    </div>
                </div>
            </div>



            {/* Simple Download Cards */}
            <div className="row g-4 mb-4">
                {/* SQL Card */}
                <div className="col-md-6">
                    <div className="card border-0 shadow-sm h-100 p-4" style={{ borderRadius: '12px', background: isDark ? '#1e293b' : '#ffffff' }}>
                        <div className="d-flex align-items-center mb-4">
                            <i className="fas fa-file-code fs-3 text-primary me-3"></i>
                            <div>
                                <h5 className="fw-bold mb-0">SQL Backup (.sql)</h5>
                                <small className="text-muted">Standard MySQL schema & data format</small>
                            </div>
                        </div>
                        <button
                            className="btn btn-primary w-100 py-2 fw-semibold rounded-3 mt-auto"
                            onClick={() => handleDownload('sql')}
                            disabled={downloadingFormat !== null}
                        >
                            {downloadingFormat === 'sql' ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                    Generating SQL...
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-download me-2"></i> Download SQL Backup
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* JSON Card */}
                <div className="col-md-6">
                    <div className="card border-0 shadow-sm h-100 p-4" style={{ borderRadius: '12px', background: isDark ? '#1e293b' : '#ffffff' }}>
                        <div className="d-flex align-items-center mb-4">
                            <i className="fas fa-file-alt fs-3 text-secondary me-3"></i>
                            <div>
                                <h5 className="fw-bold mb-0">JSON Data (.json)</h5>
                                <small className="text-muted">Django Fixture format</small>
                            </div>
                        </div>
                        <button
                            className="btn btn-outline-secondary w-100 py-2 fw-semibold rounded-3 mt-auto"
                            onClick={() => handleDownload('json')}
                            disabled={downloadingFormat !== null}
                        >
                            {downloadingFormat === 'json' ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                    Generating JSON...
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-download me-2"></i> Download JSON Backup
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Automated Backup Schedule Modal */}
            {showScheduleModal && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content border-0 shadow-sm" style={{ borderRadius: '12px', background: isDark ? '#1e293b' : '#ffffff' }}>
                            <div className="modal-header px-4 py-3 border-bottom">
                                <div className="d-flex align-items-center">
                                    <i className="fas fa-clock fs-4 text-primary me-3"></i>
                                    <div>
                                        <h5 className="modal-title fw-bold mb-0">Automated Backup Schedule</h5>
                                        <small className="text-muted">Configure automatic background database backups</small>
                                    </div>
                                </div>
                                <button type="button" className="btn-close" onClick={() => setShowScheduleModal(false)}></button>
                            </div>

                            <div className="modal-body p-4">
                                <div className="d-flex align-items-center justify-content-between p-3 rounded mb-4" style={{ background: isDark ? '#0f172a' : '#f8fafc' }}>
                                    <span className="fw-bold">Enable Automatic Backups</span>
                                    <div className="form-check form-switch fs-5 mb-0">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            role="switch"
                                            id="enableBackupScheduleModal"
                                            checked={schedule.is_enabled}
                                            onChange={e => setSchedule({ ...schedule, is_enabled: e.target.checked })}
                                        />
                                        <label className="form-check-label fs-6 fw-semibold ms-2" htmlFor="enableBackupScheduleModal">
                                            {schedule.is_enabled ? 'Active' : 'Disabled'}
                                        </label>
                                    </div>
                                </div>

                                <div className="row g-3">
                                    <div className="col-md-6">
                                        <label className="form-label fw-semibold text-muted small text-uppercase">Frequency</label>
                                        <select
                                            className="form-select rounded-3"
                                            value={schedule.frequency}
                                            onChange={e => setSchedule({ ...schedule, frequency: e.target.value })}
                                            disabled={!schedule.is_enabled}
                                        >
                                            <option value="daily">Daily</option>
                                            <option value="weekly">Weekly (Every Sunday)</option>
                                            <option value="monthly">Monthly (1st of Month)</option>
                                        </select>
                                    </div>

                                    <div className="col-md-6">
                                        <label className="form-label fw-semibold text-muted small text-uppercase">Backup Time</label>
                                        <input
                                            type="time"
                                            className="form-control rounded-3"
                                            value={schedule.backup_time}
                                            onChange={e => setSchedule({ ...schedule, backup_time: e.target.value })}
                                            disabled={!schedule.is_enabled}
                                        />
                                    </div>

                                    <div className="col-md-6">
                                        <label className="form-label fw-semibold text-muted small text-uppercase">Format</label>
                                        <select
                                            className="form-select rounded-3"
                                            value={schedule.export_format}
                                            onChange={e => setSchedule({ ...schedule, export_format: e.target.value })}
                                            disabled={!schedule.is_enabled}
                                        >
                                            <option value="sql">SQL Dump (.sql)</option>
                                            <option value="json">JSON Fixture (.json)</option>
                                        </select>
                                    </div>

                                    <div className="col-md-6">
                                        <label className="form-label fw-semibold text-muted small text-uppercase">Retention Period</label>
                                        <select
                                            className="form-select rounded-3"
                                            value={schedule.retention_days}
                                            onChange={e => setSchedule({ ...schedule, retention_days: e.target.value })}
                                            disabled={!schedule.is_enabled}
                                        >
                                            <option value={7}>Keep 7 Days</option>
                                            <option value={30}>Keep 30 Days</option>
                                            <option value={90}>Keep 90 Days</option>
                                        </select>
                                    </div>

                                    <div className="col-12">
                                        <label className="form-label fw-semibold text-muted small text-uppercase">Backup Storage Folder Path</label>
                                        <div className="input-group">
                                            <span className="input-group-text bg-light border-end-0">
                                                <i className="fas fa-folder text-warning"></i>
                                            </span>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="e.g. C:\backups or /var/backups or relative 'backups'"
                                                value={schedule.backup_path}
                                                onChange={e => setSchedule({ ...schedule, backup_path: e.target.value })}
                                                disabled={!schedule.is_enabled}
                                            />
                                            <button
                                                type="button"
                                                className="btn btn-outline-secondary rounded-end-3 px-3"
                                                onClick={handleBrowseFolder}
                                                disabled={!schedule.is_enabled}
                                            >
                                                <i className="fas fa-folder-open me-1"></i> Browse...
                                            </button>
                                        </div>
                                        <input
                                            type="file"
                                            ref={folderInputRef}
                                            style={{ display: 'none' }}
                                            webkitdirectory=""
                                            directory=""
                                            onChange={handleFolderSelect}
                                        />
                                        <small className="text-muted mt-1 d-block" style={{ fontSize: '0.8rem' }}>
                                            Folder path on the server where automated backup files will be stored.
                                        </small>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer px-4 py-3 border-top justify-content-between">
                                <button
                                    type="button"
                                    className="btn btn-outline-success rounded-3 px-3 fw-semibold"
                                    onClick={() => handleDownload(schedule.export_format || 'sql')}
                                    disabled={downloadingFormat !== null}
                                >
                                    <i className="fas fa-play me-2"></i> Run Backup Now
                                </button>
                                <div className="d-flex gap-2">
                                    <button type="button" className="btn btn-secondary rounded-3 px-4" onClick={() => setShowScheduleModal(false)}>Cancel</button>
                                    <button
                                        className="btn btn-primary px-4 rounded-3 fw-semibold"
                                        onClick={handleSaveSchedule}
                                        disabled={savingSchedule}
                                    >
                                        {savingSchedule ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2"></span>
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <i className="fas fa-save me-2"></i> Save Schedule Settings
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DatabaseBackup;
