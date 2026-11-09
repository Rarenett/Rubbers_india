import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Form, Modal, Spinner, Row, Col } from 'react-bootstrap';
import Swal from 'sweetalert2';
import axiosInstance from '../../../services/AxiosInstance';
import { getUsers } from '../../../services/HRManagementService';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';

const PRESET_OPTIONS = [
    { value: 5, label: '5 Minutes' },
    { value: 10, label: '10 Minutes (Default)' },
    { value: 15, label: '15 Minutes' },
    { value: 30, label: '30 Minutes' },
    { value: 60, label: '60 Minutes (1 Hour)' },
    { value: 120, label: '120 Minutes (2 Hours)' },
    { value: 'custom', label: 'Custom Duration' }
];

const InactivityTimeoutSettings = () => {
    const [timeoutMinutes, setTimeoutMinutes] = useState(10);
    const [selectedOption, setSelectedOption] = useState(10);
    const [customMinutes, setCustomMinutes] = useState('');
    const [userList, setUserList] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedUserEmail, setSelectedUserEmail] = useState('');
    const [loading, setLoading] = useState(true);
    const [userLoading, setUserLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // List & Modal state
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Check logged in user role
    let currentUserId = '';
    let isAdmin = false;
    try {
        const userDetailsStr = localStorage.getItem('userDetails');
        if (userDetailsStr) {
            const parsed = JSON.parse(userDetailsStr);
            const user = parsed?.user || parsed;
            currentUserId = user?.id || '';
            isAdmin = Boolean(user?.is_staff || user?.is_superuser || (user?.role_name && user.role_name.toLowerCase().includes('admin')));
        }
    } catch (e) {
        isAdmin = false;
    }

    const fetchTimeoutForUser = useCallback(async (userId) => {
        setUserLoading(true);
        try {
            const url = userId ? `/api/auth/inactivity-timeout/?user_id=${userId}` : '/api/auth/inactivity-timeout/';
            const response = await axiosInstance.get(url);
            const current = response.data?.inactivity_timeout_minutes || 10;
            setTimeoutMinutes(current);
            setSelectedUserEmail(response.data?.email || '');

            const matchedPreset = PRESET_OPTIONS.find(opt => opt.value === current);
            if (matchedPreset) {
                setSelectedOption(current);
                setCustomMinutes('');
            } else {
                setSelectedOption('custom');
                setCustomMinutes(current.toString());
            }
        } catch (error) {
            console.error('Failed to fetch inactivity timeout', error);
            try {
                const userDetailsStr = localStorage.getItem('userDetails');
                if (userDetailsStr) {
                    const parsed = JSON.parse(userDetailsStr);
                    const current = parsed?.user?.inactivity_timeout_minutes || 10;
                    setTimeoutMinutes(current);
                }
            } catch (e) {
                setTimeoutMinutes(10);
            }
        } finally {
            setUserLoading(false);
        }
    }, []);

    const initPage = useCallback(async () => {
        setLoading(true);
        if (isAdmin) {
            try {
                const usersData = await getUsers();
                const list = usersData || [];
                setUserList(list);
                if (list.length > 0) {
                    const defaultUser = list.find(u => u.id === currentUserId) || list[0];
                    setSelectedUserId(defaultUser.id);
                    await fetchTimeoutForUser(defaultUser.id);
                } else {
                    await fetchTimeoutForUser('');
                }
            } catch (e) {
                console.error('Failed to fetch users list', e);
                await fetchTimeoutForUser('');
            }
        } else {
            await fetchTimeoutForUser('');
        }
        setLoading(false);
    }, [isAdmin, currentUserId, fetchTimeoutForUser]);

    useEffect(() => {
        initPage();
    }, [initPage]);

    const handleOpenCreateModal = () => {
        if (userList.length > 0) {
            const defaultUser = userList.find(u => u.id === currentUserId) || userList[0];
            setSelectedUserId(defaultUser.id);
            fetchTimeoutForUser(defaultUser.id);
        }
        setEditMode(false);
        setShowModal(true);
    };

    const handleOpenEditModal = async (user) => {
        setSelectedUserId(user.id);
        setEditMode(true);
        setShowModal(true);
        await fetchTimeoutForUser(user.id);
    };

    const handleUserSelect = async (e) => {
        const userId = e.target.value;
        setSelectedUserId(userId);
        await fetchTimeoutForUser(userId);
    };

    const handleOptionChange = (e) => {
        const val = e.target.value;
        if (val === 'custom') {
            setSelectedOption('custom');
            if (customMinutes) {
                const parsed = parseInt(customMinutes, 10);
                if (!isNaN(parsed) && parsed > 0) setTimeoutMinutes(parsed);
            }
        } else {
            const numericVal = parseInt(val, 10);
            setSelectedOption(numericVal);
            setTimeoutMinutes(numericVal);
            setCustomMinutes('');
        }
    };

    const handleCustomChange = (e) => {
        const val = e.target.value;
        setCustomMinutes(val);
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed) && parsed > 0 && parsed <= 1440) {
            setTimeoutMinutes(parsed);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const finalMinutes = selectedOption === 'custom' ? parseInt(customMinutes, 10) : timeoutMinutes;

        if (isNaN(finalMinutes) || finalMinutes < 1 || finalMinutes > 1440) {
            Swal.fire({
                icon: 'warning',
                title: 'Invalid Timeout',
                text: 'Please select or enter a valid timeout duration between 1 and 1440 minutes.'
            });
            return;
        }

        setSaving(true);
        try {
            const payload = { inactivity_timeout_minutes: finalMinutes };
            if (selectedUserId) {
                payload.user_id = selectedUserId;
            }

            const response = await axiosInstance.patch('/api/auth/inactivity-timeout/', payload);

            // Update local user list state
            setUserList(prev => prev.map(u => u.id === selectedUserId ? { ...u, inactivity_timeout_minutes: finalMinutes } : u));

            // Update localStorage if currently logged-in user modified
            if (!selectedUserId || selectedUserId === currentUserId) {
                const userDetailsStr = localStorage.getItem('userDetails');
                if (userDetailsStr) {
                    const userDetails = JSON.parse(userDetailsStr);
                    if (userDetails.user) {
                        userDetails.user.inactivity_timeout_minutes = finalMinutes;
                        localStorage.setItem('userDetails', JSON.stringify(userDetails));
                    }
                }
            }

            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: response.data?.message || `Session inactivity timeout updated to ${finalMinutes} minutes.`,
                timer: 2000,
                showConfirmButton: false
            });
            setShowModal(false);
        } catch (error) {
            const errorMsg = error.response?.data?.error || 'Failed to update inactivity timeout';
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: errorMsg
            });
        } finally {
            setSaving(false);
        }
    };

    // Filtered users for table
    const filteredUsers = userList.filter(u => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
        const email = (u.email || '').toLowerCase();
        return fullName.includes(term) || email.includes(term);
    });

    const totalPages = Math.ceil(filteredUsers.length / pageSize) || 1;
    const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    return (
        <div className="container-fluid">
            <div className="page-titles">
                <ol className="breadcrumb">
                    <li className="breadcrumb-item"><a href="#">Configuration</a></li>
                    <li className="breadcrumb-item active"><a href="#">Timeout Settings</a></li>
                </ol>
            </div>

            <div className="row">
                <div className="col-xl-12">
                    <Card className="shadow-sm border-0 rounded-4">
                        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2 py-3">
                            <Card.Title className="fs-4 fw-bold text-dark mb-0">Session Inactivity Timeout Settings</Card.Title>
                            <div className="d-flex align-items-center gap-2">
                                <div className="input-group search-area" style={{ width: '220px' }}>
                                    <input
                                        type="text"
                                        className="form-control form-control-sm"
                                        placeholder="Search user..."
                                        value={searchTerm}
                                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                    />
                                    <span className="input-group-text">
                                        <i className="flaticon-381-search-2"></i>
                                    </span>
                                </div>
                                {isAdmin && (
                                    <CreateButton
                                        module="configuration"
                                        onClick={handleOpenCreateModal}
                                        title="Configure Timeout"
                                    >
                                        + Configure Timeout
                                    </CreateButton>
                                )}
                            </div>
                        </Card.Header>

                        <Card.Body className="p-0">
                            {loading ? (
                                <div className="text-center py-5">
                                    <Spinner animation="border" variant="primary" />
                                    <p className="mt-2 text-muted">Loading settings...</p>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-hover align-middle mb-0" style={{ minWidth: '700px' }}>
                                        <thead className="table-light">
                                            <tr>
                                                <th className="ps-4" style={{ width: '50px' }}>#</th>
                                                <th>USER NAME</th>
                                                <th>EMAIL</th>
                                                <th>TIMEOUT DURATION</th>
                                                <th className="text-end pe-4" style={{ width: '120px' }}>ACTIONS</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedUsers.length === 0 ? (
                                                <tr>
                                                    <td colSpan="5" className="text-center py-5 text-muted">
                                                        <i className="fa fa-users fs-3 d-block mb-2 text-secondary"></i>
                                                        No users found matching query.
                                                    </td>
                                                </tr>
                                            ) : (
                                                paginatedUsers.map((user, idx) => {
                                                    const absIndex = (currentPage - 1) * pageSize + idx + 1;
                                                    const timeoutVal = user.inactivity_timeout_minutes || 10;
                                                    return (
                                                        <tr key={user.id || idx}>
                                                            <td className="ps-4 text-muted fw-semibold">{absIndex}</td>
                                                            <td className="fw-bold text-dark">
                                                                {user.first_name} {user.last_name || ''}
                                                            </td>
                                                            <td>{user.email || '--'}</td>
                                                            <td>
                                                                <span className="badge bg-light text-primary border border-primary-subtle fw-semibold px-3 py-2">
                                                                    <i className="fa fa-clock-o me-1"></i> {timeoutVal} Minutes
                                                                </span>
                                                            </td>
                                                            <td className="text-end pe-4">
                                                                <EditButton
                                                                    module="configuration"
                                                                    onClick={() => handleOpenEditModal(user)}
                                                                    title="Edit Timeout"
                                                                />
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Pagination Bar */}
                            {filteredUsers.length > 0 && (
                                <div className="d-flex justify-content-between align-items-center p-3 border-top flex-wrap gap-2">
                                    <div className="d-flex align-items-center gap-2">
                                        <small className="text-muted" style={{ fontSize: '13px' }}>
                                            Showing {Math.min((currentPage - 1) * pageSize + 1, filteredUsers.length)}–{Math.min(currentPage * pageSize, filteredUsers.length)} of {filteredUsers.length} entries
                                        </small>
                                        <select
                                            className="form-select form-select-sm"
                                            style={{ width: 'auto', fontSize: '13px' }}
                                            value={pageSize}
                                            onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                                        >
                                            {[10, 25, 50, 100].map(sz => (
                                                <option key={sz} value={sz}>{sz} / page</option>
                                            ))}
                                        </select>
                                    </div>
                                    <nav>
                                        <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                            <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                <button type="button" className="page-link" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} title="First" style={{ border: 'none', background: 'none' }}>
                                                    <i className="la la-angle-double-left" />
                                                </button>
                                            </li>
                                            <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} title="Previous" style={{ border: 'none', background: 'none' }}>
                                                    <i className="la la-angle-left" />
                                                </button>
                                            </li>
                                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                                .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                                                .reduce((acc, page, idx, arr) => {
                                                    if (idx > 0 && page - arr[idx - 1] > 1) acc.push('...');
                                                    acc.push(page);
                                                    return acc;
                                                }, [])
                                                .map((item, idx) =>
                                                    item === '...' ? (
                                                        <li key={`ellipsis-${idx}`} className="page-item disabled">
                                                            <span className="page-link" style={{ border: 'none', background: 'none' }}>…</span>
                                                        </li>
                                                    ) : (
                                                        <li key={item} className={`page-item ${currentPage === item ? 'active' : ''}`}>
                                                            <button type="button" className="page-link" onClick={() => setCurrentPage(item)} style={{ border: 'none' }}>
                                                                {item}
                                                            </button>
                                                        </li>
                                                    )
                                                )
                                            }
                                            <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                                <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} title="Next" style={{ border: 'none', background: 'none' }}>
                                                    <i className="la la-angle-right" />
                                                </button>
                                            </li>
                                            <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                                <button type="button" className="page-link" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} title="Last" style={{ border: 'none', background: 'none' }}>
                                                    <i className="la la-angle-double-right" />
                                                </button>
                                            </li>
                                        </ul>
                                    </nav>
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {/* Modal Popup Form */}
            <Modal show={showModal} onHide={() => setShowModal(false)} centered size="lg">
                <Modal.Header closeButton className="border-bottom py-3">
                    <Modal.Title className="fs-5 fw-bold text-dark">
                        {editMode ? 'Edit Inactivity Timeout Settings' : 'Configure Inactivity Timeout'}
                    </Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleSave}>
                    <Modal.Body className="p-4">
                        {!isAdmin && (
                            <div className="alert alert-warning light mb-4">
                                <i className="fa fa-lock me-2"></i>
                                <strong>Read-Only Mode:</strong> Only Administrators are authorized to modify inactivity timeouts.
                            </div>
                        )}

                        <Row className="mb-3">
                            {/* User Selector */}
                            {isAdmin && (
                                <Col md={6} className="mb-3">
                                    <Form.Group controlId="selectedUserId">
                                        <Form.Label className="fw-semibold text-dark">
                                            Select User <span className="text-danger">*</span>
                                        </Form.Label>
                                        <Form.Select
                                            size="sm"
                                            value={selectedUserId}
                                            onChange={handleUserSelect}
                                            disabled={userLoading || editMode}
                                            className="rounded-3 border-secondary border-opacity-25"
                                            style={{ height: '42px', fontSize: '14px' }}
                                        >
                                            {userList.map((u) => (
                                                <option key={u.id} value={u.id}>
                                                    {u.first_name} {u.last_name} ({u.email})
                                                </option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                            )}

                            {/* Timeout Selection Dropdown */}
                            <Col md={isAdmin ? 6 : 12} className="mb-3">
                                <Form.Group controlId="timeoutMinutes">
                                    <Form.Label className="fw-semibold text-dark">
                                        Inactivity Timeout Duration <span className="text-danger">*</span>
                                    </Form.Label>
                                    <Form.Select
                                        size="sm"
                                        value={selectedOption}
                                        onChange={handleOptionChange}
                                        disabled={!isAdmin || userLoading}
                                        className="rounded-3 border-secondary border-opacity-25"
                                        style={{ height: '42px', fontSize: '14px' }}
                                    >
                                        {PRESET_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                            </Col>

                            {/* Custom Duration Input */}
                            {selectedOption === 'custom' && (
                                <Col md={12} className="mb-3">
                                    <Form.Group controlId="customMinutes">
                                        <Form.Label className="fw-semibold text-dark">
                                            Custom Duration (Minutes) <span className="text-danger">*</span>
                                        </Form.Label>
                                        <Form.Control
                                            size="sm"
                                            type="number"
                                            min="1"
                                            max="1440"
                                            placeholder="Enter minutes (1 - 1440)"
                                            value={customMinutes}
                                            onChange={handleCustomChange}
                                            disabled={!isAdmin || userLoading}
                                            required
                                            className="rounded-3 border-secondary border-opacity-25"
                                            style={{ height: '42px', fontSize: '14px' }}
                                        />
                                    </Form.Group>
                                </Col>
                            )}
                        </Row>

                        {/* Information Summary */}
                        <div className="alert alert-primary light mb-0">
                            <div className="fw-bold mb-2">
                                <i className="fa fa-info-circle me-2"></i>
                                Configuration Summary {selectedUserEmail && `for ${selectedUserEmail}`}:
                            </div>
                            <ul className="mb-0 ps-3 fs-7" style={{ lineHeight: '1.6' }}>
                                <li>Auto Logout will trigger after <strong>{timeoutMinutes} minutes</strong> of inactivity.</li>
                                <li>Active user interactions (mouse movement, typing, clicking) automatically reset the timer.</li>
                                <li>Upon logging back in, the user will be restored to their working page.</li>
                            </ul>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button
                            className="btn-universal-close"
                            onClick={() => setShowModal(false)}
                        >
                            Close
                        </Button>
                        {isAdmin && (
                            <Button
                                type="submit"
                                disabled={saving || userLoading}
                                className="btn-universal-save"
                            >
                                {editMode ? 'Update' : 'Save'}
                            </Button>
                        )}
                    </Modal.Footer>
                </Form>
            </Modal>
        </div>
    );
};

export default InactivityTimeoutSettings;
