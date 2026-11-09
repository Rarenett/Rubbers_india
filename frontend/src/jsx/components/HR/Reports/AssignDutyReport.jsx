import React, { useState, useEffect, Fragment } from 'react';
import { Card, Table, Form, Row, Col, Badge } from 'react-bootstrap';
import Swal from 'sweetalert2';

import {
    getAssignDuties
} from '../../../../services/HRManagementService';
import { useSelector } from 'react-redux';
import { exportToPDF, exportToExcel, printData, printDetailedData, exportDetailedToPDF } from '../../Assets/exportUtils';
import { formatDate } from '../../../../utils/dateUtils';
import '../../Assets/FileDashboard.css';

// Export button component
function ExportBtn({ onClick, title, children }) {
    const [hov, setHov] = useState(false);
    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
                onClick={onClick}
                onMouseEnter={() => setHov(true)}
                onMouseLeave={() => setHov(false)}
                style={{
                    width: 40, height: 40, border: 'none', background: '#eaeaea', borderRadius: '8px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', padding: 0, flexShrink: 0,
                    transition: 'all 0.2s ease',
                    transform: hov ? 'translateY(-2px)' : 'none',
                    boxShadow: hov ? '0 4px 6px rgba(0,0,0,0.1)' : 'none',
                }}
            >
                {children}
            </button>
            {hov && (
                <div style={{
                    position: 'absolute', bottom: 'calc(100% + 7px)', left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#111827', color: '#f9fafb',
                    fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                    padding: '4px 9px', borderRadius: 6,
                    pointerEvents: 'none', zIndex: 20,
                }}>
                    {title}
                    <div style={{
                        position: 'absolute', top: '100%', left: '50%',
                        transform: 'translateX(-50%)',
                        borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
                        borderTop: '5px solid #111827',
                    }} />
                </div>
            )}
        </div>
    );
}

// SVG Icons
const PdfIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
);
const ExcelIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
);

const PrintIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
);

