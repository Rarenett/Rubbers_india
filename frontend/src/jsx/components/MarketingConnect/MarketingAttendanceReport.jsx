import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Spinner, Form, Button, Pagination } from 'react-bootstrap';
import axiosInstance from '../../../services/axiosInstance';
import { usePageTitle } from '../../../context/TitleContext';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';

const MarketingAttendanceReport = () => {
    usePageTitle("Attendance Report - Marketing Connect");
    
    const [loading, setLoading] = useState(false);
    const [attendances, setAttendances] = useState([]);
    const [filterDate, setFilterDate] = useState('');
    
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    useEffect(() => {
        setCurrentPage(1);
        fetchAttendance();
    }, [filterDate]);

    const totalPages = Math.ceil(attendances.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = attendances.slice(indexOfFirstItem, indexOfLastItem);

    const fetchAttendance = async () => {
        setLoading(true);
        try {
            const response = await axiosInstance.get(`/api/project/marketing/attendance/daily_report/?date=${filterDate}`);
            setAttendances(response.data);
        } catch (error) {
            console.error('Error fetching attendance report:', error);
        } finally {
            setLoading(false);
        }
    };

    const getExportData = () => {
        return attendances.map((a, index) => {
            const dateParts = a.attendance_date ? a.attendance_date.split('-') : [];
            const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : a.attendance_date;
            return {
                slNo: index + 1,
                employee_id: a.employee_id,
                employee_name: a.employee_name || 'N/A',
                date: formattedDate,
                session: a.session_type || 'First Sign In',
                time_in: a.attendance_time,
                time_out: a.sign_out_time || '-',
                status: a.status
            };
        });
    };

    const columns = [
        { header: 'Sl No', dataKey: 'slNo' },
        { header: 'ID', dataKey: 'employee_id' },
        { header: 'Employee', dataKey: 'employee_name' },
        { header: 'Date', dataKey: 'date' },
        { header: 'Session', dataKey: 'session' },
        { header: 'Time In', dataKey: 'time_in' },
        { header: 'Time Out', dataKey: 'time_out' },
        { header: 'Status', dataKey: 'status' }
    ];

    const handleExportExcel = () => {
        exportToExcel(getExportData(), columns, `Attendance_Report_${filterDate}.xlsx`);
    };

    const handleExportPDF = () => {
        exportToPDF(getExportData(), columns, `Attendance_Report_${filterDate}.pdf`, `Attendance Report - ${filterDate}`);
    };

    const handlePrint = () => {
        printData(getExportData(), columns, `Attendance Report - ${filterDate}`);
    };

    return (
        <div className="container-fluid">
            <style>
                {`
                @media print {
                    .no-print { display: none !important; }
                    .card { border: none !important; box-shadow: none !important; }
                }
                `}
            </style>
            <div className="row page-titles mx-0 no-print">
                <div className="col-sm-6 p-md-0">
                    <div className="welcome-text">
                        <h4>Attendance Report</h4>
                        <p className="mb-0">View all attendance check-ins and check-outs.</p>
                    </div>
                </div>
            </div>

            <Row>
                <Col lg={12}>
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center">
                            <Card.Title>Attendance Records</Card.Title>
                            <div className="d-flex gap-3 align-items-center justify-content-end flex-shrink-0 no-print">
                                <Form.Group className="d-flex align-items-center mb-0">
                                    <Form.Control 
                                        type="date" 
                                        value={filterDate}
                                        onChange={(e) => setFilterDate(e.target.value)}
                                        style={{ maxWidth: '180px' }}
                                    />
                                </Form.Group>
                                
                                <div className="d-flex gap-2">
                                    <button className="btn btn-sm btn-light border" onClick={handleExportPDF} title="Export PDF">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                    </button>
                                    <button className="btn btn-sm btn-light border" onClick={handleExportExcel} title="Export Excel">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
                                    </button>
                                    <button className="btn btn-sm btn-light border" onClick={handlePrint} title="Print">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                    </button>
                                </div>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            {loading ? (
                                <div className="text-center py-5">
                                    <Spinner animation="border" variant="primary" />
                                </div>
                            ) : (
                                <>
                                <div className="table-responsive">
                                <table className="table w-100">
                                     <thead>
                                        <tr>
                                            <th style={{width: '50px'}}><strong>Sl No</strong></th>
                                            <th><strong>ID</strong></th>
                                            <th><strong>Employee</strong></th>
                                            <th><strong>Date</strong></th>
                                            <th><strong>Session</strong></th>
                                            <th><strong>Time In</strong></th>
                                            <th><strong>Time Out</strong></th>
                                            <th><strong>Status</strong></th>
                                            <th><strong>Photo</strong></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentItems.length > 0 ? (
                                            currentItems.map((item, index) => {
                                                const dateParts = item.attendance_date ? item.attendance_date.split('-') : [];
                                                const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : item.attendance_date;
                                                
                                                let badgeClass = 'badge-secondary';
                                                if (item.status === 'Completed' || item.status === 'Present') {
                                                    badgeClass = 'badge-success';
                                                } else if (item.status === 'Active (Working)') {
                                                    badgeClass = 'badge-primary';
                                                } else if (item.status === 'Absent') {
                                                    badgeClass = 'badge-danger';
                                                }

                                                return (
                                                    <tr key={index}>
                                                        <td><strong>{indexOfFirstItem + index + 1}</strong></td>
                                                        <td>{item.employee_id}</td>
                                                        <td>{item.employee_name || 'N/A'}</td>
                                                        <td>{formattedDate}</td>
                                                        <td>
                                                            <span className="badge badge-light border text-dark">
                                                                {item.session_type || 'First Sign In'}
                                                            </span>
                                                        </td>
                                                        <td>{item.attendance_time}</td>
                                                        <td>{item.sign_out_time || '-'}</td>
                                                        <td>
                                                            <span className={`badge ${badgeClass}`}>
                                                                {item.status}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            {item.selfie_image ? (
                                                                <a href={item.selfie_image} target="_blank" rel="noopener noreferrer">
                                                                    View Photo
                                                                </a>
                                                            ) : (
                                                                'No Photo'
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan="9" className="text-center">No attendance records found.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                                </div>
                                {totalPages > 1 && (
                                    <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap">
                                        <div className="mb-2">
                                            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, attendances.length)} of {attendances.length} entries
                                        </div>
                                        <nav>
                                <ul className="pagination pagination-gutter pagination-success no-bg mb-0">
                                    <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                        <button className="page-link" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}>
                                            <i className="la la-angle-left"></i>
                                        </button>
                                    </li>
                                    {Array.from({ length: totalPages }, (_, i) => (
                                        <li key={i + 1} className={`page-item ${currentPage === i + 1 ? 'active' : ''}`}>
                                            <button className="page-link" onClick={() => setCurrentPage(i + 1)}>{i + 1}</button>
                                        </li>
                                    ))}
                                    <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                        <button className="page-link" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}>
                                            <i className="la la-angle-right"></i>
                                        </button>
                                    </li>
                                </ul>
                            </nav>
                                    </div>
                                )}
                                </>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default MarketingAttendanceReport;
