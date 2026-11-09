import React, { useState, useEffect, Fragment } from 'react';
import { Card, Form, Button, Table, Spinner, Badge } from 'react-bootstrap';
import Select from 'react-select';
import MainSweetAlert from 'sweetalert2';
import ProductionService from '../../../services/ProductionService';
import { fetchCompany } from '../../../services/CompanyService';
import { usePageTitle } from '../../../context/TitleContext';
// import * as ExcelJS from 'exceljs/dist/exceljs.min.js';

const EmployeeAttendanceReport = () => {
    usePageTitle("Employee Attendance");
    const [fromDate, setFromDate] = useState(() => {
        const d = new Date();
        const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
        const yyyy = firstDay.getFullYear();
        const mm = String(firstDay.getMonth() + 1).padStart(2, '0');
        const dd = String(firstDay.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    });
    const [toDate, setToDate] = useState(() => {
        const d = new Date();
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const yyyy = lastDay.getFullYear();
        const mm = String(lastDay.getMonth() + 1).padStart(2, '0');
        const dd = String(lastDay.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    });
    const [employeeId, setEmployeeId] = useState('');
    const [employees, setEmployees] = useState([]);
    
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        fetchEmployees();
    }, []);

    useEffect(() => {
        if (fromDate && toDate) {
            fetchReportData();
        }
    }, [fromDate, toDate, employeeId]);

    const fetchEmployees = async () => {
        try {
            const response = await ProductionService.getEmployees();
            setEmployees(response.data);
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    };

    const fetchReportData = async () => {
        setLoading(true);
        try {
            let params = `?from_date=${fromDate}&to_date=${toDate}`;
            if (employeeId) {
                params += `&employee_id=${employeeId}`;
            }
            const response = await ProductionService.getAttendanceEmployeeReport(params);
            setReportData(response.data || []);
            setCurrentPage(1);
        } catch (error) {
            console.error('Error fetching employee report data:', error);
            MainSweetAlert.fire('Error', 'Failed to fetch attendance report', 'error');
        } finally {
            setLoading(false);
        }
    };

    const safeReportData = Array.isArray(reportData) ? reportData : [];
    const totalPages = Math.ceil(safeReportData.length / itemsPerPage);
    const indexOfFirst = (currentPage - 1) * itemsPerPage;
    const indexOfLast = indexOfFirst + itemsPerPage;
    const currentReportData = safeReportData.slice(indexOfFirst, indexOfLast);

    const handleExportExcel = async () => {
        MainSweetAlert.fire('Info', 'Export is temporarily disabled', 'info');
    };

    const safeEmployees = Array.isArray(employees) ? employees : (employees && employees.results ? employees.results : []);
    const hasProdDepts = safeEmployees.some(emp => emp?.department_name && String(emp.department_name).toLowerCase().includes('production'));
    const filteredEmps = hasProdDepts
        ? safeEmployees.filter(emp => emp?.department_name && String(emp.department_name).toLowerCase().includes('production'))
        : safeEmployees;
    const employeeOptions = filteredEmps.map(emp => {
        const name = emp.full_name || emp.user_name || (emp.employee_details ? emp.employee_details.user_name : '') || (emp.user ? emp.user.username : `Employee ${emp.id}`);
        return {
            value: emp.id,
            label: `${name}`
        };
    });

    return (
        <div className="container-fluid">
            <style>{`
                .ear-export-btn {
                    height: 38px;
                    width: 38px;
                    border-radius: 6px;
                    min-width: 38px;
                    background-color: #f8fafc;
                    border: 1px solid #e2e8f0;
                }
                .ear-export-btn:hover {
                    background-color: #f1f5f9;
                }
                [data-theme-version="dark"] .ear-export-btn {
                    background-color: #24292D !important;
                    border-color: #3d464e !important;
                }
                [data-theme-version="dark"] .ear-export-btn:hover {
                    background-color: #2F363E !important;
                }
                [data-theme-version="dark"] .react-select__control {
                    background-color: #24292D !important;
                    border-color: #4a5568 !important;
                    color: #fff !important;
                }
                [data-theme-version="dark"] .react-select__menu {
                    background-color: #2F363E !important;
                }
                [data-theme-version="dark"] .react-select__option {
                    background-color: transparent !important;
                    color: #fff !important;
                }
                [data-theme-version="dark"] .react-select__option:hover {
                    background-color: #3d464e !important;
                }
                [data-theme-version="dark"] .react-select__single-value {
                    color: #fff !important;
                }
                [data-theme-version="dark"] .react-select__input-container {
                    color: #fff !important;
                }
            `}</style>
            <div className="row">
                <div className="col-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <Card.Title>Employee Wise Attendance</Card.Title>
                            <div className="d-flex align-items-center flex-wrap gap-2">
                                <Form.Control
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                    style={{ height: '38px', fontSize: '13px', borderRadius: '6px', minWidth: '130px', flex: '1 1 130px' }}
                                />
                                <Form.Control
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => setToDate(e.target.value)}
                                    style={{ height: '38px', fontSize: '13px', borderRadius: '6px', minWidth: '130px', flex: '1 1 130px' }}
                                />
                                <div style={{ minWidth: '200px', flex: '1 1 200px' }}>
                                    <Select
                                        classNamePrefix="react-select"
                                        options={employeeOptions}
                                        value={employeeOptions.find(opt => String(opt.value) === String(employeeId)) || null}
                                        onChange={(selectedOption) => setEmployeeId(selectedOption ? selectedOption.value : '')}
                                        placeholder="All Employees"
                                        isClearable
                                        styles={{
                                            control: (base) => ({
                                                ...base,
                                                height: '38px',
                                                minHeight: '38px',
                                                borderRadius: '6px',
                                                fontSize: '13px'
                                            }),
                                            menu: (base) => ({
                                                ...base,
                                                fontSize: '13px',
                                                zIndex: 100
                                            })
                                        }}
                                    />
                                </div>

                                <button 
                                    className="ear-export-btn p-0 d-flex align-items-center justify-content-center" 
                                    onClick={handleExportExcel} 
                                    title="Export Excel" 
                                    disabled={loading || safeReportData.length === 0}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
                                </button>
                            </div>
                        </Card.Header>
                        <Card.Body>

                            {loading ? (
                                <div className="text-center p-5">
                                    <Spinner animation="border" variant="primary" />
                                    <p className="mt-2 text-muted">Aggregating attendance records...</p>
                                </div>
                            ) : (
                                <Fragment>
                                <Table responsive hover className="mb-0">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '50px' }}>SL No</th>
                                            <th>Code</th>
                                            <th>Name</th>
                                            <th className="text-center">Total Working Hours</th>
                                            <th className="text-center">Total Break</th>
                                            <th className="text-center">Late Hours</th>
                                            <th className="text-center">Present Hours</th>
                                            <th className="text-center">OT Hours</th>
                                            <th className="text-center">Net Hours</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {safeReportData.length === 0 ? (
                                             <tr>
                                                <td colSpan="9" className="text-center py-4 text-muted">No attendance logs found in this range.</td>
                                            </tr>
                                        ) : (
                                            currentReportData.map((s, idx) => (
                                                <tr key={s.employee_id || idx}>
                                                    <td>{indexOfFirst + idx + 1}</td>
                                                    <td><strong>{s.employee_code}</strong></td>
                                                    <td>{s.employee_name}</td>
                                                    <td className="text-center">{s.total_working_hours === '00:00' ? '-' : s.total_working_hours}</td>
                                                    <td className="text-center text-danger">{s.total_break_hours === '00:00' ? '-' : s.total_break_hours}</td>
                                                    <td className="text-center text-warning">{s.late_hours === '00:00' ? '-' : s.late_hours}</td>
                                                    <td className="text-center text-success"><strong>{s.present_hours === '00:00' ? '-' : s.present_hours}</strong></td>
                                                    <td className="text-center text-info font-w600">{s.ot_hours === '00:00' ? '-' : s.ot_hours}</td>
                                                    <td className="text-center font-w600">{s.net_hours === '00:00' ? '-' : s.net_hours}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </Table>
                                {safeReportData.length > 0 && (
                                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mt-4 mb-3">
                                        <div className="text-muted" style={{ fontSize: '13px' }}>
                                            Showing {indexOfFirst + 1} to {Math.min(indexOfLast, safeReportData.length)} of {safeReportData.length} entries
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
                                </Fragment>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default EmployeeAttendanceReport;