const AssignDutyReport = () => {
    const [assignments, setAssignments] = useState([]);
    const [flattenedData, setFlattenedData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [loading, setLoading] = useState(true);

    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    // Current User from Redux
    const auth = useSelector(state => state.auth.auth);
    const currentUser = auth?.user;
    
    // Determine if the user is a standard employee
    const isSuperuser = currentUser?.is_superuser; // Removed is_staff to prevent basic admins from seeing all HR duties
    const role = (currentUser?.role || '').toLowerCase();
    const isAdmin = isSuperuser || role.includes('hr'); // Only superusers or explicit HR roles can see all
    const isStandardEmployee = !isAdmin;

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const assignRes = await getAssignDuties();
            
            const rawAssignments = assignRes.results || assignRes;
            setAssignments(rawAssignments);
            
            // Flatten the assignments so each row is (Employee -> Duty/Responsibility)
            const flatData = [];
            rawAssignments.forEach(assign => {
                if (assign.person_name_details && Array.isArray(assign.person_name_details)) {
                    assign.person_name_details.forEach(emp => {
                        flatData.push({
                            ...assign,
                            employee_id: emp.id,
                            user_id: emp.user_id,
                            employee_name: emp.name,
                            employee_department: emp.department_name,
                        });
                    });
                } else if (assign.person_name && Array.isArray(assign.person_name)) {
                    // Fallback if person_name_details is not fully populated but person_name has IDs
                    assign.person_name.forEach(empId => {
                        flatData.push({
                            ...assign,
                            employee_id: empId,
                            employee_name: `Employee #${empId}`,
                        });
                    });
                }
            });
            setFlattenedData(flatData);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to fetch data.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [flattenedData, searchQuery, isStandardEmployee, currentUser]);

    const applyFilters = () => {
        let filtered = [...flattenedData];

        // If standard employee, force filter to their own ID
        if (isStandardEmployee && currentUser) {
            filtered = filtered.filter(row => row.user_id === currentUser.id);
        }

        // Apply universal search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(row => {
                const empName = (row.employee_name || '').toLowerCase();
                const deptName = (row.employee_department || row.department_name_details || '').toLowerCase();
                const dutyName = (row.dutyname_name || '').toLowerCase();
                const resps = (row.responsibility_details ? row.responsibility_details.map(r => r.name).join(' ') : '').toLowerCase();
                const startDate = (row.start_date || '').toLowerCase();
                const endDate = (row.end_date || '').toLowerCase();
                
                return empName.includes(query) || 
                       deptName.includes(query) || 
                       dutyName.includes(query) || 
                       resps.includes(query) ||
                       startDate.includes(query) ||
                       endDate.includes(query);
            });
        }

        filtered.sort((a, b) => (a.employee_name || '').localeCompare(b.employee_name || ''));

        setFilteredData(filtered);
    };


    const exportColumns = [
        { header: "Employee Name", dataKey: "employee_name" },
        { header: "Department", dataKey: "department" },
        { header: "Duty Name", dataKey: "dutyname_name" },
        { header: "Responsibilities", dataKey: "responsibilities" },
        { header: "Start Date", dataKey: "start_date" },
        { header: "End Date", dataKey: "end_date" }
    ];

    const getExportData = () => {
        return filteredData.map(row => {
            const dutyText = row.dutyname_name 
                ? `${row.dutyname_name}${row.dutyname_remarks ? ` (${row.dutyname_remarks})` : ''}` 
                : '-';
            
            const respsText = row.responsibility_details && row.responsibility_details.length > 0
                ? row.responsibility_details.map(r => {
                    const ended = row.ended_statuses?.find(s => s.employee_id === row.employee_id && s.responsibility_id === r.id);
                    const endedText = ended && ended.end_date ? ` (Ended: ${formatDate(ended.end_date)})` : '';
                    return `${r.name}${r.remarks ? ` (${r.remarks})` : ''}${endedText}`;
                }).join(', ')
                : (row.responsibility?.length || 0);

            return {
                employee_name: row.employee_name,
                department: row.employee_department || row.department_name_details || '-',
                dutyname_name: dutyText,
                responsibilities: respsText,
                start_date: formatDate(row.start_date),
                end_date: formatDate(row.end_date)
            };
        });
    };

    const handleExportPDF = () => {
        exportToPDF(getExportData(), exportColumns, "duty_assignments_report.pdf", "Duty Assignments Report");
    };

    const handleExportExcel = () => {
        exportToExcel(getExportData(), exportColumns, "duty_assignments_report.xlsx");
    };

    const handlePrint = () => {
        printData(getExportData(), exportColumns, "Duty Assignments Report");
    };

    const handleDetailedPrint = () => {
        printDetailedData(filteredData, "Detailed Employee Duty Report");
    };

    const handleDetailedExportPDF = () => {
        exportDetailedToPDF(filteredData, "Detailed Employee Duty Report");
    };

    const groupedData = Object.values(filteredData.reduce((acc, row) => {
        if (!acc[row.employee_id]) {
            acc[row.employee_id] = {
                employee_id: row.employee_id,
                employee_name: row.employee_name,
                employee_department: row.employee_department || row.department_name_details || '-',
                duties: []
            };
        }
        acc[row.employee_id].duties.push(row);
        return acc;
    }, {}));

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentGroupedData = groupedData.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(groupedData.length / itemsPerPage);

    return (
        <div className="container-fluid">
            {/* <div className="page-titles">
                <button
                    onClick={() => window.history.back()}
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div> */}

            <Card>
                <Card.Header className="d-flex justify-content-between align-items-center border-bottom">
                    <div>
                        <h4 className="card-title mb-1">Duty Assignments Report</h4>
                        {/* <span className="text-muted fs-13">View and manage duty assignments across the organization</span> */}
                    </div>
                    <div className="d-flex gap-3 align-items-center">
                        <div className="input-group search-area right d-flex" style={{ width: '300px' }}>
                            <input 
                                type="text" 
                                className="form-control" 
                                placeholder="Search..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ border: '1.5px solid #e2e8f0', borderRadius: '8px' }}
                            />
                        </div>
                        <div className="d-flex gap-2">
                            {/* <ExportBtn onClick={handleExportPDF} title="Export Table PDF"><PdfIcon /></ExportBtn> */}
                            <ExportBtn onClick={handleDetailedExportPDF} title="Export Detailed PDF"><PdfIcon /></ExportBtn>
                            <ExportBtn onClick={handleExportExcel} title="Export Excel"><ExcelIcon /></ExportBtn>
                            <ExportBtn onClick={handleDetailedPrint} title="Detailed Print"><PrintIcon /></ExportBtn>
                            {/* <ExportBtn onClick={handlePrint} title="Print Table"><PrintIcon /></ExportBtn> */}
                        </div>
                    </div>
                </Card.Header>
                <Card.Body>

                    <div className="table-responsive">
                        <Table hover className="table-responsive-md text-nowrap">
                            <thead className="thead-light">
                                <tr>
                                    <th style={{ width: '80px', whiteSpace: 'nowrap' }}><strong>SL NO</strong></th>
                                    <th><strong>Employee Name</strong></th>
                                    <th><strong>Department</strong></th>
                                    <th><strong>Duty Name</strong></th>
                                    <th><strong>Responsibilities</strong></th>
                                    <th><strong>Start Date</strong></th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="text-center py-4">
                                            <div className="spinner-border text-primary" role="status">
                                                <span className="sr-only">Loading...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : currentGroupedData.length > 0 ? (
                                    currentGroupedData.map((empGroup, idx) => (
                                        <Fragment key={idx}>
                                            {empGroup.duties.map((row, dIdx) => (
                                                <tr key={`${idx}-${dIdx}`}>
                                                    {dIdx === 0 && (
                                                        <td rowSpan={empGroup.duties.length} style={{ verticalAlign: 'middle', borderBottom: '1px solid #e2e8f0' }}>
                                                            <strong>{indexOfFirstItem + idx + 1}</strong>
                                                        </td>
                                                    )}
                                                    {dIdx === 0 && (
                                                        <td rowSpan={empGroup.duties.length} style={{ verticalAlign: 'middle', borderBottom: '1px solid #e2e8f0' }}>
                                                            <strong>{empGroup.employee_name}</strong>
                                                        </td>
                                                    )}
                                                    {dIdx === 0 && (
                                                        <td rowSpan={empGroup.duties.length} style={{ verticalAlign: 'middle', borderBottom: '1px solid #e2e8f0' }}>
                                                            {empGroup.employee_department}
                                                        </td>
                                                    )}
                                                    <td style={{ verticalAlign: 'middle', borderTop: dIdx !== 0 ? '1px solid #e2e8f0' : undefined, borderBottom: dIdx === empGroup.duties.length - 1 ? '1px solid #e2e8f0' : undefined }}>
                                                        {(() => {
                                                            let dutyEndDate = null;
                                                            if (row.responsibility_details && row.responsibility_details.length > 0) {
                                                                const allEnded = row.responsibility_details.every(r => 
                                                                    row.ended_statuses?.find(s => s.employee_id === row.employee_id && s.responsibility_id === r.id && s.end_date)
                                                                );
                                                                if (allEnded) {
                                                                    const endDates = row.responsibility_details.map(r => {
                                                                        const ended = row.ended_statuses.find(s => s.employee_id === row.employee_id && s.responsibility_id === r.id);
                                                                        return ended.end_date;
                                                                    });
                                                                    dutyEndDate = endDates.sort().reverse()[0];
                                                                }
                                                            }
                                                            return (
                                                                <>
                                                                    <span className="text-dark fw-medium">
                                                                        {row.dutyname_name || '-'} 
                                                                        <span className="ms-2 text-primary fs-12">
                                                                            [{formatDate(row.start_date)}{dutyEndDate ? ` - ${formatDate(dutyEndDate)}` : ''}]
                                                                        </span>
                                                                    </span>
                                                                    {row.dutyname_remarks && <div className="text-muted fs-12 mt-1"><i>{row.dutyname_remarks}</i></div>}
                                                                </>
                                                            );
                                                        })()}
                                                    </td>
                                                    <td style={{ whiteSpace: 'normal', minWidth: '200px', verticalAlign: 'middle', borderTop: dIdx !== 0 ? '1px solid #e2e8f0' : undefined, borderBottom: dIdx === empGroup.duties.length - 1 ? '1px solid #e2e8f0' : undefined }}>
                                                        {row.responsibility_details && row.responsibility_details.length > 0 ? (
                                                            row.responsibility_details.map((r, i) => {
                                                                const ended = row.ended_statuses?.find(s => s.employee_id === row.employee_id && s.responsibility_id === r.id);
                                                                const isEnded = !!(ended && ended.end_date);
                                                                return (
                                                                    <span key={i} className={`badge ${isEnded ? 'badge-secondary' : 'badge-info'} light me-1 mb-1`} title={r.remarks || 'No remarks'}>
                                                                        {r.name} {r.remarks && <span style={{opacity: 0.8, fontSize: '0.85em'}}>({r.remarks})</span>}
                                                                        {isEnded && <span style={{fontSize: '0.8em', marginLeft: '4px'}}> (Ended: {formatDate(ended.end_date)})</span>}
                                                                    </span>
                                                                );
                                                            })
                                                        ) : (
                                                            <span className="text-muted">-</span>
                                                        )}
                                                    </td>
                                                    <td style={{ verticalAlign: 'middle', borderTop: dIdx !== 0 ? '1px solid #e2e8f0' : undefined, borderBottom: dIdx === empGroup.duties.length - 1 ? '1px solid #e2e8f0' : undefined }}>{formatDate(row.start_date)}</td>
                                                </tr>
                                            ))}
                                        </Fragment>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="6" className="text-center py-4 text-muted">
                                            No assignments found for the selected criteria.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </Table>
                    </div>
                    {groupedData.length > 0 && (
                        <div className="d-flex justify-content-between align-items-center mt-3 mb-3 px-3">
                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, groupedData.length)} of {groupedData.length} entries
                            </div>
                            {totalPages > 1 && (
                                <nav>
                                    <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                        <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                            <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ border: 'none', background: 'none' }}>
                                                <i className="la la-angle-left" />
                                            </button>
                                        </li>
                                        {Array.from({ length: totalPages }, (_, index) => {
                                            const pageNumber = index + 1;
                                            if (
                                                pageNumber === 1 ||
                                                pageNumber === totalPages ||
                                                (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                                            ) {
                                                return (
                                                    <li key={pageNumber} className={`page-item ${currentPage === pageNumber ? 'active' : ''}`}>
                                                        <button type="button" className="page-link" onClick={() => setCurrentPage(pageNumber)} style={{ border: 'none' }}>
                                                            {pageNumber}
                                                        </button>
                                                    </li>
                                                );
                                            } else if (
                                                pageNumber === currentPage - 2 ||
                                                pageNumber === currentPage + 2
                                            ) {
                                                return (
                                                    <li key={pageNumber} className="page-item disabled">
                                                        <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                                    </li>
                                                );
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
        </div>
    );
};

export default AssignDutyReport;
