import React, { useState, useEffect, Fragment } from 'react';
import { Card, Form } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import { getEmployees, getDepartments } from '../../../../services/HRManagementService';
import { usePermission } from '../../../../hooks/usePermission';
import CandidateLoginModal from './CandidateLoginModal';
import EmployeeDetailModal from './EmployeeDetailModal';

const ITEMS_PER_PAGE = 10;

const selectStyles = {
    control: (base) => ({
        ...base,
        height: '38px',
        minHeight: '38px',
        borderRadius: '6px',
        fontSize: '13px',
    }),
    menu: (base) => ({
        ...base,
        fontSize: '13px',
        zIndex: 100,
    }),
};

const EmployeeList = () => {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDept, setSelectedDept] = useState(null);
    const [departments, setDepartments] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [loginModal, setLoginModal] = useState({ show: false, employee: null });
    const [detailModal, setDetailModal] = useState({ show: false, candidateId: null, employeeName: '' });
    const { can } = usePermission();

    useEffect(() => {
        fetchEmployees();
        getDepartments()
            .then(res => setDepartments(res?.results || res || []))
            .catch(() => {});
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedDept]);

    const fetchEmployees = async () => {
        try {
            setLoading(true);
            const data = await getEmployees();
            setEmployees(data);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to fetch employees' });
        } finally {
            setLoading(false);
        }
    };

    const handleAddEmploymentDetails = (emp) => {
        setDetailModal({ show: true, candidateId: emp.candidate_id, employeeId: emp.id, employeeName: emp.full_name });
    };

    const handleCloseDetailModal = () => {
        setDetailModal({ show: false, candidateId: null, employeeId: null, employeeName: '' });
    };

    const handleOpenLoginModal = (employee) => {
        setLoginModal({ show: true, employee });
    };

    const handleCloseLoginModal = () => {
        setLoginModal({ show: false, employee: null });
    };

    // Department options for react-select
    const deptOptions = departments.map(d => ({ value: d.id, label: d.name }));

    // Filter by search term AND selected department, sorted alphabetically
    const filteredEmployees = employees
        .filter(emp => {
            const term = searchTerm.toLowerCase();
            const matchesSearch = !term || (
                emp.full_name?.toLowerCase().includes(term) ||
                emp.user_email?.toLowerCase().includes(term) ||
                emp.email?.toLowerCase().includes(term) ||
                emp.mobile_number?.toLowerCase().includes(term) ||
                emp.department_name?.toLowerCase().includes(term) ||
                emp.designation_title?.toLowerCase().includes(term)
            );
            const matchesDept = selectedDept ? emp.department_id === selectedDept.value : true;
            return matchesSearch && matchesDept;
        })
        .sort((a, b) => {
            const nameA = (a.full_name || a.user_name || '').trim().toLowerCase();
            const nameB = (b.full_name || b.user_name || '').trim().toLowerCase();
            return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
        });

    // Pagination
    const totalPages = Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE);
    const indexOfLast = currentPage * ITEMS_PER_PAGE;
    const indexOfFirst = indexOfLast - ITEMS_PER_PAGE;
    const currentEmployees = filteredEmployees.slice(indexOfFirst, indexOfLast);

    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <Card.Title className="mb-0">Employees</Card.Title>
                            <div className="d-flex align-items-center flex-wrap gap-2">
                                {/* Department filter — same pattern as EmployeeAttendanceReport */}
                                <div style={{ minWidth: '200px', flex: '1 1 200px' }}>
                                    <Select
                                        options={deptOptions}
                                        value={selectedDept}
                                        onChange={(opt) => setSelectedDept(opt)}
                                        placeholder="All Departments"
                                        isClearable
                                        styles={selectStyles}
                                    />
                                </div>
                                {/* Text search */}
                                <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 220px' }}>
                                    <i
                                        className="fa fa-search position-absolute text-muted"
                                        style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}
                                    />
                                    <Form.Control
                                        type="text"
                                        placeholder="Search employee..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                            </div>
                        </Card.Header>

                        <Card.Body className="pb-4">
                            {loading ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table mb-0">
                                        <thead>
                                            <tr>
                                                <th><strong>SL No</strong></th>
                                                <th><strong>NAME</strong></th>
                                                <th><strong>DEPARTMENT</strong></th>
                                                <th><strong>DESIGNATION</strong></th>
                                                <th><strong>EMAIL</strong></th>
                                                <th><strong>PHONE</strong></th>
                                                <th><strong>LOGIN</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentEmployees.length === 0 ? (
                                                <tr>
                                                    <td colSpan="8" className="text-center py-4 text-muted">
                                                        No employees found
                                                    </td>
                                                </tr>
                                            ) : (
                                                currentEmployees.map((emp, index) => (
                                                    <tr key={emp.id}>
                                                        <td>{indexOfFirst + index + 1}</td>
                                                        <td><strong>{emp.full_name || '-'}</strong></td>
                                                        <td>{emp.department_name || '-'}</td>
                                                        <td>{emp.designation_title || '-'}</td>
                                                        <td>{emp.user_email || emp.email || '-'}</td>
                                                        <td>{emp.mobile_number || '-'}</td>
                                                        <td>
                                                            {emp.has_login
                                                                ? (emp.user_is_active === false
                                                                    ? <span className="badge badge-warning light" style={{ color: '#d97706', backgroundColor: '#fef3c7' }}>Inactive</span>
                                                                    : <span className="badge badge-success light">Active</span>)
                                                                : <span className="badge badge-danger light">None</span>
                                                            }
                                                        </td>
                                                        <td className="text-end">
                                                            <div className="d-flex justify-content-end gap-1">
                                                                {can('employees', 'edit') && (
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-outline-info shadow"
                                                                        style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                                        onClick={() => handleAddEmploymentDetails(emp)}
                                                                        title="Add Employment Details"
                                                                    >
                                                                        <i className="fa fa-plus"></i>
                                                                    </button>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-sm btn-outline-primary shadow"
                                                                    style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                                    onClick={() => handleOpenLoginModal(emp)}
                                                                    title="Setup Login Access"
                                                                >
                                                                    <i className="fa fa-key"></i>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Pagination */}
                            {!loading && filteredEmployees.length > 0 && (
                                <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mt-4 mb-3">
                                    <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirst + 1} to {Math.min(indexOfLast, filteredEmployees.length)} of {filteredEmployees.length} entries
                                    </div>
                                    {totalPages > 1 && (
                                        <nav>
                                            <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                    <button type="button" className="page-link" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} style={{ border: 'none', background: 'none' }}>
                                                        <i className="la la-angle-left" />
                                                    </button>
                                                </li>
                                                {Array.from({ length: totalPages }, (_, i) => {
                                                    const page = i + 1;
                                                    if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                                                        return (
                                                            <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                                                                <button type="button" className="page-link" onClick={() => setCurrentPage(page)} style={{ border: 'none' }}>{page}</button>
                                                            </li>
                                                        );
                                                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                                                        return (
                                                            <li key={page} className="page-item disabled">
                                                                <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                                            </li>
                                                        );
                                                    }
                                                    return null;
                                                })}
                                                <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                                    <button type="button" className="page-link" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} style={{ border: 'none', background: 'none' }}>
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
                </div>
            </div>

            <CandidateLoginModal
                show={loginModal.show}
                onHide={handleCloseLoginModal}
                candidate={loginModal.employee ? {
                    id: loginModal.employee.candidate_id,
                    full_name: loginModal.employee.full_name,
                    email: loginModal.employee.user_email || loginModal.employee.email,
                    has_login: loginModal.employee.has_login,
                    user_email: loginModal.employee.user_email,
                    user_id: loginModal.employee.user,
                    user_is_active: loginModal.employee.user_is_active !== false,
                } : null}
                onSaved={fetchEmployees}
            />

            <EmployeeDetailModal
                show={detailModal.show}
                onHide={handleCloseDetailModal}
                candidateId={detailModal.candidateId}
                employeeId={detailModal.employeeId}
                employeeName={detailModal.employeeName}
                onUpdate={fetchEmployees}
            />
        </div>
    );
};

export default EmployeeList;
