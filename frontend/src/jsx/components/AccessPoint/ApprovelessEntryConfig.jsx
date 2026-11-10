import React, { useState, useEffect, useContext, useMemo } from 'react';
import { Row, Col, Card, Form, Button, Spinner, Badge, Table } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import {
    getApprovelessConfigs,
    createApprovelessConfig,
    deleteApprovelessConfig,
    toggleApprovelessConfig
} from '../../../services/GateManagementService';
import { getDepartments, getUsers } from '../../../services/HRManagementService';
import { ThemeContext } from '../../../context/ThemeContext';

const ApprovelessEntryConfig = () => {
    const navigate = useNavigate();
    const { isDark } = useContext(ThemeContext) || { isDark: false };

    // Master data
    const [departments, setDepartments] = useState([]);
    const [users, setUsers] = useState([]);
    const [configs, setConfigs] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [loadingEmployees, setLoadingEmployees] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Form state
    const [selectedDepartment, setSelectedDepartment] = useState(null);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [isEnabled, setIsEnabled] = useState(true);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        loadAllData();
    }, []);

    const fetchUsersInBackground = async () => {
        setLoadingEmployees(true);
        try {
            const usersData = await getUsers();
            setUsers(Array.isArray(usersData) ? usersData : (usersData?.results || []));
        } catch (err) {
            console.error('Error loading users:', err);
        } finally {
            setLoadingEmployees(false);
        }
    };

    const loadAllData = async () => {
        setLoadingData(true);
        try {
            // Load departments and existing clearances first - both are fast (<100ms)
            const [deptsData, configsData] = await Promise.all([
                getDepartments().catch(err => {
                    console.error('Error loading departments:', err);
                    return [];
                }),
                getApprovelessConfigs().catch(err => {
                    console.error('Error loading approveless configs:', err);
                    return [];
                })
            ]);

            setDepartments(Array.isArray(deptsData) ? deptsData : (deptsData?.results || []));
            setConfigs(Array.isArray(configsData) ? configsData : (configsData?.results || []));
        } catch (error) {
            console.error('Failed to load initial data:', error);
            Swal.fire('Error', 'Failed to load configuration data. Please refresh.', 'error');
        } finally {
            setLoadingData(false);
        }

        // Fetch users in the background so the clearances table and UI render immediately
        fetchUsersInBackground();
    };

    // Filter employees based on selected department
    const availableEmployees = useMemo(() => {
        if (!selectedDepartment) return [];
        const deptId = parseInt(selectedDepartment.value, 10);
        return users.filter(u => {
            const userDeptId = u.department?.id || u.department_applied?.id || u.dept_id;
            return userDeptId === deptId;
        });
    }, [selectedDepartment, users]);

    // Select options
    const departmentOptions = useMemo(() => {
        return departments.map(d => ({
            value: d.id,
            label: d.name || d.department_name
        }));
    }, [departments]);

    const employeeOptions = useMemo(() => {
        return availableEmployees.map(u => {
            const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;
            const designation = u.position_applied?.name || u.designation?.title || u.role || 'Staff';
            return {
                value: u.id,
                label: `${fullName} (${designation}) - ${u.email || 'No email'}`
            };
        });
    }, [availableEmployees]);

    // React-Select styles matching Glenda template
    const customSelectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '42px',
            borderRadius: '8px',
            borderColor: state.isFocused ? '#0a500f' : (isDark ? '#334155' : '#e2e8f0'),
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            color: isDark ? '#f8fafc' : '#0f172a',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 80, 15, 0.15)' : 'none',
            '&:hover': {
                borderColor: '#0a500f'
            }
        }),
        singleValue: (base) => ({
            ...base,
            color: isDark ? '#f8fafc' : '#0f172a'
        }),
        menu: (base) => ({
            ...base,
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            zIndex: 9999,
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
        }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected
                ? '#0a500f'
                : state.isFocused
                    ? (isDark ? '#334155' : '#f0fdf4')
                    : 'transparent',
            color: state.isSelected ? '#ffffff' : (isDark ? '#f8fafc' : '#0f172a'),
            cursor: 'pointer'
        }),
        input: (base) => ({
            ...base,
            color: isDark ? '#f8fafc' : '#0f172a'
        })
    };

    const handleDepartmentChange = (option) => {
        setSelectedDepartment(option);
        setSelectedEmployee(null); // Reset employee when department changes
        if (option && users.length === 0) {
            fetchUsersInBackground();
        }
    };

    const handleCreateConfig = async (e) => {
        e.preventDefault();

        if (!selectedDepartment) {
            Swal.fire('Validation Error', 'Please select a department.', 'warning');
            return;
        }
        if (!selectedEmployee) {
            Swal.fire('Validation Error', 'Please select an employee.', 'warning');
            return;
        }

        // Check if employee already configured
        const alreadyExists = configs.some(
            c => c.employee === selectedEmployee.value && c.department === selectedDepartment.value
        );
        if (alreadyExists) {
            Swal.fire('Notice', 'An approveless entry configuration already exists for this employee in this department.', 'info');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                department: selectedDepartment.value,
                employee: selectedEmployee.value,
                is_active: isEnabled,
                notes: notes.trim() || null
            };

            const created = await createApprovelessConfig(payload);
            setConfigs(prev => [created, ...prev]);

            // Reset form
            setSelectedEmployee(null);
            setNotes('');
            setIsEnabled(true);

            Swal.fire({
                icon: 'success',
                title: 'Configuration Saved',
                text: 'Approveless entry authorization has been configured successfully!',
                timer: 2000,
                showConfirmButton: false
            });
        } catch (error) {
            console.error('Error saving approveless configuration:', error);
            const errMsg = error.response?.data?.non_field_errors?.[0] || 
                           error.response?.data?.detail || 
                           'Failed to save configuration. Please try again.';
            Swal.fire('Error', errMsg, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleStatus = async (config) => {
        try {
            const res = await toggleApprovelessConfig(config.id);
            setConfigs(prev =>
                prev.map(c => c.id === config.id ? { ...c, is_active: res.is_active } : c)
            );
        } catch (error) {
            console.error('Error toggling configuration status:', error);
            Swal.fire('Error', 'Failed to update configuration status.', 'error');
        }
    };

    const handleDelete = async (config) => {
        const result = await Swal.fire({
            title: 'Remove Configuration?',
            text: `Are you sure you want to remove approveless entry clearance for ${config.employee_name}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Yes, remove',
            cancelButtonText: 'Cancel'
        });

        if (result.isConfirmed) {
            try {
                await deleteApprovelessConfig(config.id);
                setConfigs(prev => prev.filter(c => c.id !== config.id));
                Swal.fire({
                    icon: 'success',
                    title: 'Removed',
                    text: 'Configuration removed successfully.',
                    timer: 1500,
                    showConfirmButton: false
                });
            } catch (error) {
                console.error('Error deleting configuration:', error);
                Swal.fire('Error', 'Failed to remove configuration.', 'error');
            }
        }
    };

    // Filtered configs table
    const filteredConfigs = useMemo(() => {
        if (!searchTerm.trim()) return configs;
        const q = searchTerm.toLowerCase();
        return configs.filter(c =>
            (c.employee_name && c.employee_name.toLowerCase().includes(q)) ||
            (c.department_name && c.department_name.toLowerCase().includes(q)) ||
            (c.employee_email && c.employee_email.toLowerCase().includes(q)) ||
            (c.employee_designation && c.employee_designation.toLowerCase().includes(q)) ||
            (c.notes && c.notes.toLowerCase().includes(q))
        );
    }, [configs, searchTerm]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, configs.length]);

    const totalPages = Math.ceil(filteredConfigs.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredConfigs.slice(indexOfFirstItem, indexOfLastItem);

    const activeCount = useMemo(() => configs.filter(c => c.is_active).length, [configs]);

    return (
        <div className="container-fluid py-3">
            {/* Header Strip */}
            <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
                <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                        <Button
                            variant="light"
                            className="btn-sm rounded-circle d-flex align-items-center justify-content-center border"
                            style={{ width: '32px', height: '32px', padding: 0 }}
                            onClick={() => navigate('/access-point/manage/settings')}
                            title="Back to Access Point Setup"
                        >
                            <i className="fa fa-arrow-left text-muted"></i>
                        </Button>
                        <h4 className="fw-bold mb-0 text-dark" style={{ letterSpacing: '-0.3px' }}>
                            Approveless Entry Configuration
                        </h4>
                    </div>
                    <p className="text-muted small mb-0 ms-4 ps-1">
                        Pre-authorize department employees to bypass gate approval for incoming visitors and vehicles.
                    </p>
                </div>
                <div className="d-flex align-items-center gap-2">
                    <span 
                        className="badge rounded-pill px-3 py-2 fw-semibold"
                        style={{ backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}
                    >
                        <i className="fa fa-shield-alt me-1"></i> {activeCount} Active Clearances
                    </span>
                </div>
            </div>

            <Row className="g-4">
                {/* Left Form: Add Configuration */}
                <Col lg={4}>
                    <Card 
                        className="border shadow-sm rounded-3"
                        style={{ 
                            background: isDark ? '#1e293b' : '#ffffff', 
                            borderColor: isDark ? '#334155' : '#e2e8f0' 
                        }}
                    >
                        <Card.Header 
                            className="bg-transparent border-bottom py-3"
                            style={{ borderColor: isDark ? '#334155' : '#f1f5f9' }}
                        >
                            <div className="d-flex align-items-center gap-2">
                                <div 
                                    className="d-flex align-items-center justify-content-center rounded-2"
                                    style={{ width: '30px', height: '30px', backgroundColor: '#e0f2fe', color: '#0284c7' }}
                                >
                                    <i className="fa fa-user-plus" style={{ fontSize: '13px' }}></i>
                                </div>
                                <h6 className="fw-semibold mb-0 text-dark">Grant Approveless Entry</h6>
                            </div>
                        </Card.Header>

                        <Card.Body className="p-3.5">
                            <Form onSubmit={handleCreateConfig}>
                                {/* Department Dropdown */}
                                <Form.Group className="mb-3">
                                    <Form.Label className="small fw-semibold text-muted text-uppercase" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                                        Department <span className="text-danger">*</span>
                                    </Form.Label>
                                    <Select
                                        styles={customSelectStyles}
                                        options={departmentOptions}
                                        value={selectedDepartment}
                                        onChange={handleDepartmentChange}
                                        placeholder="Select Department..."
                                        isClearable
                                        isLoading={loadingData}
                                        isDisabled={loadingData}
                                    />
                                </Form.Group>

                                {/* Employee Dropdown */}
                                <Form.Group className="mb-3">
                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                        <Form.Label className="small fw-semibold text-muted text-uppercase mb-0" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                                            Employee <span className="text-danger">*</span>
                                        </Form.Label>
                                        {selectedDepartment && (
                                            <span className="text-muted" style={{ fontSize: '11px' }}>
                                                {loadingEmployees ? (
                                                    <span><Spinner size="sm" animation="border" className="me-1" style={{ width: '10px', height: '10px' }} /> Loading staff...</span>
                                                ) : (
                                                    `${availableEmployees.length} staff available`
                                                )}
                                            </span>
                                        )}
                                    </div>
                                    <Select
                                        styles={customSelectStyles}
                                        options={employeeOptions}
                                        value={selectedEmployee}
                                        onChange={setSelectedEmployee}
                                        placeholder={
                                            !selectedDepartment
                                                ? "Choose Department first"
                                                : loadingEmployees
                                                    ? "Loading department staff..."
                                                    : "Select Employee..."
                                        }
                                        isDisabled={!selectedDepartment || loadingEmployees || (users.length > 0 && availableEmployees.length === 0)}
                                        isLoading={loadingEmployees}
                                        isClearable
                                    />
                                    {selectedDepartment && !loadingEmployees && users.length > 0 && availableEmployees.length === 0 && (
                                        <small className="text-warning mt-1 d-block" style={{ fontSize: '12px' }}>
                                            <i className="fa fa-info-circle me-1"></i> No employees found in this department.
                                        </small>
                                    )}
                                </Form.Group>

                                {/* Approveless Entry Toggle */}
                                <div 
                                    className="p-3 rounded-2 border mb-3 d-flex align-items-center justify-content-between"
                                    style={{ 
                                        backgroundColor: isDark ? '#0f172a' : '#f8fafc', 
                                        borderColor: isDark ? '#334155' : '#e2e8f0' 
                                    }}
                                >
                                    <div>
                                        <div className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
                                            Approveless Entry Active
                                        </div>
                                        <small className="text-muted" style={{ fontSize: '11px' }}>
                                            Permit visitors/vehicles to enter without waiting for host authorization
                                        </small>
                                    </div>
                                    <Form.Check
                                        type="switch"
                                        id="approveless-toggle-switch"
                                        checked={isEnabled}
                                        onChange={(e) => setIsEnabled(e.target.checked)}
                                        style={{ transform: 'scale(1.2)' }}
                                    />
                                </div>

                                {/* Notes / Remarks */}
                                <Form.Group className="mb-3">
                                    <Form.Label className="small fw-semibold text-muted text-uppercase" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                                        Notes / Reason (Optional)
                                    </Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        rows={2}
                                        placeholder="e.g. Senior Executive / Fast Clearance / Plant Head"
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        style={{ 
                                            borderRadius: '8px', 
                                            fontSize: '13px', 
                                            backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                            borderColor: isDark ? '#334155' : '#cbd5e1',
                                            color: isDark ? '#f8fafc' : '#0f172a'
                                        }}
                                    />
                                </Form.Group>

                                {/* Form Action Buttons */}
                                <div className="d-flex align-items-center justify-content-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedDepartment(null);
                                            setSelectedEmployee(null);
                                            setNotes('');
                                            setIsEnabled(true);
                                        }}
                                        className="btn btn-cancel-custom text-white fw-medium shadow-sm"
                                        style={{
                                            backgroundColor: '#dc3545',
                                            borderColor: '#dc3545',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            padding: '8px 22px'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn text-white fw-medium shadow-sm d-flex align-items-center justify-content-center"
                                        disabled={submitting || !selectedDepartment || !selectedEmployee}
                                        style={{
                                            backgroundColor: '#0a500f',
                                            borderColor: '#0a500f',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            padding: '8px 24px',
                                            opacity: (submitting || !selectedDepartment || !selectedEmployee) ? 0.65 : 1,
                                            cursor: (submitting || !selectedDepartment || !selectedEmployee) ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        {submitting ? (
                                            <>
                                                <Spinner size="sm" animation="border" className="me-2" />
                                                <span>Saving...</span>
                                            </>
                                        ) : (
                                            <span>Save</span>
                                        )}
                                    </button>
                                </div>
                            </Form>
                        </Card.Body>
                    </Card>
                </Col>

                {/* Right Table: Configured List */}
                <Col lg={8}>
                    <Card>
                        <Card.Header className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                            <Card.Title className="mb-0 text-nowrap">
                                <i className="fa fa-user-shield me-2 text-primary"></i>
                                Authorized Employee Clearances ({filteredConfigs.length})
                            </Card.Title>
                            <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-3 flex-grow-1 justify-content-md-end">
                                <div className="search-bar-container w-100" style={{ margin: 0, maxWidth: '250px' }}>
                                    <span className="search-icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                    </span>
                                    <input
                                        type="text"
                                        className="search-input"
                                        placeholder="Search Employee, Department..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                        </Card.Header>

                        <Card.Body>
                            <div className="table-responsive">
                                <table className="table table-responsive-md">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '80px' }}><strong>SL NO.</strong></th>
                                            <th><strong>EMPLOYEE</strong></th>
                                            <th><strong>DEPARTMENT</strong></th>
                                            <th><strong>STATUS</strong></th>
                                            <th><strong>NOTES</strong></th>
                                            <th className="text-end"><strong>ACTIONS</strong></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loadingData ? (
                                            <tr>
                                                <td colSpan="6" className="text-center py-4">
                                                    <Spinner animation="border" variant="primary" size="sm" className="me-2" />
                                                    Loading authorized staff...
                                                </td>
                                            </tr>
                                        ) : filteredConfigs.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="text-center py-4 text-muted">
                                                    {searchTerm ? 'No clearances match your search.' : 'No authorized employee clearances found.'}
                                                </td>
                                            </tr>
                                        ) : currentItems.map((config, idx) => (
                                            <tr key={config.id || idx}>
                                                <td>{indexOfFirstItem + idx + 1}</td>
                                                <td>
                                                    <span className="text-primary fw-bold">
                                                        <i className="fa fa-user me-2"></i>
                                                        {config.employee_name || 'Unknown'}
                                                    </span>
                                                    {(config.employee_designation || config.employee_email) && (
                                                        <div>
                                                            <small className="text-muted">
                                                                {config.employee_designation}
                                                                {config.employee_designation && config.employee_email && ' • '}
                                                                {config.employee_email}
                                                            </small>
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className="badge badge-info light">
                                                        {config.department_name || '—'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <Form.Check
                                                            type="switch"
                                                            id={`toggle-${config.id}`}
                                                            checked={config.is_active}
                                                            onChange={() => handleToggleStatus(config)}
                                                            className="cursor-pointer mb-0"
                                                            title={config.is_active ? "Click to deactivate" : "Click to activate"}
                                                        />
                                                        <span className={`badge ${config.is_active ? 'badge-success light' : 'badge-secondary light'}`}>
                                                            {config.is_active ? 'Active' : 'Disabled'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="text-muted">
                                                    {config.notes || '—'}
                                                </td>
                                                <td className="text-end">
                                                    <div className="d-flex justify-content-end align-items-center gap-1">
                                                        <button
                                                            onClick={() => handleDelete(config)}
                                                            className="btn btn-outline-danger btn-sm shadow"
                                                            title="Delete Clearance"
                                                            style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                        >
                                                            <i className="fa fa-trash"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {filteredConfigs.length > 0 && (
                                <div className="d-flex justify-content-between align-items-center mt-3 p-3">
                                    <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredConfigs.length)} of {filteredConfigs.length} entries
                                    </div>
                                    {totalPages > 1 && (
                                        <nav>
                                            <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                    <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ border: 'none', background: 'none' }}>
                                                        <i className="la la-angle-left" />
                                                    </button>
                                                </li>

                                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(number => {
                                                    if (number === 1 || number === totalPages || (number >= currentPage - 1 && number <= currentPage + 1)) {
                                                        return (
                                                            <li key={number} className={`page-item ${currentPage === number ? 'active' : ''}`}>
                                                                <button type="button" className="page-link" onClick={() => setCurrentPage(number)} style={{ border: 'none', background: 'none' }}>
                                                                    {number}
                                                                </button>
                                                            </li>
                                                        );
                                                    } else if (number === currentPage - 2 || number === currentPage + 2) {
                                                        return <li key={number} className="page-item disabled"><span className="page-link" style={{ border: 'none', background: 'none' }}>...</span></li>;
                                                    }
                                                    return null;
                                                })}

                                                <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                                    <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} style={{ border: 'none', background: 'none' }}>
                                                        <i className="la la-angle-right" />
                                                    </button>
                                                </li>
                                            </ul>
                                        </nav>
                                    )}
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default ApprovelessEntryConfig;
