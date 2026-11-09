import React, { useState, useEffect, Fragment } from 'react';
import { Card, Form } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import { getEmployees, getDepartments } from '../../../../services/HRManagementService';
import { usePermission } from '../../../../hooks/usePermission';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as ExcelJS from 'exceljs';
import { fetchCompany } from '../../../../services/CompanyService';


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

const UserReport = () => {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDept, setSelectedDept] = useState(null);
    const [departments, setDepartments] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    
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

    


    const exportToPDF = () => {
        const doc = new jsPDF();
        doc.text("User Report", 14, 15);
        const tableColumn = ["ID", "Name", "Department", "Designation", "User ID", "Phone", "Login"];
        const tableRows = [];
        filteredEmployees.forEach(emp => {
            const empData = [
                emp.employee_id || '-',
                emp.full_name || '-',
                emp.department_name || '-',
                emp.designation_title || '-',
                emp.user_email || emp.email || '-',
                emp.mobile_number || '-',
                emp.is_online ? 'Active' : 'Inactive'
            ];
            tableRows.push(empData);
        });
        autoTable(doc, { head: [tableColumn], body: tableRows, startY: 20 });
        doc.save(`User_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const exportToExcel = async () => {
        try {
            let companyName = 'Company Name';
            try {
                const response = await fetchCompany();
                if (response.data && response.data.length > 0) {
                    companyName = response.data[0].name || companyName;
                } else if (response.data && response.data.name) {
                    companyName = response.data.name;
                }
            } catch (err) {
                console.error('Failed to fetch company details:', err);
            }

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('User Report');

            // Add Company Name
            worksheet.addRow([companyName]);
            worksheet.mergeCells('A1:G1');
            worksheet.getCell('A1').font = { size: 16, bold: true };
            worksheet.getCell('A1').alignment = { horizontal: 'center' };

            // Add Report Title
            worksheet.addRow(['User Report']);
            worksheet.mergeCells('A2:G2');
            worksheet.getCell('A2').font = { size: 14, bold: true };
            worksheet.getCell('A2').alignment = { horizontal: 'center' };

            // Add Export Date and Time
            const currentDateTime = new Date().toLocaleString();
            worksheet.addRow([`Exported on: ${currentDateTime}`]);
            worksheet.mergeCells('A3:G3');
            worksheet.getCell('A3').font = { size: 10, italic: true };
            worksheet.getCell('A3').alignment = { horizontal: 'right' };

            worksheet.addRow([]); // Blank row

            // Add Headers
            const headers = ['Employee ID', 'Full Name', 'Department', 'Designation', 'User ID', 'Phone', 'Login Status'];
            const headerRow = worksheet.addRow(headers);
            headerRow.font = { bold: true };
            headerRow.eachCell(cell => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE0E0E0' }
                };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });

            // Add Data
            filteredEmployees.forEach(emp => {
                const row = worksheet.addRow([
                    emp.employee_id || '-',
                    emp.full_name || '-',
                    emp.department_name || '-',
                    emp.designation_title || '-',
                    emp.user_email || emp.email || '-',
                    emp.mobile_number || '-',
                    emp.is_online ? 'Active' : 'Inactive'
                ]);
                row.eachCell(cell => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
            });

            // Auto-fit columns
            worksheet.columns.forEach(column => {
                let maxLength = 0;
                column.eachCell({ includeEmpty: true }, cell => {
                    const columnLength = cell.value ? cell.value.toString().length : 10;
                    if (columnLength > maxLength) {
                        maxLength = columnLength;
                    }
                });
                column.width = maxLength < 10 ? 10 : maxLength + 2;
            });

            // Save File
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `User_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
            anchor.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting to Excel:', error);
        }
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
                            <Card.Title className="mb-0">User Report</Card.Title>
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

                                <button
                                    className="btn btn-sm btn-light border"
                                    style={{ borderRadius: '6px', width: '38px', height: '38px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0' }}
                                    onClick={exportToPDF}
                                    title="Export to PDF"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                </button>
                                <button
                                    className="btn btn-sm btn-light border"
                                    style={{ borderRadius: '6px', width: '38px', height: '38px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0' }}
                                    onClick={exportToExcel}
                                    title="Export to Excel"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
                                </button>
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
                                                <th><strong>USER ID</strong></th>
                                                <th><strong>PHONE</strong></th>
                                                <th><strong>LOGIN</strong></th>
                                                
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
                                                            {emp.is_online
                                                                ? <span className="badge badge-success light">Active</span>
                                                                : <span className="badge badge-danger light">Inactive</span>
                                                            }
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

            
        </div>
    );
};

export default UserReport;
