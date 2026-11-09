import React, { useState, useEffect, useCallback, useMemo } from 'react';
import DigiLockerService from '../../../services/DigiLockerService';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils.jsx';
import Pagination from '../Common/Pagination';
import { Modal, Button, Card, Row, Col, Badge } from 'react-bootstrap';
import Swal from 'sweetalert2';

const DigiLockerReport = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [folders, setFolders] = useState([]);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [selectedFolder, setSelectedFolder] = useState('');
    const [selectedAction, setSelectedAction] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(15);

    // Selected log for detail modal
    const [selectedLog, setSelectedLog] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    const loadFiltersData = async () => {
        try {
            const [empRes, folderRes] = await Promise.all([
                DigiLockerService.getEmployees(),
                DigiLockerService.getFolders()
            ]);
            setEmployees(Array.isArray(empRes) ? empRes : (empRes.results || []));
            setFolders(Array.isArray(folderRes) ? folderRes : (folderRes.results || []));
        } catch (err) {
            console.error('Error fetching filter reference data:', err);
        }
    };

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (selectedEmployee) params.employee = selectedEmployee;
            if (selectedFolder) params.folder = selectedFolder;
            if (selectedAction) params.action = selectedAction;
            if (selectedStatus) params.status = selectedStatus;
            if (startDate) params.start_date = startDate;
            if (endDate) params.end_date = endDate;
            if (searchTerm) params.search = searchTerm;

            const res = await DigiLockerService.getReports(params);
            const data = Array.isArray(res) ? res : (res.results || []);
            setLogs(data);
        } catch (err) {
            console.error('Error fetching audit logs:', err);
            Swal.fire({
                icon: 'error',
                title: 'Failed to Fetch Logs',
                text: err.response?.data?.detail || 'An unexpected error occurred while loading audit reports.',
                customClass: { confirmButton: 'btn btn-primary' }
            });
        } finally {
            setLoading(false);
        }
    }, [selectedEmployee, selectedFolder, selectedAction, selectedStatus, startDate, endDate, searchTerm]);

    useEffect(() => {
        loadFiltersData();
    }, []);

    useEffect(() => {
        fetchLogs();
        setCurrentPage(1);
    }, [fetchLogs]);

    const handleResetFilters = () => {
        setSelectedEmployee('');
        setSelectedFolder('');
        setSelectedAction('');
        setSelectedStatus('');
        setStartDate('');
        setEndDate('');
        setSearchTerm('');
    };

    // Metrics
    const metrics = useMemo(() => {
        const total = logs.length;
        const successes = logs.filter(l => l.status === 'success').length;
        const failures = logs.filter(l => l.status === 'failed' || l.status === 'denied').length;
        const views = logs.filter(l => l.action === 'view_authorized' || l.action === 'otp_verified').length;
        const downloads = logs.filter(l => l.action === 'download_authorized').length;
        return { total, successes, failures, views, downloads };
    }, [logs]);

    // Client-side pagination
    const totalPages = Math.ceil(logs.length / rowsPerPage) || 1;
    const paginatedLogs = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return logs.slice(start, start + rowsPerPage);
    }, [logs, currentPage, rowsPerPage]);

    // Export formatters
    const exportColumns = [
        { header: 'Sl. No.', key: 'sl' },
        { header: 'Timestamp', key: 'timestamp' },
        { header: 'Action', key: 'action' },
        { header: 'Status', key: 'status' },
        { header: 'Target Employee', key: 'target_employee' },
        { header: 'Folder', key: 'folder' },
        { header: 'Document', key: 'document' },
        { header: 'Actor', key: 'actor' },
        { header: 'IP Address', key: 'ip_address' },
        { header: 'Details', key: 'details' }
    ];

    const getExportData = () => {
        return logs.map((log, idx) => ({
            sl: idx + 1,
            timestamp: log.timestamp ? new Date(log.timestamp).toLocaleString() : '—',
            action: log.action || '—',
            status: log.status || '—',
            target_employee: log.target_employee_name ? `${log.target_employee_name} (${log.target_employee_code || ''})` : '—',
            folder: log.folder_name || '—',
            document: log.document_name || '—',
            actor: log.actor_username || '—',
            ip_address: log.ip_address || '—',
            details: log.details || '—'
        }));
    };

    const handleExportPDF = () => {
        exportToPDF('DigiLocker Audit Access Report', exportColumns, getExportData());
    };

    const handleExportExcel = () => {
        exportToExcel('DigiLocker Audit Access Report', exportColumns, getExportData(), 'DigiLocker_Report');
    };

    const handlePrint = () => {
        printData('DigiLocker Audit Access Report', exportColumns, getExportData());
    };

    const getActionBadge = (action) => {
        switch (action) {
            case 'view_authorized':
            case 'document_view':
                return <span className="badge badge-info light"><i className="fa fa-eye me-1"></i> View</span>;
            case 'download_authorized':
            case 'document_download':
                return <span className="badge badge-success light"><i className="fa fa-download me-1"></i> Download</span>;
            case 'otp_requested':
                return <span className="badge badge-warning light"><i className="fa fa-key me-1"></i> OTP Sent</span>;
            case 'otp_verified':
                return <span className="badge badge-primary light"><i className="fa fa-check-circle me-1"></i> OTP Verified</span>;
            case 'otp_failed':
                return <span className="badge badge-danger light"><i className="fa fa-times-circle me-1"></i> OTP Failed</span>;
            case 'folder_created':
                return <span className="badge badge-secondary light"><i className="fa fa-folder-plus me-1"></i> Folder Created</span>;
            case 'document_uploaded':
                return <span className="badge badge-primary light"><i className="fa fa-upload me-1"></i> Uploaded</span>;
            case 'folder_mapped':
                return <span className="badge badge-dark light"><i className="fa fa-link me-1"></i> Mapped</span>;
            case 'folder_unmapped':
                return <span className="badge badge-danger light"><i className="fa fa-unlink me-1"></i> Unmapped</span>;
            default:
                return <span className="badge badge-light light">{action || '—'}</span>;
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'success':
                return <span className="badge badge-success"><i className="fa fa-check me-1"></i> Success</span>;
            case 'failed':
                return <span className="badge badge-danger"><i className="fa fa-times me-1"></i> Failed</span>;
            case 'denied':
                return <span className="badge badge-warning"><i className="fa fa-ban me-1"></i> Denied</span>;
            default:
                return <span className="badge badge-secondary">{status || '—'}</span>;
        }
    };

    return (
        <div className="container-fluid">
            {/* Header & Breadcrumb */}
            <div className="row page-titles mb-3">
                <ol className="breadcrumb">
                    <li className="breadcrumb-item"><a href="#!">DigiLocker</a></li>
                    <li className="breadcrumb-item active"><a href="#!">Audit Report</a></li>
                </ol>
            </div>

            {/* Metrics Row */}
            <Row className="mb-4">
                <Col xl={3} sm={6} className="mb-2">
                    <Card className="shadow-sm border-0">
                        <Card.Body className="p-3 d-flex align-items-center">
                            <div className="avatar-md bg-primary-light text-primary rounded-circle p-3 me-3 d-flex align-items-center justify-content-center" style={{ width: 48, height: 48, background: '#eef2ff' }}>
                                <i className="fa fa-list fa-lg text-primary"></i>
                            </div>
                            <div>
                                <h6 className="text-muted text-uppercase mb-1" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>Total Logs</h6>
                                <h4 className="mb-0 fw-bold">{metrics.total}</h4>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col xl={3} sm={6} className="mb-2">
                    <Card className="shadow-sm border-0">
                        <Card.Body className="p-3 d-flex align-items-center">
                            <div className="avatar-md bg-success-light text-success rounded-circle p-3 me-3 d-flex align-items-center justify-content-center" style={{ width: 48, height: 48, background: '#f0fdf4' }}>
                                <i className="fa fa-check-circle fa-lg text-success"></i>
                            </div>
                            <div>
                                <h6 className="text-muted text-uppercase mb-1" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>Success Events</h6>
                                <h4 className="mb-0 fw-bold text-success">{metrics.successes}</h4>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col xl={3} sm={6} className="mb-2">
                    <Card className="shadow-sm border-0">
                        <Card.Body className="p-3 d-flex align-items-center">
                            <div className="avatar-md bg-info-light text-info rounded-circle p-3 me-3 d-flex align-items-center justify-content-center" style={{ width: 48, height: 48, background: '#e0f2fe' }}>
                                <i className="fa fa-eye fa-lg text-info"></i>
                            </div>
                            <div>
                                <h6 className="text-muted text-uppercase mb-1" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>View Accesses</h6>
                                <h4 className="mb-0 fw-bold text-info">{metrics.views}</h4>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col xl={3} sm={6} className="mb-2">
                    <Card className="shadow-sm border-0">
                        <Card.Body className="p-3 d-flex align-items-center">
                            <div className="avatar-md bg-warning-light text-warning rounded-circle p-3 me-3 d-flex align-items-center justify-content-center" style={{ width: 48, height: 48, background: '#fef3c7' }}>
                                <i className="fa fa-download fa-lg text-warning"></i>
                            </div>
                            <div>
                                <h6 className="text-muted text-uppercase mb-1" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>Downloads</h6>
                                <h4 className="mb-0 fw-bold text-warning">{metrics.downloads}</h4>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Main Table Card */}
            <div className="card shadow-sm border-0">
                <div className="card-header border-0 pb-0 d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <h5 className="card-title fw-bold mb-0">
                        <i className="fa fa-history text-primary me-2"></i>
                        DigiLocker Audit & Access Report
                    </h5>
                    <div className="d-flex flex-wrap align-items-center gap-2">
                        {/* Export Buttons */}
                        <button
                            type="button"
                            className="btn btn-outline-danger btn-sm shadow-sm"
                            onClick={handleExportPDF}
                            title="Export to PDF"
                        >
                            <i className="fa fa-file-pdf me-1"></i> PDF
                        </button>
                        <button
                            type="button"
                            className="btn btn-outline-success btn-sm shadow-sm"
                            onClick={handleExportExcel}
                            title="Export to Excel"
                        >
                            <i className="fa fa-file-excel me-1"></i> Excel
                        </button>
                        <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm shadow-sm"
                            onClick={handlePrint}
                            title="Print Table"
                        >
                            <i className="fa fa-print me-1"></i> Print
                        </button>
                        <button
                            type="button"
                            className="btn btn-outline-primary btn-sm shadow-sm"
                            onClick={fetchLogs}
                            title="Refresh"
                        >
                            <i className={`fa fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
                        </button>
                    </div>
                </div>

                <div className="card-body">
                    {/* Filters Bar */}
                    <div className="p-3 mb-3 bg-light rounded">
                        <Row className="g-2 align-items-end">
                            <Col md={3} sm={6}>
                                <label className="form-label text-muted small fw-bold mb-1">Search Keyword</label>
                                <div className="input-group">
                                    <span className="input-group-text bg-white border-end-0">
                                        <i className="fa fa-search text-muted"></i>
                                    </span>
                                    <input
                                        type="text"
                                        className="form-control border-start-0"
                                        placeholder="Search by details, user, doc..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </Col>

                            <Col md={2} sm={6}>
                                <label className="form-label text-muted small fw-bold mb-1">Target Employee</label>
                                <select
                                    className="form-select"
                                    value={selectedEmployee}
                                    onChange={(e) => setSelectedEmployee(e.target.value)}
                                >
                                    <option value="">All Employees</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.label || `${emp.first_name || ''} ${emp.last_name || ''} (${emp.emp_id || emp.id})`}
                                        </option>
                                    ))}
                                </select>
                            </Col>

                            <Col md={2} sm={6}>
                                <label className="form-label text-muted small fw-bold mb-1">Folder</label>
                                <select
                                    className="form-select"
                                    value={selectedFolder}
                                    onChange={(e) => setSelectedFolder(e.target.value)}
                                >
                                    <option value="">All Folders</option>
                                    {folders.map(f => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                </select>
                            </Col>

                            <Col md={2} sm={6}>
                                <label className="form-label text-muted small fw-bold mb-1">Action</label>
                                <select
                                    className="form-select"
                                    value={selectedAction}
                                    onChange={(e) => setSelectedAction(e.target.value)}
                                >
                                    <option value="">All Actions</option>
                                    <option value="view_authorized">View Document</option>
                                    <option value="download_authorized">Download Document</option>
                                    <option value="otp_requested">OTP Requested</option>
                                    <option value="otp_verified">OTP Verified</option>
                                    <option value="otp_failed">OTP Failed</option>
                                    <option value="document_uploaded">Document Uploaded</option>
                                    <option value="folder_mapped">Folder Mapped</option>
                                    <option value="folder_unmapped">Folder Unmapped</option>
                                    <option value="folder_created">Folder Created</option>
                                </select>
                            </Col>

                            <Col md={1} sm={6}>
                                <label className="form-label text-muted small fw-bold mb-1">Status</label>
                                <select
                                    className="form-select"
                                    value={selectedStatus}
                                    onChange={(e) => setSelectedStatus(e.target.value)}
                                >
                                    <option value="">All</option>
                                    <option value="success">Success</option>
                                    <option value="failed">Failed</option>
                                    <option value="denied">Denied</option>
                                </select>
                            </Col>

                            <Col md={2} sm={6}>
                                <div className="d-flex gap-2">
                                    <div className="flex-grow-1">
                                        <label className="form-label text-muted small fw-bold mb-1">From Date</label>
                                        <input
                                            type="date"
                                            className="form-control"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex-grow-1">
                                        <label className="form-label text-muted small fw-bold mb-1">To Date</label>
                                        <input
                                            type="date"
                                            className="form-control"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </Col>
                        </Row>

                        {(selectedEmployee || selectedFolder || selectedAction || selectedStatus || startDate || endDate || searchTerm) && (
                            <div className="mt-2 text-end">
                                <button
                                    type="button"
                                    className="btn btn-link btn-sm text-danger p-0"
                                    onClick={handleResetFilters}
                                >
                                    <i className="fa fa-times me-1"></i> Clear Filters
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Table */}
                    <div className="table-responsive">
                        <table className="table table-hover table-striped align-middle">
                            <thead className="table-light">
                                <tr>
                                    <th style={{ width: '60px' }}>Sl. No.</th>
                                    <th>Timestamp</th>
                                    <th>Action</th>
                                    <th>Status</th>
                                    <th>Target Employee</th>
                                    <th>Folder</th>
                                    <th>Document</th>
                                    <th>Actor</th>
                                    <th>IP Address</th>
                                    <th className="text-center" style={{ width: '80px' }}>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="10" className="text-center py-4">
                                            <div className="spinner-border text-primary spinner-border-sm me-2" role="status"></div>
                                            Loading audit records...
                                        </td>
                                    </tr>
                                ) : paginatedLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan="10" className="text-center py-4 text-muted">
                                            <i className="fa fa-info-circle me-1"></i> No audit logs found matching the selected criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedLogs.map((log, index) => {
                                        const slNo = (currentPage - 1) * rowsPerPage + index + 1;
                                        return (
                                            <tr key={log.id || index}>
                                                <td className="fw-bold text-muted">{slNo}</td>
                                                <td>
                                                    <span className="small text-muted">
                                                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                                                    </span>
                                                </td>
                                                <td>{getActionBadge(log.action)}</td>
                                                <td>{getStatusBadge(log.status)}</td>
                                                <td>
                                                    {log.target_employee_name ? (
                                                        <div>
                                                            <div className="fw-bold">{log.target_employee_name}</div>
                                                            {log.target_employee_code && (
                                                                <small className="text-muted">{log.target_employee_code}</small>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted">—</span>
                                                    )}
                                                </td>
                                                <td>{log.folder_name || '—'}</td>
                                                <td>
                                                    {log.document_name ? (
                                                        <span className="fw-semibold text-primary">{log.document_name}</span>
                                                    ) : (
                                                        <span className="text-muted">—</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <small className="fw-semibold">{log.actor_username || 'System'}</small>
                                                </td>
                                                <td>
                                                    <small className="text-muted font-monospace">{log.ip_address || '—'}</small>
                                                </td>
                                                <td className="text-center">
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-info shadow-sm"
                                                        style={{ width: '28px', height: '28px', padding: 0 }}
                                                        onClick={() => {
                                                            setSelectedLog(log);
                                                            setShowDetailModal(true);
                                                        }}
                                                        title="View Details"
                                                    >
                                                        <i className="fa fa-info-circle fa-xs"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {logs.length > 0 && (
                        <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap">
                            <div className="text-muted small">
                                Showing {(currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, logs.length)} of {logs.length} entries
                            </div>
                            <div className="d-flex align-items-center gap-2">
                                <select
                                    className="form-select form-select-sm"
                                    style={{ width: '80px' }}
                                    value={rowsPerPage}
                                    onChange={(e) => {
                                        setRowsPerPage(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                >
                                    <option value={10}>10</option>
                                    <option value={15}>15</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    onPageChange={setCurrentPage}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Audit Log Detail Modal */}
            <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title className="h5 fw-bold">
                        <i className="fa fa-info-circle text-primary me-2"></i>
                        Audit Log Details
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedLog && (
                        <div className="d-flex flex-column gap-2">
                            <div>
                                <small className="text-muted text-uppercase fw-bold">Timestamp:</small>
                                <div>{selectedLog.timestamp ? new Date(selectedLog.timestamp).toLocaleString() : '—'}</div>
                            </div>
                            <hr className="my-1" />
                            <div className="row">
                                <div className="col-6">
                                    <small className="text-muted text-uppercase fw-bold">Action:</small>
                                    <div className="mt-1">{getActionBadge(selectedLog.action)}</div>
                                </div>
                                <div className="col-6">
                                    <small className="text-muted text-uppercase fw-bold">Status:</small>
                                    <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
                                </div>
                            </div>
                            <hr className="my-1" />
                            <div>
                                <small className="text-muted text-uppercase fw-bold">Actor (Triggered By):</small>
                                <div className="fw-bold">{selectedLog.actor_username || 'System / Anonymous'}</div>
                            </div>
                            {selectedLog.target_employee_name && (
                                <div>
                                    <small className="text-muted text-uppercase fw-bold">Target Employee:</small>
                                    <div className="fw-semibold">{selectedLog.target_employee_name} ({selectedLog.target_employee_code})</div>
                                </div>
                            )}
                            {selectedLog.folder_name && (
                                <div>
                                    <small className="text-muted text-uppercase fw-bold">Folder:</small>
                                    <div>{selectedLog.folder_name}</div>
                                </div>
                            )}
                            {selectedLog.document_name && (
                                <div>
                                    <small className="text-muted text-uppercase fw-bold">Document:</small>
                                    <div className="text-primary fw-bold">{selectedLog.document_name}</div>
                                </div>
                            )}
                            <div>
                                <small className="text-muted text-uppercase fw-bold">IP Address:</small>
                                <div className="font-monospace small">{selectedLog.ip_address || '—'}</div>
                            </div>
                            <div>
                                <small className="text-muted text-uppercase fw-bold">Details / Message:</small>
                                <div className="p-2 bg-light rounded small mt-1">{selectedLog.details || 'No additional details.'}</div>
                            </div>
                            {selectedLog.safe_metadata && Object.keys(selectedLog.safe_metadata).length > 0 && (
                                <div>
                                    <small className="text-muted text-uppercase fw-bold">Metadata:</small>
                                    <pre className="p-2 bg-light rounded small mt-1 mb-0" style={{ maxHeight: 150, overflowY: 'auto' }}>
                                        {JSON.stringify(selectedLog.safe_metadata, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default DigiLockerReport;
